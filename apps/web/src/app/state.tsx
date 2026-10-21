// App state: notes, the live recorder, sync, summaries, settings and the
// gentle Pro nudges. One provider, shared by the website app and the desktop app.

import {
  extract,
  mergeExtractions,
  shouldUpsell,
  recordUpsell,
  speakersOf,
  Syncer,
  tombstone,
  type Extraction,
  type Note,
  type Plan,
  type Segment,
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
import { Chunker } from "../lib/vad.ts";

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
  rec: { state: RecState; noteId?: string; elapsed: number; level: () => number; engineProgress?: number; error?: string };
  start(opts?: { title?: string; folder?: string }): Promise<string | undefined>;
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
  summarize(id: string, sponsored?: boolean): Promise<void>;
  session: Session | null;
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
  const [plan, setPlan] = useState<Plan>("free");
  const [online, setOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<Ctx["syncState"]>(cloudEnabled ? "offline" : "local");
  const [settings, setSettingsState] = useState<Settings>(() => readJSON("nn:settings", DEFAULT_SETTINGS));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [proOpen, setProOpen] = useState<string | false>(false);
  const [rec, setRec] = useState<Omit<Ctx["rec"], "level">>({ state: "idle", elapsed: 0 });
  const [modelsReady, setModelsReady] = useState<boolean | undefined>(isDesktop ? undefined : true);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const capture = useRef<Capture | null>(null);
  const timer = useRef<number>(0);
  const browserAsr = useRef<Worker | null>(null);
  const chunker = useRef<Chunker | null>(null);
  const notified = useRef(new Set<string>());

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
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
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
    [session, online, update, syncNow, nudge, toast],
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
          const fresh = found.filter((f) => !n.extractions.some((e) => e.id === f.id));
          for (const f of fresh) notifyFor(f, n);
          const next = { ...n, segments, extractions: [...n.extractions, ...fresh], updatedAt: new Date().toISOString() };
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
        const d = desktop;
        if (d) {
          await d.recorder.start(note.id, settings.model, note.vocabulary ?? []);
          capture.current = await startCapture((s) => d.recorder.audio(s), settings.roomMode);
        } else {
          browserAsr.current ??= new Worker(new URL("../lib/browser-asr.worker.ts", import.meta.url), { type: "module" });
          const w = browserAsr.current;
          let n = 0;
          w.onmessage = (e) => {
            const m = e.data;
            if (m.type === "progress") setRec((r) => ({ ...r, engineProgress: m.p < 1 ? m.p : undefined }));
            if (m.type === "text" && m.text) onSegment(note.id, { id: m.id, start: m.start, end: m.end, text: m.text });
          };
          w.postMessage({ type: "load" });
          chunker.current = new Chunker((samples, s, e) => w.postMessage({ type: "chunk", id: `${note.id.slice(-6)}-${++n}`, samples, start: s, end: e }, [samples.buffer]));
          capture.current = await startCapture((s) => chunker.current!.push(s), settings.roomMode);
          if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
        }
      } catch (e) {
        setRec({ state: "idle", elapsed: 0, error: String(e) });
        update(note.id, { stage: "failed" });
        toast({ title: "Microphone unavailable", body: "Allow microphone access and try again." });
        return;
      }
      const t0 = Date.now();
      let pausedMs = 0;
      let pausedAt = 0;
      timer.current = window.setInterval(() => {
        setRec((r) => {
          if (r.state === "paused") {
            pausedAt ||= Date.now();
            return r;
          }
          if (pausedAt) {
            pausedMs += Date.now() - pausedAt;
            pausedAt = 0;
          }
          return { ...r, elapsed: (Date.now() - t0 - pausedMs) / 1000 };
        });
      }, 250);
      setRec({ state: "recording", noteId: note.id, elapsed: 0 });
      track("recording_started", {}, note.device);
      return note.id;
    },
    [rec.state, rec.noteId, modelsReady, downloadModels, persist, settings.model, settings.roomMode, onSegment, update, toast],
  );

  const pause = useCallback(() => {
    capture.current?.setPaused(true);
    chunker.current?.flush();
    setRec((r) => ({ ...r, state: "paused" }));
    if (rec.noteId) update(rec.noteId, { stage: "paused" });
  }, [rec.noteId, update]);

  const resume = useCallback(() => {
    capture.current?.setPaused(false);
    setRec((r) => ({ ...r, state: "recording" }));
    if (rec.noteId) update(rec.noteId, { stage: "recording" });
  }, [rec.noteId, update]);

  const stop = useCallback(async () => {
    const id = rec.noteId;
    if (!id) return;
    clearInterval(timer.current);
    capture.current?.stop();
    capture.current = null;
    const elapsed = rec.elapsed;
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
    setRec({ state: "idle", elapsed: 0 });
    track("recording_finished", { minutes: Math.round(elapsed / 60) }, deviceKind());
    void summarize(id);
  }, [rec.noteId, rec.elapsed, update, summarize]);

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
    stop,
    summarize,
    session,
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
    nudge,
    modelsReady,
    downloadModels,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
