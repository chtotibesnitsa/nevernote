// Live words from the browser's own speech engine (Chrome, Edge, Safari): words
// stream in a few hundred milliseconds after they're said, on any laptop, at no
// cost to us. Newer Chrome and Safari can run it fully on-device; when they
// can't, Chrome sends the audio to Google, and `local` says which one it is.
// Firefox has no engine, so the app falls back to Whisper in a worker.

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;
const Ctor = (): (new () => SR) | undefined => (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;

export const liveSpeechSupported = () => !!Ctor();

/**
 * Uses the browser's on-device model when it already has one. If it can fetch
 * one, that download starts in the background for next time: class never waits
 * on it, and a stalled download can't hold up the first words.
 */
async function onDevice(lang: string, onInstalled: () => void): Promise<boolean> {
  const C = Ctor() as any;
  if (!C?.available) return false;
  const opts = { langs: [lang], processLocally: true };
  try {
    const state = await Promise.race([C.available(opts), new Promise((r) => setTimeout(() => r("slow"), 2000))]);
    if (state === "available") return true;
    // The model is fetched in the background; the next phrase after it lands runs on-device.
    if (state === "downloadable" || state === "downloading")
      void Promise.resolve(C.install?.(opts))
        .then((ok) => ok && onInstalled())
        .catch(() => {});
  } catch {
    // older API shape: no on-device mode
  }
  return false;
}

/** Contextual biasing (newer Chrome, on-device): class terms the engine should expect. */
const PhraseCtor = (): (new (p: string, boost: number) => unknown) | undefined => (globalThis as any).SpeechRecognitionPhrase;

export interface LiveSpeech {
  /** True when the audio never leaves the device. */
  local: boolean;
  setPaused(p: boolean): void;
  /** Ends the phrase in progress now (a new voice took over), and keeps listening. */
  cut(): void;
  stop(): void;
}

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, "").split(/\s+/).filter(Boolean);

/** Drops the start of `next` when it repeats the end of `prev` (some engines resend a few words after a restart). */
export function dropOverlap(prev: string, next: string): string {
  const a = words(prev);
  const b = words(next);
  for (let n = Math.min(a.length, b.length, 12); n >= 3; n--) {
    if (a.slice(-n).join(" ") === b.slice(0, n).join(" ")) return next.trim().split(/\s+/).slice(n).join(" ");
  }
  return next;
}

/**
 * Starts continuous recognition. `onInterim` gets the sentence in progress on
 * every word; `onFinal` gets each finished phrase. The engine ends itself after
 * silences or about a minute; it's restarted right away so class never drops.
 * `onFail` fires when it can't run at all (blocked, offline without on-device
 * support), so the caller can switch to Whisper.
 */
export async function startLiveSpeech(opts: {
  lang?: string;
  /** The mic after our gain stage. Newer Chrome listens to it instead of opening its own, so quiet and far voices come through. */
  track?: MediaStreamTrack;
  /** Class vocabulary to listen for ("mitosis", "Le Chatelier's principle"). */
  phrases?: string[];
  /** The engine moved on-device mid-class (its model finished downloading). */
  onLocal?(): void;
  onInterim(text: string): void;
  /** `key` is stable per phrase: a phrase the engine sends again with more words comes back with the same key, to replace it. `drop` lists earlier phrases now folded into this one. */
  onFinal(text: string, key: string, drop: string[]): void;
  onFail(why: string): void;
}): Promise<LiveSpeech> {
  const C = Ctor();
  if (!C) throw new Error("no speech engine");
  const lang = opts.lang ?? (navigator.language?.startsWith("en") ? navigator.language : "en-US");
  let local = await onDevice(lang, () => {
    local = true;
    opts.onLocal?.();
  });
  let phrases = !!opts.phrases?.length && !!PhraseCtor();
  let running = true;
  let paused = false;
  let rec: SR | null = null;
  let fails = 0;
  let lastStart = 0;
  let session = 0;
  let useTrack = !!opts.track;
  // Finished phrases this engine session, oldest first.
  let done: { key: string; text: string }[] = [];
  let last: { key: string; text: string } | null = null;
  const norm = (t: string) => words(t).join(" ");

  const final = (text: string, key: string) => {
    const b = norm(text);
    if (!b) return;
    // Some engines (Chrome on Android, some on-device models) send everything
    // so far as one growing final: fold the lines it repeats into one.
    for (let j = 0; j < done.length; j++) {
      const joined = norm(done.slice(j).map((d) => d.text).join(" "));
      if (b === joined && done[j].key !== key && b.split(" ").length >= 3) return;
      const grew = b.length > joined.length && b.startsWith(joined + " ");
      if (grew || (b === joined && j < done.length - 1)) {
        const drop = done.slice(j + 1).map((d) => d.key);
        const keep = done[j].key;
        done = [...done.slice(0, j), { key: keep, text }];
        last = done.at(-1)!;
        opts.onFinal(text, keep, drop);
        return;
      }
    }
    const same = done.findIndex((d) => d.key === key);
    if (same >= 0) done[same] = { key, text };
    else {
      // After a restart the engine can resend a few words from the end of the last line.
      if (last && words(text).length >= 3 && norm(last.text).endsWith(b)) return;
      if (last) text = dropOverlap(last.text, text);
      if (!text.trim()) return;
      done.push({ key, text });
    }
    last = { key, text };
    opts.onFinal(text, key, []);
  };

  const make = () => {
    const r: SR = new C();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.maxAlternatives = 1;
    if (local) r.processLocally = true;
    if (phrases && local) {
      try {
        const P = PhraseCtor()!;
        // A light boost: a strong one makes the engine "hear" class terms in noise.
        r.phrases = opts.phrases!.map((p) => new P(p, 1.5));
      } catch {
        phrases = false;
      }
    }
    const id = ++session;
    done = [];
    const sent = new Map<number, string>();
    r.onresult = (e: any) => {
      fails = 0;
      let interim = "";
      // Walk every result, not just the changed ones: the line in progress is
      // all the unfinished results together, so it never shrinks or jumps.
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const text = String(res[0]?.transcript ?? "").trim();
        if (!text) continue;
        if (res.isFinal) {
          if (sent.get(i) === text) continue;
          // A short phrase the engine itself doubts is usually noise heard as words.
          const conf = Number(res[0]?.confidence ?? 0);
          if (conf > 0 && conf < 0.3 && words(text).length <= 4) {
            sent.set(i, text);
            continue;
          }
          sent.set(i, text);
          final(text, `${id}-${i}`);
        } else interim += (interim ? " " : "") + text;
      }
      opts.onInterim(last && interim ? dropOverlap(last.text, interim) : interim);
    };
    r.onerror = (e: any) => {
      const err = String(e.error ?? "");
      if (err === "no-speech" || err === "aborted") return;
      if (err === "phrases-not-supported") {
        phrases = false; // onend reopens it without the hints
        return;
      }
      if (err === "audio-capture" && useTrack) {
        useTrack = false; // the engine can't read our track: onend reopens it on the default mic
        return;
      }
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
      if (useTrack && opts.track?.readyState === "live") rec.start(opts.track);
      else rec.start();
    } catch (e) {
      // Older engines take no track: listen to the default mic instead.
      if (useTrack && e instanceof TypeError) {
        useTrack = false;
        try {
          rec.start();
        } catch {
          // already started
        }
      }
    }
  };
  begin();
  return {
    get local() {
      return local;
    },
    setPaused(p) {
      paused = p;
      if (p) rec?.stop();
      else if (running) begin();
    },
    cut() {
      // stop() finalizes what was heard so far; onend starts the next phrase.
      if (running && !paused) rec?.stop();
    },
    stop() {
      running = false;
      rec?.stop();
    },
  };
}
