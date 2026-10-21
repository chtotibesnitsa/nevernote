// Everything the screens share: notes, the recorder, sync, summaries and the
// gentle Pro nudges. Module-level so the recorder survives screen changes and
// keeps running with the phone locked.
import {
  extract,
  mergeExtractions,
  recordUpsell,
  shouldUpsell,
  speakersOf,
  Syncer,
  type LiveSegment,
  type Note,
  type Plan,
  type Segment,
  type Stage,
  type UpsellMoment,
  type UpsellState,
} from "@nevernote/core";
import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as Network from "expo-network";
import { AppState } from "react-native";
import { fetchPlan, remoteFor, requestSummary, supabase, track } from "../lib/cloud";
import { audioFile, local } from "../lib/local";
import { ensureModels, modelsReady, type ModelPaths } from "../lib/models";
import { announce, askPermission } from "../lib/notify";
import { PhoneRecorder, preload } from "../lib/recorder";
import { settings } from "./settings";
import { createStore } from "./store";

export type RecState = "idle" | "starting" | "recording" | "paused" | "finishing";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
}

interface AppData {
  notes: Note[];
  loaded: boolean;
  session: Session | null;
  plan: Plan;
  online: boolean;
  wifi: boolean;
  syncState: "offline" | "syncing" | "synced" | "error" | "local";
  rec: { state: RecState; noteId?: string; elapsed: number; error?: string };
  models: { ready?: boolean; progress?: number; error?: string };
  toasts: Toast[];
}

export const app = createStore<AppData>({
  notes: [],
  loaded: false,
  session: null,
  plan: "free",
  online: true,
  wifi: true,
  syncState: supabase ? "offline" : "local",
  rec: { state: "idle", elapsed: 0 },
  models: {},
  toasts: [],
});

export const useApp = <U,>(select: (s: AppData) => U): U => app.use(select);

const upsell = createStore<UpsellState>({ installedAt: new Date().toISOString(), shownCount: 0, dismissedInARow: 0 }, "nn:upsell");

let recorder: PhoneRecorder | null = null;
let paths: ModelPaths | null = null;
let ticker: ReturnType<typeof setInterval> | undefined;
let syncer: Syncer | null = null;

export function newId(): string {
  return `${Date.now().toString(36)}-${Crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function tap(kind: "light" | "medium" | "success" = "light") {
  if (!settings.get().haptics) return;
  if (kind === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

// ---------- notes ----------

export function getNote(id: string): Note | undefined {
  return app.get().notes.find((n) => n.id === id);
}

export async function reload(): Promise<void> {
  const notes = await local.list();
  app.set({ notes, loaded: true });
}

export function update(id: string, patch: Partial<Note>): void {
  app.set((s) => ({
    notes: s.notes.map((n) => {
      if (n.id !== id) return n;
      const next = { ...n, ...patch, updatedAt: new Date().toISOString() };
      void local.put(next);
      return next;
    }),
  }));
}

export async function removeNote(id: string): Promise<void> {
  await local.delete(id);
  app.set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
}

export function renameSpeaker(noteId: string, speakerId: string, name: string): void {
  const n = getNote(noteId);
  if (!n) return;
  update(noteId, { speakers: n.speakers.map((s) => (s.id === speakerId ? { ...s, name } : s)) });
}

// ---------- toasts and Pro ----------

export function toast(t: Omit<Toast, "id">): void {
  const id = Date.now() + Math.random();
  app.set((s) => ({ toasts: [...s.toasts.slice(-1), { ...t, id }] }));
  setTimeout(() => dismissToast(id), 6000);
}

export function dismissToast(id: number): void {
  app.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
}

/** Set by the root layout so non-React code can open the Pro sheet. */
export const nav = { openPro: (_reason: string) => {}, openNote: (_id: string) => {} };

export function openPro(reason: string): void {
  track("pro_opened", { reason });
  nav.openPro(reason);
}

/** At most once every few days, never in the first two days, never while recording. */
export function nudge(moment: UpsellMoment): void {
  if (!settings.get().proTips) return;
  const s = app.get();
  const d = shouldUpsell(s.plan, moment, upsell.get(), new Date(), s.rec.state === "recording");
  if (!d.show) return;
  upsell.set(recordUpsell(upsell.get(), new Date(), true));
  track("upsell_shown", { moment });
  toast({
    title: d.title!,
    body: d.body,
    action: {
      label: "See Pro",
      run: () => {
        upsell.set({ dismissedInARow: 0 });
        openPro(moment);
      },
    },
  });
}

// ---------- connectivity, auth, sync ----------

function canSummarise(): boolean {
  const s = app.get();
  return !!s.session && s.online && (!settings.get().wifiOnly || s.wifi);
}

export async function syncNow(): Promise<void> {
  if (!syncer) return;
  try {
    await syncer.run(app.get().online);
    if (app.get().rec.state === "idle") await reload();
  } catch {
    /* the pill already shows the error; retried on the next tick */
  }
}

function onSession(session: Session | null) {
  app.set({ session, syncState: session ? "offline" : supabase ? "offline" : "local" });
  syncer = session ? new Syncer(local, remoteFor(session), (syncState) => app.set({ syncState })) : null;
  if (session) {
    void fetchPlan().then((plan) => app.set({ plan }));
    void syncNow().then(flushQueue);
  } else app.set({ plan: "free" });
}

/** Back online: write notes for everything that was waiting. */
function flushQueue() {
  if (!canSummarise()) return;
  for (const n of app.get().notes) if (n.stage === "queued" && n.segments.length) void summarize(n.id);
}

let started = false;
export async function init(): Promise<void> {
  if (started) return;
  started = true;
  await Promise.all([settings.ready, upsell.ready, reload()]);
  const net = await Network.getNetworkStateAsync().catch(() => null);
  app.set({ online: net?.isInternetReachable ?? net?.isConnected ?? true, wifi: net?.type === Network.NetworkStateType.WIFI });
  Network.addNetworkStateListener((e) => {
    const online = e.isInternetReachable ?? e.isConnected ?? false;
    const was = app.get().online;
    app.set({ online, wifi: e.type === Network.NetworkStateType.WIFI });
    if (online && !was) void syncNow().then(flushQueue);
  });
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    onSession(data.session);
    supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.access_token !== app.get().session?.access_token) onSession(s);
    });
  }
  setInterval(() => void syncNow(), 60_000);
  AppState.addEventListener("change", (st) => {
    if (st === "active") void syncNow().then(flushQueue);
  });
  // Recover anything left mid-recording by a crash: the words saved so far are kept.
  for (const n of app.get().notes) if (["recording", "paused", "transcribing", "labelling"].includes(n.stage)) update(n.id, { stage: n.segments.length ? "queued" : "failed" });
  const ready = await modelsReady().catch(() => false);
  app.set({ models: { ready } });
  if (ready) void ensureModels().then((p) => {
    paths = p;
    preload(p);
  });
}

// ---------- models ----------

export async function downloadModels(): Promise<ModelPaths | null> {
  if (paths) return paths;
  app.set({ models: { ready: false, progress: 0 } });
  try {
    paths = await ensureModels((progress) => app.set({ models: { ready: false, progress } }));
    app.set({ models: { ready: true } });
    preload(paths);
    track("models_downloaded");
    return paths;
  } catch (e) {
    app.set({ models: { ready: false, error: String(e) } });
    toast({ title: "Download paused", body: "Nevernote will pick up where it left off. Wi-Fi helps; it's about 530 MB once." });
    return null;
  }
}

// ---------- summaries ----------

export async function summarize(id: string, sponsored = false): Promise<void> {
  const n = getNote(id);
  if (!n || !n.segments.length) return;
  if (!canSummarise()) return update(id, { stage: "queued" });
  update(id, { stage: "summarising" });
  try {
    await syncNow(); // the server summarises what it has
    const r = await requestSummary(id, sponsored);
    if (r.route === "overnight") {
      update(id, { stage: "queued" });
      nudge("batchQueued");
      return;
    }
    const cur = getNote(id)!;
    update(id, {
      summary: r.summary,
      stage: "ready",
      title: /^Class \d+\/\d+$/.test(cur.title) ? r.summary.title : cur.title,
      extractions: mergeExtractions(cur.extractions.filter((e) => e.source === "keywords"), r.summary.extractions),
    });
    tap("success");
    nudge("summaryReady");
  } catch {
    update(id, { stage: "queued" });
  }
}

// ---------- recording ----------

function onSegment(noteId: string, seg: Segment) {
  app.set((s) => ({
    notes: s.notes.map((n) => {
      if (n.id !== noteId) return n;
      const segments = [...n.segments.filter((x) => x.id !== seg.id), seg].sort((a, b) => a.start - b.start);
      const fresh = extract([seg], new Date(n.createdAt)).filter((f) => !n.extractions.some((e) => e.id === f.id));
      const next = { ...n, segments, extractions: [...n.extractions, ...fresh], updatedAt: new Date().toISOString() };
      void local.put(next);
      for (const f of fresh) {
        void announce(f, next);
        if (f.kind !== "important") {
          tap("medium");
          setTimeout(() => nudge("deadlineFound"), 4000);
        }
      }
      return next;
    }),
  }));
}

const plain = (s: LiveSegment): Segment => ({ id: s.id, start: s.start, end: s.end, text: s.text, speaker: s.speaker });

export async function start(opts: { title?: string; folder?: string } = {}): Promise<string | undefined> {
  const r = app.get().rec;
  if (r.state !== "idle") return r.noteId;
  app.set({ rec: { state: "starting", elapsed: 0 } });
  const p = paths ?? (await downloadModels());
  if (!p) {
    app.set({ rec: { state: "idle", elapsed: 0 } });
    return;
  }
  void askPermission();
  const now = new Date();
  const note: Note = {
    id: newId(),
    title: opts.title ?? `Class ${now.getMonth() + 1}/${now.getDate()}`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    durationSec: 0,
    device: "ios",
    folder: opts.folder,
    stage: "recording",
    segments: [],
    speakers: [],
    extractions: [],
    thoughts: "",
    vocabulary: [],
  };
  app.set((s) => ({ notes: [note, ...s.notes] }));
  void local.put(note);
  const rec = new PhoneRecorder(
    p,
    audioFile(note.id),
    (s) => onSegment(note.id, plain(s)),
    (m) => toast({ title: "Microphone hiccup", body: m }),
    note.id.slice(-6),
  );
  try {
    await rec.start();
  } catch (e) {
    app.set({ rec: { state: "idle", elapsed: 0, error: String(e) } });
    update(note.id, { stage: "failed" });
    toast({ title: "Microphone unavailable", body: "Allow microphone access in Settings › Nevernote, then try again." });
    return;
  }
  recorder = rec;
  tap("medium");
  ticker = setInterval(() => {
    const cur = app.get().rec;
    if (cur.state === "recording") app.set({ rec: { ...cur, elapsed: rec.seconds } });
  }, 250);
  app.set({ rec: { state: "recording", noteId: note.id, elapsed: 0 } });
  track("recording_started");
  return note.id;
}

export function level(): number {
  return recorder?.level() ?? 0;
}

export function pause(): void {
  const r = app.get().rec;
  if (r.state !== "recording" || !recorder) return;
  recorder.pause();
  tap();
  app.set({ rec: { ...r, state: "paused" } });
  if (r.noteId) update(r.noteId, { stage: "paused" });
}

export function resume(): void {
  const r = app.get().rec;
  if (r.state !== "paused" || !recorder) return;
  recorder.resume();
  tap();
  app.set({ rec: { ...r, state: "recording" } });
  if (r.noteId) update(r.noteId, { stage: "recording" });
}

export async function stop(): Promise<void> {
  const r = app.get().rec;
  const rec = recorder;
  if (!r.noteId || !rec) return;
  const id = r.noteId;
  clearInterval(ticker);
  tap("success");
  app.set({ rec: { ...r, state: "finishing" } });
  update(id, { durationSec: rec.seconds });
  try {
    const segs = (await rec.finish((stage: Stage) => update(id, { stage }))).map(plain);
    const cur = getNote(id)!;
    const keywords = extract(segs, new Date(cur.createdAt));
    update(id, { segments: segs, speakers: speakersOf(segs), extractions: mergeExtractions(keywords, cur.extractions.filter((e) => e.source === "ai")), durationSec: rec.seconds, stage: "queued" });
  } catch {
    update(id, { stage: getNote(id)?.segments.length ? "queued" : "failed" });
  }
  recorder = null;
  app.set({ rec: { state: "idle", elapsed: 0 } });
  track("recording_finished", { minutes: Math.round(rec.seconds / 60) });
  void summarize(id);
}
