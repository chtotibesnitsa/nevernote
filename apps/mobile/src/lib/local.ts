// Notes live as one JSON file each in the app's Documents folder, so a
// recording is never lost to a crash, a dead battery or no signal.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Note, Store } from "@notelater/core";
import { Directory, File, Paths } from "expo-file-system";

const dir = new Directory(Paths.document, "notes");
const audioDir = new Directory(Paths.document, "audio");

function ensure(d: Directory) {
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
}

const fileFor = (id: string) => new File(dir, `${id}.json`);

export const local: Store & { delete(id: string): Promise<void> } = {
  async get(id) {
    const f = fileFor(id);
    if (!f.exists) return undefined;
    try {
      return JSON.parse(await f.text()) as Note;
    } catch {
      return undefined;
    }
  },
  async put(n) {
    ensure(dir);
    const f = fileFor(n.id);
    // Write-then-move keeps a half-written file from ever replacing a good one.
    const tmp = new File(dir, `.${n.id}.tmp`);
    tmp.write(JSON.stringify(n));
    await tmp.move(f, { overwrite: true });
  },
  async list() {
    ensure(dir);
    const out: Note[] = [];
    for (const e of dir.list()) {
      if (!(e instanceof File) || !e.name.endsWith(".json")) continue;
      try {
        out.push(JSON.parse(await e.text()));
      } catch {
        /* skip a corrupt file rather than lose the whole list */
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async delete(id) {
    const f = fileFor(id);
    if (f.exists) f.delete();
    const a = audioFile(id);
    if (a.exists) a.delete();
  },
  getMeta: async (k) => (await AsyncStorage.getItem(`nn:meta:${k}`)) ?? undefined,
  setMeta: (k, v) => AsyncStorage.setItem(`nn:meta:${k}`, v),
};

export function audioFile(id: string): File {
  ensure(audioDir);
  return new File(audioDir, `${id}.wav`);
}
