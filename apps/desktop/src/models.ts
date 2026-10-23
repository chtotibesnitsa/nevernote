// Open models, downloaded once from sherpa-onnx's GitHub releases and then
// used fully offline. Licenses: Parakeet CC-BY-4.0 (NVIDIA), Moonshine MIT,
// pyannote segmentation MIT, TitaNet CC-BY-4.0, Silero VAD MIT, GTCRN MIT.

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download";

export type AsrModelId = "parakeet-en" | "parakeet-multi" | "moonshine-base";

export interface ModelFile {
  id: string;
  url: string;
  bytes: number;
  /** Folder (archives) or file name once installed. */
  installs: string;
  archive: boolean;
}

export const ASR_MODELS: Record<AsrModelId, ModelFile & { label: string; blurb: string }> = {
  "parakeet-en": {
    id: "parakeet-en", label: "Parakeet (English, most accurate)",
    blurb: "Best in noisy classrooms. ~480 MB, runs ~5x faster than real time on a laptop CPU.",
    url: `${BASE}/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2`, bytes: 482_468_385,
    installs: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8", archive: true,
  },
  "parakeet-multi": {
    id: "parakeet-multi", label: "Parakeet v3 (25 languages)",
    blurb: "Spanish, French, German, Italian, Russian and 20 more European languages.",
    url: `${BASE}/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2`, bytes: 487_170_055,
    installs: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8", archive: true,
  },
  "moonshine-base": {
    id: "moonshine-base", label: "Moonshine (English, lightest)",
    blurb: "For older computers. ~250 MB. Less accurate in noisy rooms.",
    url: `${BASE}/asr-models/sherpa-onnx-moonshine-base-en-int8.tar.bz2`, bytes: 250_807_309,
    installs: "sherpa-onnx-moonshine-base-en-int8", archive: true,
  },
};

export const SUPPORT_MODELS: ModelFile[] = [
  { id: "vad", url: `${BASE}/asr-models/silero_vad.onnx`, bytes: 643_854, installs: "silero_vad.onnx", archive: false },
  { id: "denoise", url: `${BASE}/speech-enhancement-models/gtcrn_simple.onnx`, bytes: 535_638, installs: "gtcrn_simple.onnx", archive: false },
  { id: "segmentation", url: `${BASE}/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2`, bytes: 6_958_444, installs: "sherpa-onnx-pyannote-segmentation-3-0", archive: true },
  { id: "speaker", url: `${BASE}/speaker-recongition-models/nemo_en_titanet_small.onnx`, bytes: 40_257_283, installs: "nemo_en_titanet_small.onnx", archive: false },
];

export function needed(asr: AsrModelId): ModelFile[] {
  return [ASR_MODELS[asr], ...SUPPORT_MODELS];
}

export function installed(dir: string, asr: AsrModelId): boolean {
  return needed(asr).every((m) => existsSync(join(dir, m.installs)));
}

function untar(file: string, dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // bsdtar ships with macOS and Windows 10+, GNU tar with Linux; all read .tar.bz2.
    const p = spawn("tar", ["-xjf", file, "-C", dir], { stdio: "ignore" });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`tar exited ${code}`))));
  });
}

const inflight = new Map<string, Promise<void>>();

/** Downloads whatever is missing. `onProgress` gets overall 0..1. Asking again while it runs joins the same download. */
export function ensureModels(dir: string, asr: AsrModelId, onProgress: (p: number, label: string) => void): Promise<void> {
  const key = `${dir}|${asr}`;
  let run = inflight.get(key);
  if (!run) {
    run = download(dir, asr, onProgress).finally(() => inflight.delete(key));
    inflight.set(key, run);
  }
  return run;
}

async function fetchTo(url: string, tmp: string, onBytes: (n: number) => void): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctl) {
      onBytes(chunk.byteLength);
      ctl.enqueue(chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body.pipeThrough(counter) as never), createWriteStream(tmp));
}

async function download(dir: string, asr: AsrModelId, onProgress: (p: number, label: string) => void): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const todo = needed(asr).filter((m) => !existsSync(join(dir, m.installs)));
  const total = todo.reduce((a, m) => a + m.bytes, 0);
  let done = 0;
  for (const m of todo) {
    const tmp = join(dir, `.${m.id}.part`);
    // A dropped connection restarts this file, not the whole set.
    for (let attempt = 1; ; attempt++) {
      let got = 0;
      try {
        await fetchTo(m.url, tmp, (n) => {
          got += n;
          onProgress(total ? Math.min(1, (done + got) / total) : 1, m.id);
        });
        break;
      } catch (e) {
        rmSync(tmp, { force: true });
        if (attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    if (m.archive) {
      // Unpack beside the final place, then rename: an interrupted unpack never looks installed.
      const stage = join(dir, `.${m.id}.unpack`);
      rmSync(stage, { recursive: true, force: true });
      mkdirSync(stage);
      await untar(tmp, stage);
      renameSync(join(stage, m.installs), join(dir, m.installs));
      rmSync(stage, { recursive: true, force: true });
      rmSync(tmp, { force: true });
    } else {
      renameSync(tmp, join(dir, m.installs));
    }
    done += m.bytes;
  }
  onProgress(1, "ready");
}

export function asrConfig(dir: string, asr: AsrModelId, threads: number) {
  const d = join(dir, ASR_MODELS[asr].installs);
  if (asr === "moonshine-base") {
    return {
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        moonshine: {
          preprocessor: join(d, "preprocess.onnx"), encoder: join(d, "encode.int8.onnx"),
          uncachedDecoder: join(d, "uncached_decode.int8.onnx"), cachedDecoder: join(d, "cached_decode.int8.onnx"),
        },
        tokens: join(d, "tokens.txt"), numThreads: threads, provider: "cpu", debug: 0,
      },
    };
  }
  return {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: join(d, "encoder.int8.onnx"), decoder: join(d, "decoder.int8.onnx"), joiner: join(d, "joiner.int8.onnx") },
      tokens: join(d, "tokens.txt"), numThreads: threads, provider: "cpu", debug: 0, modelType: "nemo_transducer",
    },
  };
}
