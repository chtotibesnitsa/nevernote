// One recording on the phone, fully offline:
//   live:  mic (16 kHz) -> energy chunker -> Parakeet -> bubbles within a second or two of each pause
//   disk:  every sample also goes to a WAV in Documents, so nothing is lost if the app dies
//   stop:  WAV -> GTCRN denoise -> pyannote + TitaNet speaker turns -> words relabelled
// iOS keeps the mic running with the screen locked (UIBackgroundModes: audio).
import { Chunker, labelSpeakers, levelChunk, regroup, tokensToWords, type LiveSegment } from "@notelater/core";
import { FileMode, type File } from "expo-file-system";
import { createPcmLiveStream, type PcmLiveStreamHandle } from "react-native-sherpa-onnx/audio";
import { createSTT, type SttEngine } from "react-native-sherpa-onnx/stt";
import { diarize } from "../../modules/nevernote-speakers";
import type { ModelPaths } from "./models";

export const SR = 16000;
const FRAME = 320; // 20 ms, so the chunker sees pauses at a useful resolution

let stt: Promise<SttEngine> | null = null;
function engine(paths: ModelPaths): Promise<SttEngine> {
  stt ??= createSTT({ modelPath: { type: "file", path: paths.asrDir }, modelType: "nemo_transducer", preferInt8: true }).catch((e) => {
    stt = null;
    throw e;
  });
  return stt;
}

/** Warms the recognizer so the first words show up fast. */
export function preload(paths: ModelPaths): void {
  void engine(paths).catch(() => {});
}

function wavHeader(dataBytes: number): Uint8Array {
  const b = new ArrayBuffer(44);
  const v = new DataView(b);
  const s = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  s(8, "WAVE");
  s(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, SR, true);
  v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  s(36, "data");
  v.setUint32(40, dataBytes, true);
  return new Uint8Array(b);
}

export class PhoneRecorder {
  private stream: PcmLiveStreamHandle | null = null;
  private chunker: Chunker;
  private pending: Promise<void> = Promise.resolve();
  private n = 0;
  private bytes = 0;
  private handle: ReturnType<File["open"]> | null = null;
  private paused = false;
  private rms = 0;
  private offs: (() => void)[] = [];
  segments: LiveSegment[] = [];

  constructor(
    private paths: ModelPaths,
    private wav: File,
    private onSegment: (s: LiveSegment) => void,
    private onError: (message: string) => void,
    private prefix = Math.random().toString(36).slice(2, 8),
  ) {
    this.chunker = new Chunker((samples, start, end) => this.transcribe(samples, start, end), SR);
  }

  get seconds(): number {
    return this.bytes / 2 / SR;
  }

  /** 0..1, for the waveform. */
  level(): number {
    return Math.min(1, this.rms * 6);
  }

  async start(): Promise<void> {
    await engine(this.paths);
    if (this.wav.exists) this.wav.delete();
    this.wav.create();
    this.handle = this.wav.open(FileMode.ReadWrite);
    this.handle.writeBytes(wavHeader(0));
    const stream = createPcmLiveStream({ sampleRate: SR, channelCount: 1, bufferSizeFrames: 1600 });
    this.offs.push(stream.onData((samples, rate) => this.onAudio(samples, rate)));
    this.offs.push(stream.onError((m) => this.onError(m)));
    await stream.start();
    this.stream = stream;
  }

  private onAudio(samples: Float32Array, rate: number): void {
    if (this.paused || rate !== SR) return;
    let e = 0;
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const v = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      e += v * v;
    }
    this.rms = Math.sqrt(e / Math.max(1, samples.length));
    this.handle?.writeBytes(new Uint8Array(pcm.buffer));
    this.bytes += pcm.byteLength;
    for (let i = 0; i < samples.length; i += FRAME) this.chunker.push(samples.subarray(i, i + FRAME));
  }

  private transcribe(samples: Float32Array, start: number, end: number): void {
    const audio = Array.from(levelChunk(samples));
    this.pending = this.pending.then(async () => {
      try {
        const r = await (await engine(this.paths)).transcribeSamples(audio, SR);
        const text = r.text.trim();
        if (!text) return;
        const words = r.tokens?.length && r.timestamps?.length ? tokensToWords(r.tokens, r.timestamps, start) : [];
        const parts = words.length ? regroup(words, end, this.prefix, this.n) : [{ id: `${this.prefix}-${this.n + 1}`, start, end, text }];
        this.n += parts.length;
        for (const s of parts) {
          this.segments.push(s);
          this.onSegment(s);
        }
      } catch (e) {
        this.onError(String(e));
      }
    });
  }

  pause(): void {
    this.paused = true;
    this.rms = 0;
    this.chunker.flush();
  }

  resume(): void {
    this.paused = false;
  }

  /** Stops the mic, waits for the last words, then labels speakers. */
  async finish(onStage: (s: "transcribing" | "labelling") => void): Promise<LiveSegment[]> {
    onStage("transcribing");
    for (const off of this.offs) off();
    await this.stream?.stop();
    this.stream = null;
    this.chunker.flush();
    await this.pending;
    if (this.handle) {
      this.handle.offset = 0;
      this.handle.writeBytes(wavHeader(this.bytes));
      this.handle.close();
      this.handle = null;
    }
    onStage("labelling");
    if (this.seconds > 2 && this.segments.length > 1) {
      try {
        const turns = await diarize({
          wavPath: decodeURI(this.wav.uri.replace(/^file:\/\//, "")),
          segmentationModel: this.paths.segmentation,
          embeddingModel: this.paths.embedding,
          denoiseModel: this.paths.denoise,
        });
        this.segments = labelSpeakers(this.segments, turns, this.seconds, this.prefix);
      } catch {
        /* keep the unlabelled transcript; it's still all there */
      }
    }
    return this.segments;
  }

  /** Abandons the mic without labelling (app shutting down mid-class). */
  async abort(): Promise<void> {
    for (const off of this.offs) off();
    await this.stream?.stop().catch(() => {});
    this.handle?.close();
  }
}
