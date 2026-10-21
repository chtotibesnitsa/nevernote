// Insights: the numbers on the stats screen, all computed locally from notes.

import type { Device, Note } from "./types.ts";

export interface Insights {
  totalWords: number;
  totalHours: number;
  notes: number;
  /** Words per minute across everything recorded (how fast your classes talk). */
  wpm: number;
  speakersHeard: number;
  deadlinesCaught: number;
  streak: number;
  longestStreak: number;
  /** yyyy-mm-dd -> minutes recorded, for the streak grid. */
  heatmap: Record<string, number>;
  byDevice: Partial<Record<Device, number>>;
  byFolder: { folder: string; minutes: number }[];
  /** "You've transcribed 3 novels." */
  books: number;
}

const WORDS_PER_BOOK = 90_000;

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}']+/gu);
  return m ? m.length : 0;
}

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function insights(notes: Note[], today: Date = new Date()): Insights {
  let words = 0;
  let seconds = 0;
  let deadlines = 0;
  let speakers = 0;
  const heatmap: Record<string, number> = {};
  const byDevice: Partial<Record<Device, number>> = {};
  const folders = new Map<string, number>();
  for (const n of notes) {
    const w = n.segments.reduce((a, s) => a + countWords(s.text), 0);
    words += w;
    seconds += n.durationSec;
    speakers += n.speakers.length;
    deadlines += n.extractions.filter((e) => e.kind === "deadline" || e.kind === "exam").length;
    const k = dayKey(new Date(n.createdAt));
    heatmap[k] = (heatmap[k] ?? 0) + n.durationSec / 60;
    byDevice[n.device] = (byDevice[n.device] ?? 0) + w;
    if (n.folder) folders.set(n.folder, (folders.get(n.folder) ?? 0) + n.durationSec / 60);
  }
  const { current, longest } = streaks(Object.keys(heatmap), today);
  return {
    totalWords: words,
    totalHours: seconds / 3600,
    notes: notes.length,
    wpm: seconds > 0 ? Math.round(words / (seconds / 60)) : 0,
    speakersHeard: speakers,
    deadlinesCaught: deadlines,
    streak: current,
    longestStreak: longest,
    heatmap,
    byDevice,
    byFolder: [...folders].map(([folder, minutes]) => ({ folder, minutes })).sort((a, b) => b.minutes - a.minutes),
    books: Math.floor(words / WORDS_PER_BOOK),
  };
}

/**
 * School-day streaks: weekends never break a streak, so a student who records
 * every weekday keeps it going.
 */
export function streaks(days: string[], today: Date): { current: number; longest: number } {
  const set = new Set(days);
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  let longest = 0;
  let run = 0;
  const sorted = [...set].sort();
  if (sorted.length === 0) return { current: 0, longest: 0 };
  const first = new Date(`${sorted[0]}T12:00:00`);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  for (let d = new Date(first); d <= end; d.setDate(d.getDate() + 1)) {
    if (set.has(dayKey(d))) run++;
    else if (!isWeekend(d) && dayKey(d) !== dayKey(end)) run = 0;
    longest = Math.max(longest, run);
  }
  return { current: run, longest };
}
