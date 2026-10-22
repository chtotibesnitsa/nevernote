// Live words from the browser's own speech engine (Chrome, Edge, Safari): words
// stream in a few hundred milliseconds after they're said, on any laptop, at no
// cost to us. Newer Chrome and Safari can run it fully on-device; when they
// can't, Chrome sends the audio to Google, and `local` says which one it is.
// Firefox has no engine, so the app falls back to Whisper in a worker.

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;
const Ctor = (): (new () => SR) | undefined => (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;

export const liveSpeechSupported = () => !!Ctor();

/** Asks the browser for its on-device model, installing it if it offers one. */
async function onDevice(lang: string): Promise<boolean> {
  const C = Ctor() as any;
  if (!C?.available) return false;
  try {
    const state = await C.available({ langs: [lang], processLocally: true });
    if (state === "available") return true;
    if (state === "downloadable" || state === "downloading") return !!(await C.install({ langs: [lang], processLocally: true }));
  } catch {
    // older API shape: no on-device mode
  }
  return false;
}

export interface LiveSpeech {
  /** True when the audio never leaves the device. */
  local: boolean;
  setPaused(p: boolean): void;
  stop(): void;
}

/**
 * Starts continuous recognition. `onInterim` gets the sentence in progress on
 * every word; `onFinal` gets each finished phrase. The engine ends itself after
 * silences or about a minute; it's restarted right away so class never drops.
 * `onFail` fires when it can't run at all (blocked, offline without on-device
 * support), so the caller can switch to Whisper.
 */
export async function startLiveSpeech(opts: { lang?: string; onInterim(text: string): void; onFinal(text: string): void; onFail(why: string): void }): Promise<LiveSpeech> {
  const C = Ctor();
  if (!C) throw new Error("no speech engine");
  const lang = opts.lang ?? (navigator.language?.startsWith("en") ? navigator.language : "en-US");
  const local = await onDevice(lang);
  let running = true;
  let paused = false;
  let rec: SR | null = null;
  let fails = 0;
  let lastStart = 0;

  const make = () => {
    const r: SR = new C();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.maxAlternatives = 1;
    if (local) r.processLocally = true;
    r.onresult = (e: any) => {
      fails = 0;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = String(res[0]?.transcript ?? "").trim();
        if (!text) continue;
        if (res.isFinal) opts.onFinal(text);
        else interim += (interim ? " " : "") + text;
      }
      opts.onInterim(interim);
    };
    r.onerror = (e: any) => {
      const err = String(e.error ?? "");
      if (err === "no-speech" || err === "aborted") return;
      if (err === "not-allowed" || err === "service-not-allowed" || err === "language-not-supported") {
        running = false;
        opts.onFail(err);
        return;
      }
      // network, audio-capture: retried by onend, but give up if it keeps failing
      if (++fails >= 4) {
        running = false;
        opts.onFail(err);
      }
    };
    r.onend = () => {
      opts.onInterim("");
      if (!running || paused) return;
      // Don't spin if the engine ends instantly over and over.
      const wait = performance.now() - lastStart < 1000 ? 400 : 0;
      setTimeout(() => running && !paused && begin(), wait);
    };
    return r;
  };
  const begin = () => {
    lastStart = performance.now();
    rec = make();
    try {
      rec.start();
    } catch {
      // already started
    }
  };
  begin();
  return {
    local,
    setPaused(p) {
      paused = p;
      if (p) rec?.stop();
      else if (running) begin();
    },
    stop() {
      running = false;
      rec?.stop();
    },
  };
}
