import type { ParsedMeeting, ParsedSegment } from "./types";
import { ApiError } from "./util";

const SECTION_ALIASES: Record<string, string[]> = {
  summary: ["summary", "flow summary", "meeting summary", "overview", "tl;dr"],
  notes: ["notes", "my thoughts", "my notes", "action items", "key points"],
  transcript: ["transcript", "full transcript", "refined transcript", "raw transcript"],
  attendees: ["attendees", "participants", "people", "speakers"],
};

function classifyHeading(h: string): string | null {
  const key = h.toLowerCase().replace(/[^a-z; ]/g, "").trim();
  for (const [section, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.some((a) => key === a || key.startsWith(a))) return section;
  }
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Best-effort date parsing for formats commonly found in exported notes. */
export function parseLooseDate(input: string, fallbackYear?: number): Date | null {
  const text = input.trim();
  if (!text) return null;
  const iso = text.match(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?(?:Z|[+-]\d{2}:?\d{2})?/);
  if (iso) {
    const d = new Date(iso[0].replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const us = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (us) {
    const month = Number(us[1]) - 1;
    const day = Number(us[2]);
    let year = us[3] ? Number(us[3]) : (fallbackYear ?? new Date().getFullYear());
    if (year < 100) year += 2000;
    const time = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    let hours = 0;
    let minutes = 0;
    if (time) {
      hours = Number(time[1]) % 12;
      minutes = Number(time[2]);
      if (time[3]?.toLowerCase() === "pm") hours += 12;
    }
    const d = new Date(year, month, day, hours, minutes);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const long = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/);
  if (long) {
    const m = MONTHS[long[1].slice(0, 4).toLowerCase()] ?? MONTHS[long[1].slice(0, 3).toLowerCase()];
    if (m !== undefined) {
      const year = long[3] ? Number(long[3]) : (fallbackYear ?? new Date().getFullYear());
      const time = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      let hours = 0;
      let minutes = 0;
      if (time) {
        hours = Number(time[1]) % 12;
        minutes = Number(time[2]);
        if (time[3]?.toLowerCase() === "pm") hours += 12;
      }
      const d = new Date(year, m, Number(long[2]), hours, minutes);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

const SPEAKER_LINE = /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—]?\s*)?(?:\*\*)?([A-Z][\w .'-]{0,40}?)(?:\*\*)?\s*:\s+(.+)$/;
const TIMESTAMP_ONLY = /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–—]?\s*(.+)$/;

function toOffset(ts: string | undefined): number | null {
  if (!ts) return null;
  const parts = ts.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

/** Splits transcript text into speaker-labelled segments. */
export function segmentTranscript(transcript: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastSpeaker = "Speaker";
  const lines = transcript.split(/\r?\n/);
  let pendingSpeakerOnly: string | null = null;
  for (const raw of lines) {
    const line = raw.replace(/^[-*>]\s+/, "").trim();
    if (!line) continue;
    const speakerOnly = line.match(/^(?:\*\*)?([A-Z][\w .'-]{0,40}?)(?:\*\*)?\s*(?:\(\d{1,2}:\d{2}(?::\d{2})?\))?\s*:?$/);
    const m = line.match(SPEAKER_LINE);
    if (m && m[3] && !/^https?:/i.test(line)) {
      lastSpeaker = m[2].trim();
      segments.push({ speaker: lastSpeaker, text: m[3].trim(), offset: toOffset(m[1]) });
      pendingSpeakerOnly = null;
      continue;
    }
    if (speakerOnly && line.length < 48 && !/[.!?]$/.test(line)) {
      pendingSpeakerOnly = speakerOnly[1].trim();
      continue;
    }
    const t = line.match(TIMESTAMP_ONLY);
    if (t) {
      segments.push({ speaker: pendingSpeakerOnly ?? lastSpeaker, text: t[2].trim(), offset: toOffset(t[1]) });
      if (pendingSpeakerOnly) lastSpeaker = pendingSpeakerOnly;
      pendingSpeakerOnly = null;
      continue;
    }
    if (pendingSpeakerOnly) {
      lastSpeaker = pendingSpeakerOnly;
      pendingSpeakerOnly = null;
    }
    segments.push({ speaker: lastSpeaker, text: line, offset: null });
  }
  return segments;
}

/**
 * Parses a Wispr Flow "Copy to Markdown" export (or any similarly structured
 * meeting note) into title, date, attendees, summary, notes, and transcript.
 */
export function parseWisprMarkdown(markdown: string): ParsedMeeting {
  const source = markdown.replace(/\r\n/g, "\n").trim();
  if (source.length < 40) {
    throw new ApiError(400, "MALFORMED_IMPORT", "That import looks empty. Paste the full Markdown export from Wispr Flow (title, summary and transcript).");
  }
  const lines = source.split("\n");
  let title = "";
  const meta: Record<string, string> = {};
  const sections: Record<string, string[]> = { summary: [], notes: [], transcript: [], attendees: [], other: [] };
  let current: string = "preamble";
  const preamble: string[] = [];

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && !title) {
      title = h1[1].trim();
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.+)$/) ?? line.match(/^\*\*([^*]{2,40})\*\*:?\s*$/);
    if (heading) {
      const cls = classifyHeading(heading[1]);
      current = cls ?? "other";
      continue;
    }
    const kv = line.match(/^\**\s*(Date|When|Time|Start|Started|Ended|End|Duration|Meeting ID|ID|Attendees|Participants|Calendar|Event)\s*\**\s*[:\-]\s*\**\s*(.+?)\**\s*$/i);
    if (kv && (current === "preamble" || current === "other")) {
      meta[kv[1].toLowerCase()] = kv[2].trim();
      continue;
    }
    if (current === "preamble") preamble.push(line);
    else sections[current].push(line);
  }

  if (!title) {
    const firstText = preamble.find((l) => l.trim().length > 0);
    title = firstText?.replace(/^#+\s*/, "").trim().slice(0, 120) || "Imported meeting";
  }

  const dateSource = meta.date ?? meta.when ?? meta.start ?? meta.started ?? meta.time ?? "";
  let startedAt = parseLooseDate(dateSource);
  if (!startedAt) startedAt = parseLooseDate(title);
  if (!startedAt) {
    const inPreamble = preamble.map((l) => parseLooseDate(l)).find((d) => d !== null);
    startedAt = inPreamble ?? null;
  }
  let endedAt = parseLooseDate(meta.ended ?? meta.end ?? "");
  if (!endedAt && startedAt && meta.duration) {
    const mins = meta.duration.match(/(\d+)\s*(?:m|min)/i);
    const hrs = meta.duration.match(/(\d+)\s*(?:h|hr)/i);
    const total = (hrs ? Number(hrs[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
    if (total > 0) endedAt = new Date(startedAt.getTime() + total * 60_000);
  }

  const attendeesRaw = [meta.attendees ?? "", meta.participants ?? "", ...sections.attendees].join("\n");
  const attendees = Array.from(
    new Set(
      attendeesRaw
        .split(/[\n,;]+/)
        .map((a) => a.replace(/^[-*•\s]+/, "").replace(/\*\*/g, "").trim())
        .filter((a) => a.length > 1 && a.length < 80),
    ),
  );

  let transcriptText = sections.transcript.join("\n").trim();
  const summary = sections.summary.join("\n").trim();
  const notes = sections.notes.join("\n").trim();
  if (!transcriptText) {
    const other = sections.other.join("\n").trim();
    const pre = preamble.join("\n").trim();
    transcriptText = other.length > pre.length ? other : pre;
  }
  if (!transcriptText && !summary) {
    throw new ApiError(400, "MALFORMED_IMPORT", "Couldn't find a transcript or summary section. Make sure the export includes a '## Transcript' or '## Summary' heading.");
  }
  const segments = segmentTranscript(transcriptText);
  const externalId = meta["meeting id"] ?? meta.id ?? null;

  return {
    title,
    startedAt: startedAt ? startedAt.toISOString() : null,
    endedAt: endedAt ? endedAt.toISOString() : null,
    attendees,
    summary,
    notes,
    transcript: transcriptText,
    segments,
    externalId,
  };
}
