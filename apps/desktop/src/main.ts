import { app, BrowserWindow, ipcMain, nativeTheme, net, Notification, powerSaveBlocker, session, shell, systemPreferences } from "electron";
import { appendFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import type { Note } from "../../../packages/core/src/types.ts";
import { ASR_MODELS, ensureModels, installed, useFetch, type AsrModelId } from "./models.ts";
import { FileStore } from "./store.ts";

const data = app.getPath("userData");
const modelsDir = join(data, "models");
const store = new FileStore(data);
let win: BrowserWindow | undefined;
let worker: Worker | undefined;

// The app is light only, so native glass and menus match it.
nativeTheme.themeSource = "light";

// Sign-in finishes in the browser, which opens nevernote://auth?code=… to hand it back.
// macOS delivers that as open-url (sometimes before the window exists); Windows
// starts a second copy of the app with the link in its arguments.
let pendingAuth: string | undefined;
let authListening = false;
function deliverAuth(url: string) {
  if (!url.startsWith("nevernote://")) return;
  if (win && authListening) win.webContents.send("auth", url);
  else pendingAuth = url;
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}
if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient("nevernote", process.execPath, [process.argv[1]]);
else app.setAsDefaultProtocolClient("nevernote");
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", (_e, argv) => {
  const link = argv.find((a) => a.startsWith("nevernote://"));
  if (link) deliverAuth(link);
  else if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on("open-url", (e, url) => {
  e.preventDefault();
  deliverAuth(url);
});

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(join(__dirname, "engine-worker.cjs"));
  worker.on("message", (m) => {
    if (m.type === "segment") win?.webContents.send("rec:segment", m);
    if (m.type === "stage") win?.webContents.send("rec:stage", m);
    if (m.type === "partial") win?.webContents.send("rec:partial", m);
    if (m.type === "error") win?.webContents.send("rec:stage", { noteId: m.noteId, stage: "failed", message: m.message });
  });
  worker.on("exit", () => (worker = undefined));
  return worker;
}

function createWindow() {
  const mac = process.platform === "darwin";
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    title: "Nevernote",
    titleBarStyle: mac ? "hiddenInset" : "hidden",
    titleBarOverlay: mac ? undefined : { color: "#00000000", symbolColor: "#1d1d1f", height: 40 },
    trafficLightPosition: mac ? { x: 18, y: 18 } : undefined,
    // Liquid glass: the desktop shows through the sidebar.
    vibrancy: mac ? "sidebar" : undefined,
    visualEffectState: "followWindow",
    backgroundMaterial: process.platform === "win32" ? "mica" : undefined,
    backgroundColor: mac ? "#00000000" : "#f5f5f7",
    show: false,
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: false },
  });
  win.once("ready-to-show", () => win?.show());
  const dev = process.env.NEVERNOTE_DEV_URL;
  if (dev) win.loadURL(`${dev}/app`);
  else win.loadFile(join(__dirname, "..", "renderer", "index.html"), { hash: "/app" });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

/**
 * `NEVERNOTE_SELFTEST=1 Nevernote` (used by the release build on every platform) opens the real
 * packaged app, checks the screen loads with its bridge, then starts the speech engine in its
 * worker. With `=full` it also downloads the offline models and transcribes a sample recording.
 * Exits 0 on success, 1 on any failure.
 */
async function selfTest() {
  const full = process.env.NEVERNOTE_SELFTEST === "full";
  const say = (m: string) => {
    console.log(`SELFTEST ${m}`);
    // Windows apps have no console, so CI reads the result from a file.
    if (process.env.NEVERNOTE_SELFTEST_OUT) appendFileSync(process.env.NEVERNOTE_SELFTEST_OUT, `${m}\n`);
  };
  const fail = (m: string) => {
    say(`FAIL ${m}`);
    app.exit(1);
  };
  setTimeout(() => fail("timed out"), 16 * 60_000);
  // CI runs the app in the background, where App Nap would freeze it.
  holdAwake(true);
  // A heartbeat, so a log shows whether the app froze or was just waiting.
  const beat = setInterval(() => say(`still running after ${Math.round(process.uptime())}s`), 60_000);
  beat.unref?.();
  try {
    createWindow();
    await new Promise<void>((ok) => win!.webContents.once("did-finish-load", () => ok()));
    await new Promise((r) => setTimeout(r, 3000));
    const ui = await win!.webContents.executeJavaScript(`({ bridge: !!window.nevernote && !!window.nevernote.recorder, rendered: (document.getElementById("root")?.children.length ?? 0) > 0, title: document.body.innerText.slice(0, 60) })`);
    say(`window ${JSON.stringify(ui)}`);
    if (!ui.bridge || !ui.rendered) return fail("the app screen did not load");

    const asr: AsrModelId = "parakeet-en";
    say("screen OK, getting the speech models");
    // Progress every tenth, so a slow or stuck download shows where it stopped.
    const t0 = Date.now();
    let shown = -1;
    if (full)
      await ensureModels(modelsDir, asr, (p, label) => {
        const tenth = Math.floor(p * 10);
        if (tenth > shown || label === "ready" || label.startsWith("retrying")) say(`models ${Math.round(p * 100)}% ${label} after ${Math.round((Date.now() - t0) / 1000)}s`);
        shown = tenth;
      });
    else if (!installed(modelsDir, asr)) {
      say("OK (screen and bridge; engine needs models, run with =full to test it)");
      return app.exit(0);
    }
    const w = getWorker();
    const reply = (type: string) =>
      new Promise<any>((ok, bad) => {
        const h = (m: any) => {
          if (m.type === "error") bad(new Error(m.message));
          if (m.type === type) {
            w.off("message", h);
            ok(m);
          }
        };
        w.on("message", h);
      });
    const started = reply("started");
    // Course words are passed the way a real class passes them; models that can't use them must still start.
    const hotwordsFile = join(data, "hotwords.txt");
    writeFileSync(hotwordsFile, ["MITOSIS", "PHOTOSYNTHESIS", "PORTRAIT"].join("\n"));
    w.postMessage({ type: "start", noteId: "selftest", modelsDir, asr, threads: 2, hotwordsFile });
    await started;
    say("engine loaded");

    const dir = join(modelsDir, ASR_MODELS[asr].installs, "test_wavs");
    const wav = existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith(".wav")) : undefined;
    if (!wav) {
      say("OK (screen, bridge and engine; no sample recording in the model)");
      return app.exit(0);
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { samples, sampleRate } = require("sherpa-onnx-node").readWave(join(dir, wav), false);
    if (sampleRate !== 16000) return fail(`sample is ${sampleRate} Hz`);
    const done = reply("finished");
    let partials = 0;
    w.on("message", (m: any) => m.type === "partial" && m.text && partials++);
    // Feed it like a microphone would (at twice real time), so the live words are exercised too.
    for (let i = 0; i < samples.length; i += 1600) {
      const c = Float32Array.from(samples.subarray(i, i + 1600));
      w.postMessage({ type: "audio", samples: c.buffer }, [c.buffer]);
      await new Promise((r) => setTimeout(r, 50));
    }
    say(`live words shown while speaking: ${partials}`);
    w.postMessage({ type: "stop", noteId: "selftest" });
    const r = await done;
    const text = r.segments.map((s: { text: string }) => s.text).join(" ").trim();
    say(`heard "${text.slice(0, 120)}"`);
    if (text.split(/\s+/).length < 4) return fail("the engine heard almost nothing in the sample recording");
    say("OK");
    app.exit(0);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

app.whenReady().then(async () => {
  useFetch(net.fetch as typeof fetch);
  if (process.env.NEVERNOTE_SELFTEST) return void selfTest();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "media" || permission === "notifications"));
  if (process.platform === "darwin") await systemPreferences.askForMediaAccess("microphone").catch(() => false);
  createWindow();
  const link = process.argv.find((a) => a.startsWith("nevernote://"));
  if (link) deliverAuth(link);
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());

/**
 * macOS App Nap freezes timers and network for an app that isn't in front, which
 * would stall a model download or a class being transcribed in the background.
 * Held while either runs.
 */
let napBlock: number | undefined;
let napHolds = 0;
function holdAwake(on: boolean) {
  napHolds = Math.max(0, napHolds + (on ? 1 : -1));
  if (napHolds && napBlock === undefined) napBlock = powerSaveBlocker.start("prevent-app-suspension");
  if (!napHolds && napBlock !== undefined) {
    powerSaveBlocker.stop(napBlock);
    napBlock = undefined;
  }
}

ipcMain.handle("models:status", () =>
  Object.fromEntries(Object.keys(ASR_MODELS).map((k) => [k, installed(modelsDir, k as AsrModelId)])),
);
ipcMain.handle("models:download", async (_e, asr: AsrModelId) => {
  holdAwake(true);
  try {
    await ensureModels(modelsDir, asr, (p, label) => win?.webContents.send("models:progress", { asr, p, label }));
  } finally {
    holdAwake(false);
  }
  return true;
});

ipcMain.handle("rec:start", (_e, noteId: string, asr: AsrModelId, vocabulary: string[] = []) => {
  let hotwordsFile: string | undefined;
  if (vocabulary.length) {
    hotwordsFile = join(data, "hotwords.txt");
    // Parakeet's BPE hotwords are written in upper case, one phrase per line.
    writeFileSync(hotwordsFile, vocabulary.map((v) => v.toUpperCase()).join("\n"));
  }
  holdAwake(true);
  getWorker().postMessage({ type: "start", noteId, modelsDir, asr, threads: Math.max(2, Math.min(6, cpus().length - 2)), hotwordsFile });
});
ipcMain.on("rec:audio", (_e, buf: ArrayBuffer) => worker?.postMessage({ type: "audio", samples: buf }, [buf]));
ipcMain.handle(
  "rec:stop",
  (_e, noteId: string) =>
    new Promise((resolve) => {
      const w = getWorker();
      const h = (m: any) => {
        if (m.noteId !== noteId || (m.type !== "finished" && m.type !== "error")) return;
        w.off("message", h);
        holdAwake(false);
        if (m.type === "finished") store.saveAudio(noteId, m.audio);
        resolve(m.type === "finished" ? { segments: m.segments, seconds: m.seconds } : { error: m.message });
      };
      w.on("message", h);
      w.postMessage({ type: "stop", noteId });
    }),
);

ipcMain.handle("notes:list", () => store.list().map((n) => ({ ...n, segments: n.segments.slice(0, 3) })));
ipcMain.handle("notes:get", (_e, id: string) => store.get(id));
ipcMain.handle("notes:put", (_e, note: Note) => store.put(note));
ipcMain.handle("notes:delete", (_e, id: string) => store.delete(id));
ipcMain.handle("notes:meta", (_e, key: string, value?: string) => store.meta(key, value));
ipcMain.handle("notify", (_e, title: string, body: string, noteId?: string) => {
  const n = new Notification({ title, body, silent: false });
  n.on("click", () => {
    win?.show();
    if (noteId) win?.webContents.send("open-note", noteId);
  });
  n.show();
});
// The page asks for a link that arrived before it was listening.
ipcMain.handle("auth:pending", () => {
  authListening = true;
  const url = pendingAuth;
  pendingAuth = undefined;
  return url;
});
ipcMain.handle("open-external", (_e, url: string) => /^https:\/\//.test(url) && shell.openExternal(url));
