// The on-device models, fetched once from the sherpa-onnx GitHub releases and
// kept in Documents. ~530 MB in all; nothing is downloaded again after that.
import { readDir } from "@dr.pogodin/react-native-fs";
import { File, Directory, Paths } from "expo-file-system";
import { ensureModel, isModelDownloaded, ModelCategory, type Progress } from "react-native-sherpa-onnx/download";

export const ASR_ID = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8";
const SEGMENTATION_ID = "sherpa-onnx-pyannote-segmentation-3-0";
const DENOISE_ID = "gtcrn_simple";
const TITANET_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/nemo_en_titanet_small.onnx";

// Rough byte sizes, only for one combined progress bar.
const SIZES = { asr: 480e6, seg: 7e6, denoise: 0.5e6, titanet: 40e6 };
const TOTAL = SIZES.asr + SIZES.seg + SIZES.denoise + SIZES.titanet;

export interface ModelPaths {
  asrDir: string;
  segmentation: string;
  embedding: string;
  denoise: string;
}

const titanetFile = () => new File(new Directory(Paths.document, "models"), "nemo_en_titanet_small.onnx");

/** A model id resolves to a folder or a single file; find the .onnx we want inside. */
async function onnxIn(path: string, prefer: RegExp): Promise<string> {
  if (path.endsWith(".onnx")) return path;
  const items = await readDir(path);
  const files = items.filter((i) => i.isFile() && i.name.endsWith(".onnx"));
  const hit = files.find((f) => prefer.test(f.name)) ?? files[0];
  if (hit) return hit.path;
  for (const d of items.filter((i) => i.isDirectory())) {
    const deeper = await onnxIn(d.path, prefer).catch(() => "");
    if (deeper) return deeper;
  }
  throw new Error(`no model in ${path}`);
}

export async function modelsReady(): Promise<boolean> {
  const [a, s, d] = await Promise.all([
    isModelDownloaded(ModelCategory.Stt, ASR_ID),
    isModelDownloaded(ModelCategory.Diarization, SEGMENTATION_ID),
    isModelDownloaded(ModelCategory.Enhancement, DENOISE_ID),
  ]);
  return a && s && d && titanetFile().exists;
}

/** Downloads whatever is missing and returns the paths. `onProgress` gets 0..1 overall. */
export async function ensureModels(onProgress: (p: number) => void = () => {}): Promise<ModelPaths> {
  let done = 0;
  const step = (size: number) => (p: Progress) => onProgress(Math.min(0.999, (done + size * (p.percent / 100)) / TOTAL));
  const asr = await ensureModel(ModelCategory.Stt, ASR_ID, { onProgress: step(SIZES.asr), deleteArchiveAfterExtract: true });
  done += SIZES.asr;
  const seg = await ensureModel(ModelCategory.Diarization, SEGMENTATION_ID, { onProgress: step(SIZES.seg), deleteArchiveAfterExtract: true });
  done += SIZES.seg;
  const dn = await ensureModel(ModelCategory.Enhancement, DENOISE_ID, { onProgress: step(SIZES.denoise) });
  done += SIZES.denoise;
  const tf = titanetFile();
  if (!tf.exists) {
    const parent = new Directory(Paths.document, "models");
    if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(TITANET_URL, tf);
  }
  done += SIZES.titanet;
  onProgress(1);
  return {
    asrDir: asr.localPath,
    segmentation: await onnxIn(seg.localPath, /int8/),
    embedding: tf.uri.replace(/^file:\/\//, ""),
    denoise: await onnxIn(dn.localPath, /gtcrn/),
  };
}

