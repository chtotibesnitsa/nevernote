// Deterministic transcript scanner: regex date/future detection plus a large
// generated keyword net. This runs BEFORE and INDEPENDENTLY of the language
// model, so nothing forward-looking can be missed just because a model skipped
// it. Every hit is flagged for human review — it never writes a calendar event
// and never invents a due date.

import type { TranscriptSegment } from "./types";
import { normalizeText } from "./util";

export type SignalCategory =
  | "assessment"
  | "assignment"
  | "reading"
  | "project"
  | "presentation"
  | "logistics"
  | "materials"
  | "deadline"
  | "schedule_change"
  | "future_mention";

export interface TranscriptSignal {
  segment_id: string;
  segment_index: number;
  category: SignalCategory;
  /** The keyword or pattern that fired. */
  trigger: string;
  /** Verbatim sentence from the transcript — never paraphrased. */
  excerpt: string;
  /** Raw date/time words found in the same sentence, if any. */
  date_phrase: string;
  /** Only set for fully explicit calendar dates; relative phrases stay null. */
  resolved_date: string | null;
  /** 0-100 triage score used to order the review queue. */
  score: number;
}

// ---------------------------------------------------------------------------
// Keyword net — families x variants, expanded at module load into thousands of
// distinct surface forms so slight phrasing differences still match.
// ---------------------------------------------------------------------------

const ASSESSMENT_NOUNS = [
  "test", "quiz", "exam", "midterm", "final", "finals", "assessment", "evaluation", "benchmark",
  "unit test", "chapter test", "pop quiz", "practice test", "mock exam", "oral exam", "practical",
  "ap exam", "ap test", "sat", "psat", "act", "regents", "eoc", "state test", "standardized test",
  "diagnostic", "placement test", "retake", "make up test", "makeup exam", "final exam",
  "semester exam", "quarterly", "midyear", "mid-term", "check-in quiz", "spot check", "oral quiz",
];

const ASSIGNMENT_NOUNS = [
  "homework", "hw", "assignment", "worksheet", "packet", "problem set", "pset", "exercise",
  "essay", "paper", "report", "write-up", "writeup", "journal", "reflection", "response",
  "lab report", "lab write up", "annotated bibliography", "outline", "rough draft", "final draft",
  "revision", "edit", "peer review", "discussion post", "forum post", "blog post", "portfolio",
  "notebook check", "binder check", "problem sheet", "review sheet", "study guide", "take home",
  "take-home", "extra credit", "bonus assignment", "corrections", "test corrections",
];

const READING_NOUNS = [
  "reading", "read", "chapter", "chapters", "pages", "page", "article", "excerpt", "handout",
  "textbook", "novel", "book", "section", "passage", "poem", "play", "act", "scene", "case study",
  "primary source", "document", "packet reading", "assigned reading", "close reading",
];

const PROJECT_NOUNS = [
  "project", "group project", "final project", "capstone", "research project", "science fair",
  "experiment", "lab", "build", "prototype", "model", "poster", "display board", "portfolio piece",
  "milestone", "checkpoint", "deliverable", "phase", "proposal", "topic proposal", "thesis",
  "literature review", "data collection", "group work", "team assignment",
];

const PRESENTATION_NOUNS = [
  "presentation", "present", "speech", "debate", "oral report", "slideshow", "slide deck",
  "powerpoint", "google slides", "demo", "demonstration", "recital", "performance", "showcase",
  "gallery walk", "socratic seminar", "panel", "pitch", "defense",
];

const LOGISTICS_NOUNS = [
  "field trip", "permission slip", "form", "waiver", "consent form", "sign up", "signup",
  "office hours", "tutoring", "study session", "study hall", "review session", "help session",
  "conference", "parent conference", "meeting", "appointment", "assembly", "orientation",
  "registration", "enrollment", "course selection", "college visit", "guest speaker",
  "picture day", "early release", "half day", "no school", "holiday", "break", "spring break",
  "winter break", "fall break", "snow day", "delayed start", "fire drill", "lockdown drill",
  "graduation", "prom", "banquet", "tryout", "tryouts", "practice", "game", "match", "rehearsal",
  "audition", "competition", "tournament", "meet", "scrimmage", "club meeting", "fundraiser",
];

const MATERIAL_NOUNS = [
  "bring", "supplies", "materials", "calculator", "graphing calculator", "laptop", "chromebook",
  "charger", "headphones", "notebook", "binder", "folder", "pencil", "pen", "highlighter",
  "ruler", "protractor", "compass", "index cards", "note cards", "poster board", "glue",
  "scissors", "markers", "colored pencils", "lab goggles", "goggles", "lab coat", "apron",
  "gym clothes", "uniform", "cleats", "instrument", "sheet music", "textbook copy", "printed copy",
  "hard copy", "flash drive", "permission form", "signed form", "money", "cash", "fee",
];

const DEADLINE_NOUNS = [
  "due", "due date", "deadline", "cutoff", "cut-off", "last day", "final day", "submit by",
  "turn in", "turned in", "hand in", "handed in", "upload", "submit", "submission", "post by",
  "no later than", "closes", "close", "expires", "late penalty", "late work", "grace period",
  "extension", "resubmit",
];

const SCHEDULE_CHANGE_NOUNS = [
  "moved", "rescheduled", "postponed", "pushed back", "pushed to", "bumped", "changed to",
  "swapped", "canceled", "cancelled", "call off", "called off", "new date", "different day",
  "instead of", "earlier than", "later than", "double period", "shortened", "extended",
];

/** Verb/announcement frames that signal something upcoming. */
const FUTURE_FRAMES = [
  "will be", "will have", "we'll have", "there will be", "there's going to be", "going to be",
  "gonna be", "plan to", "planning to", "expect", "expecting", "coming up", "upcoming",
  "next class", "next time", "next week", "next month", "next unit", "next chapter",
  "make sure you", "make sure to", "be sure to", "don't forget", "do not forget", "remember to",
  "remember that", "keep in mind", "heads up", "reminder", "just a reminder", "note that",
  "you'll need", "you will need", "you need to", "you should", "i want you to", "i need you to",
  "start working on", "start studying", "study for", "prepare for", "prep for", "get ready for",
  "look over", "look at", "review for", "work on", "finish", "finish up", "complete", "wrap up",
  "sign up for", "bring in", "turn it in", "have it ready", "be ready", "come prepared",
];

const MODIFIERS = ["", "the ", "your ", "a ", "an ", "this ", "that ", "next ", "our ", "tomorrow's ", "monday's ", "friday's ", "upcoming "];
const SUFFIXES = ["", "s", " is due", " due", " tomorrow", " next week", " on friday", " coming up", " this week"];

interface KeywordEntry {
  phrase: string;
  category: SignalCategory;
  weight: number;
}

function expand(nouns: string[], category: SignalCategory, weight: number): KeywordEntry[] {
  const out: KeywordEntry[] = [];
  for (const noun of nouns) {
    for (const mod of MODIFIERS) {
      for (const suffix of SUFFIXES) {
        const phrase = `${mod}${noun}${suffix}`.trim();
        if (phrase.length < 3) continue;
        out.push({ phrase, category, weight });
      }
    }
  }
  return out;
}

/** The full keyword net. Built once; deduped by phrase, longest match wins. */
export const KEYWORDS: KeywordEntry[] = (() => {
  const all: KeywordEntry[] = [
    ...expand(ASSESSMENT_NOUNS, "assessment", 34),
    ...expand(ASSIGNMENT_NOUNS, "assignment", 30),
    ...expand(READING_NOUNS, "reading", 22),
    ...expand(PROJECT_NOUNS, "project", 28),
    ...expand(PRESENTATION_NOUNS, "presentation", 28),
    ...expand(LOGISTICS_NOUNS, "logistics", 24),
    ...expand(MATERIAL_NOUNS, "materials", 20),
    ...expand(DEADLINE_NOUNS, "deadline", 32),
    ...expand(SCHEDULE_CHANGE_NOUNS, "schedule_change", 26),
    ...FUTURE_FRAMES.map((phrase) => ({ phrase, category: "future_mention" as SignalCategory, weight: 14 })),
  ];
  const byPhrase = new Map<string, KeywordEntry>();
  for (const entry of all) {
    const key = normalizeText(entry.phrase);
    const prior = byPhrase.get(key);
    if (!prior || entry.weight > prior.weight) byPhrase.set(key, { ...entry, phrase: key });
  }
  // Longest first so "final exam" beats "final".
  return Array.from(byPhrase.values()).sort((a, b) => b.phrase.length - a.phrase.length);
})();

export const KEYWORD_COUNT = KEYWORDS.length;

// ---------------------------------------------------------------------------
// Date / future-time regexes
// ---------------------------------------------------------------------------

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";
const WEEKDAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thur|thu|fri|sat|sun";

/** Ordered by specificity. `absolute` marks patterns we can safely resolve. */
const DATE_PATTERNS: { re: RegExp; absolute: boolean; weight: number }[] = [
  // March 5th, 2026 / Mar 5 2026
  { re: new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, "gi"), absolute: true, weight: 30 },
  // 5th of March
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+(${MONTHS})\\b`, "gi"), absolute: true, weight: 30 },
  // 3/5, 3-5-2026, 03/05/26
  { re: /\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/g, absolute: true, weight: 26 },
  // ISO
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, absolute: true, weight: 30 },
  // this/next/coming Friday
  { re: new RegExp(`\\b(this|next|coming|following|upcoming)\\s+(${WEEKDAYS})\\b`, "gi"), absolute: false, weight: 24 },
  // by Friday / on Friday / before Friday
  { re: new RegExp(`\\b(by|on|before|after|until|till)\\s+(${WEEKDAYS})\\b`, "gi"), absolute: false, weight: 24 },
  // bare weekday
  { re: new RegExp(`\\b(${WEEKDAYS})\\b`, "gi"), absolute: false, weight: 14 },
  // tomorrow / tonight / today
  { re: /\b(tomorrow|tonight|today|tmrw)\b/gi, absolute: false, weight: 22 },
  // day after tomorrow
  { re: /\bday after tomorrow\b/gi, absolute: false, weight: 22 },
  // in 3 days / in two weeks
  { re: /\bin\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s+(day|days|week|weeks|month|months|class|classes|period|periods)\b/gi, absolute: false, weight: 22 },
  // next week / next month / next class / next period
  { re: /\b(next|following|upcoming|this)\s+(week|month|class|period|session|unit|quarter|semester|term|trimester)\b/gi, absolute: false, weight: 20 },
  // end of the week/month/quarter
  { re: /\b(end|beginning|start|middle)\s+of\s+(the\s+)?(week|month|quarter|semester|term|year|unit|day)\b/gi, absolute: false, weight: 20 },
  // at 3pm / 3:30 / noon
  { re: /\b(\d{1,2})(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/gi, absolute: false, weight: 12 },
  { re: /\b(noon|midnight|first period|last period|homeroom|before school|after school|lunch)\b/gi, absolute: false, weight: 12 },
  // vague-but-forward
  { re: /\b(soon|shortly|later this week|sometime|eventually|down the road|in a bit|before long)\b/gi, absolute: false, weight: 10 },
];

const MONTH_INDEX: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4,
  june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sept: 8, sep: 8,
  october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

/**
 * Resolves only unambiguous, fully-specified calendar dates. Anything relative
 * ("next Friday", "in two weeks") deliberately returns null so a human decides.
 */
function resolveAbsolute(text: string, reference: Date): string | null {
  const monthDay = new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, "i").exec(text);
  if (monthDay) {
    const month = MONTH_INDEX[monthDay[1].toLowerCase()];
    const day = Number(monthDay[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = monthDay[3] ? Number(monthDay[3]) : inferYear(month, day, reference);
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** Picks the year that puts an explicit month/day nearest the recording, forward-biased. */
function inferYear(month: number, day: number, reference: Date): number {
  const year = reference.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month, day, 12));
  // More than ~3 months in the past means the speaker meant next year.
  if (candidate.getTime() < reference.getTime() - 92 * 86_400_000) return year + 1;
  return year;
}

/** Splits a segment into sentences so excerpts stay quotable and tight. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function findDatePhrase(sentence: string): { phrase: string; weight: number; absolute: boolean } | null {
  let best: { phrase: string; weight: number; absolute: boolean } | null = null;
  for (const { re, absolute, weight } of DATE_PATTERNS) {
    re.lastIndex = 0;
    const match = re.exec(sentence);
    if (!match) continue;
    if (!best || weight > best.weight) best = { phrase: match[0].trim(), weight, absolute };
  }
  return best;
}

/**
 * Best keyword hit in a sentence. Ranks by category weight first so a strong
 * topic ("unit test") wins over a merely forward-looking frame ("start studying")
 * that happens to be a longer string; length breaks ties.
 */
function findKeyword(normalized: string): KeywordEntry | null {
  let best: KeywordEntry | null = null;
  for (const entry of KEYWORDS) {
    if (best && entry.weight < best.weight && entry.phrase.length <= best.phrase.length) continue;
    // Word-boundary-ish containment without building thousands of RegExps.
    const idx = normalized.indexOf(entry.phrase);
    if (idx < 0) continue;
    const before = idx === 0 ? " " : normalized[idx - 1];
    const afterIdx = idx + entry.phrase.length;
    const after = afterIdx >= normalized.length ? " " : normalized[afterIdx];
    if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
    if (!best || entry.weight > best.weight || (entry.weight === best.weight && entry.phrase.length > best.phrase.length)) {
      best = entry;
    }
  }
  return best;
}

const MAX_SIGNALS = 400;

/**
 * Scans every transcript sentence for upcoming-obligation signals. Pure and
 * synchronous — no model calls, no cost, and it cannot hallucinate.
 */
export function scanTranscriptSignals(segments: TranscriptSegment[], recordedAt: Date): TranscriptSignal[] {
  const out: TranscriptSignal[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    for (const sentence of sentences(segment.text)) {
      if (sentence.length < 8) continue;
      const normalized = normalizeText(sentence);
      const keyword = findKeyword(normalized);
      const date = findDatePhrase(sentence);
      // A hit needs either a topic keyword or a date; a date alone with no topic
      // is only worth flagging when it also carries a forward-looking frame.
      if (!keyword && !date) continue;
      if (!keyword && date && date.weight < 20) continue;

      const category: SignalCategory = keyword?.category ?? "future_mention";
      const trigger = keyword?.phrase ?? date?.phrase ?? "";
      const dedupeKey = `${category}|${trigger}|${normalized.slice(0, 60)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const resolved = date?.absolute ? resolveAbsolute(sentence, recordedAt) : null;
      // Past-dated explicit references are not upcoming; skip them.
      if (resolved && new Date(resolved).getTime() < recordedAt.getTime() - 86_400_000) continue;

      let score = (keyword?.weight ?? 0) + (date?.weight ?? 0);
      if (keyword && date) score += 15;
      if (resolved) score += 10;
      out.push({
        segment_id: segment.id,
        segment_index: segment.segment_index,
        category,
        trigger,
        excerpt: sentence.slice(0, 500),
        date_phrase: date?.phrase ?? "",
        resolved_date: resolved,
        score: Math.min(100, score),
      });
    }
  }

  return out.sort((a, b) => b.score - a.score || a.segment_index - b.segment_index).slice(0, MAX_SIGNALS);
}
