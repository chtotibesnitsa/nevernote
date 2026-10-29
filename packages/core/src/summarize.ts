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
The class is usually a US high school or college class. The transcript was made live by speech recognition in a noisy room, so:
- Words are often misheard, especially subject vocabulary, names and numbers. Work out what was really meant from the subject and context, and write the correct term in the notes (e.g. "sync" -> "sink" in ecology, "my toast is" -> "mitosis", "biopia" -> "biofuel"). Never copy an obviously misheard word into the notes.
- There is little punctuation and some words are missing. Fill gaps only when the meaning is certain; otherwise leave the point out rather than guess.
- Lines can run several speakers together, and labels can be wrong. Decide who said what from the content (a question, an answer, a correction) rather than trusting the label.
Speakers are labelled with their name when it was said aloud, otherwise S1, S2...; the one who talks most is usually the teacher. Use names in the notes when you have them; never invent names for S1, S2.
Return ONLY a JSON object with these keys:
- "title": short note title, like "Carbon Cycle & Feedback Loops"
- "notes": markdown. 3-7 "### " sections in the order taught, each with 2-6 concise bullet points. Keep numbers, names, formulas, examples. No intro or outro.
- "studyGuide": 4-8 {"question","answer"} pairs a teacher would put on a test
- "keyTerms": up to 10 {"term","definition"} pairs
- "items": every deadline, test, event or reminder mentioned: {"kind": "deadline"|"exam"|"event"|"reminder"|"important", "title", "date": "YYYY-MM-DD" or null, "time": "HH:MM" (24h) or null, "quote": exact words from the transcript}. Only real tasks, dates and things the teacher flagged; "you have to understand" or a passing opinion is not an item
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

export function summaryMessages(segments: Segment[], recordedAt: Date, opts: { course?: string; thoughts?: string; part?: [number, number]; style?: string; speakers?: { id: string; name: string }[]; earlier?: Summary } = {}): ChatMessage[] {
  const day = recordedAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const head = [
    `Recording date: ${day}.`,
    opts.course ? `Class: ${opts.course}.` : "",
    opts.part ? `This is part ${opts.part[0]} of ${opts.part[1]} of the lecture.` : "",
    opts.thoughts?.trim() ? `The student's own notes:\n${opts.thoughts.trim()}` : "",
    opts.earlier ? earlierBrief(opts.earlier) : "",
  ].filter(Boolean);
  return [
    { role: "system", content: opts.style ? `${SYSTEM}\n${opts.style}` : SYSTEM },
    { role: "user", content: `${head.join("\n")}\n\nTranscript:\n${transcriptText(segments, opts.speakers)}` },
  ];
}

/**
 * For a class that was resumed: what the notes already cover, so the model writes
 * only what's new instead of repeating it. Headings and terms are enough context.
 */
function earlierBrief(s: Summary): string {
  const heads = [s.notes, ...(s.updates ?? []).map((u) => u.notes)].join("\n").split("\n").filter((l) => l.startsWith("#")).map((l) => l.replace(/^#+\s*/, ""));
  const terms = [...s.keyTerms, ...(s.updates ?? []).flatMap((u) => u.keyTerms)].map((t) => t.term);
  return [
    `This class was resumed. The student already has notes titled "${s.title}" covering: ${heads.join("; ") || "the start of class"}.`,
    terms.length ? `Key terms already defined: ${terms.join(", ")}.` : "",
    "The transcript below is only the new part. Write notes for what's new in it; don't repeat what's already covered. Leave \"title\" as the existing title. Use fewer sections if there's less to say.",
  ].filter(Boolean).join("\n");
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
  // Unique across summaries, so an update's items never collide with earlier ones.
  const stamp = Date.now().toString(36);
  const extractions: Extraction[] = items
    .filter((i) => typeof i.title === "string")
    .map((i, k) => {
      const date = typeof i.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : undefined;
      const time = typeof i.time === "string" && /^\d{1,2}:\d{2}$/.test(i.time) ? i.time.padStart(5, "0") : undefined;
      const quote = typeof i.quote === "string" ? i.quote : "";
      const seg = quote ? segments.find((s) => s.text.toLowerCase().includes(quote.toLowerCase().slice(0, 40))) : undefined;
      return {
        id: `ai-${stamp}-${k}`,
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
  const same = (a: Extraction, k: Extraction) => a.id === k.id || (a.kind === k.kind && (sameDay(a.when, k.when) || (!!a.segmentId && a.segmentId === k.segmentId)));
  const extra = keyword.filter((k) => !ai.some((a) => same(a, k)));
  // A yes or no the student already gave carries over to the rewritten item.
  const answered = ai.map((a) => {
    const k = !a.status ? keyword.find((k) => k.status && same(a, k)) : undefined;
    return k ? { ...a, status: k.status, confidence: k.status === "confirmed" ? 1 : a.confidence } : a;
  });
  return [...answered, ...extra].sort((a, b) => (a.when ?? "9999").localeCompare(b.when ?? "9999"));
}

/** What Ask can do besides answer: each is the same notes with a different job. */
export type AskTool = "answer" | "quiz" | "explain" | "plan" | "recap";

const ASK_JOBS: Record<AskTool, string> = {
  answer: "Answer the student's question.",
  quiz: "Write a short quiz from these classes: 5 questions, mixed multiple choice (4 options, A-D) and short answer, the kind a teacher would really ask. Put all the answers, with one line of why, under a final \"### Answers\" heading.",
  explain: "Explain what the student asks about in plain, friendly words a younger student would follow, with one everyday example and one line on how it's likely to be tested.",
  plan: "Make a short, realistic study plan up to the next test or deadline these classes mention: a dated list of 20-40 minute sessions, each with what to review and how (flashcards, practice questions, re-reading a part of class). Say which test or deadline it's for.",
  recap: "Recap these classes as a quick catch-up: what was covered, what was assigned or announced, and anything the teacher stressed.",
};

/** Long classes keep their opening and, mostly, their latest part: what was just said matters most. */
export function clipMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.floor(max / 4);
  return `${text.slice(0, head)}\n[…]\n${text.slice(text.length - (max - head))}`;
}

export function askMessages(
  question: string,
  context: { title: string; date: Date; segments: Segment[]; notes?: string }[],
  opts: { tool?: AskTool; history?: { q: string; a: string }[] } = {},
): ChatMessage[] {
  const docs = context
    .map((c) => `## ${c.title} (${toLocalISO(c.date, true)})\n${c.notes ? `${c.notes}\n` : ""}${clipMiddle(transcriptText(c.segments), 12000)}`)
    .join("\n\n");
  // A few earlier turns, trimmed, so follow-ups ("and the second one?") make sense.
  const past = (opts.history ?? []).slice(-4).flatMap((t): ChatMessage[] => [
    { role: "user", content: t.q.slice(0, 600) },
    { role: "assistant", content: t.a.slice(0, 1500) },
  ]);
  return [
    {
      role: "system",
      content: `${ASK_JOBS[opts.tool ?? "answer"]} Use only the student's class notes below. Be brief and concrete, and use markdown. Back each point with the words actually said, copied exactly from the transcript inside double quotes (at least 4 words, so the app can jump to that moment), and name which class and date they came from. The transcript comes from live speech recognition, so read past misheard words using context, but quote them as written. If the notes don't say, say so.\n\n${docs}`,
    },
    ...past,
    { role: "user", content: question },
  ];
}
