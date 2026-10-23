// Pure transcript plumbing shared by the desktop, phone and browser engines:
// timed words from model tokens, readable bubbles, and speaker labelling.

export interface Word {
  w: string;
  /** Seconds from the start of the recording. */
  t: number;
}

export interface LiveSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: Word[];
}

export interface SpeakerTurn {
  start: number;
  end: number;
  speaker: number;
}

/** Joins sub-word tokens (" fe", "ll", "ow") into timed words. */
export function tokensToWords(tokens: string[], times: number[], offset: number): Word[] {
  const words: Word[] = [];
  tokens.forEach((tok, i) => {
    const t = offset + (times[i] ?? 0);
    if (words.length === 0 || /^\s/.test(tok)) {
      words.push({ w: tok.trim(), t });
    } else {
      words[words.length - 1].w += tok;
    }
  });
  return words.filter((w) => w.w);
}

/**
 * Cuts timed words into short, readable bubbles: at sentence ends, at pauses
 * over a second, and whenever the speaker changes.
 */
export function regroup(words: (Word & { speaker?: string })[], end: number, idPrefix: string, startN = 0): LiveSegment[] {
  const out: LiveSegment[] = [];
  let cur: (Word & { speaker?: string })[] = [];
  let n = startN;
  const flush = (until: number) => {
    if (!cur.length) return;
    out.push({
      id: `${idPrefix}-${++n}`,
      start: cur[0].t,
      end: until,
      text: cur.map((w) => w.w).join(" ").replace(/\s+([,.?!;:])/g, "$1"),
      speaker: cur[0].speaker,
      words: cur.map(({ w, t }) => ({ w, t })),
    });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = cur[cur.length - 1];
    if (prev && (w.speaker !== prev.speaker || w.t - prev.t > 1.2)) flush(w.t);
    cur.push(w);
    const next = words[i + 1];
    if (/[.?!]$/.test(w.w) && !/^(?:[ap]\.m\.|mr\.|mrs\.|ms\.|dr\.|prof\.|e\.g\.|i\.e\.|vs\.|st\.)$/i.test(w.w) && cur.length >= 3) flush(next ? next.t : end);
  });
  flush(end);
  return out;
}

/**
 * Turns over-loud chunks down to a common level. Never boosts: on the bench
 * trials boosting quiet chunks added phantom words and fixed nothing.
 */
export function levelChunk(c: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < c.length; i++) sum += c[i] * c[i];
  const rms = Math.sqrt(sum / Math.max(1, c.length));
  const gain = Math.min(0.1 / (rms + 1e-6), 1);
  const out = new Float32Array(c.length);
  for (let i = 0; i < c.length; i++) out[i] = Math.max(-1, Math.min(1, c[i] * gain));
  return out;
}

/**
 * Gives every word the speaker talking at that instant (or the nearest turn)
 * and rebuilds the bubbles. Speakers are numbered by first appearance, so S1
 * is whoever spoke first.
 */
export function labelSpeakers(segments: LiveSegment[], turns: SpeakerTurn[], total: number, idPrefix: string): LiveSegment[] {
  if (!turns.length) return segments;
  const who = (t: number): number | undefined => {
    let best: number | undefined;
    let dist = Infinity;
    for (const turn of turns) {
      const d = t < turn.start ? turn.start - t : t > turn.end ? t - turn.end : 0;
      if (d < dist) [best, dist] = [turn.speaker, d];
      if (d === 0) break;
    }
    return best;
  };
  // Name speakers in the order they are first heard in the transcript.
  const names = new Map<number, string>();
  const name = (id: number | undefined) => {
    if (id === undefined) return undefined;
    if (!names.has(id)) names.set(id, `S${names.size + 1}`);
    return names.get(id);
  };
  if (segments.every((s) => s.words?.length)) {
    const words = segments.flatMap((s) => s.words!.map((w) => ({ ...w, raw: who(w.t + 0.05) })));
    // A lone word flipped to another speaker between two agreeing neighbours is a boundary wobble.
    for (let i = 0; i < words.length; i++) {
      const a = words[i - 1]?.raw ?? words[i + 1]?.raw;
      const b = words[i + 1]?.raw ?? a;
      if (a !== undefined && a === b && words[i].raw !== a) words[i].raw = a;
    }
    return regroup(words.map(({ w, t, raw }) => ({ w, t, speaker: name(raw) })), total, idPrefix);
  }
  return segments.map((s) => ({ ...s, speaker: name(who((s.start + s.end) / 2)) }));
}

/**
 * A small energy-based speech chunker for engines without Silero VAD (browser
 * and phone). Tracks the noise floor and cuts at real pauses, so each chunk is
 * a whole sentence or two.
 *
 * Tuned on far-field recordings (a teacher 10+ feet away, -42 to -50 dBFS):
 * the old thresholds dropped most quiet speech and cut words in half, which is
 * what made the models invent text. A short pre-roll keeps the first syllable,
 * and `onPartial` hands over the sentence so far about once a second, so words
 * show up while the teacher is still talking.
 */
export class Chunker {
  private buf: Float32Array[] = [];
  private len = 0;
  private start = 0;
  private t = 0;
  private floor = 0.004;
  private silentFor = 0;
  private voiced = 0;
  private pre: Float32Array[] = [];
  private preLen = 0;
  private sincePartial = 0;
  constructor(
    private onChunk: (samples: Float32Array, start: number, end: number) => void,
    private rate = 16000,
    private onPartial?: (samples: Float32Array, start: number) => void,
  ) {}

  push(s: Float32Array): void {
    let e = 0;
    for (const v of s) e += v * v;
    const rms = Math.sqrt(e / s.length);
    const dur = s.length / this.rate;
    // Noise floor adapts slowly upward, quickly downward.
    this.floor = rms < this.floor ? this.floor * 0.9 + rms * 0.1 : this.floor * 0.995 + rms * 0.005;
    const speech = rms > this.floor * 1.5 + 0.0002;
    if (this.len === 0 && !speech) {
      // Keep the last 0.4 s so the start of the first word isn't clipped.
      this.pre.push(s);
      this.preLen += s.length;
      while (this.pre.length > 1 && this.preLen - this.pre[0].length >= 0.4 * this.rate) this.preLen -= this.pre.shift()!.length;
      this.t += dur;
      return;
    }
    if (this.len === 0) {
      this.start = this.t - this.preLen / this.rate;
      this.buf = this.pre;
      this.len = this.preLen;
      this.pre = [];
      this.preLen = 0;
    }
    this.buf.push(s);
    this.len += s.length;
    this.t += dur;
    if (speech) {
      this.silentFor = 0;
      this.voiced += dur;
    } else this.silentFor += dur;
    const total = this.len / this.rate;
    if ((this.silentFor >= 1.0 && total > 3) || total > 12) return this.flush();
    this.sincePartial += dur;
    if (this.onPartial && this.sincePartial >= 1 && this.voiced > 0.3) {
      this.sincePartial = 0;
      this.onPartial(this.joined(), this.start);
    }
  }

  private joined(): Float32Array {
    const out = new Float32Array(this.len);
    let o = 0;
    for (const b of this.buf) {
      out.set(b, o);
      o += b.length;
    }
    return out;
  }

  flush(): void {
    if (this.len === 0) return;
    const out = this.joined();
    if (this.voiced > 0.3) this.onChunk(out, this.start, this.start + out.length / this.rate);
    this.buf = [];
    this.len = 0;
    this.silentFor = 0;
    this.voiced = 0;
    this.sincePartial = 0;
  }
}

/**
 * Brings far-away speech up to a normal level for the model: the loudest 30%
 * of 25 ms frames (the speech) is set to about -22 dBFS, with up to 30x gain.
 * Measured on far-field trials this beats leaving quiet chunks alone.
 */
export function boostChunk(c: Float32Array, maxGain = 30): Float32Array {
  const F = 400;
  const n = Math.floor(c.length / F);
  if (!n) return c;
  const e = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * F; i < (f + 1) * F; i++) s += c[i] * c[i];
    e[f] = s / F;
  }
  e.sort();
  let sum = 0;
  const from = Math.floor(n * 0.7);
  for (let f = from; f < n; f++) sum += e[f];
  const level = Math.sqrt(sum / (n - from)) + 1e-6;
  const gain = Math.min(0.08 / level, maxGain);
  const out = new Float32Array(c.length);
  for (let i = 0; i < c.length; i++) out[i] = Math.max(-1, Math.min(1, c[i] * gain));
  return out;
}

/** What Whisper-style models print for noise, music or silence instead of words. */
export function cleanAsrText(text: string): string {
  const t = text
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*|♪+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[a-z0-9]/i.test(t)) return "";
  if (/^(?:thank you\.?|thanks for watching[.!]?|you|bye\.?|\.+)$/i.test(t)) return "";
  // A phrase looped over and over is the model stuck on noise.
  const words = t.split(" ");
  if (words.length >= 8 && new Set(words.map((w) => w.toLowerCase())).size / words.length < 0.3) return "";
  return t;
}

/** Who talked, sorted by share of talk time. */
export function speakersOf(segments: { start: number; end: number; speaker?: string }[]): { id: string; name: string; share: number }[] {
  const time = new Map<string, number>();
  let total = 0;
  for (const s of segments) {
    if (!s.speaker) continue;
    const d = s.end - s.start;
    time.set(s.speaker, (time.get(s.speaker) ?? 0) + d);
    total += d;
  }
  return [...time].map(([id, t]) => ({ id, name: id, share: total ? t / total : 0 })).sort((a, b) => b.share - a.share);
}
