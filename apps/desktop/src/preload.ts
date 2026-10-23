// The bridge the shared web UI uses to reach the local engine and files.
import { contextBridge, ipcRenderer } from "electron";

const on = (channel: string) => (cb: (payload: any) => void) => {
  const h = (_: unknown, p: any) => cb(p);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld("nevernote", {
  platform: process.platform,
  models: {
    status: () => ipcRenderer.invoke("models:status"),
    download: (asr: string) => ipcRenderer.invoke("models:download", asr),
    onProgress: on("models:progress"),
  },
  recorder: {
    start: (noteId: string, asr: string, vocabulary: string[]) => ipcRenderer.invoke("rec:start", noteId, asr, vocabulary),
    audio: (samples: Float32Array) => ipcRenderer.send("rec:audio", samples.buffer),
    stop: (noteId: string) => ipcRenderer.invoke("rec:stop", noteId),
    onSegment: on("rec:segment"),
    onStage: on("rec:stage"),
  },
  notes: {
    list: () => ipcRenderer.invoke("notes:list"),
    get: (id: string) => ipcRenderer.invoke("notes:get", id),
    put: (note: unknown) => ipcRenderer.invoke("notes:put", note),
    delete: (id: string) => ipcRenderer.invoke("notes:delete", id),
    meta: (key: string, value?: string) => ipcRenderer.invoke("notes:meta", key, value),
  },
  notify: (title: string, body: string, noteId?: string) => ipcRenderer.invoke("notify", title, body, noteId),
  onOpenNote: on("open-note"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  onAuth: (cb: (url: string) => void) => {
    const off = on("auth")(cb);
    ipcRenderer.invoke("auth:pending").then((url?: string) => url && cb(url));
    return off;
  },
});
