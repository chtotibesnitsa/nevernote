// Local note storage: files on desktop, IndexedDB in the browser.
import type { Note, Store } from "@nevernote/core";
import { desktop } from "./bridge.ts";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("nevernote", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("notes", { keyPath: "id" });
      req.result.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: "notes" | "meta", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const d = desktop;

export const local: Store & { delete(id: string): Promise<void> } = d
  ? {
      get: (id) => d.notes.get(id),
      put: (n) => d.notes.put(n),
      list: () => d.notes.list(),
      delete: (id) => d.notes.delete(id),
      getMeta: (k) => d.notes.meta(k),
      setMeta: async (k, v) => void (await d.notes.meta(k, v)),
    }
  : {
      get: (id) => tx<Note | undefined>("notes", "readonly", (s) => s.get(id)),
      put: async (n) => void (await tx("notes", "readwrite", (s) => s.put(n))),
      list: async () => (await tx<Note[]>("notes", "readonly", (s) => s.getAll())).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      delete: async (id) => void (await tx("notes", "readwrite", (s) => s.delete(id))),
      getMeta: (k) => tx<string | undefined>("meta", "readonly", (s) => s.get(k)),
      setMeta: async (k, v) => void (await tx("meta", "readwrite", (s) => s.put(v, k))),
    };
