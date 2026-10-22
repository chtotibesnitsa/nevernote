// Who is talking, with no model download: a compact voice fingerprint (pitch plus
// the shape of the spectrum over the voiced frames) per phrase, clustered on the fly.
// It is best-effort by design, tuned to separate a teacher from students in one room.

const SR = 16000;
const N = 512;
const HOP = 256;
const BANDS = 20;

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

function pitch(frame: Float32Array): number {
  const lo = Math.floor(SR / 400);
  const hi = Math.floor(SR / 70);
  let e0 = 0;
  for (let i = 0; i < frame.length; i++) e0 += frame[i] * frame[i];
  if (e0 < 1e-9) return 0;
  let best = 0;
  let bestLag = 0;
  for (let lag = lo; lag <= hi; lag++) {
    let c = 0;
    for (let i = 0; i + lag < frame.length; i++) c += frame[i] * frame[i + lag];
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  return best / e0 > 0.35 ? SR / bestLag : 0;
}

export interface Voiceprint {
  vec: Float32Array;
  /** Seconds of voiced speech the print is based on. */
  voiced: number;
}

export function voiceprint(samples: Float32Array): Voiceprint | null {
  const frames: { e: number; f: number }[] = [];
  const mel: Float32Array[] = [];
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (let s = 0; s + N <= samples.length; s += HOP) {
    const fr = samples.subarray(s, s + N);
    let e = 0;
    for (const v of fr) e += v * v;
    frames.push({ e: e / N, f: 0 });
    mel.push(new Float32Array(0));
  }
  if (frames.length < 6) return null;
  const sorted = frames.map((f) => f.e).sort((a, b) => a - b);
  const gate = Math.max(sorted[Math.floor(sorted.length * 0.6)] * 0.7, 1e-7);
  const bands = new Float32Array(BANDS);
  const f0s: number[] = [];
  let voiced = 0;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  frames.forEach((fr, idx) => {
    if (fr.e < gate) return;
    const seg = samples.subarray(idx * HOP, idx * HOP + N);
    const p = pitch(seg);
    if (!p) return;
    f0s.push(p);
    for (let i = 0; i < N; i++) {
      re[i] = seg[i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    // log-spaced bands, 100 Hz to 4 kHz
    for (let b = 0; b < BANDS; b++) {
      const lo = 100 * Math.pow(40, b / BANDS);
      const hi = 100 * Math.pow(40, (b + 1) / BANDS);
      let sum = 0;
      for (let k = Math.max(1, Math.floor((lo * N) / SR)); k <= Math.min(N / 2 - 1, Math.ceil((hi * N) / SR)); k++) sum += re[k] * re[k] + im[k] * im[k];
      bands[b] += Math.log(sum + 1e-9);
    }
    voiced++;
  });
  if (voiced < 4) return null;
  let mean = 0;
  for (let b = 0; b < BANDS; b++) {
    bands[b] /= voiced;
    mean += bands[b];
  }
  mean /= BANDS;
  f0s.sort((a, b) => a - b);
  const f0 = f0s[Math.floor(f0s.length / 2)];
  const vec = new Float32Array(BANDS + 1);
  for (let b = 0; b < BANDS; b++) vec[b] = (bands[b] - mean) * 0.12;
  vec[BANDS] = Math.log2(f0) * 1.6;
  return { vec, voiced: (voiced * HOP) / SR };
}

/**
 * Online clustering: each phrase joins the closest known voice. A new voice is
 * only opened once two phrases (of a second or more of voiced speech) agree on
 * it and both sit well away from every known voice, so one teacher moving
 * around the room, turning to the board or raising their voice stays one
 * speaker. The first phrase of a new voice keeps the previous label.
 */
export class SpeakerTracker {
  private centers: { v: Float32Array; n: number }[] = [];
  private last = "S1";
  private candidate: { v: Float32Array; age: number } | null = null;
  constructor(
    private maxSpeakers = 6,
    private threshold = 0.75,
    private agree = 0.45,
  ) {}

  assign(p: Voiceprint | null): string {
    if (!p || p.voiced < 0.25) return this.last;
    const dist = (v: Float32Array) => {
      let d = 0;
      for (let k = 0; k < v.length; k++) d += (v[k] - p.vec[k]) ** 2;
      return Math.sqrt(d);
    };
    if (!this.centers.length) {
      this.centers.push({ v: Float32Array.from(p.vec), n: 1 });
      return (this.last = "S1");
    }
    let best = 0;
    let bd = Infinity;
    this.centers.forEach((c, i) => {
      const d = dist(c.v);
      if (d < bd) [bd, best] = [d, i];
    });
    if (this.candidate && ++this.candidate.age > 4) this.candidate = null;
    if (bd > this.threshold && this.centers.length < this.maxSpeakers && p.voiced >= 1) {
      if (this.candidate && dist(this.candidate.v) < this.agree) {
        const v = Float32Array.from(this.candidate.v);
        for (let k = 0; k < v.length; k++) v[k] = (v[k] + p.vec[k]) / 2;
        this.centers.push({ v, n: 2 });
        this.candidate = null;
        return (this.last = `S${this.centers.length}`);
      }
      this.candidate = { v: Float32Array.from(p.vec), age: 0 };
      return this.last;
    }
    if (bd > this.threshold) return this.last; // a one-off odd phrase: don't drag a voice towards it
    const c = this.centers[best];
    c.n++;
    const a = Math.max(1 / c.n, 0.05);
    for (let k = 0; k < c.v.length; k++) c.v[k] += (p.vec[k] - c.v[k]) * a;
    return (this.last = `S${best + 1}`);
  }
}

// ---------- names ----------

const NAME = "([A-Z][a-z]{1,14})";
const TITLE = "(Mr|Mrs|Ms|Miss|Dr|Prof|Professor|Coach)\\.?";
const NOT_NAMES = new Set(["Okay", "Ok", "So", "Yes", "No", "Well", "Sure", "Good", "Great", "Right", "Please", "Everyone", "Class", "Guys", "Thanks", "Thank", "Sorry", "Hello", "Hi", "Hey", "Actually", "Today", "Just", "Not", "Going", "Gonna", "Done", "Here", "Back", "Ready", "Fine", "Doing", "Trying", "Looking", "Sir", "Maam", "Anyone", "Someone", "Nobody", "Can", "Could", "Would", "Will", "What", "Why", "How", "When", "Where", "Who"]);
const ok = (n: string) => !NOT_NAMES.has(n);

const SELF = [
  new RegExp(`\\b(?:my name is|my name's|name is|call me|this is|it's|i am|i'm|im) ${NAME}\\b`, "i"),
  new RegExp(`\\b(?:this is|i am|i'm) ${TITLE} ${NAME}\\b`, "i"),
  new RegExp(`\\bmy name(?:'s| is) ${TITLE} ${NAME}\\b`, "i"),
];
const HELLO = new RegExp(`\\b(?:[Hh]i|[Hh]ey|[Hh]ello|[Tt]hanks|[Tt]hank you|[Oo]kay|[Oo]k|[Nn]ice|[Gg]ood job|[Gg]reat|[Yy]es|[Gg]o ahead),? ${NAME}\\b`);
const VOCATIVE_TITLE = new RegExp(`\\b${TITLE} ${NAME}\\b`);

interface Seg {
  speaker?: string;
  text: string;
}

/**
 * Picks names out of what people say. "I'm Maya" names the speaker; "thanks, Maya"
 * or "Mr. Chen, can I..." names whoever answers next. Only confident names are kept,
 * and a speaker keeps the first name they were given; the rest stay S1, S2.
 */
export function nameSpeakers(segments: Seg[]): Record<string, string> {
  const names: Record<string, string> = {};
  const used = new Set<string>();
  const give = (sp: string | undefined, name: string) => {
    if (!sp || names[sp] || used.has(name)) return;
    names[sp] = name;
    used.add(name);
  };
  const proper = (t: string, m: RegExpMatchArray | null, titled: boolean) => {
    if (!m) return undefined;
    const nm = m[m.length - 1];
    // Speech recognition lowercases names often; require the capital that the matcher captured.
    if (!ok(nm) || (!titled && nm.length < 3)) return undefined;
    return titled ? `${m[1].replace(/\.$/, "")}. ${nm}` : nm;
  };
  segments.forEach((s, i) => {
    const self = SELF[1].exec(s.text) ?? SELF[2].exec(s.text);
    if (self) return give(s.speaker, proper(s.text, self, true)!);
    // Only an explicit self-introduction counts, and the name must be capitalised in the text.
    const intro = /\b(?:[Mm]y name is|[Mm]y name's|[Cc]all me|I'm)\s+([A-Z][a-z]{2,14})\b/.exec(s.text);
    if (intro && ok(intro[1]) && /\b(?:my name is|my name's|call me)\b/i.test(s.text)) give(s.speaker, intro[1]);
    else if (intro && ok(intro[1]) && i < 15) give(s.speaker, intro[1]);
    const next = segments.slice(i + 1, i + 4).find((n) => n.speaker && n.speaker !== s.speaker);
    const t = VOCATIVE_TITLE.exec(s.text);
    if (t && ok(t[2]) && next) {
      // "Mr. Chen, can I..." names the person who answers.
      give(next.speaker, `${t[1]}. ${t[2]}`);
      return;
    }
    const h = HELLO.exec(s.text);
    if (h && ok(h[1]) && next) give(next.speaker, h[1]);
  });
  return names;
}
