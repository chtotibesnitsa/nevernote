// Notes live as JSON files next to their audio in the app's data folder.
// Plain files: easy to back up, easy to inspect, nothing to migrate.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Note } from "../../../packages/core/src/types.ts";

export class FileStore {
  constructor(private dir: string) {
    mkdirSync(join(dir, "notes"), { recursive: true });
    mkdirSync(join(dir, "audio"), { recursive: true });
  }
  private path(id: string) {
    if (!/^[\w-]+$/.test(id)) throw new Error("bad note id");
    return join(this.dir, "notes", `${id}.json`);
  }
  get(id: string): Note | undefined {
    try {
      return JSON.parse(readFileSync(this.path(id), "utf8"));
    } catch {
      return undefined;
    }
  }
  put(note: Note): void {
    const p = this.path(note.id);
    writeFileSync(`${p}.tmp`, JSON.stringify(note));
    renameSync(`${p}.tmp`, p);
  }
  delete(id: string): void {
    rmSync(this.path(id), { force: true });
    rmSync(join(this.dir, "audio", `${id}.wav`), { force: true });
  }
  list(): Note[] {
    return readdirSync(join(this.dir, "notes"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => this.get(f.slice(0, -5)))
      .filter((n): n is Note => !!n)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  meta(key: string, value?: string): string | undefined {
    const p = join(this.dir, "meta.json");
    let m: Record<string, string> = {};
    try {
      m = JSON.parse(readFileSync(p, "utf8"));
    } catch {}
    if (value === undefined) return m[key];
    m[key] = value;
    writeFileSync(p, JSON.stringify(m));
    return value;
  }
  saveAudio(id: string, samples: Float32Array): void {
    writeFileSync(join(this.dir, "audio", `${id}.wav`), wav(samples, 16000));
  }
}

/** 16-bit PCM WAV. */
export function wav(samples: Float32Array, rate: number): Buffer {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}
