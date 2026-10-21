// The on-device transcription engine, same pipeline as bench/pipeline.py:
//   live:  mic -> Silero VAD -> level-matched speech chunks -> Parakeet -> text
//   stop:  whole recording -> GTCRN denoise -> pyannote + TitaNet speaker turns
//          -> every segment gets the speaker it overlaps most
// Nothing here touches the network.

import { join } from "node:path";
import { labelSpeakers, levelChunk, regroup, tokensToWords, type LiveSegment, type Word } from "@nevernote/core";
import { asrConfig, type AsrModelId } from "./models.ts";

export { regroup, tokensToWords, levelChunk, type LiveSegment, type Word };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sherpa = require("sherpa-onnx-node");

export const SR = 16000;

export interface EngineOptions {
  modelsDir: string;
  asr: AsrModelId;
  threads?: number;
  /** Course words to boost (Parakeet only). */
  hotwordsFile?: string;
}

export class Engine {
  private recognizer: any;
  private diarizer: any;
  private denoiser: any;
  constructor(private opts: EngineOptions) {
    const threads = opts.threads ?? 4;
    const cfg: any = asrConfig(opts.modelsDir, opts.asr, threads);
    if (opts.hotwordsFile && opts.asr !== "moonshine-base") {
      cfg.decodingMethod = "modified_beam_search";
      cfg.hotwordsFile = opts.hotwordsFile;
      cfg.hotwordsScore = 2.0;
    }
    this.recognizer = new sherpa.OfflineRecognizer(cfg);
  }

  newVad(): any {
    return new sherpa.Vad(
      {
        sileroVad: {
          model: join(this.opts.modelsDir, "silero_vad.onnx"),
          threshold: 0.35, minSilenceDuration: 0.35, minSpeechDuration: 0.2, maxSpeechDuration: 20, windowSize: 512,
        },
        sampleRate: SR, numThreads: 1, provider: "cpu", debug: 0,
      },
      120,
    );
  }

  async recognize(samples: Float32Array, offset = 0): Promise<{ text: string; words: Word[] }> {
    const stream = this.recognizer.createStream();
    stream.acceptWaveform({ sampleRate: SR, samples: levelChunk(samples) });
    await this.recognizer.decodeAsync(stream);
    const r = this.recognizer.getResult(stream);
    const text = String(r.text ?? "").trim();
    const words = r.tokens?.length && r.timestamps?.length ? tokensToWords(r.tokens, r.timestamps, offset) : [];
    return { text, words };
  }

  denoise(samples: Float32Array): Float32Array {
    this.denoiser ??= new sherpa.OfflineSpeechDenoiser({
      model: { gtcrn: { model: join(this.opts.modelsDir, "gtcrn_simple.onnx") }, numThreads: this.opts.threads ?? 4, provider: "cpu", debug: 0 },
    });
    const out = this.denoiser.run({ samples, sampleRate: SR, enableExternalBuffer: false });
    return Float32Array.from(out.samples).subarray(0, samples.length);
  }

  /** Speaker turns for a whole recording: [{start, end, speaker}] with speaker 0, 1, 2... */
  speakers(samples: Float32Array, numSpeakers = -1): { start: number; end: number; speaker: number }[] {
    this.diarizer ??= new sherpa.OfflineSpeakerDiarization({
      segmentation: {
        pyannote: { model: join(this.opts.modelsDir, "sherpa-onnx-pyannote-segmentation-3-0", "model.int8.onnx") },
        numThreads: this.opts.threads ?? 4, debug: 0,
      },
      embedding: { model: join(this.opts.modelsDir, "nemo_en_titanet_small.onnx"), numThreads: this.opts.threads ?? 4, debug: 0 },
      clustering: { numClusters: numSpeakers, threshold: 0.6 },
      minDurationOn: 0.3,
      minDurationOff: 0.5,
    });
    try {
      return this.diarizer.process(samples);
    } catch {
      return [];
    }
  }
}

/**
 * One recording. Feed it microphone audio as it arrives; it emits finished
 * segments within a second or two of each pause in speech. Pausing simply
 * stops feeding: timestamps count recorded time only.
 */
export class LiveSession {
  private vad: any;
  private chunks: Float32Array[] = [];
  private recorded = 0; // samples
  private pending: Promise<void> = Promise.resolve();
  private n = 0;
  private window = new Float32Array(0);
  segments: LiveSegment[] = [];

  constructor(
    private engine: Engine,
    private onSegment: (s: LiveSegment) => void,
    private idPrefix = Math.random().toString(36).slice(2, 8),
  ) {
    this.vad = engine.newVad();
  }

  get seconds(): number {
    return this.recorded / SR;
  }

  /** 16 kHz mono float samples, any length. */
  push(samples: Float32Array): void {
    this.chunks.push(samples);
    this.recorded += samples.length;
    // Silero wants exact 512-sample windows.
    const buf = new Float32Array(this.window.length + samples.length);
    buf.set(this.window);
    buf.set(samples, this.window.length);
    let i = 0;
    for (; i + 512 <= buf.length; i += 512) this.vad.acceptWaveform(buf.subarray(i, i + 512));
    this.window = buf.slice(i);
    this.drain();
  }

  private drain(): void {
    while (!this.vad.isEmpty()) {
      const seg = this.vad.front(false);
      this.vad.pop();
      const start = seg.start / SR;
      const audio = Float32Array.from(seg.samples);
      this.pending = this.pending.then(async () => {
        const { text, words } = await this.engine.recognize(audio, start);
        if (!text) return;
        const end = start + audio.length / SR;
        const parts = words.length ? regroup(words, end, this.idPrefix, this.n) : [{ id: `${this.idPrefix}-${this.n + 1}`, start, end, text }];
        this.n += parts.length;
        for (const s of parts) {
          this.segments.push(s);
          this.onSegment(s);
        }
      });
    }
  }

  /** Waits for the last words, then labels speakers. */
  async finish(onStage: (stage: "transcribing" | "labelling") => void = () => {}): Promise<LiveSegment[]> {
    onStage("transcribing");
    this.vad.flush();
    this.drain();
    await this.pending;
    onStage("labelling");
    const all = this.audio();
    if (all.length > SR * 2 && this.segments.length > 1) {
      const turns = this.engine.speakers(this.engine.denoise(all));
      this.segments = labelSpeakers(this.segments, turns, this.seconds, this.idPrefix);
    }
    return this.segments;
  }

  audio(): Float32Array {
    const out = new Float32Array(this.recorded);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}
