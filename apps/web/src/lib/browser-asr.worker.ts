// In-browser transcription for the website: Moonshine via transformers.js,
// WebGPU when available, WebAssembly otherwise. The model is fetched once and
// cached by the browser, so later sessions work offline.
//
// The app starts this worker as soon as it opens, so the download is done
// before the first class. One load at a time and one chunk at a time: parallel
// downloads of the same 40 MB file were what made first runs fail.
import { voiceprint } from "@nevernote/core";
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

const MODEL = "onnx-community/moonshine-base-ONNX";
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
    dtype: webgpu ? "fp32" : "q8",
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
  try {
    return (await make("automatic-speech-recognition", MODEL, opts(gpu))) as AutomaticSpeechRecognitionPipeline;
  } catch (e) {
    if (!gpu) throw e;
    files.clear();
    return (await make("automatic-speech-recognition", MODEL, opts(false))) as AutomaticSpeechRecognitionPipeline;
  }
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

// Chunks are transcribed in order, one after another.
let queue: Promise<void> = Promise.resolve();

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "load") {
    void load().catch(() => {});
    return;
  }
  if (m.type !== "chunk") return;
  const samples = m.samples as Float32Array;
  const vp = voiceprint(samples);
  queue = queue.then(async () => {
    try {
      const p = await load();
      const out = (await p(samples)) as { text: string };
      post({ type: "text", id: m.id, note: m.note, offset: m.offset, start: m.start, end: m.end, text: out.text.trim(), vp: vp ? { vec: Array.from(vp.vec), voiced: vp.voiced } : null });
    } catch (err) {
      post({ type: "chunk-error", id: m.id, message: String(err) });
    }
  });
};
