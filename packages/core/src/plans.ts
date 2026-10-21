// What's free, what's Pro, and when we're allowed to mention Pro.

import type { Plan } from "./types.ts";

export type Feature =
  | "record"
  | "transcribe"
  | "speakers"
  | "sync"
  | "keywordReminders"
  | "summary"
  | "studyGuide"
  | "insights"
  | "askNotes"
  | "calendarSync"
  | "instantUnlimitedSummaries"
  | "examPack"
  | "export";

const PRO_ONLY = new Set<Feature>(["askNotes", "calendarSync", "instantUnlimitedSummaries", "examPack", "export"]);

export function can(plan: Plan, f: Feature): boolean {
  return plan === "pro" || !PRO_ONLY.has(f);
}

export const PRICING = {
  monthly: { price: 3.99, label: "$3.99 / month" },
  yearly: { price: 29.99, label: "$29.99 / year", note: "4 months free" },
} as const;

/** Free AI summaries that run the moment you're online. Past this they still run, just batched overnight (or instantly after a short sponsor card). */
export const FREE_INSTANT_SUMMARIES_PER_DAY = 3;

/** Cost guards. A summary costs about $0.002 per class hour on Gemini Flash Lite, so these keep a heavy free user under a few cents a month. */
export const LIMITS = {
  /** Sponsor-card summaries a free user can unlock per day. */
  sponsoredPerDay: 10,
  /** Pro "Ask your notes" questions per day. */
  asksPerDay: 100,
  /** Longest transcript we summarise in one note, in words (about 4 hours of class). */
  maxSummaryWords: 36_000,
  /** Times one note can be re-summarised (e.g. after edits) per day. */
  resummariesPerNotePerDay: 2,
} as const;

export type SummaryRoute = "instant" | "sponsored-or-overnight";

export function summaryRoute(plan: Plan, usedToday: number): SummaryRoute {
  if (plan === "pro" || usedToday < FREE_INSTANT_SUMMARIES_PER_DAY) return "instant";
  return "sponsored-or-overnight";
}

export const PRO_PITCH: { feature: Feature; title: string; body: string }[] = [
  { feature: "calendarSync", title: "Due dates land in your calendar", body: "Every deadline and test Nevernote hears goes straight into Google or Apple Calendar, with a reminder the night before." },
  { feature: "askNotes", title: "Ask your notes anything", body: "\"What did I miss?\" \"What's on Friday's test?\" Answers from every class you've recorded, with the exact moment they said it." },
  { feature: "examPack", title: "Exam packs", body: "Pick a unit and get one study guide, flashcards and practice questions built from all of its lectures." },
  { feature: "instantUnlimitedSummaries", title: "Instant notes, every time", body: "No waiting for overnight batches and no sponsor cards." },
  { feature: "export", title: "Export anywhere", body: "Send notes to Notion, Google Docs, Markdown or PDF." },
];

// ---- Gentle upsell ----

export type UpsellMoment =
  | "deadlineFound" // a due date was just heard
  | "summaryReady"
  | "askedQuestion" // typed into Ask on the free plan
  | "streak" // hit a streak milestone
  | "batchQueued"; // ran out of instant summaries

export interface UpsellState {
  installedAt: string;
  lastShownAt?: string;
  shownCount: number;
  dismissedInARow: number;
  snoozedUntil?: string;
}

export interface UpsellDecision {
  show: boolean;
  title?: string;
  body?: string;
  reason?: string;
}

const DAY = 86_400_000;

/**
 * Pro is mentioned only at a moment where it would have helped, at most once
 * every three days, never in the first two days, never while recording, and
 * it goes quiet for a month after three dismissals in a row.
 */
export function shouldUpsell(plan: Plan, moment: UpsellMoment, state: UpsellState, now: Date, recording = false): UpsellDecision {
  if (plan === "pro") return { show: false, reason: "pro" };
  if (recording) return { show: false, reason: "recording" };
  const t = now.getTime();
  if (t - Date.parse(state.installedAt) < 2 * DAY) return { show: false, reason: "new user" };
  if (state.snoozedUntil && t < Date.parse(state.snoozedUntil)) return { show: false, reason: "snoozed" };
  // Asking a question is an explicit request, so it isn't rate-limited.
  if (moment !== "askedQuestion" && state.lastShownAt && t - Date.parse(state.lastShownAt) < 3 * DAY) return { show: false, reason: "too soon" };
  const copy: Record<UpsellMoment, [string, string]> = {
    deadlineFound: ["Want this in your calendar?", "Pro adds every due date it hears to Google Calendar automatically."],
    summaryReady: ["Your notes are ready", "With Pro you can ask them questions, like \"what's on the test?\""],
    askedQuestion: ["Ask your notes with Pro", "Get answers from every class you've recorded, with the moment they said it."],
    streak: ["Nice streak", "Pro turns a week of lectures into one exam pack."],
    batchQueued: ["Notes coming tonight", "Free notes past 3 a day are written overnight. Pro writes them instantly."],
  };
  const [title, body] = copy[moment];
  return { show: true, title, body };
}

export function recordUpsell(state: UpsellState, now: Date, dismissed: boolean): UpsellState {
  const dismissedInARow = dismissed ? state.dismissedInARow + 1 : 0;
  return {
    ...state,
    lastShownAt: now.toISOString(),
    shownCount: state.shownCount + 1,
    dismissedInARow: dismissedInARow >= 3 ? 0 : dismissedInARow,
    snoozedUntil: dismissedInARow >= 3 ? new Date(now.getTime() + 30 * DAY).toISOString() : state.snoozedUntil,
  };
}
