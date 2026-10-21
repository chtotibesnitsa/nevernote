import { CHEAP_MODEL, STRONG_MODEL, chatJson } from "./ai";
import type { Course, Env, ObligationType, TranscriptSegment } from "./types";
import { OBLIGATION_TYPES } from "./types";
import { ApiError, normalizeText } from "./util";

export interface ExtractionCandidate {
  type: ObligationType;
  title: string;
  description: string;
  course_hint: string;
  raw_date_phrase: string;
  due_at: string | null;
  all_day: boolean;
  confidence: number;
  evidence_excerpt: string;
  evidence_segment_ids: string[];
  date_reasoning: string;
  ambiguous: boolean;
}

interface RawCandidate {
  type?: string;
  title?: string;
  description?: string;
  course_hint?: string;
  raw_date_phrase?: string | null;
  due_at?: string | null;
  all_day?: boolean;
  confidence?: number;
  evidence_excerpt?: string;
  evidence_segment_ids?: string[];
  date_reasoning?: string;
  ambiguous?: boolean;
}

interface Chunk {
  segments: TranscriptSegment[];
  text: string;
}

const CHUNK_CHARS = 9000;
const OVERLAP_SEGMENTS = 6;

function buildChunks(segments: TranscriptSegment[]): Chunk[] {
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < segments.length) {
    let size = 0;
    let j = i;
    const group: TranscriptSegment[] = [];
    while (j < segments.length && size < CHUNK_CHARS) {
      group.push(segments[j]);
      size += segments[j].text.length + 24;
      j++;
    }
    chunks.push({
      segments: group,
      text: group.map((s) => `[${s.id}] ${s.speaker}: ${s.text}`).join("\n"),
    });
    if (j >= segments.length) break;
    i = Math.max(i + 1, j - OVERLAP_SEGMENTS);
  }
  return chunks;
}

/** Verifies the excerpt exists in the transcript text (whitespace/quote-insensitive). */
export function excerptSupported(excerpt: string, transcript: string): boolean {
  const e = normalizeText(excerpt);
  if (e.length < 8) return false;
  const t = normalizeText(transcript);
  if (t.includes(e)) return true;
  const words = e.split(" ");
  if (words.length < 6) return false;
  const head = words.slice(0, Math.min(10, words.length)).join(" ");
  return t.includes(head);
}

function weekdayName(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(d);
}

function localDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function systemPrompt(meetingDate: Date, tz: string, courses: Course[], title: string): string {
  const courseLines = courses.length
    ? courses.map((c) => `- ${c.name} (${c.short_name || "-"}) teacher: ${c.teacher || "?"}; schedule: ${c.typical_schedule || "unknown"}; keywords: ${c.meeting_keywords || "-"}`).join("\n")
    : "- (no courses configured)";
  return `You extract academic obligations from a class recording transcript for a student.
Recording title: "${title}"
Recording date: ${localDate(meetingDate, tz)} (${weekdayName(meetingDate, tz)}), timezone ${tz}.
Known courses:
${courseLines}

Return ONLY a JSON object: {"items":[...]}. Each item:
{
 "type": one of ${OBLIGATION_TYPES.join(" | ")},
 "title": short (max 70 chars),
 "description": 1-2 sentences of useful context for the student,
 "course_hint": course name if identifiable else "",
 "raw_date_phrase": the exact date/time words spoken (e.g. "this Friday", "next class", "October 3rd") or "",
 "due_at": ISO 8601 with timezone offset if the date can be resolved with confidence from the recording date, otherwise null,
 "all_day": true if no specific time was given,
 "confidence": 0-1 that this is a real obligation for the student,
 "evidence_excerpt": VERBATIM quote copied character-for-character from the transcript (one or two consecutive sentences),
 "evidence_segment_ids": the [seg_...] ids the quote came from,
 "date_reasoning": one sentence explaining the date interpretation only,
 "ambiguous": true when the date phrase is genuinely unclear (e.g. "next class" with unknown schedule, "soon", "in a couple weeks")
}
Rules:
- Only include actionable items: homework, assignments, readings, quizzes, tests, exams, project milestones, presentations, forms/permission slips, materials to bring, office hours or appointments.
- Do NOT include general lecture content, past events, or things already completed.
- Never invent a date. If ambiguous set due_at to null and ambiguous true.
- "this Friday" = the Friday of the recording's week (or the next one if the recording is on/after Friday). "next week" without a day is ambiguous.
- If the teacher mentions the same item twice, return it once.
- If nothing actionable is present return {"items":[]}.`;
}

function coerceType(t: string | undefined): ObligationType | null {
  if (!t) return null;
  const k = t.toLowerCase().replace(/[\s-]+/g, "_") as ObligationType;
  if (OBLIGATION_TYPES.includes(k)) return k;
  if (k.includes("home")) return "homework";
  if (k.includes("read")) return "reading";
  if (k.includes("quiz")) return "quiz";
  if (k.includes("exam") || k.includes("final") || k.includes("midterm")) return "exam";
  if (k.includes("test")) return "test";
  if (k.includes("project")) return "project_milestone";
  if (k.includes("present")) return "presentation";
  if (k.includes("form") || k.includes("permission")) return "form";
  if (k.includes("bring") || k.includes("material")) return "material";
  if (k.includes("office") || k.includes("appoint") || k.includes("meet")) return "appointment";
  if (k.includes("assign")) return "assignment";
  return null;
}

/**
 * Runs the extraction pipeline over one meeting's segments.
 * Cheap model for the extraction pass; strong model only for ambiguous dates.
 */
export async function extractObligations(
  env: Env,
  args: { meetingId: string; title: string; startedAt: string; timezone: string; transcript: string; segments: TranscriptSegment[]; courses: Course[] },
): Promise<{ candidates: ExtractionCandidate[]; rejectedUnsupported: number; failedChunks: number }> {
  const meetingDate = new Date(args.startedAt);
  const sys = systemPrompt(meetingDate, args.timezone, args.courses, args.title);
  const chunks = buildChunks(args.segments);
  const all: ExtractionCandidate[] = [];
  let rejectedUnsupported = 0;
  let failedChunks = 0;

  for (const chunk of chunks) {
    // One bad chunk must never lose the whole lecture. Previously a single
    // model hiccup threw out of the loop and the recording was marked
    // "extraction failed" even though other chunks were perfectly readable.
    let result: { items?: RawCandidate[] };
    try {
      result = await chatJson<{ items?: RawCandidate[] }>(env, CHEAP_MODEL, [
        { role: "system", content: sys },
        { role: "user", content: `Transcript chunk:\n${chunk.text}` },
      ]);
    } catch (err) {
      failedChunks++;
      console.warn("extraction chunk failed", err instanceof Error ? err.message : err);
      continue;
    }
    const items = Array.isArray(result.items) ? result.items : [];
    const segIds = new Set(chunk.segments.map((s) => s.id));
    for (const raw of items) {
      const type = coerceType(raw.type);
      const excerpt = (raw.evidence_excerpt ?? "").trim();
      if (!type || !raw.title || !excerpt) continue;
      if (!excerptSupported(excerpt, args.transcript)) {
        rejectedUnsupported++;
        continue;
      }
      const ids = (raw.evidence_segment_ids ?? []).filter((id) => segIds.has(id));
      const fallbackIds = ids.length ? ids : chunk.segments.filter((s) => excerptSupported(excerpt, s.text) || normalizeText(s.text).includes(normalizeText(excerpt).slice(0, 40))).map((s) => s.id).slice(0, 3);
      let dueAt: string | null = null;
      if (raw.due_at) {
        const d = new Date(raw.due_at);
        if (!Number.isNaN(d.getTime())) dueAt = d.toISOString();
      }
      all.push({
        type,
        title: raw.title.slice(0, 90),
        description: (raw.description ?? "").slice(0, 600),
        course_hint: raw.course_hint ?? "",
        raw_date_phrase: raw.raw_date_phrase ?? "",
        due_at: dueAt,
        all_day: raw.all_day !== false,
        confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5))),
        evidence_excerpt: excerpt.slice(0, 700),
        evidence_segment_ids: fallbackIds,
        date_reasoning: (raw.date_reasoning ?? "").slice(0, 400),
        ambiguous: Boolean(raw.ambiguous) || (Boolean(raw.raw_date_phrase) && !dueAt),
      });
    }
  }

  const merged = mergeDuplicates(all);

  const ambiguousWithPhrase = merged.filter((c) => c.ambiguous && c.raw_date_phrase);
  if (ambiguousWithPhrase.length > 0) {
    try {
      await resolveAmbiguousDates(env, ambiguousWithPhrase, meetingDate, args.timezone, args.courses);
    } catch (err) {
      console.warn("strong-model date resolution skipped", err instanceof Error ? err.message : err);
    }
  }
  if (failedChunks > 0 && failedChunks === chunks.length) {
    throw new ApiError(502, "AI_ALL_CHUNKS_FAILED", "Every transcript chunk failed to process with the model.");
  }
  return { candidates: merged, rejectedUnsupported, failedChunks };
}

function mergeDuplicates(items: ExtractionCandidate[]): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  for (const item of items) {
    const key = normalizeText(item.title).replace(/[^a-z0-9 ]/g, "");
    const existing = out.find((o) => {
      const ok = normalizeText(o.title).replace(/[^a-z0-9 ]/g, "");
      return o.type === item.type && (ok === key || ok.includes(key) || key.includes(ok));
    });
    if (!existing) {
      out.push(item);
      continue;
    }
    if (!existing.evidence_excerpt.includes(item.evidence_excerpt)) {
      existing.evidence_excerpt = `${existing.evidence_excerpt}\n…\n${item.evidence_excerpt}`.slice(0, 1400);
    }
    existing.evidence_segment_ids = Array.from(new Set([...existing.evidence_segment_ids, ...item.evidence_segment_ids]));
    existing.confidence = Math.max(existing.confidence, item.confidence);
    if (!existing.due_at && item.due_at) {
      existing.due_at = item.due_at;
      existing.ambiguous = item.ambiguous;
      existing.date_reasoning = item.date_reasoning;
    }
  }
  return out;
}

async function resolveAmbiguousDates(
  env: Env,
  items: ExtractionCandidate[],
  meetingDate: Date,
  tz: string,
  courses: Course[],
): Promise<void> {
  const schedule = courses.map((c) => `${c.name}: ${c.typical_schedule || "unknown schedule"}`).join("\n") || "none";
  const list = items.map((c, i) => `${i}. phrase="${c.raw_date_phrase}" item="${c.title}" course_hint="${c.course_hint}" evidence="${c.evidence_excerpt.slice(0, 200)}"`).join("\n");
  const res = await chatJson<{ resolutions?: { index: number; due_at: string | null; all_day?: boolean; reasoning: string; confident: boolean }[] }>(env, STRONG_MODEL, [
    {
      role: "system",
      content: `You resolve relative date phrases from a class recording. Recording date: ${localDate(meetingDate, tz)} (${weekdayName(meetingDate, tz)}), timezone ${tz}.
Course schedules:\n${schedule}
For each item return {"index":n,"due_at": ISO8601 with offset or null,"all_day":bool,"reasoning":"one sentence","confident":bool}.
Only set confident=true when a reasonable teacher and student would agree on the exact date. "Next class" is resolvable ONLY if the course schedule lists meeting days. Otherwise due_at=null, confident=false. Return {"resolutions":[...]}.`,
    },
    { role: "user", content: list },
  ], 1500);
  for (const r of res.resolutions ?? []) {
    const item = items[r.index];
    if (!item) continue;
    item.date_reasoning = r.reasoning || item.date_reasoning;
    if (r.confident && r.due_at) {
      const d = new Date(r.due_at);
      if (!Number.isNaN(d.getTime())) {
        item.due_at = d.toISOString();
        item.all_day = r.all_day !== false;
        item.ambiguous = false;
      }
    }
  }
}
