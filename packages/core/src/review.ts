// The daily check-in: which things NoteLater heard are worth a quick yes or no.
import type { Extraction, Note } from "./types.ts";

const TRACKED = new Set(["deadline", "exam", "event", "reminder"]);

/** Hidden everywhere once the student says it isn't real. */
export const isLive = (e: Extraction) => e.status !== "dismissed";

/** Heard, but not sure enough to trust without asking: keyword guesses, or no date. */
export function needsReview(e: Extraction, now = new Date()): boolean {
  if (e.status || !TRACKED.has(e.kind)) return false;
  if (e.when && Date.parse(e.when.slice(0, 10)) < Date.parse(now.toISOString().slice(0, 10)) - 86_400_000) return false;
  return e.confidence < 0.85 || !e.when;
}

export interface Pending {
  e: Extraction;
  n: Note;
}

/** Everything waiting for a yes or no, newest class first. */
export function reviewQueue(notes: Note[], now = new Date()): Pending[] {
  return notes
    .filter((n) => !n.deleted)
    .flatMap((n) => n.extractions.filter((e) => needsReview(e, now)).map((e) => ({ e, n })))
    .sort((a, b) => b.n.createdAt.localeCompare(a.n.createdAt));
}

/** Dated things still ahead (today included), soonest first. Confirmed or confident ones only. */
export function comingUp(notes: Note[], now = new Date(), days = 14): Pending[] {
  const today = now.toISOString().slice(0, 10);
  const until = new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  return notes
    .filter((n) => !n.deleted)
    .flatMap((n) =>
      n.extractions
        .filter((e) => e.when && isLive(e) && TRACKED.has(e.kind) && e.when.slice(0, 10) >= today && e.when.slice(0, 10) <= until && (e.status === "confirmed" || !needsReview(e, now)))
        .map((e) => ({ e, n })),
    )
    .sort((a, b) => a.e.when!.localeCompare(b.e.when!));
}

/** The note with one extraction answered. Confirming makes it certain. */
export function answer(n: Note, id: string, status: "confirmed" | "dismissed", patch: Partial<Extraction> = {}): Extraction[] {
  return n.extractions.map((e) => (e.id === id ? { ...e, ...patch, status, confidence: status === "confirmed" ? 1 : e.confidence } : e));
}
