import { aiConfigured, CHEAP_MODEL, chatCompletion } from "./ai";
import type { Env, Meeting, TranscriptSegment } from "./types";
import { normalizeText } from "./util";

/** Question words that hint at obligations; expands the lexical search so "assessments" also finds "quiz" / "test". */
const SYNONYMS: Record<string, string[]> = {
  assessment: ["quiz", "test", "exam", "midterm", "final", "assessment"],
  assessments: ["quiz", "test", "exam", "midterm", "final", "assessment"],
  homework: ["homework", "assignment", "worksheet", "problem set", "due"],
  deadline: ["due", "deadline", "submit", "turn in", "by friday", "by monday"],
  deadlines: ["due", "deadline", "submit", "turn in"],
  project: ["project", "presentation", "proposal", "essay", "paper", "lab"],
  reading: ["read", "reading", "chapter", "pages"],
  forgetting: ["due", "quiz", "test", "bring", "remember", "don't forget", "tomorrow", "next week"],
  upcoming: ["next week", "tomorrow", "friday", "monday", "due", "coming up"],
};

const ACTION_RE = /\b(homework|assignment|due|quiz|test|exam|midterm|final|project|read|reading|chapter|bring|submit|turn in|proposal|presentation|essay|lab|deadline|tomorrow|next week|by (?:mon|tues|wednes|thurs|fri)day)\b/;

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "what", "did", "my", "me", "is", "are", "was", "were", "about", "this", "that", "with", "i", "we", "you", "it", "be", "do", "does", "have", "has", "say", "said", "tell", "show", "everything", "anything", "week", "month", "teacher", "class", "mentioned", "assigned", "assign"]);

export interface RetrievedSegment extends TranscriptSegment {
  score: number;
  meeting_title: string;
  meeting_started_at: string;
}

/** Simple lexical retrieval over transcript segments (keyword overlap + neighbors). */
export function retrieveSegments(question: string, segments: (TranscriptSegment & { meeting_title: string; meeting_started_at: string })[], limit = 18): RetrievedSegment[] {
  const baseTerms = normalizeText(question).replace(/[^a-z0-9 ]/g, "").split(" ").filter((t) => t.length > 2 && !STOP.has(t));
  const terms = new Set<string>(baseTerms);
  for (const t of baseTerms) for (const syn of SYNONYMS[t] ?? []) terms.add(syn);
  const scored: RetrievedSegment[] = segments.map((s) => {
    const text = normalizeText(s.text);
    let score = 0;
    for (const t of terms) {
      if (text.includes(t)) score += 1 + Math.min(2, t.length / 5);
    }
    if (ACTION_RE.test(text)) score += 0.6;
    return { ...s, score };
  });
  const byId = new Map(scored.map((s) => [s.id, s]));
  const top = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  const expanded = new Map<string, RetrievedSegment>();
  for (const s of top) {
    expanded.set(s.id, s);
    for (const idx of [s.segment_index - 1, s.segment_index + 1]) {
      const n = scored.find((x) => x.meeting_id === s.meeting_id && x.segment_index === idx);
      if (n && !expanded.has(n.id)) expanded.set(n.id, byId.get(n.id) ?? n);
    }
  }
  if (expanded.size === 0) {
    // No lexical match: fall back to the most recent segments that look actionable.
    return scored
      .filter((s) => ACTION_RE.test(normalizeText(s.text)))
      .sort((a, b) => b.meeting_started_at.localeCompare(a.meeting_started_at))
      .slice(0, limit);
  }
  return Array.from(expanded.values()).sort((a, b) => a.meeting_started_at.localeCompare(b.meeting_started_at) || a.segment_index - b.segment_index);
}

export interface CoachAnswer {
  answer: string;
  citedSegmentIds: string[];
  citedMeetingIds: string[];
  /** "model" when the AI wrote the answer, "keyword" when only the deterministic scan ran. */
  mode: "model" | "keyword";
}

/**
 * Deterministic answer used when the model is unreachable: lists the matching
 * transcript lines grouped by recording, each with a citation. Never invents.
 */
function keywordOnlyAnswer(retrieved: RetrievedSegment[], meetings: Meeting[], timezone: string, reason: string): CoachAnswer {
  if (retrieved.length === 0) return { answer: "I couldn't find that in your recordings.", citedSegmentIds: [], citedMeetingIds: [], mode: "keyword" };
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const byMeeting = new Map<string, RetrievedSegment[]>();
  for (const s of retrieved.filter((s) => s.score > 0).slice(0, 12)) {
    const list = byMeeting.get(s.meeting_id) ?? [];
    list.push(s);
    byMeeting.set(s.meeting_id, list);
  }
  const lines: string[] = [`**Matching lines in your recordings** (${reason})`];
  const cited: string[] = [];
  for (const [mid, segs] of byMeeting) {
    const m = meetingById.get(mid);
    const date = m ? new Date(m.started_at).toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" }) : "";
    lines.push(`\n**${m?.title ?? "Recording"}** · ${date}`);
    for (const s of segs) {
      lines.push(`- ${s.speaker}: “${s.text.length > 220 ? `${s.text.slice(0, 220)}…` : s.text}” [[${s.id}]]`);
      cited.push(s.id);
    }
  }
  return { answer: lines.join("\n"), citedSegmentIds: cited, citedMeetingIds: Array.from(byMeeting.keys()), mode: "keyword" };
}

export interface CalendarContextEvent {
  summary: string;
  start: string | null;
  allDay: boolean;
  createdByNeverNote: boolean;
}

export interface CoachContext {
  obligations: { title: string; type: string; due_at: string | null; status: string; meeting_id: string }[];
  history: { role: "user" | "assistant"; content: string }[];
  timezone: string;
  /** Live Google Calendar window, when connected. */
  calendar: CalendarContextEvent[] | null;
  calendarStatus: "connected" | "not_connected" | "needs_server_config" | "unavailable";
}

/** Answers a question grounded only in the retrieved transcript segments. */
export async function answerWithEvidence(
  env: Env,
  question: string,
  retrieved: RetrievedSegment[],
  meetings: Meeting[],
  ctx: CoachContext,
): Promise<CoachAnswer> {
  const { obligations, history, timezone } = ctx;
  if (retrieved.length === 0 && (ctx.calendar?.length ?? 0) === 0 && obligations.length === 0) {
    return { answer: "I couldn't find that in your recordings.", citedSegmentIds: [], citedMeetingIds: [], mode: "keyword" };
  }
  if (!aiConfigured(env)) return keywordOnlyAnswer(retrieved, meetings, timezone, "AI is not reachable from the server, so this is the keyword match only");
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const context = retrieved
    .map((s) => {
      const m = meetingById.get(s.meeting_id);
      const date = m ? new Date(m.started_at).toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric", year: "numeric" }) : "";
      return `[${s.id}] (${m?.title ?? "Recording"}, ${date}) ${s.speaker}: ${s.text}`;
    })
    .join("\n");
  const obligationCtx = obligations.length
    ? obligations.map((o) => `- ${o.type}: ${o.title} — due ${o.due_at ?? "unknown"} — status ${o.status}`).join("\n")
    : "(none yet)";
  const now = new Date().toLocaleDateString("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const calendarCtx = (() => {
    if (ctx.calendarStatus !== "connected") {
      return `(Google Calendar is not connected — status: ${ctx.calendarStatus}. Say so plainly if the user asks what is on their calendar, and never guess at calendar contents.)`;
    }
    if (!ctx.calendar || ctx.calendar.length === 0) return "(Google Calendar is connected, but there are no events in the next 30 days.)";
    return ctx.calendar
      .map((e) => {
        const when = e.start
          ? new Date(e.start).toLocaleString("en-US", {
              timeZone: timezone,
              weekday: "short",
              month: "short",
              day: "numeric",
              ...(e.allDay ? {} : { hour: "numeric", minute: "2-digit" }),
            })
          : "no date";
        return `- ${when}${e.allDay ? " (all day)" : ""}: ${e.summary}${e.createdByNeverNote ? " [added by NeverNote]" : ""}`;
      })
      .join("\n");
  })();

  let text: string;
  try {
    text = await chatCompletion(env, CHEAP_MODEL, [
    {
      role: "system",
      content: `You are Memory Coach, a careful assistant that answers a student's questions using ONLY the transcript excerpts provided. Today is ${now} (${timezone}).

Rules:
- Every factual claim must be followed by a citation in the form [[seg_id]] using ids from the excerpts. Cite the specific excerpt that supports the claim.
- Clearly separate "Confirmed in your recordings" (facts the teacher stated) from "Suggestions" (your own study advice), using those two headings when you give advice.
- Never invent dates, assignments, or details. If the excerpts do not answer the question, reply exactly: "I couldn't find that in your recordings." and optionally suggest what to search for.
- Be concise: short paragraphs or bullets, no fluff.
- The "Detected obligations" list shows what the app already extracted and its review status; you may reference it, but transcript excerpts remain the source of truth.
- The "Google Calendar" block is the user's real calendar for the next 30 days. Use it to answer scheduling questions, spot conflicts, and notice deadlines that were accepted but never added. Calendar lines need no [[seg_id]] citation — just say "on your calendar".
- When the transcripts imply a date that is missing from the calendar, say so and recommend adding it, naming the exact date and time. Recommend only; you never write to the calendar yourself — the user approves each event in the Review screen.
- If asked to add, move, or delete an event, explain that you can only recommend, and point them to Review where one tap does it.`,
    },
    ...history.slice(-6),
    {
      role: "user",
      content: `Question: ${question}\n\nDetected obligations:\n${obligationCtx}\n\nGoogle Calendar (next 30 days):\n${calendarCtx}\n\nTranscript excerpts:\n${context || "(no matching transcript lines)"}`,
    },
  ], { temperature: 0.2, maxTokens: 900 });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 120) : "model call failed";
    return keywordOnlyAnswer(retrieved, meetings, timezone, `the model call failed: ${reason}`);
  }

  const validIds = new Set(retrieved.map((s) => s.id));
  const cited = Array.from(new Set(Array.from(text.matchAll(/\[\[(seg_[a-z0-9]+)\]\]/g), (m) => m[1]))).filter((id) => validIds.has(id));
  const meetingIds = Array.from(new Set(cited.map((id) => retrieved.find((s) => s.id === id)?.meeting_id).filter((x): x is string => Boolean(x))));
  const cleaned = text.replace(/\[\[(seg_[a-z0-9]+)\]\]/g, (full, id: string) => (validIds.has(id) ? full : ""));
  return { answer: cleaned.trim(), citedSegmentIds: cited, citedMeetingIds: meetingIds, mode: "model" };
}
