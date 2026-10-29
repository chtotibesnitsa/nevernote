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
  | "export"
  | "flashcards"
  | "practiceTest"
  | "calendarFile";

const PRO_ONLY = new Set<Feature>(["askNotes", "calendarSync", "instantUnlimitedSummaries", "examPack", "export", "flashcards", "practiceTest"]);

export function can(plan: Plan, f: Feature): boolean {
  return plan === "pro" || !PRO_ONLY.has(f);
}

/**
 * Who's using the app: a guest (no account yet, notes only in this browser),
 * a free account (signed in with Google) or Pro.
 */
export type Tier = "guest" | "free" | "pro";

/** What a guest can't do until they sign up (free). Recording and transcription are never limited. */
const ACCOUNT_ONLY = new Set<Feature>(["summary", "studyGuide", "sync", "insights", "calendarFile"]);

export function tierCan(tier: Tier, f: Feature): boolean {
  if (tier === "pro") return true;
  if (PRO_ONLY.has(f)) return false;
  return tier === "free" || !ACCOUNT_ONLY.has(f);
}

/** The step that unlocks a feature: "signup" (free account) or "pro". */
export function unlockStep(tier: Tier, f: Feature): "signup" | "pro" | null {
  if (tierCan(tier, f)) return null;
  return PRO_ONLY.has(f) ? (tier === "guest" ? "signup" : "pro") : "signup";
}

export const PRICING = {
  monthly: { price: 3.99, label: "$3.99 / month" },
  yearly: { price: 29.99, label: "$29.99 / year", note: "4 months free" },
} as const;

/**
 * Free AI notes a day that are written right away. Every write counts: a new
 * class, and each update a pause or stop adds to one. Past this they still get
 * written, overnight (or right away after a short sponsor card); Pro is unlimited.
 */
export const FREE_INSTANT_SUMMARIES_PER_DAY = 5;

/** The daily allowance resets at midnight UTC, the same clock the server counts by. */
export function nextReset(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Cost guards. A summary costs about $0.002 per class hour on Gemini Flash Lite, so these keep a heavy free user under a few cents a month. */
export const LIMITS = {
  /** Sponsor-card summaries a free user can unlock per day. */
  sponsoredPerDay: 10,
  /** Pro "Ask your notes" questions per day. */
  asksPerDay: 30,
  /** Longest transcript we summarise in one note, in words (about 4 hours of class). */
  maxSummaryWords: 36_000,
  /** Times one note can be summarised again per day (after edits, or each time a class is resumed). */
  resummariesPerNotePerDay: 16,
} as const;

export type SummaryRoute = "instant" | "sponsored-or-overnight";

export function summaryRoute(plan: Plan, usedToday: number): SummaryRoute {
  if (plan === "pro" || usedToday < FREE_INSTANT_SUMMARIES_PER_DAY) return "instant";
  return "sponsored-or-overnight";
}

export const PRO_PITCH: { feature: Feature; title: string; body: string }[] = [
  { feature: "calendarSync", title: "Due dates land in your calendar", body: "Every deadline and test NoteLater hears goes straight into Google or Apple Calendar, with a reminder the night before." },
  { feature: "askNotes", title: "Ask your notes anything", body: "\"What did I miss?\" \"What's on Friday's test?\" Answers from every class you've recorded, with the exact moment they said it." },
  { feature: "examPack", title: "Exam packs", body: "Pick a unit and get one study guide, flashcards and practice questions built from all of its lectures." },
  { feature: "practiceTest", title: "Practice tests and study plans", body: "A fresh test written from what your teacher actually said, and a day-by-day plan up to the exam." },
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
    batchQueued: ["Notes coming tonight", "Free accounts get 5 instant notes a day; the rest are written overnight. Pro writes them instantly."],
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
