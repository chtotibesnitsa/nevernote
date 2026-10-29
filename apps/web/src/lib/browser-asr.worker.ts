// In-browser transcription for the website: Whisper base.en via transformers.js,
// WebGPU when available, WebAssembly otherwise. The model is fetched once and
// cached by the browser, so later sessions work offline.
//
// Whisper base beat Moonshine base on every far-field trial (a teacher 10+ feet
// away): 19-23% word errors against 24-33%. Quiet speech is boosted before it
// reaches the model, and noise tags like "(static)" are dropped.
//
// The app starts this worker as soon as it opens, so the download is done
// before the first class. One load at a time and one chunk at a time: parallel
// downloads of the same 40 MB file were what made first runs fail.
import { boostChunk, cleanAsrText, voiceprint } from "@notelater/core";
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

// The same model is published twice; the second copy is a fallback if the first is missing a file.
const MODELS = ["onnx-community/whisper-base.en", "Xenova/whisper-base.en"];
let loading: Promise<AutomaticSpeechRecognitionPipeline> | undefined;
const post = (x: unknown) => (self as unknown as Worker).postMessage(x);

async function hasGpu(): Promise<boolean> {
  // `"gpu" in navigator` is true even with hardware acceleration off; the adapter is the real test.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(await (navigator as any).gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function build(): Promise<AutomaticSpeechRecognitionPipeline> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const make = pipeline as (...a: any[]) => Promise<unknown>;
  // Progress across all files, so the bar moves once from 0 to 100.
  const files = new Map<string, [number, number]>();
  const opts = (webgpu: boolean) => ({
    device: webgpu ? "webgpu" : "wasm",
    dtype: webgpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : { encoder_model: "q8", decoder_model_merged: "q8" },
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== "progress" || !p.file || !p.total) return;
      files.set(p.file, [p.loaded ?? 0, p.total]);
      let got = 0;
      let all = 0;
      for (const [l, t] of files.values()) {
        got += l;
        all += t;
      }
      post({ type: "progress", p: all ? got / all : 0 });
    },
  });
  const gpu = await hasGpu();
  let err: unknown;
  for (const model of MODELS)
    for (const webgpu of gpu ? [true, false] : [false]) {
      try {
        files.clear();
        return (await make("automatic-speech-recognition", model, opts(webgpu))) as AutomaticSpeechRecognitionPipeline;
      } catch (e) {
        err = e;
      }
    }
  throw err;
}

/** Loads once; a failed download is retried with backoff before giving up. */
function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  loading ??= (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const p = await build();
        post({ type: "ready" });
        return p;
      } catch (e) {
        if (attempt >= 3) {
          loading = undefined;
          post({ type: "error", message: String(e) });
          throw e;
        }
        post({ type: "retry", attempt: attempt + 1 });
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      }
    }
  })();
  return loading;
}

// Finished chunks are transcribed in order, one after another. The sentence in
// progress ("partial") is only transcribed when nothing finished is waiting, and
// only its newest version, so live words never hold up the real transcript.
let queue: Promise<void> = Promise.resolve();
let waiting = 0;
let partial: { note: string; start: number; samples: Float32Array } | null = null;
let partialBusy = false;

async function run(samples: Float32Array): Promise<string> {
  const p = await load();
  const out = (await p(boostChunk(samples))) as { text: string };
  return cleanAsrText(out.text);
}

async function pumpPartial() {
  if (partialBusy || waiting || !partial) return;
  const job = partial;
  partial = null;
  partialBusy = true;
  try {
    const text = await run(job.samples);
    // A finished chunk may have overtaken this preview; then it's stale.
    if (!waiting) post({ type: "partial", note: job.note, start: job.start, text });
  } catch {
    // previews are best-effort
  } finally {
    partialBusy = false;
    void pumpPartial();
  }
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "load") {
    void load().catch(() => {});
    return;
  }
  if (m.type === "partial") {
    partial = { note: m.note, start: m.start, samples: m.samples };
    void pumpPartial();
    return;
  }
  if (m.type !== "chunk") return;
  const samples = m.samples as Float32Array;
  const vp = voiceprint(samples);
  partial = null;
  waiting++;
  queue = queue.then(async () => {
    try {
      const text = await run(samples);
      post({ type: "text", id: m.id, note: m.note, offset: m.offset, start: m.start, end: m.end, text, vp: vp ? { vec: Array.from(vp.vec), voiced: vp.voiced } : null });
    } catch (err) {
      post({ type: "chunk-error", id: m.id, message: String(err) });
    } finally {
      waiting--;
      void pumpPartial();
    }
  });
};
