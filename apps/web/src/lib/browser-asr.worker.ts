// In-browser transcription for the website: Moonshine via transformers.js,
// WebGPU when available, WebAssembly otherwise. The model is fetched once and
// cached by the browser, so later sessions work offline.
import { voiceprint } from "@nevernote/core";
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

let asr: AutomaticSpeechRecognitionPipeline | undefined;

async function hasGpu(): Promise<boolean> {
  // `"gpu" in navigator` is true even with hardware acceleration off; the adapter is the real test.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(await (navigator as any).gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function load(post: (m: unknown) => void) {
  if (asr) return asr;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const make = pipeline as (...a: any[]) => Promise<unknown>;
  const build = (webgpu: boolean) =>
    make("automatic-speech-recognition", "onnx-community/moonshine-base-ONNX", {
      device: webgpu ? "webgpu" : "wasm",
      dtype: webgpu ? "fp32" : "q8",
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === "progress") post({ type: "progress", p: (p.progress ?? 0) / 100, file: p.file });
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
  const gpu = await hasGpu();
  try {
    asr = await build(gpu);
  } catch (e) {
    if (!gpu) throw e;
    asr = await build(false);
  }
  return asr;
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  const post = (x: unknown) => (self as unknown as Worker).postMessage(x);
  try {
    if (m.type === "load") {
      await load(post);
      post({ type: "ready" });
    } else if (m.type === "chunk") {
      const vp = voiceprint(m.samples as Float32Array);
      const p = await load(post);
      const out = (await p(m.samples as Float32Array)) as { text: string };
      post({ type: "text", id: m.id, start: m.start, end: m.end, text: out.text.trim(), vp: vp ? { vec: Array.from(vp.vec), voiced: vp.voiced } : null });
    }
  } catch (err) {
    post({ type: "error", id: m.id, message: String(err) });
  }
};
