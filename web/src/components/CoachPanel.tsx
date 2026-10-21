import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Quote, SendHorizontal, SlidersHorizontal, Sparkles, TextSearch } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { ChatMessageRow, ChatThread, Citation, CoachReply, ContextMeeting } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  threadId?: string;
  onThreadCreated?: (id: string) => void;
  scopeMeetingId?: string;
  scopeTitle?: string;
}

const SUGGESTIONS = [
  "What homework was assigned most recently?",
  "What assessments were mentioned this month?",
  "What am I likely forgetting this week?",
  "Show everything said about the upcoming project.",
];

export default function CoachPanel({ threadId, onThreadCreated, scopeMeetingId, scopeTitle }: Props) {
  const { me } = useMe();
  const qc = useQueryClient();
  const [localThread, setLocalThread] = useState<string | undefined>(threadId);
  const [question, setQuestion] = useState<string>("");
  const [course, setCourse] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [citations, setCitations] = useState<Record<string, Citation[]>>({});
  const [meta, setMeta] = useState<Record<string, { mode: "model" | "keyword"; context: ContextMeeting[] }>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLocalThread(threadId), [threadId]);

  const thread = useQuery<{ thread: ChatThread; messages: ChatMessageRow[]; citations?: Record<string, Citation[]> }>({
    queryKey: ["thread", localThread],
    queryFn: () => api(`/chat/threads/${localThread}`),
    enabled: Boolean(localThread),
  });

  const ask = useMutation({
    mutationFn: async (text: string) => {
      let id = localThread;
      if (!id) {
        const { thread: t } = await api<{ thread: ChatThread }>("/chat/threads", { method: "POST" });
        id = t.id;
        setLocalThread(id);
        onThreadCreated?.(id);
      }
      const body: Record<string, unknown> = { question: scopeMeetingId ? `${text} (Only use the recording titled "${scopeTitle}".)` : text };
      if (course) body.course_id = course;
      if (from) body.from = from;
      if (to) body.to = to;
      const res = await api<CoachReply>(`/chat/threads/${id}/messages`, { method: "POST", json: body });
      return { id, res };
    },
    onSuccess: ({ id, res }) => {
      setCitations((c) => ({ ...c, [res.message.id]: res.citations }));
      setMeta((m) => ({ ...m, [res.message.id]: { mode: res.mode, context: res.context_meetings ?? [] } }));
      setQuestion("");
      void qc.invalidateQueries({ queryKey: ["thread", id] });
      void qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  const messages = thread.data?.messages ?? [];
  const savedCitations = thread.data?.citations;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, ask.isPending]);

  const submit = (text: string) => {
    if (!text.trim() || ask.isPending) return;
    ask.mutate(text.trim());
  };

  const filtersActive = Boolean(course || from || to);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!scopeMeetingId && (
        <details className="group mb-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Narrow the search
            {filtersActive && <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-semibold text-sage">on</span>}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <select className="h-8 rounded-lg border border-input bg-background px-2" value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course">
              <option value="">All courses</option>
              {me?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" className="h-8 rounded-lg border border-input bg-background px-2" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <input type="date" className="h-8 rounded-lg border border-input bg-background px-2" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            {filtersActive && (
              <button type="button" onClick={() => { setCourse(""); setFrom(""); setTo(""); }} className="h-8 rounded-lg px-2 text-muted-foreground hover:bg-secondary">Clear</button>
            )}
          </div>
        </details>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && !ask.isPending && (
          <div className="paper-card p-5">
            <p className="text-sm text-muted-foreground">Ask anything about {scopeTitle ? `“${scopeTitle}”` : "your recordings"}. Every answer matches keywords across your transcripts first, then shows exactly which recordings it read.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => submit(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) => <Bubble key={m.id} message={m} citations={citations[m.id] ?? savedCitations?.[m.id]} meta={meta[m.id]} tz={me?.profile.timezone} />)}
        {ask.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Matching keywords, then reading only the relevant transcripts…</div>
        )}
        {ask.isError && <ErrorNote message={errorMessage(ask.error)} />}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex shrink-0 items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(question);
            }
          }}
          rows={1}
          placeholder="Ask Memory Coach…"
          className="min-h-[40px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={ask.isPending || !question.trim()} aria-label="Send"><SendHorizontal className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function Bubble({ message, citations, meta, tz }: { message: ChatMessageRow; citations?: Citation[]; meta?: { mode: "model" | "keyword"; context: ContextMeeting[] }; tz?: string }) {
  const isUser = message.role === "user";
  const citedIds = useMemo(() => {
    try {
      return JSON.parse(message.cited_segment_ids) as string[];
    } catch {
      return [];
    }
  }, [message.cited_segment_ids]);
  const citedMeetings = useMemo(() => {
    try {
      return JSON.parse(message.cited_meeting_ids) as string[];
    } catch {
      return [];
    }
  }, [message.cited_meeting_ids]);
  const citationMap = new Map((citations ?? []).map((c) => [c.segment_id, c]));

  const rendered = useMemo(() => renderAnswer(message.content, citedIds, citationMap, citedMeetings), [message.content, citedIds, citationMap, citedMeetings]);

  return (
    <div className={cn("fade-up flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[92%] rounded-2xl px-4 py-3 text-sm md:max-w-[80%]", isUser ? "bg-primary text-primary-foreground" : "paper-card")}>
        {isUser ? <p className="whitespace-pre-line">{message.content}</p> : <div className="prose-coach">{rendered}</div>}
        {!isUser && meta && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", meta.mode === "model" ? "bg-sage-soft text-sage" : "bg-secondary")}>
              {meta.mode === "model" ? <Sparkles className="h-3 w-3" /> : <TextSearch className="h-3 w-3" />}
              {meta.mode === "model" ? "Keyword match + AI" : "Keyword match only"}
            </span>
            {meta.context.length > 0 && (
              <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> Read {meta.context.length} recording{meta.context.length === 1 ? "" : "s"}:</span>
            )}
            {meta.context.map((c) => (
              <Link key={c.meeting_id} to={`/recordings/${c.meeting_id}`} className="rounded-full border border-border bg-card px-2 py-0.5 hover:bg-secondary" title={`${c.lines} matching line(s)`}>
                {c.title} · {fmtDate(c.started_at, tz)}
              </Link>
            ))}
          </div>
        )}
        {!isUser && citations && citations.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</p>
            {citations.map((c, i) => (
              <Link key={c.segment_id} to={`/recordings/${c.meeting_id}?seg=${c.segment_id}`} className="flex gap-2 rounded-lg bg-secondary/60 px-2.5 py-2 text-xs hover:bg-secondary">
                <span className="font-semibold text-sage">[{i + 1}]</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.meeting_title} · {fmtDate(c.meeting_started_at, tz)} · {c.speaker}</span>
                  <span className="line-clamp-2 text-muted-foreground">“{c.text}”</span>
                </span>
                <Quote className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Very small markdown renderer: paragraphs, bullets, bold, headings, and [[seg_id]] citation links. */
function renderAnswer(text: string, citedIds: string[], map: Map<string, Citation>, citedMeetings: string[]): ReactNode {
  const order = new Map(citedIds.map((id, i) => [id, i + 1]));
  const inline = (line: string, key: string): ReactNode => {
    const parts: ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\[\[seg_[a-z0-9]+\]\])/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(line)) !== null) {
      parts.push(line.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) parts.push(<strong key={`${key}-b${i}`}>{tok.slice(2, -2)}</strong>);
      else {
        const id = tok.slice(2, -2);
        const n = order.get(id);
        const c = map.get(id);
        const meetingId = c?.meeting_id ?? citedMeetings[0];
        parts.push(
          n ? (
            <Link key={`${key}-c${i}`} to={`/recordings/${meetingId}?seg=${id}`} className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-sage-soft px-1 align-text-top text-[10px] font-semibold text-sage hover:bg-sage hover:text-white" title={c?.text}>{n}</Link>
          ) : null,
        );
      }
      last = m.index + tok.length;
      i++;
    }
    parts.push(line.slice(last));
    return parts;
  };
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let bullets: ReactNode[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(<ul key={`ul${out.length}`}>{bullets}</ul>);
      bullets = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      return;
    }
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    if (b) {
      bullets.push(<li key={idx}>{inline(b[1], `l${idx}`)}</li>);
      return;
    }
    flush();
    const h = line.match(/^#{1,4}\s+(.*)$/) ?? line.match(/^\*\*([^*]+)\*\*:?$/);
    if (h) out.push(<h4 key={idx}>{h[1]}</h4>);
    else out.push(<p key={idx}>{inline(line, `p${idx}`)}</p>);
  });
  flush();
  return out;
}
