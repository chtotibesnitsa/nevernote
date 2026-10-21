// Who spoke when, on the phone. A thin native wrapper over sherpa-onnx's
// offline diarization (pyannote segmentation + TitaNet embeddings), the same
// models and settings the desktop app uses. Optional: if the native module is
// missing (Expo Go, Android for now) callers simply get no speaker turns.
import { requireOptionalNativeModule } from "expo-modules-core";

export interface SpeakerTurn {
  start: number;
  end: number;
  speaker: number;
}

export interface DiarizeOptions {
  /** 16 kHz mono 16-bit WAV of the whole recording. */
  wavPath: string;
  segmentationModel: string;
  embeddingModel: string;
  /** GTCRN denoiser; cleaner audio separates voices better in noisy rooms. */
  denoiseModel?: string;
  /** Cosine distance threshold for a new speaker. */
  threshold?: number;
  numSpeakers?: number;
}

interface Native {
  diarize(o: Required<Omit<DiarizeOptions, "denoiseModel">> & { denoiseModel: string }): Promise<SpeakerTurn[]>;
}

const native = requireOptionalNativeModule<Native>("NevernoteSpeakers");

export const speakersAvailable = !!native;

export async function diarize(o: DiarizeOptions): Promise<SpeakerTurn[]> {
  if (!native) return [];
  return native.diarize({ threshold: 0.6, numSpeakers: -1, denoiseModel: "", ...o });
}
