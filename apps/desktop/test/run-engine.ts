// Streams a trial recording through the live engine in 100 ms chunks, the
// way the microphone delivers it, then prints the transcript as JSON.
//   npx tsx test/run-engine.ts ~/models ../../bench/trials/apes_t2_classroom.wav
import { Engine, LiveSession, SR } from "../src/engine.ts";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sherpa = require("sherpa-onnx-node");

async function main() {
  const [modelsDir, wav] = process.argv.slice(2);
  const engine = new Engine({ modelsDir, asr: "parakeet-en" });
  const w = sherpa.readWave(wav);
  if (w.sampleRate !== SR) throw new Error("expected 16 kHz");
  const t0 = Date.now();
  let firstAt = 0;
  const session = new LiveSession(engine, () => (firstAt ||= Date.now()));
  for (let i = 0; i < w.samples.length; i += 1600) session.push(w.samples.subarray(i, i + 1600));
  const segs = await session.finish();
  console.log(JSON.stringify({ seconds: session.seconds, wall: (Date.now() - t0) / 1000, segments: segs }));
}
main();
