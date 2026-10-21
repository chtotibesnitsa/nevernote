// Local-first sync. Every device keeps its own copy and works with no
// internet; when a connection appears the outbox drains and newer notes come
// down. Recording never waits on the network.

import type { Note, Segment } from "./types.ts";

/** Merge two copies of the same note. Segments union by id; other fields: newest edit wins. */
export function mergeNote(a: Note, b: Note): Note {
  const [older, newer] = Date.parse(a.updatedAt) <= Date.parse(b.updatedAt) ? [a, b] : [b, a];
  const segs = new Map<string, Segment>();
  for (const s of older.segments) segs.set(s.id, s);
  for (const s of newer.segments) segs.set(s.id, s);
  return {
    ...older,
    ...newer,
    // A summary or duration is never "un-made" by an older copy.
    summary: newer.summary ?? older.summary,
    durationSec: Math.max(a.durationSec, b.durationSec),
    segments: [...segs.values()].sort((x, y) => x.start - y.start),
    thoughts: newer.thoughts || older.thoughts,
  };
}

export interface Store {
  get(id: string): Promise<Note | undefined>;
  put(note: Note): Promise<void>;
  list(): Promise<Note[]>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
}

export interface Remote {
  push(notes: Note[]): Promise<void>;
  /** Notes changed since the cursor, oldest first, plus the next cursor. */
  pull(cursor: string | undefined, limit: number): Promise<{ notes: Note[]; cursor?: string }>;
}

export type SyncState = "offline" | "syncing" | "synced" | "error";

export class Syncer {
  private running = false;
  private failures = 0;
  constructor(
    private store: Store,
    private remote: Remote,
    private onState: (s: SyncState) => void = () => {},
  ) {}

  /** Seconds to wait after the nth consecutive failure: 5, 10, 20 ... capped at 5 minutes. */
  backoff(): number {
    return Math.min(300, 5 * 2 ** Math.max(0, this.failures - 1));
  }

  async run(online: boolean): Promise<void> {
    if (!online) return this.onState("offline");
    if (this.running) return;
    this.running = true;
    this.onState("syncing");
    try {
      const all = await this.store.list();
      // Notes still recording sync once they stop; everything else that changed goes up.
      const dirty = all.filter((n) => n.stage !== "recording" && (!n.syncedAt || Date.parse(n.updatedAt) > Date.parse(n.syncedAt)));
      for (let i = 0; i < dirty.length; i += 20) await this.remote.push(dirty.slice(i, i + 20));
      const now = new Date().toISOString();
      for (const n of dirty) await this.store.put({ ...n, syncedAt: now });

      let cursor = await this.store.getMeta("cursor");
      for (;;) {
        const page = await this.remote.pull(cursor, 50);
        for (const r of page.notes) {
          const local = await this.store.get(r.id);
          await this.store.put({ ...(local ? mergeNote(local, r) : r), syncedAt: now });
        }
        if (!page.cursor || page.notes.length === 0) break;
        cursor = page.cursor;
        await this.store.setMeta("cursor", cursor);
      }
      this.failures = 0;
      this.onState("synced");
    } catch (e) {
      this.failures++;
      this.onState("error");
      throw e;
    } finally {
      this.running = false;
    }
  }
}

type Row = Record<string, any>;

/** A note as a row of the server's `notes` table. */
export const noteToRow = (n: Note, userId: string): Row => ({
  id: n.id, user_id: userId, title: n.title, created_at: n.createdAt, updated_at: n.updatedAt, duration_sec: n.durationSec,
  device: n.device, folder: n.folder ?? null, stage: n.stage, segments: n.segments, speakers: n.speakers,
  extractions: n.extractions, summary: n.summary ?? null, thoughts: n.thoughts, vocabulary: n.vocabulary ?? [],
});

export const rowToNote = (r: Row): Note => ({
  id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at, durationSec: r.duration_sec, device: r.device,
  folder: r.folder ?? undefined, stage: r.stage, segments: r.segments ?? [], speakers: r.speakers ?? [], extractions: r.extractions ?? [],
  summary: r.summary ?? undefined, thoughts: r.thoughts ?? "", vocabulary: r.vocabulary ?? [],
});
