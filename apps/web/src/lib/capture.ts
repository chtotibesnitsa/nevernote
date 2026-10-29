// Microphone -> 16 kHz mono Float32 chunks (~100 ms each), plus a live level
// for the waveform. Room mode turns off the browser's voice processing, which
// is tuned for one person on a call and squashes everyone else in the room,
// and puts in our own: a rumble filter and a slow, strong leveller, so a
// whisper or a voice at the back of the room reaches the transcriber about as
// loud as someone next to the laptop.

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
  /** The levelled mic as a track, for engines that can listen to one. */
  track: MediaStreamTrack;
}

/** `onLost` fires when the mic goes away on its own: unplugged, taken by another app, or the audio engine stuck. */
export async function startCapture(onChunk: (s: Float32Array) => void, room = true, onLost?: (why: string) => void): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: (() => { try { const d = localStorage.getItem("nn:mic"); return d ? { exact: d } : undefined; } catch { return undefined; } })(), channelCount: 1, echoCancellation: !room, noiseSuppression: !room, autoGainControl: !room },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "nn-down");
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  let out: AudioNode = src;
  if (room) {
    const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 85, Q: 0.7 });
    const level = new DynamicsCompressorNode(ctx, { threshold: -46, knee: 18, ratio: 6, attack: 0.01, release: 0.4 });
    const makeup = new GainNode(ctx, { gain: 7 });
    const limit = new DynamicsCompressorNode(ctx, { threshold: -4, knee: 0, ratio: 20, attack: 0.002, release: 0.1 });
    src.connect(hp).connect(level).connect(makeup).connect(limit);
    out = limit;
  }
  const dest = ctx.createMediaStreamDestination();
  out.connect(node);
  out.connect(analyser);
  out.connect(dest);
  let paused = false;
  let closed = false;
  const lost = (why: string) => {
    if (closed) return;
    closed = true;
    onLost?.(why);
  };
  const track = stream.getAudioTracks()[0];
  track.onended = () => lost("The microphone disconnected.");
  let muteTimer = 0;
  track.onmute = () => {
    muteTimer = window.setTimeout(() => lost("The microphone went silent (another app may have taken it)."), 5000);
  };
  track.onunmute = () => clearTimeout(muteTimer);
  let stuck = 0;
  ctx.onstatechange = () => {
    clearTimeout(stuck);
    if (ctx.state === "running" || closed) return;
    void ctx.resume().catch(() => {});
    stuck = window.setTimeout(() => ctx.state !== "running" && lost("The browser paused audio capture."), 4000);
  };
  node.port.onmessage = (e) => !paused && onChunk(e.data as Float32Array);
  const data = new Float32Array(analyser.fftSize);
  return {
    track: dest.stream.getAudioTracks()[0],
    stop() {
      closed = true;
      clearTimeout(muteTimer);
      clearTimeout(stuck);
      ctx.onstatechange = null;
      node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      dest.stream.getTracks().forEach((t) => t.stop());
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
      return Math.min(1, Math.sqrt(s / data.length) * (room ? 3 : 8));
    },
  };
}
