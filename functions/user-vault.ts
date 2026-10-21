import { DurableObject } from "cloudflare:workers";

import { hashRecoveryCode, hashToken, isAllowedEmail, matchesHash, MAX_MFA_ATTEMPTS, MAX_SESSIONS, MFA_LOCK_MS, PENDING_MFA_TTL_MS, SESSION_TTL_MS, type AttemptState, type MfaState, type PendingMfa, type SessionRecord } from "./_lib/auth-gate";
import { answerWithEvidence, retrieveSegments, type CalendarContextEvent } from "./_lib/chat";
import { DEMO_MARKDOWN } from "./_lib/demo";
import { aiConfigured } from "./_lib/ai";
import { extractObligations } from "./_lib/extraction";
import { deleteEvent, findEventByObligation, googleAuthUrl, googleConfigured, googleExchangeCode, googleRefresh, insertEvent, listCalendars, listUpcomingEvents, patchEvent, publicOrigin, type EventPayload, type GoogleTokens } from "./_lib/google";
import { parseWisprMarkdown, segmentTranscript } from "./_lib/markdown";
import { KEYWORD_COUNT, scanTranscriptSignals, type SignalCategory } from "./_lib/signals";
import { DEFAULT_WISPR_MCP_URL, McpClient, discoverAuthServer, exchangeMcpCode, pickArgs, refreshMcpTokens, registerClient, transcriptFrom, type McpTokens, type McpTool } from "./_lib/mcp";
import type { Course, Env, Meeting, Obligation, ObligationStatus, ObligationType, ParsedMeeting, SourceType, TranscriptSegment } from "./_lib/types";
import { OBLIGATION_TYPES } from "./_lib/types";
import { diagnoseTotpDrift, newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, otpauthUrl, verifyTotp } from "./_lib/totp";
import { ApiError, errorResponse, json, newId, normalizeText, nowIso, pkcePair, randomToken, safeJsonParse, sha256, withBackoff } from "./_lib/util";

interface Profile {
  timezone: string;
  school_name: string;
  default_calendar_id: string;
  onboarding_done: boolean;
  created_at: string;
}

interface SyncState {
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  imported_count: number;
  cursor: string | null;
  running: boolean;
}

interface PendingOAuth {
  provider: "google" | "wispr";
  nonce: string;
  verifier: string;
  created_at: number;
  meta?: unknown;
  client_id?: string;
  client_secret?: string;
}

interface SignalRow {
  id: string;
  user_id: string;
  meeting_id: string;
  segment_id: string;
  segment_index: number;
  category: SignalCategory;
  trigger_phrase: string;
  excerpt: string;
  date_phrase: string;
  resolved_date: string | null;
  score: number;
  status: "flagged" | "covered" | "dismissed" | "promoted";
  linked_obligation_id: string | null;
  fingerprint: string;
  created_at: string;
}

/** Maps a deterministic signal category onto the closest obligation type. */
const CATEGORY_TO_TYPE: Record<string, ObligationType> = {
  assessment: "test",
  assignment: "homework",
  reading: "reading",
  project: "project_milestone",
  presentation: "presentation",
  logistics: "appointment",
  materials: "material",
  deadline: "assignment",
  schedule_change: "appointment",
  future_mention: "assignment",
};

interface WisprConnection {
  server_url: string;
  tokens: McpTokens;
  tools: string[];
  connected_at: string;
}

/** Continuous catch-up polling: new Notetaker meetings land within ~10 minutes of finishing. */
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
/** Backoff base after a failed scheduled sync. */
const SYNC_RETRY_BASE_MS = 5 * 60 * 1000;

export class UserVault extends DurableObject<Env> {
  private calendarLocks = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL DEFAULT '', teacher TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT 'sage', meeting_keywords TEXT NOT NULL DEFAULT '', typical_schedule TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, external_wispr_id TEXT, course_id TEXT, source_type TEXT NOT NULL, title TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, attendees_json TEXT NOT NULL DEFAULT '[]', summary TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', transcript TEXT NOT NULL DEFAULT '', transcript_hash TEXT NOT NULL, processing_status TEXT NOT NULL DEFAULT 'pending', processing_error TEXT, imported_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS meetings_ext ON meetings(external_wispr_id);
      CREATE TABLE IF NOT EXISTS segments (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, user_id TEXT NOT NULL, speaker TEXT NOT NULL, started_at_offset INTEGER, ended_at_offset INTEGER, text TEXT NOT NULL, segment_index INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS segments_meeting ON segments(meeting_id, segment_index);
      CREATE TABLE IF NOT EXISTS obligations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, meeting_id TEXT NOT NULL, course_id TEXT, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', due_at TEXT, all_day INTEGER NOT NULL DEFAULT 1, timezone TEXT NOT NULL, confidence REAL NOT NULL, status TEXT NOT NULL, evidence_excerpt TEXT NOT NULL, evidence_segment_ids TEXT NOT NULL DEFAULT '[]', raw_date_phrase TEXT NOT NULL DEFAULT '', date_reasoning TEXT NOT NULL DEFAULT '', provider_event_id TEXT, calendar_dirty INTEGER NOT NULL DEFAULT 0, fingerprint TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS obligations_meeting ON obligations(meeting_id);
      CREATE TABLE IF NOT EXISTS calendar_actions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, obligation_id TEXT NOT NULL, action TEXT NOT NULL, previous_payload_json TEXT, proposed_payload_json TEXT, provider_event_id TEXT, status TEXT NOT NULL, error TEXT, executed_at TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chat_threads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, cited_meeting_ids TEXT NOT NULL DEFAULT '[]', cited_segment_ids TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS signals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, meeting_id TEXT NOT NULL, segment_id TEXT NOT NULL, segment_index INTEGER NOT NULL, category TEXT NOT NULL, trigger_phrase TEXT NOT NULL, excerpt TEXT NOT NULL, date_phrase TEXT NOT NULL DEFAULT '', resolved_date TEXT, score INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'flagged', linked_obligation_id TEXT, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS signals_meeting ON signals(meeting_id);
      CREATE UNIQUE INDEX IF NOT EXISTS signals_fp ON signals(fingerprint);
    `);
  }

  private get userId(): string {
    return this.ctx.id.name ?? "";
  }

  /** Origin of the request currently being served, used to build absolute OAuth URLs. */
  private requestOrigin: string | undefined;

  // ---------- two-factor gate ----------
  private async getMfa(): Promise<MfaState | null> {
    return (await this.ctx.storage.get<MfaState>("mfa")) ?? null;
  }

  private async getSessions(): Promise<Record<string, SessionRecord>> {
    return (await this.ctx.storage.get<Record<string, SessionRecord>>("sessions")) ?? {};
  }

  /**
   * Validates the opaque session token minted after a successful TOTP challenge
   * and slides its last-seen timestamp forward so active use keeps you signed in.
   */
  private async touchSession(token: string | null): Promise<boolean> {
    if (!token || token.length < 20) return false;
    const key = await hashToken(token);
    const sessions = await this.getSessions();
    const record = sessions[key];
    if (!record) return false;
    if (record.expires_at < Date.now()) {
      delete sessions[key];
      await this.ctx.storage.put("sessions", sessions);
      return false;
    }
    const seen = new Date(record.last_seen_at).getTime();
    if (Date.now() - seen > 60 * 60_000) {
      sessions[key] = { ...record, last_seen_at: nowIso(), expires_at: Date.now() + SESSION_TTL_MS };
      await this.ctx.storage.put("sessions", sessions);
    }
    return true;
  }

  private async mintSession(label: string): Promise<string> {
    const token = randomToken(32);
    const sessions = await this.getSessions();
    const entries = Object.entries(sessions).filter(([, s]) => s.expires_at > Date.now());
    entries.sort((a, b) => b[1].last_seen_at.localeCompare(a[1].last_seen_at));
    const kept = Object.fromEntries(entries.slice(0, MAX_SESSIONS - 1));
    kept[await hashToken(token)] = { created_at: nowIso(), last_seen_at: nowIso(), expires_at: Date.now() + SESSION_TTL_MS, label: label.slice(0, 80) };
    await this.ctx.storage.put("sessions", kept);
    await this.ctx.storage.delete("mfa_attempts");
    return token;
  }

  /** Throttles code guessing: 8 wrong codes locks the challenge for 15 minutes. */
  private async guardAttempts(): Promise<void> {
    const state = (await this.ctx.storage.get<AttemptState>("mfa_attempts")) ?? { count: 0, first_at: Date.now(), locked_until: 0 };
    if (state.locked_until > Date.now()) {
      const mins = Math.ceil((state.locked_until - Date.now()) / 60_000);
      throw new ApiError(429, "MFA_LOCKED", `Too many incorrect codes. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
    }
  }

  private async recordFailedAttempt(): Promise<void> {
    const prev = (await this.ctx.storage.get<AttemptState>("mfa_attempts")) ?? { count: 0, first_at: Date.now(), locked_until: 0 };
    const fresh = Date.now() - prev.first_at > MFA_LOCK_MS ? { count: 0, first_at: Date.now(), locked_until: 0 } : prev;
    const count = fresh.count + 1;
    await this.ctx.storage.put("mfa_attempts", {
      count,
      first_at: fresh.first_at,
      locked_until: count >= MAX_MFA_ATTEMPTS ? Date.now() + MFA_LOCK_MS : 0,
    } satisfies AttemptState);
  }

  /**
   * Turns a rejected code into an actionable message. A code that matches the
   * secret at a distant counter means the phone's clock is off, not that the
   * user typed the wrong thing — the generic "wrong code" text sent people in
   * circles re-scanning a QR that was never the problem.
   */
  private async explainBadCode(secret: string, code: string, setup = false): Promise<string> {
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) return "Enter all 6 digits from your authenticator app.";
    const drift = await diagnoseTotpDrift(secret, digits);
    if (drift !== null) {
      const ahead = drift > 0;
      const mins = Math.round(Math.abs(drift) / 60);
      const amount = mins >= 1 ? `${mins} minute${mins === 1 ? "" : "s"}` : `${Math.abs(drift)} seconds`;
      return `That code is correct, but your phone's clock is ${amount} ${ahead ? "ahead of" : "behind"} real time, so it arrived outside the valid window. On your phone open Settings → General → Date & Time and turn on "Set automatically" (in Google Authenticator: Settings → Time correction for codes → Sync now), then try again.`;
    }
    return setup
      ? "That code doesn't match the QR code shown here. Delete any older NeverNote entry in your authenticator, scan this QR again, then enter the current 6 digits."
      : "That code doesn't match this account's authenticator. If you re-installed your authenticator app or moved phones, its NeverNote entry is gone — use a recovery code below to get back in and re-enroll.";
  }

  private async authStatus(request: Request): Promise<Response> {
    const mfa = await this.getMfa();
    const attempts = await this.ctx.storage.get<AttemptState>("mfa_attempts");
    const sessionValid = await this.touchSession(request.headers.get("X-NeverNote-Session"));
    const sessions = await this.getSessions();
    return json({
      email: request.headers.get("X-Rork-User-Email") ?? null,
      mfa_enrolled: Boolean(mfa),
      enrolled_at: mfa?.enrolled_at ?? null,
      session_valid: sessionValid,
      active_sessions: Object.values(sessions).filter((s) => s.expires_at > Date.now()).length,
      recovery_codes_left: mfa ? mfa.recovery_hashes.filter((h) => h.length > 0).length : 0,
      locked_until: attempts?.locked_until && attempts.locked_until > Date.now() ? new Date(attempts.locked_until).toISOString() : null,
    });
  }

  /** First-run only: hands back a fresh secret + otpauth URI for the QR code. */
  private async mfaSetup(request: Request): Promise<Response> {
    if (await this.getMfa()) {
      throw new ApiError(409, "MFA_ALREADY_ENROLLED", "Two-factor is already set up. Enter a code from your authenticator, or use a recovery code.");
    }
    const secret = newTotpSecret();
    await this.ctx.storage.put("pending_mfa", { secret, created_at: Date.now() } satisfies PendingMfa);
    const account = request.headers.get("X-Rork-User-Email") ?? "owner";
    return json({ secret, otpauth_url: otpauthUrl(secret, account), account, issuer: "NeverNote", digits: 6, period: 30 });
  }

  /** Confirms the authenticator is in sync, activates 2FA, and opens a session. */
  private async mfaEnroll(request: Request, body: { code?: string }): Promise<Response> {
    if (await this.getMfa()) throw new ApiError(409, "MFA_ALREADY_ENROLLED", "Two-factor is already set up.");
    await this.guardAttempts();
    const pending = await this.ctx.storage.get<PendingMfa>("pending_mfa");
    if (!pending || Date.now() - pending.created_at > PENDING_MFA_TTL_MS) {
      await this.ctx.storage.delete("pending_mfa");
      throw new ApiError(400, "MFA_SETUP_EXPIRED", "That setup code expired. Start the setup again to get a fresh QR code.");
    }
    const counter = await verifyTotp(pending.secret, body.code ?? "");
    if (counter === null) {
      await this.recordFailedAttempt();
      throw new ApiError(400, "MFA_INVALID", await this.explainBadCode(pending.secret, body.code ?? "", true));
    }
    const recovery = newRecoveryCodes(8);
    const recoveryHashes: string[] = [];
    for (const code of recovery) recoveryHashes.push(await hashRecoveryCode(normalizeRecoveryCode(code)));
    await this.ctx.storage.put("mfa", {
      secret: pending.secret,
      enrolled_at: nowIso(),
      last_counter: counter,
      recovery_hashes: recoveryHashes,
      recovery_used: 0,
    } satisfies MfaState);
    await this.ctx.storage.delete("pending_mfa");
    const token = await this.mintSession(request.headers.get("User-Agent") ?? "browser");
    return json({ ok: true, session_token: token, recovery_codes: recovery, expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  }

  /** Every later sign-in: 6-digit code (or a one-time recovery code) for a session. */
  private async mfaVerify(request: Request, body: { code?: string; recovery_code?: string }): Promise<Response> {
    await this.guardAttempts();
    const mfa = await this.getMfa();
    if (!mfa) throw new ApiError(409, "MFA_SETUP_REQUIRED", "Two-factor isn't set up yet on this vault.");

    if (body.recovery_code) {
      const candidate = await hashRecoveryCode(normalizeRecoveryCode(body.recovery_code));
      const idx = matchesHash(mfa.recovery_hashes, candidate);
      if (idx < 0) {
        await this.recordFailedAttempt();
        throw new ApiError(400, "MFA_INVALID", "That recovery code isn't valid or has already been used.");
      }
      const hashes = [...mfa.recovery_hashes];
      hashes[idx] = "";
      await this.ctx.storage.put("mfa", { ...mfa, recovery_hashes: hashes, recovery_used: mfa.recovery_used + 1 });
      const token = await this.mintSession(request.headers.get("User-Agent") ?? "browser");
      return json({ ok: true, used_recovery_code: true, recovery_codes_left: hashes.filter((h) => h.length > 0).length, session_token: token, expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
    }

    const counter = await verifyTotp(mfa.secret, body.code ?? "");
    if (counter === null) {
      await this.recordFailedAttempt();
      throw new ApiError(400, "MFA_INVALID", await this.explainBadCode(mfa.secret, body.code ?? ""));
    }
    // Replay protection must not reject a *newer* code just because a previous
    // login stored a counter from a clock-drifted one; only the exact same step
    // is a replay.
    if (counter === mfa.last_counter) {
      await this.recordFailedAttempt();
      throw new ApiError(400, "MFA_REPLAY", "That code was already used. Wait for your authenticator to show the next one, then enter it.");
    }
    await this.ctx.storage.put("mfa", { ...mfa, last_counter: Math.max(counter, mfa.last_counter) });
    const token = await this.mintSession(request.headers.get("User-Agent") ?? "browser");
    return json({ ok: true, used_recovery_code: false, session_token: token, expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  }

  private async authLogout(request: Request, all: boolean): Promise<Response> {
    if (all) {
      await this.ctx.storage.put("sessions", {});
      return json({ ok: true, signed_out: "all" });
    }
    const token = request.headers.get("X-NeverNote-Session");
    if (token) {
      const sessions = await this.getSessions();
      delete sessions[await hashToken(token)];
      await this.ctx.storage.put("sessions", sessions);
    }
    return json({ ok: true, signed_out: "this_device" });
  }

  /** Regenerates recovery codes; requires a live session plus a fresh TOTP code. */
  private async mfaRegenerateRecovery(body: { code?: string }): Promise<Response> {
    await this.guardAttempts();
    const mfa = await this.getMfa();
    if (!mfa) throw new ApiError(409, "MFA_SETUP_REQUIRED", "Two-factor isn't set up yet.");
    const counter = await verifyTotp(mfa.secret, body.code ?? "");
    if (counter === null) {
      await this.recordFailedAttempt();
      throw new ApiError(400, "MFA_INVALID", "Enter the current 6-digit code from your authenticator.");
    }
    const recovery = newRecoveryCodes(8);
    const recoveryHashes: string[] = [];
    for (const code of recovery) recoveryHashes.push(await hashRecoveryCode(normalizeRecoveryCode(code)));
    await this.ctx.storage.put("mfa", { ...mfa, recovery_hashes: recoveryHashes, recovery_used: 0, last_counter: Math.max(counter, mfa.last_counter) });
    return json({ ok: true, recovery_codes: recovery });
  }

  /** Removes the authenticator so a new device can be enrolled from scratch. */
  private async mfaReset(body: { code?: string; recovery_code?: string }): Promise<Response> {
    await this.guardAttempts();
    const mfa = await this.getMfa();
    if (!mfa) return json({ ok: true, mfa_enrolled: false });
    let allowed = false;
    if (body.recovery_code) {
      const candidate = await hashRecoveryCode(normalizeRecoveryCode(body.recovery_code));
      allowed = matchesHash(mfa.recovery_hashes, candidate) >= 0;
    } else {
      allowed = (await verifyTotp(mfa.secret, body.code ?? "")) !== null;
    }
    if (!allowed) {
      await this.recordFailedAttempt();
      throw new ApiError(400, "MFA_INVALID", "Confirm with a current code or an unused recovery code before removing two-factor.");
    }
    await this.ctx.storage.delete("mfa");
    await this.ctx.storage.delete("pending_mfa");
    await this.ctx.storage.put("sessions", {});
    return json({ ok: true, mfa_enrolled: false });
  }

  // ---------- storage helpers ----------
  private sql<T = Record<string, unknown>>(query: string, ...params: unknown[]): T[] {
    return this.ctx.storage.sql.exec<T & Record<string, SqlStorageValue>>(query, ...(params as SqlStorageValue[])).toArray() as T[];
  }
  private one<T>(query: string, ...params: unknown[]): T | null {
    return this.sql<T>(query, ...params)[0] ?? null;
  }
  private async getProfile(): Promise<Profile> {
    const p = await this.ctx.storage.get<Profile>("profile");
    return p ?? { timezone: "America/New_York", school_name: "", default_calendar_id: "", onboarding_done: false, created_at: nowIso() };
  }
  private async getSync(): Promise<SyncState> {
    return (await this.ctx.storage.get<SyncState>("sync")) ?? { last_sync_at: null, last_success_at: null, last_error: null, imported_count: 0, cursor: null, running: false };
  }
  private courses(): Course[] {
    return this.sql<Course>("SELECT * FROM courses ORDER BY name");
  }

  // ---------- router ----------
  override async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      this.requestOrigin = request.headers.get("X-NeverNote-Origin") ?? url.origin;
      const path = url.pathname.replace(/\/$/, "");
      const m = request.method;
      const seg = path.split("/").filter(Boolean);

      if (m === "POST" && path === "/diag/echo") {
        const parsed = (await request.json()) as Record<string, unknown>;
        return json({ ok: true, keys: Object.keys(parsed), ct: request.headers.get("content-type") });
      }

      // OAuth callbacks are authenticated by their signed state, not a session.
      const isOAuthCallback = path === "/google/callback" || path === "/wispr/callback";

      if (!isOAuthCallback && seg[0] === "auth") {
        if (m === "GET" && path === "/auth/status") return this.authStatus(request);
        if (m === "POST" && path === "/auth/mfa/setup") return this.mfaSetup(request);
        if (m === "POST" && path === "/auth/mfa/enroll") return this.mfaEnroll(request, await request.json());
        if (m === "POST" && path === "/auth/mfa/verify") return this.mfaVerify(request, await request.json());
        if (m === "POST" && path === "/auth/logout") return this.authLogout(request, false);
        if (m === "POST" && path === "/auth/logout-all") return this.authLogout(request, true);
        // Session-protected two-factor management.
        if (!(await this.touchSession(request.headers.get("X-NeverNote-Session")))) {
          throw new ApiError(401, "MFA_REQUIRED", "Enter your authenticator code to continue.");
        }
        if (m === "POST" && path === "/auth/mfa/recovery") return this.mfaRegenerateRecovery(await request.json());
        if (m === "POST" && path === "/auth/mfa/reset") return this.mfaReset(await request.json());
        return json({ error: "Not found", code: "NOT_FOUND" }, 404);
      }

      // Everything else needs a session created by a passed two-factor challenge.
      if (!isOAuthCallback && !(await this.touchSession(request.headers.get("X-NeverNote-Session")))) {
        const enrolled = Boolean(await this.getMfa());
        throw new ApiError(401, enrolled ? "MFA_REQUIRED" : "MFA_SETUP_REQUIRED", enrolled ? "Enter your authenticator code to unlock your vault." : "Set up two-factor authentication to unlock your vault.");
      }

      if (m === "GET" && path === "/me") return this.me(request);
      if (m === "PUT" && path === "/profile") return this.updateProfile(await request.json());
      if (m === "GET" && path === "/courses") return json({ courses: this.courses() });
      if (m === "POST" && path === "/courses") return this.upsertCourse(await request.json());
      if (m === "PUT" && seg[0] === "courses" && seg[1]) return this.upsertCourse({ ...(await request.json()) as object, id: seg[1] });
      if (m === "DELETE" && seg[0] === "courses" && seg[1]) {
        this.sql("DELETE FROM courses WHERE id = ?", seg[1]);
        this.sql("UPDATE meetings SET course_id = NULL WHERE course_id = ?", seg[1]);
        return json({ ok: true });
      }

      if (m === "POST" && path === "/import/markdown") return this.importMarkdown(await request.json());
      if (m === "POST" && path === "/demo/seed") return this.seedDemo();

      if (m === "GET" && path === "/meetings") return this.listMeetings(url);
      if (m === "GET" && seg[0] === "meetings" && seg[1] && !seg[2]) return this.getMeeting(seg[1]);
      if (m === "PATCH" && seg[0] === "meetings" && seg[1]) return this.patchMeeting(seg[1], await request.json());
      if (m === "DELETE" && seg[0] === "meetings" && seg[1]) return this.deleteMeeting(seg[1]);
      if (m === "POST" && seg[0] === "meetings" && seg[1] && seg[2] === "extract") {
        await this.runExtraction(seg[1], true);
        return this.getMeeting(seg[1]);
      }

      if (m === "GET" && path === "/obligations") return this.listObligations(url);
      if (m === "GET" && path === "/signals") return await this.listSignals(url);
      if (seg[0] === "signals" && seg[1]) {
        if (m === "POST" && seg[2] === "dismiss") return this.setSignalStatus(seg[1], "dismissed");
        if (m === "POST" && seg[2] === "restore") return this.setSignalStatus(seg[1], "flagged");
        if (m === "POST" && seg[2] === "promote") return this.promoteSignal(seg[1], await request.json());
      }
      if (seg[0] === "obligations" && seg[1]) {
        const id = seg[1];
        if (m === "PATCH" && !seg[2]) return this.editObligation(id, await request.json());
        if (m === "POST" && seg[2] === "reject") return this.setStatus(id, "rejected");
        if (m === "POST" && seg[2] === "ask") return this.setStatus(id, "needs_clarification");
        if (m === "POST" && seg[2] === "accept") return this.acceptObligation(id);
        if (m === "POST" && seg[2] === "calendar" && seg[3] === "preview") return json({ preview: await this.buildPreview(id) });
        if (m === "POST" && seg[2] === "calendar" && seg[3] === "create") return this.createCalendarEvent(id);
        if (m === "POST" && seg[2] === "calendar" && seg[3] === "update") return this.updateCalendarEvent(id);
        if (m === "POST" && seg[2] === "calendar" && seg[3] === "undo") return this.undoCalendarEvent(id);
      }
      if (m === "GET" && path === "/calendar-actions") return json({ actions: this.sql("SELECT * FROM calendar_actions ORDER BY created_at DESC LIMIT 200") });

      if (m === "GET" && path === "/chat/threads") return json({ threads: this.sql("SELECT * FROM chat_threads ORDER BY updated_at DESC") });
      if (m === "POST" && path === "/chat/threads") return this.createThread();
      if (m === "GET" && seg[0] === "chat" && seg[1] === "threads" && seg[2] && !seg[3]) return this.getThread(seg[2]);
      if (m === "DELETE" && seg[0] === "chat" && seg[1] === "threads" && seg[2]) {
        this.sql("DELETE FROM chat_messages WHERE thread_id = ?", seg[2]);
        this.sql("DELETE FROM chat_threads WHERE id = ?", seg[2]);
        return json({ ok: true });
      }
      if (m === "POST" && seg[0] === "chat" && seg[1] === "threads" && seg[2] && seg[3] === "messages") return this.askCoach(seg[2], await request.json());

      if (m === "GET" && path === "/digest") return this.digest(url.searchParams.get("period") === "week" ? "week" : "day");

      if (m === "POST" && path === "/google/connect") return this.googleConnect();
      if (m === "GET" && path === "/google/callback") return this.googleCallback(url);
      if (m === "GET" && path === "/google/calendars") return this.googleCalendars();
      if (m === "PUT" && path === "/google/calendar") return this.selectCalendar(await request.json());
      if (m === "DELETE" && path === "/google") {
        await this.ctx.storage.delete("google");
        return json({ ok: true });
      }

      if (m === "POST" && path === "/wispr/connect") return this.wisprConnect(await request.json());
      if (m === "GET" && path === "/wispr/callback") return this.wisprCallback(url);
      if (m === "POST" && path === "/wispr/sync") return this.wisprSync();
      if (m === "POST" && path === "/meetings/rescan") return this.rescanAll();
      if (m === "DELETE" && path === "/wispr") {
        await this.ctx.storage.delete("wispr");
        await this.ctx.storage.delete("wispr_backfilled");
        await this.env.DO.deleteAlarm("UserVault", this.userId).catch(() => undefined);
        return json({ ok: true });
      }

      if (m === "GET" && path === "/export") return this.exportAll();
      if (m === "DELETE" && path === "/account") return this.wipe();

      return json({ error: "Not found", code: "NOT_FOUND" }, 404);
    } catch (err) {
      return errorResponse(err);
    }
  }

  // ---------- profile / me ----------
  private async me(request: Request): Promise<Response> {
    const profile = await this.getProfile();
    const sync = await this.getSync();
    const google = await this.ctx.storage.get<GoogleTokens & { email?: string; connected_at: string }>("google");
    const wispr = await this.ctx.storage.get<WisprConnection>("wispr");
    const counts = this.one<{ meetings: number }>("SELECT COUNT(*) AS meetings FROM meetings") ?? { meetings: 0 };
    const pending = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM obligations WHERE status IN ('needs_review','needs_clarification')") ?? { n: 0 };
    const flagged = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM signals WHERE status = 'flagged'") ?? { n: 0 };
    const mfa = await this.getMfa();
    return json({
      user_id: this.userId,
      email: request.headers.get("X-Rork-User-Email") ?? null,
      security: { mfa_enrolled: Boolean(mfa), enrolled_at: mfa?.enrolled_at ?? null, recovery_codes_left: mfa ? mfa.recovery_hashes.filter((h) => h.length > 0).length : 0 },
      profile,
      counts: { meetings: counts.meetings, pending_review: pending.n, flagged_mentions: flagged.n },
      ai: { available: aiConfigured(this.env), keyword_count: KEYWORD_COUNT },
      courses: this.courses(),
      sync,
      connections: {
        google: { status: google ? "connected" : googleConfigured(this.env) ? "not_connected" : "needs_server_config", selected_calendar_id: profile.default_calendar_id || null, connected_at: google?.connected_at ?? null },
        wispr: {
          status: wispr ? "connected" : "not_connected",
          host: wispr ? new URL(wispr.server_url).host : null,
          tools: wispr?.tools ?? [],
          connected_at: wispr?.connected_at ?? null,
          // The MCP URL is known, so the user never has to paste anything.
          env_url_present: true,
          long_lived: wispr ? Boolean(wispr.tokens.refresh_token) : null,
        },
      },
    });
  }

  private async updateProfile(body: Partial<Profile>): Promise<Response> {
    const current = await this.getProfile();
    const next: Profile = {
      ...current,
      timezone: typeof body.timezone === "string" && body.timezone ? body.timezone : current.timezone,
      school_name: typeof body.school_name === "string" ? body.school_name.slice(0, 120) : current.school_name,
      default_calendar_id: typeof body.default_calendar_id === "string" ? body.default_calendar_id : current.default_calendar_id,
      onboarding_done: typeof body.onboarding_done === "boolean" ? body.onboarding_done : current.onboarding_done,
    };
    await this.ctx.storage.put("profile", next);
    return json({ profile: next });
  }

  private upsertCourse(body: Partial<Course>): Response {
    const name = (body.name ?? "").trim();
    if (!name) throw new ApiError(400, "VALIDATION", "Course name is required.");
    const id = body.id ?? newId("crs");
    const existing = this.one<Course>("SELECT * FROM courses WHERE id = ?", id);
    const row: Course = {
      id,
      user_id: this.userId,
      name: name.slice(0, 80),
      short_name: (body.short_name ?? existing?.short_name ?? "").slice(0, 16),
      teacher: (body.teacher ?? existing?.teacher ?? "").slice(0, 80),
      color: (body.color ?? existing?.color ?? "sage").slice(0, 20),
      meeting_keywords: (body.meeting_keywords ?? existing?.meeting_keywords ?? "").slice(0, 200),
      typical_schedule: (body.typical_schedule ?? existing?.typical_schedule ?? "").slice(0, 200),
      created_at: existing?.created_at ?? nowIso(),
    };
    this.sql(
      `INSERT INTO courses (id,user_id,name,short_name,teacher,color,meeting_keywords,typical_schedule,created_at) VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, short_name=excluded.short_name, teacher=excluded.teacher, color=excluded.color, meeting_keywords=excluded.meeting_keywords, typical_schedule=excluded.typical_schedule`,
      row.id, row.user_id, row.name, row.short_name, row.teacher, row.color, row.meeting_keywords, row.typical_schedule, row.created_at,
    );
    return json({ course: row });
  }

  private guessCourseId(title: string, transcript: string): string | null {
    const hay = `${title}\n${transcript.slice(0, 2000)}`.toLowerCase();
    let best: { id: string; score: number } | null = null;
    for (const c of this.courses()) {
      let score = 0;
      const keys = [c.name, c.short_name, c.teacher, ...c.meeting_keywords.split(/[,;]+/)].map((k) => k.trim().toLowerCase()).filter((k) => k.length > 1);
      for (const k of keys) {
        if (title.toLowerCase().includes(k)) score += 3;
        else if (hay.includes(k)) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
    }
    return best?.id ?? null;
  }

  // ---------- import ----------
  private async upsertParsedMeeting(parsed: ParsedMeeting, sourceType: SourceType, externalId: string | null): Promise<{ meeting: Meeting; changed: boolean; created: boolean }> {
    const hash = await sha256(`${parsed.title}\n${parsed.summary}\n${parsed.notes}\n${parsed.transcript}`);
    const startedAt = parsed.startedAt ?? nowIso();
    const existing = externalId
      ? this.one<Meeting>("SELECT * FROM meetings WHERE external_wispr_id = ?", externalId)
      : this.one<Meeting>("SELECT * FROM meetings WHERE transcript_hash = ?", hash);
    if (existing && existing.transcript_hash === hash) {
      return { meeting: existing, changed: false, created: false };
    }
    const now = nowIso();
    const id = existing?.id ?? newId("mtg");
    const courseId = existing?.course_id ?? this.guessCourseId(parsed.title, parsed.transcript);
    this.sql(
      `INSERT INTO meetings (id,user_id,external_wispr_id,course_id,source_type,title,started_at,ended_at,attendees_json,summary,notes,transcript,transcript_hash,processing_status,processing_error,imported_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',NULL,?,?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, started_at=excluded.started_at, ended_at=excluded.ended_at, attendees_json=excluded.attendees_json, summary=excluded.summary, notes=excluded.notes, transcript=excluded.transcript, transcript_hash=excluded.transcript_hash, processing_status='pending', processing_error=NULL, updated_at=excluded.updated_at`,
      id, this.userId, externalId, courseId, sourceType, parsed.title, startedAt, parsed.endedAt, JSON.stringify(parsed.attendees), parsed.summary, parsed.notes, parsed.transcript, hash, existing?.imported_at ?? now, now,
    );
    this.sql("DELETE FROM segments WHERE meeting_id = ?", id);
    parsed.segments.forEach((s, i) => {
      this.sql("INSERT INTO segments (id,meeting_id,user_id,speaker,started_at_offset,ended_at_offset,text,segment_index) VALUES (?,?,?,?,?,?,?,?)", newId("seg"), id, this.userId, s.speaker, s.offset, null, s.text, i);
    });
    const meeting = this.one<Meeting>("SELECT * FROM meetings WHERE id = ?", id);
    if (!meeting) throw new ApiError(500, "INTERNAL", "Meeting failed to save.");
    return { meeting, changed: true, created: !existing };
  }

  private async importMarkdown(body: { markdown?: string; source_type?: SourceType; course_id?: string | null }): Promise<Response> {
    const markdown = typeof body.markdown === "string" ? body.markdown : "";
    if (markdown.length > 1_500_000) throw new ApiError(413, "TOO_LARGE", "That import is too large. Split the export into smaller files.");
    const parsed = parseWisprMarkdown(markdown);
    const result = await this.upsertParsedMeeting(parsed, body.source_type === "demo" ? "demo" : "wispr_markdown", parsed.externalId ? `md:${parsed.externalId}` : null);
    if (body.course_id) {
      this.sql("UPDATE meetings SET course_id = ? WHERE id = ?", body.course_id, result.meeting.id);
    }
    if (result.changed) this.ctx.waitUntil(this.runExtraction(result.meeting.id, false));
    return json({ meeting: this.one<Meeting>("SELECT * FROM meetings WHERE id = ?", result.meeting.id), duplicate: !result.changed, created: result.created, segment_count: parsed.segments.length });
  }

  private async seedDemo(): Promise<Response> {
    const count = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM meetings")?.n ?? 0;
    if (count > 0) throw new ApiError(409, "HAS_DATA", "Demo data is only seeded when you have no recordings yet.");
    if (this.courses().length === 0) {
      this.upsertCourse({ name: "AP US Government", short_name: "AP GOV", teacher: "Ms. Okafor", color: "sage", meeting_keywords: "gov, government, okafor", typical_schedule: "Mon, Wed, Fri 9:00 AM" });
    }
    return this.importMarkdown({ markdown: DEMO_MARKDOWN, source_type: "demo" });
  }

  /** Extraction pipeline for one meeting. Idempotent: re-running replaces only un-reviewed items. */
  private async runExtraction(meetingId: string, force: boolean): Promise<void> {
    const meeting = this.one<Meeting>("SELECT * FROM meetings WHERE id = ?", meetingId);
    if (!meeting) return;
    if (!force && meeting.processing_status === "done") return;
    this.sql("UPDATE meetings SET processing_status = 'processing', processing_error = NULL WHERE id = ?", meetingId);
    try {
      const segments = this.sql<TranscriptSegment>("SELECT * FROM segments WHERE meeting_id = ? ORDER BY segment_index", meetingId);
      const profile = await this.getProfile();
      const courses = this.courses();
      const transcriptForCheck = segments.length ? segments.map((s) => s.text).join("\n") : `${meeting.transcript}\n${meeting.summary}`;
      // Older imports (and transcript-less meetings) may have no rows in
      // `segments`. Materialise them from the stored transcript/summary and
      // persist them, otherwise the scanner, the citations and the coach all
      // have nothing to read for that recording.
      let sourceSegments = segments;
      if (sourceSegments.length === 0) {
        const fallbackText = meeting.transcript || meeting.summary;
        const parsed = segmentTranscript(fallbackText);
        sourceSegments = parsed.map((s, i) => ({ id: newId("seg"), meeting_id: meetingId, user_id: this.userId, speaker: s.speaker, started_at_offset: s.offset, ended_at_offset: null, text: s.text, segment_index: i }));
        for (const s of sourceSegments) {
          this.sql("INSERT OR IGNORE INTO segments (id,meeting_id,user_id,speaker,started_at_offset,ended_at_offset,text,segment_index) VALUES (?,?,?,?,?,?,?,?)", s.id, s.meeting_id, s.user_id, s.speaker, s.started_at_offset, null, s.text, s.segment_index);
        }
      }
      // The deterministic keyword sweep runs FIRST and independently of the model,
      // so a model outage never hides a due-date mention from the Flagged queue.
      const flagged = await this.storeSignals(meetingId, sourceSegments, meeting.started_at);
      if (!aiConfigured(this.env)) {
        this.sql(
          "UPDATE meetings SET processing_status = 'done', processing_error = ?, updated_at = ? WHERE id = ?",
          `AI extraction skipped (model not reachable from the server). Keyword scan flagged ${flagged} mention(s) for review.`,
          nowIso(),
          meetingId,
        );
        return;
      }
      const { candidates, rejectedUnsupported, failedChunks } = await extractObligations(this.env, {
        meetingId,
        title: meeting.title,
        startedAt: meeting.started_at,
        timezone: profile.timezone,
        transcript: `${transcriptForCheck}\n${meeting.summary}`,
        segments: sourceSegments,
        courses,
      });
      const now = nowIso();
      const existing = this.sql<Obligation & { fingerprint: string }>("SELECT * FROM obligations WHERE meeting_id = ?", meetingId);
      const seen = new Set<string>();
      for (const c of candidates) {
        const fingerprint = await sha256(`${c.type}|${c.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`);
        seen.add(fingerprint);
        const courseId = meeting.course_id ?? courses.find((k) => c.course_hint && (k.name.toLowerCase().includes(c.course_hint.toLowerCase()) || c.course_hint.toLowerCase().includes(k.name.toLowerCase())))?.id ?? null;
        const status: ObligationStatus = c.ambiguous || !c.due_at ? "needs_clarification" : "needs_review";
        const prior = existing.find((e) => e.fingerprint === fingerprint);
        if (prior) {
          // Reviewed items keep their decision; only refresh evidence. Un-reviewed items get updated.
          const reviewed = !["needs_review", "needs_clarification"].includes(prior.status);
          const dueChanged = prior.due_at !== c.due_at && c.due_at !== null;
          this.sql(
            `UPDATE obligations SET description = ?, evidence_excerpt = ?, evidence_segment_ids = ?, raw_date_phrase = ?, date_reasoning = ?, confidence = ?, updated_at = ?,
               due_at = CASE WHEN ? THEN due_at ELSE ? END,
               all_day = CASE WHEN ? THEN all_day ELSE ? END,
               status = CASE WHEN ? THEN status ELSE ? END,
               calendar_dirty = CASE WHEN ? AND provider_event_id IS NOT NULL THEN 1 ELSE calendar_dirty END
             WHERE id = ?`,
            c.description, c.evidence_excerpt, JSON.stringify(c.evidence_segment_ids), c.raw_date_phrase, c.date_reasoning, c.confidence, now,
            reviewed ? 1 : 0, c.due_at, reviewed ? 1 : 0, c.all_day ? 1 : 0, reviewed ? 1 : 0, status, reviewed && dueChanged ? 1 : 0, prior.id,
          );
          continue;
        }
        this.sql(
          `INSERT INTO obligations (id,user_id,meeting_id,course_id,type,title,description,due_at,all_day,timezone,confidence,status,evidence_excerpt,evidence_segment_ids,raw_date_phrase,date_reasoning,provider_event_id,calendar_dirty,fingerprint,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,0,?,?,?)`,
          newId("obl"), this.userId, meetingId, courseId, c.type, c.title, c.description, c.due_at, c.all_day ? 1 : 0, profile.timezone, c.confidence, status, c.evidence_excerpt, JSON.stringify(c.evidence_segment_ids), c.raw_date_phrase, c.date_reasoning, fingerprint, now, now,
        );
      }
      // Remove stale un-reviewed items that no longer appear after a re-run.
      for (const e of existing) {
        if (!seen.has(e.fingerprint) && ["needs_review", "needs_clarification"].includes(e.status)) {
          this.sql("DELETE FROM obligations WHERE id = ?", e.id);
        }
      }
      // Second pass links signals to obligations the model just produced.
      await this.storeSignals(meetingId, sourceSegments, meeting.started_at);
      const notes: string[] = [];
      if (rejectedUnsupported > 0) notes.push(`${rejectedUnsupported} unsupported suggestion(s) were discarded because their quotes were not found in the transcript.`);
      if (failedChunks > 0) notes.push(`${failedChunks} transcript section(s) could not be read by the model; the keyword scan still covered them.`);
      this.sql("UPDATE meetings SET processing_status = 'done', processing_error = ?, updated_at = ? WHERE id = ?", notes.length ? notes.join(" ") : null, now, meetingId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed";
      console.error("extraction failed", meetingId, message);
      // The deterministic scan already ran and its results are stored, so this
      // recording is still useful. Marking it 'error' made the whole library
      // look broken; record the reason but keep the keyword coverage visible.
      const flaggedNow = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM signals WHERE meeting_id = ?", meetingId)?.n ?? 0;
      this.sql(
        "UPDATE meetings SET processing_status = ?, processing_error = ?, updated_at = ? WHERE id = ?",
        flaggedNow > 0 ? "done" : "error",
        `AI extraction didn't complete (${message.slice(0, 160)}). The keyword scan still flagged ${flaggedNow} mention(s) from this transcript.`,
        nowIso(),
        meetingId,
      );
    }
  }

  /**
   * Deterministic keyword/date sweep. Runs alongside the model so a forward-looking
   * mention is flagged for human review even when the model missed it. Signals the
   * model already turned into an obligation (same segment) are linked, not duplicated.
   */
  private async storeSignals(meetingId: string, segments: TranscriptSegment[], startedAt: string): Promise<number> {
    const recordedAt = new Date(startedAt);
    const signals = scanTranscriptSignals(segments, Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt);
    if (signals.length === 0) return 0;

    // Map segment -> obligation so covered mentions don't clutter the queue.
    const covered = new Map<string, string>();
    for (const o of this.sql<{ id: string; evidence_segment_ids: string }>("SELECT id, evidence_segment_ids FROM obligations WHERE meeting_id = ?", meetingId)) {
      for (const sid of (safeJsonParse<string[]>(o.evidence_segment_ids) ?? [])) covered.set(sid, o.id);
    }

    const now = nowIso();
    for (const s of signals) {
      const fingerprint = await sha256(`${meetingId}|${s.category}|${s.trigger}|${normalizeText(s.excerpt).slice(0, 80)}`);
      const linked = covered.get(s.segment_id) ?? null;
      // INSERT OR IGNORE keeps re-extraction idempotent and preserves prior decisions.
      this.sql(
        `INSERT OR IGNORE INTO signals (id,user_id,meeting_id,segment_id,segment_index,category,trigger_phrase,excerpt,date_phrase,resolved_date,score,status,linked_obligation_id,fingerprint,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        newId("sig"), this.userId, meetingId, s.segment_id, s.segment_index, s.category, s.trigger, s.excerpt, s.date_phrase, s.resolved_date, Math.round(s.score),
        linked ? "covered" : "flagged", linked, fingerprint, now,
      );
      // A later extraction pass may cover a previously bare signal.
      if (linked) this.sql("UPDATE signals SET status = CASE WHEN status = 'flagged' THEN 'covered' ELSE status END, linked_obligation_id = ? WHERE fingerprint = ?", linked, fingerprint);
    }
    return signals.length;
  }

  /**
   * Guarantees every stored recording has been through the deterministic
   * keyword/date sweep. Imports that failed before the scanner existed (or that
   * were marked 'error' by a model outage) otherwise stay invisible forever,
   * because re-extraction only runs when a transcript actually changes.
   * Pure string work, no model calls, so it is safe to run on read paths.
   */
  private async ensureScanned(limit = 40): Promise<number> {
    const pending = this.sql<{ id: string; started_at: string }>(
      `SELECT m.id, m.started_at FROM meetings m
       WHERE NOT EXISTS (SELECT 1 FROM signals s WHERE s.meeting_id = m.id)
       ORDER BY m.started_at DESC LIMIT ?`,
      limit,
    );
    let scanned = 0;
    for (const m of pending) {
      let segments = this.sql<TranscriptSegment>("SELECT * FROM segments WHERE meeting_id = ? ORDER BY segment_index", m.id);
      if (segments.length === 0) {
        const row = this.one<Meeting>("SELECT * FROM meetings WHERE id = ?", m.id);
        const text = `${row?.transcript ?? ""}\n${row?.summary ?? ""}`.trim();
        if (!text) continue;
        segments = segmentTranscript(text).map((s, i) => ({ id: newId("seg"), meeting_id: m.id, user_id: this.userId, speaker: s.speaker, started_at_offset: s.offset, ended_at_offset: null, text: s.text, segment_index: i }));
        for (const s of segments) {
          this.sql("INSERT OR IGNORE INTO segments (id,meeting_id,user_id,speaker,started_at_offset,ended_at_offset,text,segment_index) VALUES (?,?,?,?,?,?,?,?)", s.id, s.meeting_id, s.user_id, s.speaker, s.started_at_offset, null, s.text, s.segment_index);
        }
      }
      await this.storeSignals(m.id, segments, m.started_at);
      scanned++;
    }
    return scanned;
  }

  private async listSignals(url: URL): Promise<Response> {
    await this.ensureScanned();
    const status = url.searchParams.get("status") ?? "flagged";
    const statuses = status === "all" ? ["flagged", "covered", "dismissed", "promoted"] : status.split(",");
    const rows = this.sql<SignalRow>(
      `SELECT * FROM signals WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY score DESC, segment_index ASC LIMIT 500`,
      ...statuses,
    );
    const meetings = new Map(this.sql<{ id: string; title: string; started_at: string }>("SELECT id,title,started_at FROM meetings").map((m) => [m.id, m]));
    return json({
      signals: rows.map((r) => ({ ...r, meeting_title: meetings.get(r.meeting_id)?.title ?? "Recording", meeting_started_at: meetings.get(r.meeting_id)?.started_at ?? null })),
      keyword_count: KEYWORD_COUNT,
    });
  }

  private setSignalStatus(id: string, status: "flagged" | "dismissed"): Response {
    const row = this.one<SignalRow>("SELECT * FROM signals WHERE id = ?", id);
    if (!row) throw new ApiError(404, "NOT_FOUND", "That flagged mention no longer exists.");
    this.sql("UPDATE signals SET status = ? WHERE id = ?", status, id);
    return json({ ok: true, signal: { ...row, status } });
  }

  /**
   * Turns a flagged mention into a real obligation for review. The excerpt is
   * copied verbatim from the transcript, and an unresolved date stays null so the
   * item lands in "Needs a date" rather than inventing one.
   */
  private async promoteSignal(id: string, body: { type?: string; title?: string; due_at?: string | null }): Promise<Response> {
    const row = this.one<SignalRow>("SELECT * FROM signals WHERE id = ?", id);
    if (!row) throw new ApiError(404, "NOT_FOUND", "That flagged mention no longer exists.");
    const meeting = this.one<Meeting>("SELECT * FROM meetings WHERE id = ?", row.meeting_id);
    if (!meeting) throw new ApiError(404, "NOT_FOUND", "The source recording no longer exists.");
    const profile = await this.getProfile();

    const type = (OBLIGATION_TYPES as string[]).includes(body.type ?? "") ? (body.type as ObligationType) : CATEGORY_TO_TYPE[row.category] ?? "assignment";
    const title = (body.title ?? "").trim() || row.excerpt.slice(0, 70);
    let dueAt: string | null = row.resolved_date;
    if (body.due_at !== undefined) {
      if (body.due_at === null) dueAt = null;
      else {
        const d = new Date(body.due_at);
        if (Number.isNaN(d.getTime())) throw new ApiError(400, "VALIDATION", "That date could not be understood.");
        dueAt = d.toISOString();
      }
    }

    const now = nowIso();
    const oblId = newId("obl");
    const fingerprint = await sha256(`${type}|${title.toLowerCase().replace(/[^a-z0-9]/g, "")}`);
    const existing = this.one<{ id: string }>("SELECT id FROM obligations WHERE meeting_id = ? AND fingerprint = ?", row.meeting_id, fingerprint);
    if (existing) {
      this.sql("UPDATE signals SET status = 'promoted', linked_obligation_id = ? WHERE id = ?", existing.id, id);
      return json({ ok: true, obligation_id: existing.id, already_existed: true });
    }
    this.sql(
      `INSERT INTO obligations (id,user_id,meeting_id,course_id,type,title,description,due_at,all_day,timezone,confidence,status,evidence_excerpt,evidence_segment_ids,raw_date_phrase,date_reasoning,provider_event_id,calendar_dirty,fingerprint,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,NULL,0,?,?,?)`,
      oblId, this.userId, row.meeting_id, meeting.course_id, type, title.slice(0, 90),
      `Flagged from the transcript by keyword "${row.trigger_phrase}".`,
      dueAt, profile.timezone, 0.5, dueAt ? "needs_review" : "needs_clarification",
      row.excerpt, JSON.stringify([row.segment_id]), row.date_phrase,
      dueAt ? "Date read directly from the words spoken." : "No explicit date was spoken — set one yourself.",
      fingerprint, now, now,
    );
    this.sql("UPDATE signals SET status = 'promoted', linked_obligation_id = ? WHERE id = ?", oblId, id);
    return json({ ok: true, obligation_id: oblId });
  }

  // ---------- meetings ----------
  private listMeetings(url: URL): Response {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const courseId = url.searchParams.get("course");
    let rows = this.sql<Meeting>("SELECT id,user_id,external_wispr_id,course_id,source_type,title,started_at,ended_at,attendees_json,summary,processing_status,processing_error,imported_at,updated_at, length(transcript) AS transcript_length FROM meetings ORDER BY started_at DESC");
    if (courseId) rows = rows.filter((r) => r.course_id === courseId);
    if (q) {
      const ids = new Set(this.sql<{ meeting_id: string }>("SELECT DISTINCT meeting_id FROM segments WHERE lower(text) LIKE ?", `%${q}%`).map((r) => r.meeting_id));
      rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || ids.has(r.id));
    }
    const counts = new Map(this.sql<{ meeting_id: string; n: number }>("SELECT meeting_id, COUNT(*) AS n FROM obligations WHERE status != 'rejected' GROUP BY meeting_id").map((r) => [r.meeting_id, r.n]));
    return json({ meetings: rows.map((r) => ({ ...r, obligation_count: counts.get(r.id) ?? 0 })) });
  }

  private getMeeting(id: string): Response {
    const meeting = this.one<Meeting>("SELECT * FROM meetings WHERE id = ?", id);
    if (!meeting) throw new ApiError(404, "NOT_FOUND", "Recording not found.");
    return json({
      meeting,
      segments: this.sql<TranscriptSegment>("SELECT * FROM segments WHERE meeting_id = ? ORDER BY segment_index", id),
      obligations: this.sql<Obligation>("SELECT * FROM obligations WHERE meeting_id = ? ORDER BY created_at", id),
    });
  }

  private patchMeeting(id: string, body: { course_id?: string | null; title?: string }): Response {
    if (body.course_id !== undefined) {
      this.sql("UPDATE meetings SET course_id = ?, updated_at = ? WHERE id = ?", body.course_id, nowIso(), id);
      this.sql("UPDATE obligations SET course_id = ? WHERE meeting_id = ? AND status IN ('needs_review','needs_clarification')", body.course_id, id);
    }
    if (typeof body.title === "string" && body.title.trim()) this.sql("UPDATE meetings SET title = ? WHERE id = ?", body.title.trim().slice(0, 160), id);
    return this.getMeeting(id);
  }

  private deleteMeeting(id: string): Response {
    this.sql("DELETE FROM segments WHERE meeting_id = ?", id);
    this.sql("DELETE FROM obligations WHERE meeting_id = ?", id);
    this.sql("DELETE FROM meetings WHERE id = ?", id);
    return json({ ok: true });
  }

  // ---------- obligations ----------
  private listObligations(url: URL): Response {
    const status = url.searchParams.get("status");
    const rows = status
      ? this.sql<Obligation>(`SELECT * FROM obligations WHERE status IN (${status.split(",").map(() => "?").join(",")}) ORDER BY COALESCE(due_at,'9999') ASC, confidence DESC`, ...status.split(","))
      : this.sql<Obligation>("SELECT * FROM obligations ORDER BY COALESCE(due_at,'9999') ASC, confidence DESC");
    const meetings = new Map(this.sql<{ id: string; title: string; started_at: string }>("SELECT id,title,started_at FROM meetings").map((m) => [m.id, m]));
    return json({ obligations: rows.map((o) => ({ ...o, meeting_title: meetings.get(o.meeting_id)?.title ?? "Recording", meeting_started_at: meetings.get(o.meeting_id)?.started_at ?? null })) });
  }

  private getObligation(id: string): Obligation {
    const o = this.one<Obligation>("SELECT * FROM obligations WHERE id = ?", id);
    if (!o) throw new ApiError(404, "NOT_FOUND", "That item no longer exists.");
    return o;
  }

  private editObligation(id: string, body: Partial<Obligation>): Response {
    const o = this.getObligation(id);
    const type: ObligationType = body.type && OBLIGATION_TYPES.includes(body.type) ? body.type : o.type;
    let dueAt = o.due_at;
    if (body.due_at !== undefined) {
      if (body.due_at === null || body.due_at === "") dueAt = null;
      else {
        const d = new Date(body.due_at);
        if (Number.isNaN(d.getTime())) throw new ApiError(400, "VALIDATION", "That due date is not valid.");
        dueAt = d.toISOString();
      }
    }
    const dirty = o.provider_event_id && (dueAt !== o.due_at || (body.title && body.title !== o.title) || (body.all_day !== undefined && Number(body.all_day) !== o.all_day)) ? 1 : o.calendar_dirty;
    let status = o.status;
    if (body.status && ["needs_review", "accepted", "rejected", "needs_clarification"].includes(body.status)) status = body.status;
    if ((status === "needs_clarification") && dueAt) status = "needs_review";
    this.sql(
      "UPDATE obligations SET type=?, title=?, description=?, due_at=?, all_day=?, course_id=?, status=?, calendar_dirty=?, updated_at=? WHERE id=?",
      type, (body.title ?? o.title).slice(0, 120), (body.description ?? o.description).slice(0, 800), dueAt, body.all_day !== undefined ? (body.all_day ? 1 : 0) : o.all_day, body.course_id !== undefined ? body.course_id : o.course_id, status, dirty, nowIso(), id,
    );
    return json({ obligation: this.getObligation(id) });
  }

  private setStatus(id: string, status: ObligationStatus): Response {
    const o = this.getObligation(id);
    if (status === "rejected" && o.provider_event_id) {
      throw new ApiError(409, "HAS_EVENT", "This item already has a calendar event. Use Undo to remove the event first.");
    }
    this.sql("UPDATE obligations SET status = ?, updated_at = ? WHERE id = ?", status, nowIso(), id);
    return json({ obligation: this.getObligation(id) });
  }

  private async acceptObligation(id: string): Promise<Response> {
    const o = this.getObligation(id);
    if (!o.due_at) throw new ApiError(400, "NEEDS_DATE", "Add a due date before accepting — NeverNote never guesses deadlines.");
    if (o.status === "needs_review" || o.status === "needs_clarification" || o.status === "rejected") {
      this.sql("UPDATE obligations SET status = 'accepted', updated_at = ? WHERE id = ?", nowIso(), id);
    }
    const preview = await this.buildPreview(id);
    return json({ obligation: this.getObligation(id), preview });
  }

  private async buildPreview(id: string): Promise<{ calendar_id: string | null; payload: EventPayload; google_status: string }> {
    const o = this.getObligation(id);
    if (!o.due_at) throw new ApiError(400, "NEEDS_DATE", "This item has no confirmed due date yet.");
    const profile = await this.getProfile();
    const meeting = this.one<Meeting>("SELECT * FROM meetings WHERE id = ?", o.meeting_id);
    const course = o.course_id ? this.one<Course>("SELECT * FROM courses WHERE id = ?", o.course_id) : null;
    const due = new Date(o.due_at);
    const tz = o.timezone || profile.timezone;
    const label = o.type.replace("_", " ");
    const summary = `${course?.short_name || course?.name ? `${course.short_name || course.name} · ` : ""}${o.title}`;
    const dateStr = meeting ? new Date(meeting.started_at).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" }) : "";
    const description = [
      `${label.charAt(0).toUpperCase()}${label.slice(1)}${course ? ` for ${course.name}` : ""}.`,
      o.description,
      "",
      `Source: NeverNote recording "${meeting?.title ?? "Recording"}" (${dateStr}).`,
      `Teacher said: "${o.evidence_excerpt.split("\n")[0].slice(0, 300)}"`,
      "",
      `NeverNote reference: ${o.id}`,
    ].filter((l) => l !== undefined).join("\n");
    let start: EventPayload["start"];
    let end: EventPayload["end"];
    if (o.all_day) {
      const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(due);
      const next = new Date(due.getTime() + 24 * 3600 * 1000);
      const ymdNext = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(next);
      start = { date: ymd };
      end = { date: ymdNext };
    } else {
      start = { dateTime: due.toISOString(), timeZone: tz };
      end = { dateTime: new Date(due.getTime() + 60 * 60 * 1000).toISOString(), timeZone: tz };
    }
    const google = await this.ctx.storage.get<GoogleTokens>("google");
    return {
      calendar_id: profile.default_calendar_id || null,
      google_status: google ? (profile.default_calendar_id ? "ready" : "select_calendar") : googleConfigured(this.env) ? "not_connected" : "needs_server_config",
      payload: { summary, description, start, end, extendedProperties: { private: { recallGuardObligationId: o.id, recallGuardMeetingId: o.meeting_id } } },
    };
  }

  private async googleToken(): Promise<{ token: string; calendarId: string }> {
    let tokens = await this.ctx.storage.get<GoogleTokens>("google");
    if (!tokens) {
      throw new ApiError(401, googleConfigured(this.env) ? "GOOGLE_NOT_CONNECTED" : "GOOGLE_NOT_CONFIGURED", googleConfigured(this.env) ? "Connect Google Calendar in Settings before adding events." : "Google Calendar connection requires server OAuth configuration.");
    }
    if (tokens.expires_at < Date.now()) {
      tokens = { ...tokens, ...(await googleRefresh(this.env, tokens)) };
      await this.ctx.storage.put("google", tokens);
    }
    const profile = await this.getProfile();
    if (!profile.default_calendar_id) throw new ApiError(400, "SELECT_CALENDAR", "Choose a destination calendar in Settings first.");
    return { token: tokens.access_token, calendarId: profile.default_calendar_id };
  }

  private recordAction(obligationId: string, action: string, proposed: unknown, previous: unknown, status: string, eventId: string | null, error?: string): string {
    const id = newId("act");
    this.sql(
      "INSERT INTO calendar_actions (id,user_id,obligation_id,action,previous_payload_json,proposed_payload_json,provider_event_id,status,error,executed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      id, this.userId, obligationId, action, previous ? JSON.stringify(previous) : null, proposed ? JSON.stringify(proposed) : null, eventId, status, error ?? null, status === "done" ? nowIso() : null, nowIso(),
    );
    return id;
  }

  private async createCalendarEvent(id: string): Promise<Response> {
    if (this.calendarLocks.has(id)) throw new ApiError(409, "IN_PROGRESS", "That event is already being created.");
    this.calendarLocks.add(id);
    try {
      const o = this.getObligation(id);
      if (o.status === "rejected") throw new ApiError(400, "REJECTED", "Accept this item before adding it to your calendar.");
      if (!o.due_at) throw new ApiError(400, "NEEDS_DATE", "Add a due date first.");
      const preview = await this.buildPreview(id);
      const { token, calendarId } = await this.googleToken();
      if (o.provider_event_id) {
        return json({ obligation: o, event_id: o.provider_event_id, duplicate_prevented: true });
      }
      const existing = await withBackoff(() => findEventByObligation(token, calendarId, o.id), 2);
      if (existing) {
        this.sql("UPDATE obligations SET provider_event_id = ?, status = 'calendar_created', calendar_dirty = 0, updated_at = ? WHERE id = ?", existing.id, nowIso(), id);
        this.recordAction(id, "create", preview.payload, null, "done", existing.id);
        return json({ obligation: this.getObligation(id), event_id: existing.id, html_link: existing.htmlLink ?? null, duplicate_prevented: true });
      }
      try {
        const created = await withBackoff(() => insertEvent(token, calendarId, preview.payload), 2);
        this.sql("UPDATE obligations SET provider_event_id = ?, status = 'calendar_created', calendar_dirty = 0, updated_at = ? WHERE id = ?", created.id, nowIso(), id);
        this.recordAction(id, "create", preview.payload, null, "done", created.id);
        return json({ obligation: this.getObligation(id), event_id: created.id, html_link: created.htmlLink ?? null, duplicate_prevented: false });
      } catch (err) {
        this.recordAction(id, "create", preview.payload, null, "failed", null, err instanceof Error ? err.message : "failed");
        throw err;
      }
    } finally {
      this.calendarLocks.delete(id);
    }
  }

  private async updateCalendarEvent(id: string): Promise<Response> {
    const o = this.getObligation(id);
    if (!o.provider_event_id) throw new ApiError(400, "NO_EVENT", "This item has no calendar event yet.");
    const preview = await this.buildPreview(id);
    const { token, calendarId } = await this.googleToken();
    const previous = this.one<{ proposed_payload_json: string }>("SELECT proposed_payload_json FROM calendar_actions WHERE obligation_id = ? AND status = 'done' ORDER BY created_at DESC LIMIT 1", id);
    try {
      const updated = await withBackoff(() => patchEvent(token, calendarId, o.provider_event_id as string, preview.payload), 2);
      this.sql("UPDATE obligations SET status = 'calendar_updated', calendar_dirty = 0, updated_at = ? WHERE id = ?", nowIso(), id);
      this.recordAction(id, "update", preview.payload, previous ? JSON.parse(previous.proposed_payload_json) : null, "done", updated.id);
      return json({ obligation: this.getObligation(id), event_id: updated.id, html_link: updated.htmlLink ?? null });
    } catch (err) {
      this.recordAction(id, "update", preview.payload, null, "failed", o.provider_event_id, err instanceof Error ? err.message : "failed");
      throw err;
    }
  }

  private async undoCalendarEvent(id: string): Promise<Response> {
    const o = this.getObligation(id);
    if (!o.provider_event_id) throw new ApiError(400, "NO_EVENT", "Nothing to undo — no calendar event exists for this item.");
    const { token, calendarId } = await this.googleToken();
    try {
      await withBackoff(() => deleteEvent(token, calendarId, o.provider_event_id as string), 2);
    } catch (err) {
      if (!(err instanceof ApiError && (err.code === "GOOGLE_GONE" || err.code === "GOOGLE_NOT_FOUND"))) {
        this.recordAction(id, "delete", null, null, "failed", o.provider_event_id, err instanceof Error ? err.message : "failed");
        throw err;
      }
    }
    this.sql("UPDATE obligations SET provider_event_id = NULL, status = 'accepted', calendar_dirty = 0, updated_at = ? WHERE id = ?", nowIso(), id);
    this.recordAction(id, "delete", null, null, "done", o.provider_event_id);
    return json({ obligation: this.getObligation(id) });
  }

  // ---------- chat ----------
  private createThread(): Response {
    const id = newId("thr");
    const now = nowIso();
    this.sql("INSERT INTO chat_threads (id,user_id,title,created_at,updated_at) VALUES (?,?,?,?,?)", id, this.userId, "New conversation", now, now);
    return json({ thread: this.one("SELECT * FROM chat_threads WHERE id = ?", id) });
  }

  private getThread(id: string): Response {
    const thread = this.one("SELECT * FROM chat_threads WHERE id = ?", id);
    if (!thread) throw new ApiError(404, "NOT_FOUND", "Conversation not found.");
    const messages = this.sql<{ id: string; cited_segment_ids: string }>("SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at", id);
    // Rehydrate sources so citations survive a reload / thread switch.
    const segIds = new Set<string>();
    for (const msg of messages) for (const sid of safeJsonParse<string[]>(msg.cited_segment_ids) ?? []) segIds.add(sid);
    const citations: Record<string, unknown[]> = {};
    if (segIds.size > 0) {
      const rows = this.sql<TranscriptSegment & { meeting_title: string; meeting_started_at: string }>(
        "SELECT s.*, m.title AS meeting_title, m.started_at AS meeting_started_at FROM segments s JOIN meetings m ON m.id = s.meeting_id",
      ).filter((s) => segIds.has(s.id));
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const msg of messages) {
        citations[msg.id] = (safeJsonParse<string[]>(msg.cited_segment_ids) ?? [])
          .map((sid) => byId.get(sid))
          .filter((s): s is NonNullable<typeof s> => Boolean(s))
          .map((s) => ({ segment_id: s.id, meeting_id: s.meeting_id, meeting_title: s.meeting_title, meeting_started_at: s.meeting_started_at, speaker: s.speaker, text: s.text }));
      }
    }
    return json({ thread, messages, citations });
  }

  private async askCoach(threadId: string, body: { question?: string; course_id?: string | null; from?: string | null; to?: string | null }): Promise<Response> {
    const question = (body.question ?? "").trim();
    if (!question) throw new ApiError(400, "VALIDATION", "Ask a question first.");
    const thread = this.one<{ id: string; title: string }>("SELECT * FROM chat_threads WHERE id = ?", threadId);
    if (!thread) throw new ApiError(404, "NOT_FOUND", "Conversation not found.");
    let meetings = this.sql<Meeting>("SELECT * FROM meetings");
    if (body.course_id) meetings = meetings.filter((m) => m.course_id === body.course_id);
    if (body.from) meetings = meetings.filter((m) => m.started_at >= new Date(body.from as string).toISOString());
    if (body.to) meetings = meetings.filter((m) => m.started_at <= new Date(body.to as string).toISOString());
    const meetingIds = new Set(meetings.map((m) => m.id));
    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const allSegments = this.sql<TranscriptSegment>("SELECT * FROM segments").filter((s) => meetingIds.has(s.meeting_id)).map((s) => ({ ...s, meeting_title: meetingById.get(s.meeting_id)?.title ?? "", meeting_started_at: meetingById.get(s.meeting_id)?.started_at ?? "" }));
    const retrieved = retrieveSegments(question, allSegments);
    const obligations = this.sql<{ title: string; type: string; due_at: string | null; status: string; meeting_id: string }>("SELECT title,type,due_at,status,meeting_id FROM obligations WHERE status != 'rejected'").filter((o) => meetingIds.has(o.meeting_id));
    const history = this.sql<{ role: "user" | "assistant"; content: string }>("SELECT role, content FROM chat_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 6", threadId).reverse();
    const profile = await this.getProfile();
    const now = nowIso();
    this.sql("INSERT INTO chat_messages (id,thread_id,user_id,role,content,cited_meeting_ids,cited_segment_ids,created_at) VALUES (?,?,?,?,?,?,?,?)", newId("msg"), threadId, this.userId, "user", question, "[]", "[]", now);
    const cal = await this.calendarContext();
    const answer = await answerWithEvidence(this.env, question, retrieved, meetings, {
      obligations,
      history,
      timezone: profile.timezone,
      calendar: cal.events,
      calendarStatus: cal.status,
    });
    const msgId = newId("msg");
    this.sql("INSERT INTO chat_messages (id,thread_id,user_id,role,content,cited_meeting_ids,cited_segment_ids,created_at) VALUES (?,?,?,?,?,?,?,?)", msgId, threadId, this.userId, "assistant", answer.answer, JSON.stringify(answer.citedMeetingIds), JSON.stringify(answer.citedSegmentIds), nowIso());
    const title = thread.title === "New conversation" ? question.slice(0, 60) : thread.title;
    this.sql("UPDATE chat_threads SET title = ?, updated_at = ? WHERE id = ?", title, nowIso(), threadId);
    const citations = retrieved.filter((s) => answer.citedSegmentIds.includes(s.id)).map((s) => ({ segment_id: s.id, meeting_id: s.meeting_id, meeting_title: s.meeting_title, meeting_started_at: s.meeting_started_at, speaker: s.speaker, text: s.text }));
    // Which recordings were read to produce this answer (keyword pre-filter), so
    // the UI can show the context window even when the model cited nothing.
    const contextMeetings = Array.from(new Set(retrieved.map((s) => s.meeting_id))).map((id) => {
      const m = meetingById.get(id);
      return { meeting_id: id, title: m?.title ?? "Recording", started_at: m?.started_at ?? "", lines: retrieved.filter((s) => s.meeting_id === id).length };
    });
    return json({ message: this.one("SELECT * FROM chat_messages WHERE id = ?", msgId), citations, mode: answer.mode, context_meetings: contextMeetings, ai_available: aiConfigured(this.env) });
  }

  /**
   * Reads the next 30 days from Google Calendar for the chatbot. Failures are
   * soft: the coach is told the calendar is unavailable rather than erroring.
   */
  private async calendarContext(): Promise<{ events: CalendarContextEvent[] | null; status: "connected" | "not_connected" | "needs_server_config" | "unavailable" }> {
    let tokens = await this.ctx.storage.get<GoogleTokens>("google");
    if (!tokens) {
      return { events: null, status: googleConfigured(this.env) ? "not_connected" : "needs_server_config" };
    }
    const profile = await this.getProfile();
    if (!profile.default_calendar_id) return { events: null, status: "not_connected" };
    try {
      if (tokens.expires_at < Date.now()) {
        tokens = { ...tokens, ...(await googleRefresh(this.env, tokens)) };
        await this.ctx.storage.put("google", tokens);
      }
      const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const to = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const events = await withBackoff(() => listUpcomingEvents(tokens?.access_token ?? "", profile.default_calendar_id, from, to), 2);
      return {
        events: events.map((e) => ({ summary: e.summary, start: e.start, allDay: e.allDay, createdByNeverNote: e.createdByNeverNote })),
        status: "connected",
      };
    } catch (err) {
      console.warn("calendar context unavailable", err instanceof Error ? err.message : err);
      return { events: null, status: "unavailable" };
    }
  }

  // ---------- digest ----------
  private async digest(period: "day" | "week"): Promise<Response> {
    // Today's dashboard is the first thing opened, so it is also where a
    // never-scanned recording gets picked up automatically.
    await this.ensureScanned(15);
    const profile = await this.getProfile();
    const now = new Date();
    const horizon = new Date(now.getTime() + (period === "day" ? 2 : 8) * 24 * 3600 * 1000);
    const all = this.sql<Obligation>("SELECT * FROM obligations WHERE status != 'rejected'");
    const meetings = new Map(this.sql<{ id: string; title: string }>("SELECT id,title FROM meetings").map((m) => [m.id, m.title]));
    const decorate = (o: Obligation) => ({ ...o, meeting_title: meetings.get(o.meeting_id) ?? "Recording" });
    const upcoming = all.filter((o) => o.due_at && new Date(o.due_at) >= new Date(now.getTime() - 12 * 3600 * 1000) && new Date(o.due_at) <= horizon).sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? "")).map(decorate);
    const overdue = all.filter((o) => o.due_at && new Date(o.due_at) < new Date(now.getTime() - 12 * 3600 * 1000) && ["accepted", "needs_review"].includes(o.status)).map(decorate);
    const unreviewed = all.filter((o) => o.status === "needs_review").map(decorate);
    const unclear = all.filter((o) => o.status === "needs_clarification").map(decorate);
    const notOnCalendar = all.filter((o) => o.status === "accepted" && !o.provider_event_id).map(decorate);
    return json({ period, timezone: profile.timezone, upcoming, overdue, unreviewed, unclear, not_on_calendar: notOnCalendar });
  }

  // ---------- google oauth ----------
  private async googleConnect(): Promise<Response> {
    const { verifier, challenge } = await pkcePair();
    const nonce = randomToken(16);
    const pending: PendingOAuth = { provider: "google", nonce, verifier, created_at: Date.now() };
    await this.ctx.storage.put("pending_google", pending);
    const state = `${this.userId}.${nonce}`;
    return json({ auth_url: googleAuthUrl(this.env, state, challenge, this.requestOrigin) });
  }

  private async googleCallback(url: URL): Promise<Response> {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    const error = url.searchParams.get("error");
    const pending = await this.ctx.storage.get<PendingOAuth>("pending_google");
    if (error) return popupPage(false, `Google returned: ${error}`);
    if (!code || !pending || state !== `${this.userId}.${pending.nonce}` || Date.now() - pending.created_at > 15 * 60_000) {
      return popupPage(false, "This authorization link is invalid or expired. Please try connecting again.");
    }
    try {
      const tokens = await googleExchangeCode(this.env, code, pending.verifier, this.requestOrigin);
      await this.ctx.storage.put("google", { ...tokens, connected_at: nowIso() });
      await this.ctx.storage.delete("pending_google");
      // Auto-select the primary calendar when none chosen yet.
      const profile = await this.getProfile();
      if (!profile.default_calendar_id) {
        try {
          const cals = await listCalendars(tokens.access_token);
          const primary = cals.find((c) => c.primary) ?? cals[0];
          if (primary) await this.ctx.storage.put("profile", { ...profile, default_calendar_id: primary.id });
        } catch (e) {
          console.warn("calendar list after connect failed", e instanceof Error ? e.message : e);
        }
      }
      return popupPage(true, "Google Calendar connected. You can close this window.");
    } catch (err) {
      return popupPage(false, err instanceof Error ? err.message : "Authorization failed.");
    }
  }

  private async googleCalendars(): Promise<Response> {
    let tokens = await this.ctx.storage.get<GoogleTokens>("google");
    if (!tokens) throw new ApiError(401, "GOOGLE_NOT_CONNECTED", "Connect Google Calendar first.");
    if (tokens.expires_at < Date.now()) {
      tokens = { ...tokens, ...(await googleRefresh(this.env, tokens)) };
      await this.ctx.storage.put("google", tokens);
    }
    const calendars = await withBackoff(() => listCalendars(tokens?.access_token ?? ""), 2);
    const profile = await this.getProfile();
    return json({ calendars, selected_calendar_id: profile.default_calendar_id || null });
  }

  private async selectCalendar(body: { calendar_id?: string }): Promise<Response> {
    if (!body.calendar_id) throw new ApiError(400, "VALIDATION", "Pick a calendar.");
    const profile = await this.getProfile();
    await this.ctx.storage.put("profile", { ...profile, default_calendar_id: body.calendar_id });
    return json({ ok: true, selected_calendar_id: body.calendar_id });
  }

  // ---------- wispr mcp ----------
  /**
   * Absolute callback URL for the Wispr OAuth dance. Derived from the live
   * request origin: EXPO_PUBLIC_RORK_FUNCTIONS_URL is unset in the Worker
   * runtime, which previously produced the relative '/wispr/oauth/callback'
   * that Wispr's registration endpoint rejected as an invalid redirect URI.
   */
  private wisprRedirect(): string {
    return `${publicOrigin(this.env, this.requestOrigin)}/wispr/oauth/callback`;
  }

  private async wisprConnect(body: { server_url?: string }): Promise<Response> {
    // The MCP endpoint is the same for every Wispr account, so we default to it;
    // an explicit URL (or env override) still wins if Wispr ever changes it.
    const serverUrl = (body.server_url ?? this.env.WISPR_MCP_URL ?? DEFAULT_WISPR_MCP_URL).trim();
    if (!serverUrl) throw new ApiError(400, "MCP_URL_REQUIRED", "Paste the Server URL from Wispr Flow → Settings → MCP → All other apps.");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(serverUrl);
    } catch {
      throw new ApiError(400, "MCP_URL_INVALID", "That doesn't look like a valid URL.");
    }
    if (parsedUrl.protocol !== "https:") throw new ApiError(400, "MCP_URL_INVALID", "The MCP server URL must use https.");
    const meta = await discoverAuthServer(serverUrl);
    const client = await registerClient(meta, this.wisprRedirect(), publicOrigin(this.env, this.requestOrigin));
    const { verifier, challenge } = await pkcePair();
    const nonce = randomToken(16);
    await this.ctx.storage.put("pending_wispr", { provider: "wispr", nonce, verifier, created_at: Date.now(), meta, client_id: client.client_id, client_secret: client.client_secret } satisfies PendingOAuth);
    await this.ctx.storage.put("wispr_pending_url", serverUrl);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: this.wisprRedirect(),
      state: `${this.userId}.${nonce}`,
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: serverUrl,
      scope: client.scope,
    });
    return json({ auth_url: `${meta.authorization_endpoint}${meta.authorization_endpoint.includes("?") ? "&" : "?"}${params.toString()}` });
  }

  private async wisprCallback(url: URL): Promise<Response> {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    const error = url.searchParams.get("error");
    const pending = await this.ctx.storage.get<PendingOAuth>("pending_wispr");
    const serverUrl = await this.ctx.storage.get<string>("wispr_pending_url");
    if (error) return popupPage(false, `Wispr Flow returned: ${url.searchParams.get("error_description") ?? error}`);
    if (!code || !pending || !serverUrl || state !== `${this.userId}.${pending.nonce}` || Date.now() - pending.created_at > 15 * 60_000) {
      return popupPage(false, "This authorization link is invalid or expired. Please try connecting again.");
    }
    try {
      const tokens = await exchangeMcpCode({ meta: pending.meta as { authorization_endpoint: string; token_endpoint: string }, clientId: pending.client_id ?? "", clientSecret: pending.client_secret, code, verifier: pending.verifier, redirectUri: this.wisprRedirect(), resource: serverUrl });
      const client = new McpClient(serverUrl, tokens.access_token);
      await client.initialize();
      const tools = await client.listTools();
      if (!tokens.refresh_token) {
        console.warn("wispr connected without refresh token — sync will need periodic reauthorization");
      }
      await this.ctx.storage.put("wispr", { server_url: serverUrl, tokens, tools: tools.map((t) => t.name), connected_at: nowIso() } satisfies WisprConnection);
      await this.ctx.storage.delete("pending_wispr");
      await this.ctx.storage.delete("wispr_pending_url");
      await this.env.DO.setAlarm("UserVault", this.userId, Date.now() + 5_000);
      return popupPage(true, "Wispr Flow connected. NeverNote will start syncing your Notetaker meetings.");
    } catch (err) {
      return popupPage(false, err instanceof Error ? err.message : "Authorization failed.");
    }
  }

  private async wisprClient(): Promise<{ client: McpClient; conn: WisprConnection }> {
    let conn = await this.ctx.storage.get<WisprConnection>("wispr");
    if (!conn) throw new ApiError(401, "WISPR_NOT_CONNECTED", "Wispr Flow is not connected. Use Connect Wispr Flow in Settings, or import a Markdown export.");
    if (conn.tokens.expires_at < Date.now()) {
      conn = { ...conn, tokens: await refreshMcpTokens(conn.tokens, conn.server_url) };
      await this.ctx.storage.put("wispr", conn);
    }
    const client = new McpClient(conn.server_url, conn.tokens.access_token);
    await client.initialize();
    return { client, conn };
  }

  /** Incremental sync: discovers Wispr tools dynamically and pulls meetings updated since the last cursor. */
  private async wisprSync(): Promise<Response> {
    const sync = await this.getSync();
    if (sync.running && sync.last_sync_at && Date.now() - new Date(sync.last_sync_at).getTime() < 10 * 60_000) {
      throw new ApiError(409, "SYNC_RUNNING", "A sync is already running.");
    }
    await this.ctx.storage.put("sync", { ...sync, running: true, last_sync_at: nowIso() });
    let imported = 0;
    let checked = 0;
    const toolErrors: string[] = [];
    try {
      const { client, conn } = await this.wisprClient();
      const tools = await client.listTools();
      await this.ctx.storage.put("wispr", { ...conn, tools: tools.map((t) => t.name) });
      const searchTool = tools.find((t) => /meeting/i.test(t.name) && /(search|list)/i.test(t.name)) ?? tools.find((t) => /(search|list)/i.test(t.name));
      const getTool = tools.find((t) => /meeting/i.test(t.name) && /(get|read|fetch|detail)/i.test(t.name));
      // Wispr split transcript reading into its own tool; `include_transcript`
      // on get_meeting is gone, so the transcript needs a second call.
      const transcriptTool = tools.find((t) => /transcript/i.test(t.name) && !/(search|list)/i.test(t.name));
      if (!searchTool) throw new ApiError(502, "MCP_NO_SEARCH_TOOL", `Wispr's MCP server exposed no meeting search tool (found: ${tools.map((t) => t.name).join(", ") || "none"}).`);

      // Every sync walks the list newest-first and stops only when it has seen a
      // full page of meetings that are already stored unchanged (after the first
      // full backfill). Date filters are deliberately NOT sent: a filter argument
      // the server interprets differently than we expect silently hides today's
      // recordings, which is exactly what happened before.
      const backfillDone = (await this.ctx.storage.get<boolean>("wispr_backfilled")) === true;
      const maxPages = backfillDone ? 40 : 200;
      let cursor: string | null = null;
      let redated = 0;
      for (let page = 0; page < maxPages; page++) {
        const args = pickArgs(searchTool, {
          limit: 25,
          page_size: 25,
          sort: "desc",
          order: "desc",
          sort_by: "start_time",
          cursor: cursor ?? undefined,
          page: cursor ? undefined : page + 1,
          offset: cursor ? undefined : page * 25,
        });
        const res = await withBackoff(() => client.callTool(searchTool.name, args));
        const { items, nextCursor } = normalizeList(res);
        let unchangedOnPage = 0;
        for (const item of items) {
          checked++;
          const externalId = String(item.id ?? item.meeting_id ?? item.meetingId ?? item.uuid ?? "");
          if (!externalId) continue;
          // Repair rows that were stamped with the import time instead of the real
          // Wispr date, without re-fetching their transcripts.
          const listDate = findStart(item) ?? dateFromTitle(str(item.title ?? item.name ?? ""));
          const stored = this.one<Meeting>("SELECT * FROM meetings WHERE external_wispr_id = ?", `wispr:${externalId}`);
          if (stored && listDate && Math.abs(new Date(stored.started_at).getTime() - listDate.getTime()) > 60_000) {
            this.sql("UPDATE meetings SET started_at = ?, updated_at = ? WHERE id = ?", listDate.toISOString(), nowIso(), stored.id);
            redated++;
          }
          let full: Record<string, unknown> = item;
          const idArgs = { id: externalId, meeting_id: externalId, meetingId: externalId };
          if (getTool) {
            const detail = await this.safeTool(client, getTool, idArgs, externalId, toolErrors);
            if (detail && typeof detail === "object") full = { ...item, ...(detail as Record<string, unknown>) };
          }
          const parsed = mcpMeetingToParsed(full);
          // Transcript lives behind its own tool now; fetch it when the meeting
          // record didn't already carry one.
          if (!parsed.transcript && transcriptTool) {
            const raw = await this.safeTool(client, transcriptTool, idArgs, externalId, toolErrors);
            const text = transcriptFrom(raw);
            if (text) {
              parsed.transcript = text;
              parsed.segments = segmentTranscript(text);
            }
          }
          if (!parsed.transcript && !parsed.summary) continue;
          if (!parsed.startedAt && stored) parsed.startedAt = stored.started_at;
          const result = await this.upsertParsedMeeting(parsed, "wispr_mcp", `wispr:${externalId}`);
          if (result.changed) {
            imported++;
            await this.runExtraction(result.meeting.id, false);
          } else {
            unchangedOnPage++;
          }
        }
        if (items.length === 0) break;
        // Incremental mode: a whole page of already-known meetings means we've
        // reached history we already have.
        if (backfillDone && unchangedOnPage === items.length && items.length >= 10) break;
        if (nextCursor) {
          cursor = nextCursor;
          continue;
        }
        // No cursor: only keep paging when the tool supports page/offset arguments.
        const pageable = Object.keys(args).some((k) => k === "page" || k === "offset");
        if (!pageable || items.length < 25) break;
      }
      // A handful of unreadable meetings must not present as a clean sync, but
      // they must not throw away the ones that did import either.
      const partial = toolErrors.length > 0 ? `Imported ${imported} of ${checked}. ${toolErrors.length} meeting(s) could not be read: ${toolErrors[0]}` : null;
      const done: SyncState = { ...sync, running: false, last_sync_at: nowIso(), last_success_at: nowIso(), last_error: partial, imported_count: sync.imported_count + imported, cursor };
      await this.ctx.storage.put("sync", done);
      await this.ctx.storage.put("wispr_backfilled", true);
      await this.env.DO.setAlarm("UserVault", this.userId, Date.now() + SYNC_INTERVAL_MS);
      return json({ ok: true, imported, checked, redated, backfill: !backfillDone, tools: tools.map((t) => t.name), skipped: toolErrors.length, sync: done });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await this.ctx.storage.put("sync", { ...sync, running: false, last_sync_at: nowIso(), last_error: message });
      throw err;
    }
  }

  /** Re-runs the keyword scan (and AI extraction when reachable) for every recording. */
  private async rescanAll(): Promise<Response> {
    const ids = this.sql<{ id: string }>("SELECT id FROM meetings ORDER BY started_at DESC").map((r) => r.id);
    let done = 0;
    for (const id of ids) {
      await this.runExtraction(id, true);
      done++;
    }
    const flagged = this.one<{ n: number }>("SELECT COUNT(*) AS n FROM signals WHERE status = 'flagged'")?.n ?? 0;
    return json({ ok: true, rescanned: done, flagged, ai_available: aiConfigured(this.env) });
  }

  /**
   * Calls a per-meeting tool without letting one bad meeting abort the whole
   * sync. Previously a single tool rejection threw all the way out, so one
   * unsupported argument meant zero transcripts imported.
   */
  private async safeTool(client: McpClient, tool: McpTool, idArgs: Record<string, unknown>, externalId: string, errors: string[]): Promise<unknown> {
    try {
      return await withBackoff(() => client.callTool(tool.name, pickArgs(tool, idArgs)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/MCP_REAUTH|RATE_LIMITED/.test(message)) throw err;
      if (errors.length < 5) errors.push(message.slice(0, 160));
      console.warn(`wispr tool ${tool.name} failed for ${externalId}: ${message}`);
      return null;
    }
  }

  async onAlarm(info: { retryCount: number; isRetry: boolean }): Promise<void> {
    const conn = await this.ctx.storage.get<WisprConnection>("wispr");
    if (!conn) return;
    try {
      await this.wisprSync();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("scheduled sync failed", message);
      // Re-auth needs the user; keep the loop alive but back off hard.
      const needsUser = /MCP_REAUTH|MCP_NO_/.test(message);
      const delay = needsUser ? 6 * 60 * 60_000 : SYNC_RETRY_BASE_MS * 2 ** Math.min(info.retryCount, 4);
      await this.env.DO.setAlarm("UserVault", this.userId, Date.now() + delay);
    }
  }

  // ---------- export / wipe ----------
  private async exportAll(): Promise<Response> {
    return json({
      exported_at: nowIso(),
      profile: await this.getProfile(),
      courses: this.courses(),
      meetings: this.sql("SELECT * FROM meetings"),
      segments: this.sql("SELECT * FROM segments"),
      obligations: this.sql("SELECT * FROM obligations"),
      calendar_actions: this.sql("SELECT * FROM calendar_actions"),
      chat_threads: this.sql("SELECT * FROM chat_threads"),
      chat_messages: this.sql("SELECT * FROM chat_messages"),
    });
  }

  private async wipe(): Promise<Response> {
    for (const t of ["chat_messages", "chat_threads", "calendar_actions", "obligations", "segments", "meetings", "courses"]) this.sql(`DELETE FROM ${t}`);
    await this.ctx.storage.deleteAll();
    await this.env.DO.deleteAlarm("UserVault", this.userId).catch(() => undefined);
    return json({ ok: true });
  }
}

function normalizeList(res: unknown): { items: Record<string, unknown>[]; nextCursor: string | null } {
  if (Array.isArray(res)) return { items: res as Record<string, unknown>[], nextCursor: null };
  if (res && typeof res === "object") {
    const r = res as Record<string, unknown>;
    const list = (r.meetings ?? r.items ?? r.results ?? r.data ?? []) as unknown;
    const nextCursor = (r.next_cursor ?? r.nextCursor ?? r.cursor ?? r.next_page_token ?? null) as string | null;
    return { items: Array.isArray(list) ? (list as Record<string, unknown>[]) : [], nextCursor: typeof nextCursor === "string" && nextCursor ? nextCursor : null };
  }
  return { items: [], nextCursor: null };
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "text" in (v as object)) return String((v as { text: unknown }).text ?? "");
  return "";
}

/** Parses ISO strings, epoch seconds/millis, and nested `{ dateTime }` shapes into a Date. */
function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const ms = v < 1e11 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{9,13}$/.test(s)) return toDate(Number(s));
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return toDate(o.dateTime ?? o.date_time ?? o.date ?? o.iso ?? o.value ?? o.seconds ?? o.timestamp);
  }
  return null;
}

/** Finds the first plausible start-time field anywhere in a Wispr meeting record (top level or one level nested). */
function findStart(m: Record<string, unknown>): Date | null {
  const direct = ["started_at", "start_time", "startTime", "start", "start_date", "startDate", "scheduled_start", "meeting_date", "meetingDate", "recorded_at", "recordedAt", "date", "timestamp", "created_at", "createdAt", "created"];
  for (const k of direct) {
    const d = toDate(m[k]);
    if (d) return d;
  }
  for (const v of Object.values(m)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = v as Record<string, unknown>;
      for (const k of direct) {
        const d = toDate(nested[k]);
        if (d) return d;
      }
    }
  }
  return null;
}

/** Last resort: Wispr titles like "APES Notes 09/09" or "AP GOVT Notes 09/10/26" carry their own date. */
function dateFromTitle(title: string, now = new Date()): Date | null {
  const m = title.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = m[3] ? Number(m[3]) : now.getFullYear();
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (!m[3] && d.getTime() > now.getTime() + 2 * 86400_000) d.setUTCFullYear(year - 1);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mcpMeetingToParsed(m: Record<string, unknown>): ParsedMeeting {
  const title = str(m.title ?? m.name ?? m.subject) || "Untitled meeting";
  const endedRaw = m.ended_at ?? m.end_time ?? m.endTime ?? m.end;
  const attendeesRaw = (m.attendees ?? m.participants ?? []) as unknown;
  const attendees = Array.isArray(attendeesRaw) ? attendeesRaw.map((a) => (typeof a === "string" ? a : str((a as Record<string, unknown>).name ?? (a as Record<string, unknown>).email))).filter(Boolean) : [];
  let transcript = "";
  const t = m.transcript ?? m.refined_transcript ?? m.refinedTranscript ?? m.full_transcript;
  if (typeof t === "string") transcript = t;
  else if (Array.isArray(t)) {
    transcript = (t as Record<string, unknown>[]).map((s) => `${str(s.speaker ?? s.speaker_name ?? "Speaker")}: ${str(s.text ?? s.content)}`).join("\n");
  }
  const summary = str(m.summary ?? m.flow_summary ?? m.overview);
  const notes = str(m.notes ?? m.my_thoughts ?? m.note);
  const started = findStart(m) ?? dateFromTitle(title);
  const ended = toDate(endedRaw);
  return {
    title,
    startedAt: started ? started.toISOString() : null,
    endedAt: ended ? ended.toISOString() : null,
    attendees,
    summary,
    notes,
    transcript,
    segments: segmentTranscript(transcript),
    externalId: null,
  };
}

function popupPage(ok: boolean, message: string): Response {
  const safe = message.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>NeverNote</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#f6f1e8;color:#232120;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#fffdf8;border:1px solid #e6dccb;border-radius:20px;padding:32px;max-width:420px;text-align:center;box-shadow:0 10px 30px rgba(35,33,32,.08)}
h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#5c5750;line-height:1.5}.dot{width:44px;height:44px;border-radius:50%;margin:0 auto 16px;background:${ok ? "#2f5d50" : "#b8583a"}}</style></head>
<body><div class="card"><div class="dot"></div><h1>${ok ? "Connected" : "Connection failed"}</h1><p>${safe}</p></div>
<script>try{if(window.opener){window.opener.postMessage({type:"nevernote_oauth",ok:${ok ? "true" : "false"}},"*");}}catch(e){}
${ok ? "setTimeout(function(){window.close()},1800);" : ""}</script></body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
