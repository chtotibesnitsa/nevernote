// Runs the engine off the main thread so the window never stutters.
import { parentPort } from "node:worker_threads";
import { Engine, LiveSession } from "./engine.ts";
import type { AsrModelId } from "./models.ts";

let engine: Engine | undefined;
let session: LiveSession | undefined;
let key = "";

parentPort!.on("message", async (m: any) => {
  try {
    if (m.type === "start") {
      const k = `${m.modelsDir}|${m.asr}|${m.hotwordsFile ?? ""}`;
      if (!engine || k !== key) {
        engine = new Engine({ modelsDir: m.modelsDir, asr: m.asr as AsrModelId, threads: m.threads, hotwordsFile: m.hotwordsFile });
        key = k;
      }
      session = new LiveSession(engine, (s) => parentPort!.postMessage({ type: "segment", noteId: m.noteId, segment: s }), m.noteId.slice(0, 6));
      session.onPartial = (text) => parentPort!.postMessage({ type: "partial", noteId: m.noteId, text });
      parentPort!.postMessage({ type: "started", noteId: m.noteId });
    } else if (m.type === "audio" && session) {
      session.push(new Float32Array(m.samples));
    } else if (m.type === "stop" && session) {
      const s = session;
      session = undefined;
      const segments = await s.finish((stage) => parentPort!.postMessage({ type: "stage", noteId: m.noteId, stage }));
      parentPort!.postMessage({ type: "finished", noteId: m.noteId, segments, seconds: s.seconds, audio: s.audio() }, []);
    }
  } catch (e) {
    parentPort!.postMessage({ type: "error", noteId: m.noteId, message: e instanceof Error ? e.message : String(e) });
  }
});
