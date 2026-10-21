import { useQuery } from "@tanstack/react-query";
import { Library, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CourseChip, EmptyState, ErrorNote, PageHeader } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Recordings() {
  const { me } = useMe();
  const [q, setQ] = useState<string>("");
  const [course, setCourse] = useState<string>("");
  const query = useQuery<{ meetings: Meeting[] }>({
    queryKey: ["meetings", q, course],
    queryFn: () => api(`/meetings?q=${encodeURIComponent(q)}&course=${encodeURIComponent(course)}`),
    refetchInterval: (query) => (query.state.data?.meetings.some((m) => m.processing_status === "pending" || m.processing_status === "processing") ? 4000 : false),
  });

  return (
    <div>
      <PageHeader eyebrow="Recordings" title="Every lesson, kept." subtitle="Search titles, summaries and full transcripts." action={<Button asChild variant="outline" className="rounded-xl"><Link to="/settings#import">Import</Link></Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transcripts…" className="rounded-xl pl-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button onClick={() => setCourse("")} className={cn("chip shrink-0 border", !course ? "border-foreground bg-card" : "border-transparent bg-secondary text-muted-foreground")}>All</button>
          {me?.courses.map((c) => (
            <button key={c.id} onClick={() => setCourse(course === c.id ? "" : c.id)} className={cn("shrink-0 rounded-full border", course === c.id ? "border-foreground" : "border-transparent")}><CourseChip course={c} /></button>
          ))}
        </div>
      </div>
      {query.isError && <ErrorNote message={errorMessage(query.error)} />}
      {query.data && query.data.meetings.length === 0 && <EmptyState icon={<Library className="h-5 w-5" />} title={q ? "No matches" : "No recordings yet"} body={q ? "Try a different phrase." : "Import a Wispr Markdown export or connect Wispr Flow in Settings."} />}
      <ul className="space-y-2">
        {query.data?.meetings.map((m) => {
          const c = me?.courses.find((x) => x.id === m.course_id);
          return (
            <li key={m.id}>
              <Link to={`/recordings/${m.id}`} className="paper-card flex items-start gap-4 p-4 transition-transform hover:-translate-y-0.5 fade-up">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">{new Date(m.started_at).toLocaleDateString("en-US", { month: "short", timeZone: me?.profile.timezone })}</span>
                  <span className="text-lg font-semibold leading-none">{new Date(m.started_at).toLocaleDateString("en-US", { day: "numeric", timeZone: me?.profile.timezone })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate font-medium">{m.title}</h3>
                    {m.source_type === "demo" && <span className="chip bg-amber-soft text-amber">Demo</span>}
                    {m.source_type === "wispr_mcp" && <span className="chip bg-sky-soft text-sky">Wispr sync</span>}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{m.summary || "No summary"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <CourseChip course={c} />
                    <span>{fmtDateTime(m.started_at, false, me?.profile.timezone)}</span>
                    <span>· {m.processing_status === "done" ? `${m.obligation_count ?? 0} items` : m.processing_status === "error" ? "extraction failed" : "extracting…"}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
