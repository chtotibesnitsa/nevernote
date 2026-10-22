// App state: notes, the live recorder, sync, summaries, settings and the
// gentle Pro nudges. One provider, shared by the website app and the desktop app.

import {
  extract,
  mergeExtractions,
  shouldUpsell,
  recordUpsell,
  nameSpeakers,
  speakersOf,
  SpeakerTracker,
  voiceprint,
  Syncer,
  tombstone,
  type Extraction,
  type Note,
  type Feature,
  type Plan,
  type Segment,
  type Tier,
  unlockStep,
  type Stage,
  type UpsellMoment,
  type UpsellState,
} from "@nevernote/core";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { desktop, isDesktop, type AsrModelId } from "../lib/bridge.ts";
import { startCapture, type Capture } from "../lib/capture.ts";
import { cloudEnabled, fetchPlan, remoteFor, requestSummary, supabase, track } from "../lib/cloud.ts";
import { deviceKind, newId } from "../lib/ids.ts";
import { local } from "../lib/local.ts";
import { getActive, logCut, setActive } from "../lib/cutoffs.ts";
import { startFlash, stopFlash } from "../lib/tabflash.ts";
import { Chunker } from "../lib/vad.ts";
import { liveSpeechSupported, startLiveSpeech, type LiveSpeech } from "../lib/live-speech.ts";

export interface Settings {
  model: AsrModelId;
  roomMode: boolean;
  notifyDeadlines: boolean;
  notifyExams: boolean;
  notifyImportant: boolean;
  proTips: boolean;
  theme: "system" | "light" | "dark";
  name: string;
}

const DEFAULT_SETTINGS: Settings = {
  model: "parakeet-en",
  roomMode: true,
  notifyDeadlines: true,
  notifyExams: true,
  notifyImportant: false,
  proTips: true,
  theme: "system",
  name: "",
};

export interface AsrState {
  state: "idle" | "loading" | "ready" | "error";
  p?: number;
  error?: string;
}

export type RecState = "idle" | "starting" | "recording" | "paused" | "finishing";

interface Toast {
  id: number;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
}

interface Ctx {
  notes: Note[];
  loaded: boolean;
  get(id: string): Note | undefined;
  load(id: string): Promise<Note | undefined>;
  update(id: string, patch: Partial<Note>): void;
  remove(id: string): Promise<void>;
  rec: { state: RecState; noteId?: string; elapsed: number; level: () => number; engineProgress?: number; error?: string; stopReason?: string };
  /** The in-browser transcriber (web only): downloaded once when the app opens. */
  asr: AsrState;
  retryAsr(): void;
  /** Web only: the sentence the teacher is saying right now, before it's final. */
  preview: { note: string; text: string } | null;
  /** Web only: which engine is writing the live transcript. "local" and "whisper" keep audio on the device. */
  liveEngine: "local" | "cloud" | "whisper" | null;
  start(opts?: { title?: string; folder?: string }): Promise<string | undefined>;
  pause(): void;
  resume(): Promise<void>;
  /** Web only: pick a class back up after the tab was closed. */
  resumeNote(id: string): Promise<void>;
  stop(): Promise<void>;
  summarize(id: string, sponsored?: boolean): Promise<void>;
  session: Session | null;
  /** False until the saved sign-in has been read, so the sign-in screen doesn't flash. */
  authReady: boolean;
  plan: Plan;
  online: boolean;
  syncState: "offline" | "syncing" | "synced" | "error" | "local";
  settings: Settings;
  setSettings(p: Partial<Settings>): void;
  toasts: Toast[];
  toast(t: Omit<Toast, "id">): void;
  dismissToast(id: number): void;
  proOpen: string | false;
  openPro(reason?: string): void;
  closePro(): void;
  /** Guest (no account yet), free account, or Pro. */
  tier: Tier;
  signupOpen: string | false;
  openSignup(reason?: string): void;
  closeSignup(): void;
  /** True if this tier can use the feature; otherwise opens the sign-up or Pro sheet and returns false. */
  need(f: Feature, reason?: string): boolean;
  nudge(moment: UpsellMoment): void;
  modelsReady: boolean | undefined;
  downloadModels(): Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

function defaultTitle(d = new Date()): string {
  return `Class ${d.getMonth() + 1}/${d.getDate()}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [plan, setPlan] = useState<Plan>("free");
  const [online, setOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<Ctx["syncState"]>(cloudEnabled ? "offline" : "local");
  const [settings, setSettingsState] = useState<Settings>(() => readJSON("nn:settings", DEFAULT_SETTINGS));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [proOpen, setProOpen] = useState<string | false>(false);
  const [signupOpen, setSignupOpen] = useState<string | false>(false);
  const [rec, setRec] = useState<Omit<Ctx["rec"], "level">>({ state: "idle", elapsed: 0 });
  const [modelsReady, setModelsReady] = useState<boolean | undefined>(isDesktop ? undefined : true);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const capture = useRef<Capture | null>(null);
  const timer = useRef<number>(0);
  const browserAsr = useRef<Worker | null>(null);
  const chunker = useRef<Chunker | null>(null);
  const live = useRef<LiveSpeech | null>(null);
  const [liveEngine, setLiveEngine] = useState<Ctx["liveEngine"]>(null);
  const notified = useRef(new Set<string>());
  const trackers = useRef(new Map<string, SpeakerTracker>());

  // ---------- notes ----------
  const reload = useCallback(async () => {
    const list = (await local.list()).filter((n) => !n.deleted);
    setNotes(list);
    setLoaded(true);
  }, []);
  useEffect(() => void reload(), [reload]);

  const get = useCallback((id: string) => notesRef.current.find((n) => n.id === id), []);

  const persist = useCallback((n: Note) => {
    void local.put(n);
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Note>) => {
      setNotes((all) =>
        all.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n, ...patch, updatedAt: new Date().toISOString() };
          persist(next);
          return next;
        }),
      );
    },
    [persist],
  );

  const load = useCallback(async (id: string) => {
    const full = await local.get(id);
    if (full) setNotes((all) => (all.some((n) => n.id === id) ? all.map((n) => (n.id === id ? full : n)) : [full, ...all]));
    return full;
  }, []);

  // Deleted notes stay as empty tombstones until synced, so other devices delete them too.
  const remove = useCallback(async (id: string) => {
    const n = notesRef.current.find((x) => x.id === id);
    if (n) await local.put(tombstone(n));
    setNotes((all) => all.filter((x) => x.id !== id));
  }, []);

  // ---------- toasts, Pro ----------
  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 6500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const openPro = useCallback((reason?: string) => {
    setProOpen(reason ?? "menu");
    track("pro_opened", { reason });
  }, []);

  // Without a sync server there's no account to make, so everything that doesn't need Pro is open.
  const tier: Tier = plan === "pro" ? "pro" : cloudEnabled && (!session || session.user.is_anonymous) ? "guest" : "free";
  const openSignup = useCallback((reason?: string) => {
    setSignupOpen(reason ?? "menu");
    track("signup_opened", { reason });
  }, []);
  const need = useCallback(
    (f: Feature, reason?: string) => {
      const step = unlockStep(tier, f);
      if (step === "signup") openSignup(reason ?? f);
      else if (step === "pro") openPro(reason ?? f);
      return step === null;
    },
    [tier, openSignup, openPro],
  );

  const nudge = useCallback(
    (moment: UpsellMoment) => {
      if (!settings.proTips) return;
      const state = readJSON<UpsellState>("nn:upsell", { installedAt: localStorage.getItem("nn:installed") ?? new Date().toISOString(), shownCount: 0, dismissedInARow: 0 });
      const d = shouldUpsell(plan, moment, state, new Date(), rec.state === "recording");
      if (!d.show) return;
      localStorage.setItem("nn:upsell", JSON.stringify(recordUpsell(state, new Date(), true)));
      track("upsell_shown", { moment });
      toast({
        title: d.title!,
        body: d.body,
        action: {
          label: "See Pro",
          run: () => {
            localStorage.setItem("nn:upsell", JSON.stringify(recordUpsell(state, new Date(), false)));
            openPro(moment);
          },
        },
      });
    },
    [plan, rec.state, settings.proTips, toast, openPro],
  );

  useEffect(() => {
    if (!localStorage.getItem("nn:installed")) localStorage.setItem("nn:installed", new Date().toISOString());
  }, []);

  // ---------- settings / theme ----------
  const setSettings = useCallback((p: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...p };
      localStorage.setItem("nn:settings", JSON.stringify(next));
      return next;
    });
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", settings.theme === "dark" || (settings.theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  // ---------- auth, plan, online ----------
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) fetchPlan().then(setPlan);
    else setPlan("free");
  }, [session]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);

  // ---------- sync ----------
  const syncer = useMemo(() => (session ? new Syncer(local, remoteFor(session), setSyncState) : null), [session]);
  const syncNow = useCallback(async () => {
    if (!syncer) return;
    try {
      await syncer.run(online);
      await reload();
    } catch {
      /* state already shows the error; retried on the next tick */
    }
  }, [syncer, online, reload]);
  useEffect(() => {
    void syncNow();
    const t = setInterval(syncNow, 60_000);
    return () => clearInterval(t);
  }, [syncNow]);

  // ---------- summaries ----------
  const summarize = useCallback(
    async (id: string, sponsored = false) => {
      const n = notesRef.current.find((x) => x.id === id);
      if (!n || !n.segments.length) return;
      // Guests get their transcript; AI notes are the first thing a free account adds.
      if (session?.user.is_anonymous) {
        openSignup("summary");
        return;
      }
      if (!session || !online) {
        update(id, { stage: "queued" });
        return;
      }
      update(id, { stage: "summarising" });
      try {
        await syncNow(); // the server summarises what it has
        const r = await requestSummary(id, sponsored);
        if (r.route === "overnight") {
          update(id, { stage: "queued" });
          nudge("batchQueued");
          return;
        }
        const cur = notesRef.current.find((x) => x.id === id)!;
        update(id, {
          summary: r.summary,
          stage: "ready",
          title: /^Class \d+\/\d+$/.test(cur.title) ? r.summary.title : cur.title,
          extractions: mergeExtractions(cur.extractions.filter((e) => e.source === "keywords"), r.summary.extractions),
        });
        nudge("summaryReady");
      } catch (e) {
        update(id, { stage: "queued" });
        toast({ title: "Couldn't write notes yet", body: "Saved; Nevernote will try again when the connection is better." });
      }
    },
    [session, online, update, syncNow, nudge, toast, openSignup],
  );

  // Back online: write notes for everything that was waiting.
  useEffect(() => {
    if (!online || !session) return;
    for (const n of notesRef.current) if (n.stage === "queued" && n.segments.length) void summarize(n.id);
  }, [online, session, summarize]);

  // ---------- live extraction + notifications ----------
  const onSegment = useCallback(
    (noteId: string, seg: Segment) => {
      setNotes((all) =>
        all.map((n) => {
          if (n.id !== noteId) return n;
          const segments = [...n.segments.filter((s) => s.id !== seg.id), seg].sort((a, b) => a.start - b.start);
          const found = extract([seg], new Date(n.createdAt));
          // A line that came back with more words replaces what was found in it before.
          const kept = n.extractions.filter((e) => e.segmentId !== seg.id || found.some((f) => f.id === e.id));
          const fresh = found.filter((f) => !kept.some((e) => e.id === f.id));
          for (const f of fresh) notifyFor(f, n);
          // Names said out loud ("I'm Maya", "thanks, Jordan") replace S1, S2; a name the student typed wins.
          const said = nameSpeakers(segments);
          const speakers = speakersOf(segments).map((sp) => {
            const prior = n.speakers.find((x) => x.id === sp.id)?.name;
            return { ...sp, name: prior && prior !== sp.id ? prior : (said[sp.id] ?? sp.id) };
          });
          const next = { ...n, segments, speakers, extractions: [...kept, ...fresh], updatedAt: new Date().toISOString() };
          persist(next);
          return next;
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, settings],
  );

  function notifyFor(e: Extraction, n: Note) {
    if (notified.current.has(e.id)) return;
    const allowed = (e.kind === "deadline" && settings.notifyDeadlines) || (e.kind === "exam" && settings.notifyExams) || (e.kind === "important" && settings.notifyImportant);
    if (!allowed) return;
    notified.current.add(e.id);
    const when = e.when ? new Date(e.when).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", ...(e.allDay ? {} : { hour: "numeric", minute: "2-digit" }) }) : "";
    const title = e.kind === "important" ? "★ Worth remembering" : `${e.kind === "exam" ? "Test" : "Due"}: ${e.title}`;
    const body = e.kind === "important" ? e.phrase : `${when}${when ? " · " : ""}${n.title}`;
    toast({ title, body });
    if (desktop) void desktop.notify(title, body, n.id);
    else if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, tag: e.id });
    if (e.kind !== "important") setTimeout(() => nudge("deadlineFound"), 4000);
  }

  // Desktop engine events.
  useEffect(() => {
    if (!desktop) return;
    const a = desktop.recorder.onSegment(({ noteId, segment }) => onSegment(noteId, segment));
    const b = desktop.recorder.onStage(({ noteId, stage, message }) => {
      update(noteId, { stage: stage as Stage });
      if (message) toast({ title: "Transcription problem", body: message });
    });
    const c = desktop.onOpenNote((id) => (location.hash = `#/app/note/${id}`));
    desktop.models.status().then((s) => setModelsReady(!!s[settings.model]));
    return () => {
      a();
      b();
      c();
    };
  }, [onSegment, update, toast, settings.model]);

  const downloadModels = useCallback(async () => {
    if (!desktop) return;
    const off = desktop.models.onProgress(({ p }) => setRec((r) => ({ ...r, engineProgress: p })));
    try {
      await desktop.models.download(settings.model);
      setModelsReady(true);
    } catch (e) {
      toast({ title: "Model download failed", body: String(e) });
    } finally {
      off();
      setRec((r) => ({ ...r, engineProgress: undefined }));
    }
  }, [settings.model, toast]);

  // ---------- recording ----------
  const recStateRef = useRef<RecState>("idle");
  const noteIdRef = useRef<string | undefined>(undefined);
  const elapsedRef = useRef(0);
  const segN = useRef(0);
  recStateRef.current = rec.state;
  noteIdRef.current = rec.noteId;
  elapsedRef.current = rec.elapsed;

  const startTimer = useCallback(() => {
    clearInterval(timer.current);
    let last = Date.now();
    timer.current = window.setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setRec((r) => (r.state === "recording" ? { ...r, elapsed: r.elapsed + dt } : r));
    }, 250);
  }, []);

  // ---------- in-browser transcriber ----------
  const [asr, setAsr] = useState<AsrState>({ state: isDesktop || liveSpeechSupported() ? "ready" : "idle" });
  const [preview, setPreview] = useState<{ note: string; text: string } | null>(null);
  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;
  /** Lines the engine folded into a longer one. */
  const dropSegsRef = useRef((noteId: string, segIds: string[]) => {
    setNotes((all) =>
      all.map((n) => {
        if (n.id !== noteId) return n;
        const next = { ...n, updatedAt: new Date().toISOString(), segments: n.segments.filter((s) => !segIds.includes(s.id)), extractions: n.extractions.filter((e) => !e.segmentId || !segIds.includes(e.segmentId)) };
        void local.put(next);
        return next;
      }),
    );
  });
  /** A new voice was confirmed on its second line: its first line goes over to it too. */
  const relabelRef = useRef((noteId: string, segId: string, speaker: string) => {
    const seg = notesRef.current.find((n) => n.id === noteId)?.segments.find((s) => s.id === segId);
    if (seg && seg.speaker !== speaker) onSegmentRef.current(noteId, { ...seg, speaker });
  });
  const ensureAsr = useCallback(() => {
    if (isDesktop) return null;
    if (!browserAsr.current) {
      const w = new Worker(new URL("../lib/browser-asr.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === "progress") setAsr((a) => (a.state === "ready" ? a : { state: "loading", p: m.p }));
        else if (m.type === "ready") setAsr({ state: "ready" });
        else if (m.type === "retry") setAsr((a) => ({ ...a, state: "loading" }));
        else if (m.type === "error") setAsr({ state: "error", error: String(m.message).slice(0, 200) });
        else if (m.type === "partial") setPreview(m.text ? { note: m.note, text: m.text } : null);
        else if (m.type === "text") setPreview(null);
        if (m.type === "text" && m.text && m.note) {
          let tr = trackers.current.get(m.note);
          if (!tr) trackers.current.set(m.note, (tr = new SpeakerTracker()));
          const speaker = tr.assign(m.vp ? { vec: Float32Array.from(m.vp.vec), voiced: m.vp.voiced } : null, m.id);
          const off = m.offset ?? 0;
          onSegmentRef.current(m.note, { id: m.id, start: m.start + off, end: m.end + off, text: m.text, speaker });
          if (tr.relabel) relabelRef.current(m.note, tr.relabel, speaker);
        }
      };
      browserAsr.current = w;
      setAsr((a) => (a.state === "idle" ? { state: "loading", p: 0 } : a));
      w.postMessage({ type: "load" });
    }
    return browserAsr.current;
  }, []);
  const retryAsr = useCallback(() => {
    setAsr({ state: "loading", p: 0 });
    ensureAsr()?.postMessage({ type: "load" });
  }, [ensureAsr]);
  // Download the transcriber as soon as the app opens, not when class starts.
  useEffect(() => {
    if (isDesktop || liveSpeechSupported() || (cloudEnabled && !session)) return;
    ensureAsr();
    void navigator.storage?.persist?.().catch(() => {});
  }, [session, ensureAsr]);

  /** The mic is lost for good: keep everything so far, pause, and let the student resume. */
  const cutOff = useCallback(
    (noteId: string, detail: string) => {
      capture.current?.stop();
      capture.current = null;
      live.current?.stop();
      live.current = null;
      chunker.current?.flush();
      logCut(noteId, "mic", elapsedRef.current, detail);
      setRec((r) => ({ ...r, state: "paused", stopReason: detail }));
      update(noteId, { stage: "paused", durationSec: elapsedRef.current });
      toast({ title: "Recording stopped", body: `${detail} Everything so far is saved. Tap Resume.` });
    },
    [update, toast],
  );

  /** Opens the mic and wires it to the transcriber. `offset` keeps timestamps going after a resume. */
  const openCapture = useCallback(
    async (noteId: string, offset: number) => {
      const onLost = (why: string) => cutOff(noteId, why);
      const d = desktop;
      if (d) {
        capture.current = await startCapture((s) => d.recorder.audio(s), settings.roomMode, onLost);
        return;
      }
      chunker.current = null;
      const whisper = () => {
        const w = ensureAsr()!;
        chunker.current = new Chunker(
          (samples, s, e) => w.postMessage({ type: "chunk", id: `${noteId.slice(-6)}-${++segN.current}`, note: noteId, offset: offset + skipped, samples, start: s, end: e }, [samples.buffer]),
          16000,
          (samples, s) => w.postMessage({ type: "partial", note: noteId, start: s + offset + skipped, samples }, [samples.buffer]),
        );
        setLiveEngine("whisper");
      };
      // The last 20 s of audio, so each finished phrase can be matched to a voice.
      const RING = 16000 * 20;
      const ring = new Float32Array(RING);
      let heard = 0; // samples since this capture opened
      let skipped = 0; // seconds heard before a switch to Whisper
      const now = () => offset + heard / 16000;
      const recent = (sec: number) => {
        const n = Math.max(0, Math.min(heard, RING, Math.round(sec * 16000)));
        const a = new Float32Array(n);
        for (let i = 0; i < n; i++) a[i] = ring[(heard - n + i) % RING];
        return a;
      };
      let phraseStart: number | null = null;
      let lastEnd = offset;
      let cutAt: number | null = null; // set when a new voice ended the phrase early
      // Who's talking right now, checked every second while a phrase is open.
      let voiceOfPhrase: string | null = null;
      let other = 0;
      let sinceCheck = 0;
      const tracker = () => {
        let tr = trackers.current.get(noteId);
        if (!tr) trackers.current.set(noteId, (tr = new SpeakerTracker()));
        return tr;
      };
      const watchVoice = (n: number) => {
        sinceCheck += n;
        if (phraseStart === null || !live.current || sinceCheck < 16000) return;
        sinceCheck = 0;
        const v = tracker().peek(voiceprint(recent(1.6)));
        if (!v) return;
        if (!voiceOfPhrase) {
          voiceOfPhrase = v;
          return;
        }
        other = v !== voiceOfPhrase ? other + 1 : 0;
        // Two seconds of a different voice: close this line so each person gets their own.
        if (other >= 2 && now() - phraseStart > 2.5) {
          cutAt = now() - 1.6;
          other = 0;
          live.current.cut();
        }
      };
      capture.current = await startCapture(
        (s) => {
          for (let i = 0; i < s.length; i++) ring[(heard + i) % RING] = s[i];
          heard += s.length;
          chunker.current?.push(s);
          watchVoice(s.length);
        },
        settings.roomMode,
        onLost,
      );
      if (!liveSpeechSupported()) return whisper();
      const ids = new Map<string, { id: string; start: number; speaker: string }>();
      try {
        live.current = await startLiveSpeech({
          track: capture.current.track,
          onInterim: (text) => {
            // The engine is about a second behind the audio.
            if (text && phraseStart === null) phraseStart = Math.max(lastEnd, now() - 1.2);
            setPreview(text ? { note: noteId, text } : null);
          },
          onFinal: (text, key, drop) => {
            const clean = text.trim()[0].toUpperCase() + text.trim().slice(1);
            const gone = drop.map((k) => ids.get(k)?.id).filter(Boolean) as string[];
            if (gone.length) dropSegsRef.current(noteId, gone);
            const known = ids.get(key);
            if (known) {
              // The engine sent this phrase again with more words: replace the line in place.
              onSegmentRef.current(noteId, { id: known.id, start: known.start, end: now(), text: clean, speaker: known.speaker });
              return;
            }
            const end = cutAt ?? now();
            const start = Math.max(lastEnd, Math.min(phraseStart ?? end - 2, end - 0.5));
            phraseStart = cutAt !== null ? cutAt : null;
            cutAt = null;
            voiceOfPhrase = null;
            other = 0;
            lastEnd = end;
            const audio = recent(now() - start).subarray(0, Math.max(0, Math.round((end - start) * 16000)));
            const id = `${noteId.slice(-6)}-${++segN.current}`;
            const tr = tracker();
            const speaker = tr.assign(voiceprint(audio), id);
            ids.set(key, { id, start, speaker });
            onSegmentRef.current(noteId, { id, start, end, text: clean, speaker });
            if (tr.relabel) relabelRef.current(noteId, tr.relabel, speaker);
          },
          onFail: () => {
            live.current = null;
            setPreview(null);
            skipped = heard / 16000;
            whisper();
          },
        });
        setLiveEngine(live.current.local ? "local" : "cloud");
      } catch {
        whisper();
      }
    },
    [settings.roomMode, cutOff, ensureAsr],
  );

  const start = useCallback(
    async (opts: { title?: string; folder?: string } = {}) => {
      if (rec.state !== "idle") return rec.noteId;
      if (isDesktop && !modelsReady) {
        await downloadModels();
      }
      setRec({ state: "starting", elapsed: 0 });
      const now = new Date();
      const note: Note = {
        id: newId(),
        title: opts.title ?? defaultTitle(now),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        durationSec: 0,
        device: deviceKind(),
        folder: opts.folder,
        stage: "recording",
        segments: [],
        speakers: [],
        extractions: [],
        thoughts: "",
        vocabulary: [],
      };
      setNotes((all) => [note, ...all]);
      persist(note);
      try {
        if (desktop) await desktop.recorder.start(note.id, settings.model, note.vocabulary ?? []);
        await openCapture(note.id, 0);
        if (!desktop && "Notification" in window && Notification.permission === "default") void Notification.requestPermission();
      } catch (e) {
        setRec({ state: "idle", elapsed: 0, error: String(e) });
        update(note.id, { stage: "failed" });
        toast({ title: "Microphone unavailable", body: "Allow microphone access and try again." });
        return;
      }
      startTimer();
      logCut(note.id, "started", 0);
      setRec({ state: "recording", noteId: note.id, elapsed: 0 });
      track("recording_started", {}, note.device);
      return note.id;
    },
    [rec.state, rec.noteId, modelsReady, downloadModels, persist, settings.model, openCapture, startTimer, update, toast],
  );

  const pause = useCallback(() => {
    capture.current?.setPaused(true);
    live.current?.setPaused(true);
    chunker.current?.flush();
    setRec((r) => ({ ...r, state: "paused", stopReason: undefined }));
    if (rec.noteId) {
      logCut(rec.noteId, "paused", elapsedRef.current);
      update(rec.noteId, { stage: "paused" });
    }
  }, [rec.noteId, update]);

  const resume = useCallback(async () => {
    const id = noteIdRef.current;
    if (!id) return;
    if (capture.current) {
      capture.current.setPaused(false);
      live.current?.setPaused(false);
    } else {
      try {
        await openCapture(id, elapsedRef.current);
      } catch {
        toast({ title: "Microphone unavailable", body: "Allow microphone access and try again." });
        return;
      }
    }
    logCut(id, "resumed", elapsedRef.current);
    setRec((r) => ({ ...r, state: "recording", stopReason: undefined }));
    update(id, { stage: "recording" });
  }, [openCapture, update, toast]);

  /** Picks a class back up after the tab was closed or reloaded (web only). */
  const resumeNote = useCallback(
    async (id: string) => {
      const n = notesRef.current.find((x) => x.id === id);
      if (!n || recStateRef.current !== "idle" || desktop) return;
      setRec({ state: "starting", noteId: id, elapsed: n.durationSec });
      try {
        await openCapture(id, n.durationSec);
      } catch {
        setRec({ state: "idle", elapsed: 0 });
        toast({ title: "Microphone unavailable", body: "Allow microphone access and try again." });
        return;
      }
      startTimer();
      logCut(id, "resumed", n.durationSec);
      setRec({ state: "recording", noteId: id, elapsed: n.durationSec });
      update(id, { stage: "recording" });
    },
    [openCapture, startTimer, update, toast],
  );

  const stop = useCallback(async () => {
    const id = rec.noteId;
    if (!id) return;
    clearInterval(timer.current);
    capture.current?.stop();
    capture.current = null;
    live.current?.stop();
    live.current = null;
    setPreview(null);
    const elapsed = rec.elapsed;
    logCut(id, "manual", elapsed);
    setRec((r) => ({ ...r, state: "finishing" }));
    update(id, { stage: "transcribing", durationSec: elapsed });
    if (desktop) {
      const r = await desktop.recorder.stop(id);
      if ("segments" in r) {
        const cur = notesRef.current.find((n) => n.id === id)!;
        const extractions = extract(r.segments, new Date(cur.createdAt));
        update(id, { segments: r.segments, speakers: speakersOf(r.segments), extractions, durationSec: r.seconds, stage: "queued" });
      } else update(id, { stage: "failed" });
    } else {
      chunker.current?.flush();
      chunker.current = null;
      // Let the last chunk finish in the worker.
      await new Promise((r) => setTimeout(r, 1500));
      update(id, { stage: "queued" });
    }
    setActive(null);
    setRec({ state: "idle", elapsed: 0 });
    track("recording_finished", { minutes: Math.round(elapsed / 60) }, deviceKind());
    void summarize(id);
  }, [rec.noteId, rec.elapsed, update, summarize]);

  // Tab safety: shout in the tab bar, warn before closing, keep the screen awake, and log Wi-Fi changes.
  const active = rec.state === "recording" || rec.state === "paused" || rec.state === "starting";
  useEffect(() => {
    if (isDesktop || !active) return;
    const mmss = () => {
      const t = Math.floor(elapsedRef.current);
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    };
    const label = () => (recStateRef.current === "recording" ? `Recording ${mmss()}. Don't close this tab` : `STOPPED ${mmss()}. Tap Resume`);
    startFlash(label, recStateRef.current === "recording" ? "#ef4444" : "#f59e0b");
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    const beat = () => noteIdRef.current && setActive({ noteId: noteIdRef.current, elapsed: elapsedRef.current });
    beat();
    const hb = window.setInterval(beat, 2000);
    window.addEventListener("pagehide", beat);
    let lock: WakeLockSentinel | undefined;
    const grab = () => {
      if (document.visibilityState === "visible") navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    };
    grab();
    document.addEventListener("visibilitychange", grab);
    return () => {
      stopFlash();
      window.removeEventListener("beforeunload", guard);
      window.removeEventListener("pagehide", beat);
      document.removeEventListener("visibilitychange", grab);
      clearInterval(hb);
      void lock?.release().catch(() => {});
    };
  }, [active]);
  // The flash colour follows paused/stopped vs recording.
  useEffect(() => {
    if (isDesktop || !active) return;
    startFlash(() => {
      const t = Math.floor(elapsedRef.current);
      const c = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
      return recStateRef.current === "recording" ? `Recording ${c}. Don't close this tab` : `STOPPED ${c}. Tap Resume`;
    }, rec.state === "recording" ? "#ef4444" : "#f59e0b");
  }, [rec.state, active]);

  const wasOnline = useRef(online);
  useEffect(() => {
    if (wasOnline.current === online) return;
    wasOnline.current = online;
    if (noteIdRef.current && recStateRef.current !== "idle") logCut(noteIdRef.current, online ? "online" : "offline", elapsedRef.current);
  }, [online]);

  // A class left "recording" by a closed or reloaded tab: save it as stopped and offer Resume.
  useEffect(() => {
    if (!loaded || isDesktop || recStateRef.current !== "idle") return;
    const hb = getActive();
    for (const n of notesRef.current) {
      if (n.stage !== "recording") continue;
      const sec = hb?.noteId === n.id ? Math.max(hb.elapsed, n.durationSec) : n.durationSec;
      logCut(n.id, "tab", sec);
      update(n.id, { stage: "paused", durationSec: sec });
    }
    setActive(null);
    // once, after the first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const value: Ctx = {
    notes,
    loaded,
    get,
    load,
    update,
    remove,
    rec: { ...rec, level: () => capture.current?.level() ?? 0 },
    start,
    pause,
    resume,
    resumeNote,
    stop,
    asr,
    retryAsr,
    preview,
    liveEngine,
    summarize,
    session,
    authReady,
    plan,
    online,
    syncState,
    settings,
    setSettings,
    toasts,
    toast,
    dismissToast,
    proOpen,
    openPro,
    closePro: () => setProOpen(false),
    tier,
    signupOpen,
    openSignup,
    closeSignup: () => setSignupOpen(false),
    need,
    nudge,
    modelsReady,
    downloadModels,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
