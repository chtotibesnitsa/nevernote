import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ObligationCard } from "@/components/ObligationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime, offsetLabel } from "@/lib/format";
import type { Meeting, Obligation, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";
import CoachPanel from "@/components/CoachPanel";

type Tab = "summary" | "transcript" | "items" | "chat";

interface Detail {
  meeting: Meeting;
  segments: Segment[];
  obligations: Obligation[];
}

export default function RecordingDetail() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useMe();
  const seg = params.get("seg");
  const [tab, setTab] = useState<Tab>(seg ? "transcript" : (params.get("tab") as Tab) || "summary");
  const [search, setSearch] = useState<string>("");
  const q = useQuery<Detail>({ queryKey: ["meeting", id], queryFn: () => api(`/meetings/${id}`), refetchInterval: (query) => (["pending", "processing"].includes(query.state.data?.meeting.processing_status ?? "") ? 3000 : false) });
  const reextract = useMutation({
    mutationFn: () => api(`/meetings/${id}/extract`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["meeting", id] });
      void qc.invalidateQueries({ queryKey: ["obligations"] });
      toast.success("Extraction re-run. Reviewed items kept their decisions.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const setCourse = useMutation({
    mutationFn: (course_id: string | null) => api(`/meetings/${id}`, { method: "PATCH", json: { course_id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["meeting", id] }),
  });
  const remove = useMutation({
    mutationFn: () => api(`/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries();
      navigate("/recordings");
    },
  });

  const highlightIds = useMemo(() => {
    const ids = new Set<string>();
    for (const o of q.data?.obligations ?? []) {
      try {
        for (const s of JSON.parse(o.evidence_segment_ids) as string[]) ids.add(s);
      } catch {
        /* ignore */
      }
    }
    return ids;
  }, [q.data]);

  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!seg || tab !== "transcript" || !q.data || scrolled.current === seg) return;
    const el = document.getElementById(seg);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-segment");
      scrolled.current = seg;
    }
  }, [seg, tab, q.data]);

  if (q.isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (q.isError || !q.data) return <ErrorNote message={errorMessage(q.error)} action={<Link to="/recordings" className="underline">Back to recordings</Link>} />;
  const { meeting, segments, obligations } = q.data;
  const attendees = safeParse<string[]>(meeting.attendees_json) ?? [];
  const term = search.trim().toLowerCase();
  const visible = term ? segments.filter((s) => s.text.toLowerCase().includes(term)) : segments;

  return (
    <div>
      <Link to="/recordings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Recordings</Link>
      <header className="paper-card mb-5 p-5 fade-up">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{fmtDateTime(meeting.started_at, false, me?.profile.timezone)}</span>
          {meeting.source_type === "demo" && <span className="chip bg-amber-soft text-amber">Demo · fictional</span>}
          {meeting.source_type === "wispr_markdown" && <span className="chip bg-secondary">Markdown import</span>}
          {meeting.source_type === "wispr_mcp" && <span className="chip bg-sky-soft text-sky">Wispr sync</span>}
        </div>
        <h1 className="mt-1 text-2xl font-medium leading-tight md:text-3xl">{meeting.title}</h1>
        {attendees.length > 0 && <p className="mt-1 text-sm text-muted-foreground">{attendees.join(", ")}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-lg border border-input bg-background px-2 text-sm" value={meeting.course_id ?? ""} onChange={(e) => setCourse.mutate(e.target.value || null)}>
            <option value="">No course</option>
            {me?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => reextract.mutate()} disabled={reextract.isPending || meeting.processing_status === "processing"}>{reextract.isPending ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />} Re-extract</Button>
          <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" onClick={() => { if (confirm("Delete this recording and its items?")) remove.mutate(); }}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {meeting.processing_status === "done" ? `${obligations.length} item${obligations.length === 1 ? "" : "s"} extracted` : meeting.processing_status === "error" ? "Extraction failed" : "Extracting…"}
          </span>
        </div>
        {meeting.processing_error && <div className="mt-3"><ErrorNote message={meeting.processing_error} action={meeting.processing_status === "error" ? <button className="underline" onClick={() => reextract.mutate()}>Try again</button> : undefined} /></div>}
      </header>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-secondary/70 p-1">
        {(["summary", "transcript", "items", "chat"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setParams(t === "summary" ? {} : { tab: t }); }} className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors", tab === t ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t === "items" ? `Extracted items (${obligations.length})` : t}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="space-y-4">
          <section className="paper-card p-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Wispr summary</h2>{meeting.summary ? <p className="whitespace-pre-line text-sm leading-relaxed">{meeting.summary}</p> : <p className="text-sm text-muted-foreground">No summary in this import.</p>}</section>
          {meeting.notes && <section className="paper-card p-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">My notes</h2><p className="whitespace-pre-line text-sm leading-relaxed">{meeting.notes}</p></section>}
        </div>
      )}

      {tab === "transcript" && (
        <div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this transcript…" className="rounded-xl pl-9" />
            {term && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{visible.length} match{visible.length === 1 ? "" : "es"}</span>}
          </div>
          {segments.length === 0 && <p className="text-sm text-muted-foreground">{meeting.transcript ? "Transcript could not be split into segments." : "This import had no transcript section."}</p>}
          <ol className="space-y-2">
            {visible.map((s) => {
              const evidence = highlightIds.has(s.id);
              return (
                <li key={s.id} id={s.id} className={cn("rounded-xl border px-4 py-3 transition-colors", evidence ? "border-amber/50 bg-amber-soft/30" : "border-border/60 bg-card", seg === s.id && "ring-2 ring-sage")}>
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{s.speaker}</span>
                    {s.started_at_offset !== null && <span>{offsetLabel(s.started_at_offset)}</span>}
                    {evidence && <span className="chip bg-amber-soft px-1.5 py-0 text-amber">evidence</span>}
                  </div>
                  <p className="text-sm leading-relaxed">{highlight(s.text, term)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {tab === "items" && (
        <div className="space-y-4">
          {obligations.length === 0 && <p className="paper-card p-5 text-sm text-muted-foreground">{meeting.processing_status === "done" ? "No actionable items were found in this recording." : "Still extracting — this usually takes under a minute."}</p>}
          {obligations.map((o) => <ObligationCard key={o.id} obligation={{ ...o, meeting_title: meeting.title, meeting_started_at: meeting.started_at }} />)}
        </div>
      )}

      {tab === "chat" && <CoachPanel scopeMeetingId={meeting.id} scopeTitle={meeting.title} />}
    </div>
  );
}

function highlight(text: string, term: string) {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term);
  if (idx < 0) return text;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let i = idx;
  while (i >= 0) {
    parts.push(text.slice(cursor, i));
    parts.push(<mark key={i} className="mark bg-transparent text-foreground">{text.slice(i, i + term.length)}</mark>);
    cursor = i + term.length;
    i = text.toLowerCase().indexOf(term, cursor);
  }
  parts.push(text.slice(cursor));
  return parts;
}

function safeParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}
