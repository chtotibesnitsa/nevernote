import { app, BrowserWindow, ipcMain, nativeTheme, Notification, session, shell, systemPreferences } from "electron";
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import type { Note } from "../../../packages/core/src/types.ts";
import { ASR_MODELS, ensureModels, installed, type AsrModelId } from "./models.ts";
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

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "media" || permission === "notifications"));
  if (process.platform === "darwin") await systemPreferences.askForMediaAccess("microphone").catch(() => false);
  createWindow();
  const link = process.argv.find((a) => a.startsWith("nevernote://"));
  if (link) deliverAuth(link);
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());

ipcMain.handle("models:status", () =>
  Object.fromEntries(Object.keys(ASR_MODELS).map((k) => [k, installed(modelsDir, k as AsrModelId)])),
);
ipcMain.handle("models:download", async (_e, asr: AsrModelId) => {
  await ensureModels(modelsDir, asr, (p, label) => win?.webContents.send("models:progress", { asr, p, label }));
  return true;
});

ipcMain.handle("rec:start", (_e, noteId: string, asr: AsrModelId, vocabulary: string[] = []) => {
  let hotwordsFile: string | undefined;
  if (vocabulary.length) {
    hotwordsFile = join(data, "hotwords.txt");
    // Parakeet's BPE hotwords are written in upper case, one phrase per line.
    writeFileSync(hotwordsFile, vocabulary.map((v) => v.toUpperCase()).join("\n"));
  }
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
