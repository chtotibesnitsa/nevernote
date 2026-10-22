// Prompt and parser for AI notes. The same prompt runs against a hosted model
// (server/functions/summarize) or a small on-device model, so it is kept
// short, explicit and JSON-only.

import { toLocalISO } from "./dates.ts";
import type { Extraction, Segment, Summary } from "./types.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM = `You turn class recordings into study notes for a student.
The transcript was made by speech recognition, so fix obvious mis-hearings using context (e.g. "sync" -> "sink" in an ecology class).
Speakers are labelled with their name when it was said aloud, otherwise S1, S2...; the one who talks most is usually the teacher. Use names in the notes when you have them; never invent names for S1, S2.
Return ONLY a JSON object with these keys:
- "title": short note title, like "Carbon Cycle & Feedback Loops"
- "notes": markdown. 3-7 "### " sections in the order taught, each with 2-6 concise bullet points. Keep numbers, names, formulas, examples. No intro or outro.
- "studyGuide": 4-8 {"question","answer"} pairs a teacher would put on a test
- "keyTerms": up to 10 {"term","definition"} pairs
- "items": every deadline, test, event or reminder mentioned: {"kind": "deadline"|"exam"|"event"|"reminder"|"important", "title", "date": "YYYY-MM-DD" or null, "time": "HH:MM" (24h) or null, "quote": exact words from the transcript}
Resolve relative dates ("next Tuesday") against the recording date given. Never invent items or dates that were not said.`;

/** ~6k words per chunk keeps a 75-minute lecture to two calls on small models. */
const CHUNK_WORDS = 6000;

export function transcriptText(segments: Segment[], speakers: { id: string; name: string }[] = []): string {
  const name = (id?: string) => speakers.find((x) => x.id === id)?.name ?? id ?? "S?";
  return segments.map((s) => `${name(s.speaker)}: ${s.text}`).join("\n");
}

export function chunkSegments(segments: Segment[], maxWords = CHUNK_WORDS): Segment[][] {
  const out: Segment[][] = [];
  let cur: Segment[] = [];
  let n = 0;
  for (const s of segments) {
    const w = s.text.split(/\s+/).length;
    if (n + w > maxWords && cur.length) {
      out.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(s);
    n += w;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function summaryMessages(segments: Segment[], recordedAt: Date, opts: { course?: string; thoughts?: string; part?: [number, number]; style?: string; speakers?: { id: string; name: string }[] } = {}): ChatMessage[] {
  const day = recordedAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const head = [
    `Recording date: ${day}.`,
    opts.course ? `Class: ${opts.course}.` : "",
    opts.part ? `This is part ${opts.part[0]} of ${opts.part[1]} of the lecture.` : "",
    opts.thoughts?.trim() ? `The student's own notes:\n${opts.thoughts.trim()}` : "",
  ].filter(Boolean);
  return [
    { role: "system", content: opts.style ? `${SYSTEM}\n${opts.style}` : SYSTEM },
    { role: "user", content: `${head.join("\n")}\n\nTranscript:\n${transcriptText(segments, opts.speakers)}` },
  ];
}

/** Merges per-chunk summaries of a long lecture into one. */
export function mergeMessages(parts: Summary[]): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM.replace("You turn class recordings", "You merge partial notes from one class recording") },
    {
      role: "user",
      content: `Merge these partial notes into one set, removing repeats, same JSON format:\n${JSON.stringify(
        parts.map((p) => ({ title: p.title, notes: p.notes, studyGuide: p.studyGuide, keyTerms: p.keyTerms, items: p.extractions })),
      )}`,
    },
  ];
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model did not return JSON");
  return JSON.parse(body.slice(start, end + 1));
}

const KINDS = new Set(["deadline", "exam", "event", "reminder", "important"]);

export function parseSummary(raw: string, model: string, segments: Segment[] = []): Summary {
  const j = extractJson(raw) as Record<string, unknown>;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const items = arr<Record<string, unknown>>(j.items ?? j.extractions);
  const extractions: Extraction[] = items
    .filter((i) => typeof i.title === "string")
    .map((i, k) => {
      const date = typeof i.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : undefined;
      const time = typeof i.time === "string" && /^\d{1,2}:\d{2}$/.test(i.time) ? i.time.padStart(5, "0") : undefined;
      const quote = typeof i.quote === "string" ? i.quote : "";
      const seg = quote ? segments.find((s) => s.text.toLowerCase().includes(quote.toLowerCase().slice(0, 40))) : undefined;
      return {
        id: `ai${k}`,
        kind: (KINDS.has(String(i.kind)) ? i.kind : "reminder") as Extraction["kind"],
        title: String(i.title),
        when: date ? (time ? `${date}T${time}:00` : date) : undefined,
        allDay: !time,
        phrase: quote,
        segmentId: seg?.id,
        confidence: 0.9,
        source: "ai" as const,
      };
    });
  return {
    title: typeof j.title === "string" ? j.title : "Class notes",
    notes: typeof j.notes === "string" ? j.notes : "",
    studyGuide: arr<{ question: string; answer: string }>(j.studyGuide).filter((q) => q?.question),
    keyTerms: arr<{ term: string; definition: string }>(j.keyTerms).filter((t) => t?.term),
    extractions,
    model,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Keyword items are instant, AI items are smarter. Keep every AI item, and
 * keep keyword items only when the AI didn't report the same thing.
 */
export function mergeExtractions(keyword: Extraction[], ai: Extraction[]): Extraction[] {
  const sameDay = (a?: string, b?: string) => !!a && !!b && a.slice(0, 10) === b.slice(0, 10);
  const extra = keyword.filter((k) => !ai.some((a) => a.kind === k.kind && (sameDay(a.when, k.when) || a.segmentId === k.segmentId)));
  return [...ai, ...extra].sort((a, b) => (a.when ?? "9999").localeCompare(b.when ?? "9999"));
}

export function askMessages(question: string, context: { title: string; date: Date; segments: Segment[]; notes?: string }[]): ChatMessage[] {
  const docs = context
    .map((c) => `## ${c.title} (${toLocalISO(c.date, true)})\n${c.notes ? `${c.notes}\n` : ""}${transcriptText(c.segments).slice(0, 12000)}`)
    .join("\n\n");
  return [
    {
      role: "system",
      content:
        "Answer the student's question using only their class notes below. Be brief and concrete. Quote the teacher's words when useful and name which class and date they came from. If the notes don't say, say so.",
    },
    { role: "user", content: `${docs}\n\nQuestion: ${question}` },
  ];
}
