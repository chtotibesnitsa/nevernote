// Shared data model. The desktop app, the website and the iOS app all store
// notes in this shape, and the sync server mirrors it table for table.

export type Device = "mac" | "windows" | "linux" | "web" | "ios" | "android";

/** Where a note is in its life. Drives the red / orange / green dots. */
export type Stage =
  | "recording"
  | "paused"
  | "transcribing" // speech-to-text still catching up with the audio
  | "labelling" // speaker identification pass after recording stops
  | "queued" // waiting for internet to summarise or sync
  | "summarising"
  | "ready"
  | "failed";

export interface Segment {
  id: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
  text: string;
  /** Stable within a note: "S1", "S2"... until the user renames them. */
  speaker?: string;
}

export interface Speaker {
  id: string;
  name: string;
  /** Share of talk time, 0..1. */
  share: number;
}

export type ExtractionKind = "deadline" | "exam" | "event" | "reminder" | "important";

export interface Extraction {
  id: string;
  kind: ExtractionKind;
  title: string;
  /** ISO 8601 in the user's local time zone, when a date was found. */
  when?: string;
  allDay: boolean;
  /** The exact words that triggered it, for "show me where they said that". */
  phrase: string;
  segmentId?: string;
  confidence: number;
  source: "keywords" | "ai";
}

export interface Summary {
  title: string;
  /** Markdown: headed sections with bullet points, Wispr-style. */
  notes: string;
  studyGuide: { question: string; answer: string }[];
  keyTerms: { term: string; definition: string }[];
  extractions: Extraction[];
  model: string;
  createdAt: string;
  /** How many transcript segments these notes cover; anything after came in later (a resumed class). */
  covered?: number;
  /** Notes for what was added later, each kept in its own dated section (unless the student chose to merge). */
  updates?: SummaryUpdate[];
}

export interface SummaryUpdate {
  /** When this update was written. */
  at: string;
  /** Transcript time it covers, in seconds from the start of the note. */
  fromSec: number;
  toSec: number;
  notes: string;
  studyGuide: { question: string; answer: string }[];
  keyTerms: { term: string; definition: string }[];
  model: string;
}

export interface Note {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  durationSec: number;
  device: Device;
  folder?: string;
  stage: Stage;
  segments: Segment[];
  speakers: Speaker[];
  extractions: Extraction[];
  summary?: Summary;
  /** Free-form typed notes ("My thoughts" tab). */
  thoughts: string;
  /** Course words that boost recognition (names, jargon). */
  vocabulary?: string[];
  /** Last time this note was confirmed on the server. */
  syncedAt?: string;
  /** Tombstone: an emptied note kept until it syncs, so other devices delete it too. */
  deleted?: boolean;
}

export type Plan = "free" | "pro";
