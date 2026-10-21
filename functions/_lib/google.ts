import type { Env } from "./types";
import { ApiError } from "./util";

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * Absolute callback URL. `origin` comes from the live request because
 * EXPO_PUBLIC_RORK_FUNCTIONS_URL is not bound in the Worker runtime — relying on
 * it produced a relative '/google/oauth/callback', which OAuth servers reject.
 */
export function googleRedirectUri(env: Env, origin?: string): string {
  return `${publicOrigin(env, origin)}/google/oauth/callback`;
}

/** Resolves the externally reachable backend origin, preferring the real request. */
export function publicOrigin(env: Env, origin?: string): string {
  const candidates = [origin, env.EXPO_PUBLIC_RORK_FUNCTIONS_URL];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return new URL(c).origin;
    } catch {
      /* not absolute — keep looking */
    }
  }
  throw new ApiError(500, "NO_PUBLIC_ORIGIN", "The server could not determine its own public URL, so it cannot build an OAuth callback.");
}

export function googleAuthUrl(env: Env, state: string, challenge: string, origin?: string): string {
  if (!googleConfigured(env)) {
    throw new ApiError(503, "GOOGLE_NOT_CONFIGURED", "Google Calendar connection requires server OAuth configuration (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).");
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(env, origin),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function googleExchangeCode(env: Env, code: string, verifier: string, origin?: string): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(env, origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new ApiError(400, "GOOGLE_TOKEN", `Google authorization failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    scope: data.scope,
  };
}

export async function googleRefresh(env: Env, tokens: GoogleTokens): Promise<GoogleTokens> {
  if (!tokens.refresh_token) {
    throw new ApiError(401, "GOOGLE_REAUTH", "Google Calendar authorization expired. Please reconnect Google Calendar in Settings.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) {
    throw new ApiError(401, "GOOGLE_REAUTH", "Google Calendar authorization expired. Please reconnect Google Calendar in Settings.");
  }
  return { ...tokens, access_token: data.access_token, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000 };
}

async function gfetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 401) throw new ApiError(401, "GOOGLE_REAUTH", "Google Calendar authorization expired. Please reconnect Google Calendar in Settings.");
  if (res.status === 403) throw new ApiError(403, "GOOGLE_FORBIDDEN", "Google denied access to this calendar. Check the calendar permissions or reconnect.");
  if (res.status === 429) throw new ApiError(429, "RATE_LIMITED", "Google Calendar is rate limiting requests. Please try again in a minute.");
  if (res.status === 404) throw new ApiError(404, "GOOGLE_NOT_FOUND", "That Google Calendar event no longer exists.");
  if (res.status === 410) throw new ApiError(410, "GOOGLE_GONE", "That Google Calendar event was already deleted.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("google api error", res.status, body.slice(0, 300));
    throw new ApiError(502, "GOOGLE_UPSTREAM", "Google Calendar returned an error. Please try again.");
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
}

export async function listCalendars(token: string): Promise<GoogleCalendar[]> {
  const data = await gfetch<{ items?: GoogleCalendar[] }>(token, "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer");
  return data.items ?? [];
}

export interface EventPayload {
  summary: string;
  description: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
}

export async function insertEvent(token: string, calendarId: string, payload: EventPayload): Promise<{ id: string; htmlLink?: string }> {
  return gfetch<{ id: string; htmlLink?: string }>(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function patchEvent(token: string, calendarId: string, eventId: string, payload: Partial<EventPayload>): Promise<{ id: string; htmlLink?: string }> {
  return gfetch<{ id: string; htmlLink?: string }>(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  await gfetch<unknown>(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
}

export interface CalendarEventSummary {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  location: string;
  createdByNeverNote: boolean;
}

/** Reads upcoming events so the chatbot knows what's already on the calendar. */
export async function listUpcomingEvents(token: string, calendarId: string, fromIso: string, toIso: string, max = 60): Promise<CalendarEventSummary[]> {
  const params = new URLSearchParams({
    timeMin: fromIso,
    timeMax: toIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.min(max, 250)),
  });
  const data = await gfetch<{
    items?: {
      id: string;
      summary?: string;
      location?: string;
      status?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      extendedProperties?: { private?: Record<string, string> };
    }[];
  }>(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? "(untitled)",
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      allDay: Boolean(e.start?.date && !e.start?.dateTime),
      location: e.location ?? "",
      createdByNeverNote: Boolean(e.extendedProperties?.private?.recallGuardObligationId),
    }));
}

/** Finds an event we previously created for this obligation (idempotency guard). */
export async function findEventByObligation(token: string, calendarId: string, obligationId: string): Promise<{ id: string; htmlLink?: string } | null> {
  const params = new URLSearchParams({ privateExtendedProperty: `recallGuardObligationId=${obligationId}`, maxResults: "5", showDeleted: "false" });
  const data = await gfetch<{ items?: { id: string; htmlLink?: string; status?: string }[] }>(
    token,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  const live = (data.items ?? []).find((e) => e.status !== "cancelled");
  return live ?? null;
}
