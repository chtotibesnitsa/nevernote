// Microphone -> 16 kHz mono Float32 chunks (~100 ms each), plus a live level
// for the waveform. Room mode turns off the browser's voice processing, which
// is tuned for one person on a call and squashes everyone else in the room.

const WORKLET = `
class Down extends AudioWorkletProcessor {
  constructor(o) { super(); this.ratio = sampleRate / 16000; this.buf = []; this.acc = 0; this.pos = 0; }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    // Box-filter decimation: average the input samples that map to each output sample.
    for (let i = 0; i < ch.length; i++) {
      this.acc += ch[i]; this.pos++;
      if (this.pos >= this.ratio) { this.buf.push(this.acc / this.pos); this.acc = 0; this.pos -= this.ratio; if (this.pos < 0) this.pos = 0; }
    }
    if (this.buf.length >= 1600) { this.port.postMessage(Float32Array.from(this.buf)); this.buf = []; }
    return true;
  }
}
registerProcessor("nn-down", Down);
`;

export interface Capture {
  stop(): void;
  setPaused(p: boolean): void;
  level(): number;
}

export async function startCapture(onChunk: (s: Float32Array) => void, room = true): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: !room, noiseSuppression: !room, autoGainControl: !room },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "nn-down");
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(node);
  src.connect(analyser);
  let paused = false;
  node.port.onmessage = (e) => !paused && onChunk(e.data as Float32Array);
  const data = new Float32Array(analyser.fftSize);
  return {
    stop() {
      node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
    setPaused(p) {
      paused = p;
    },
    level() {
      if (paused) return 0;
      analyser.getFloatTimeDomainData(data);
      let s = 0;
      for (const v of data) s += v * v;
      return Math.min(1, Math.sqrt(s / data.length) * 8);
    },
  };
}
