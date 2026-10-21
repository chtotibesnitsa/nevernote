import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, CircleDashed } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CalendarPreviewDialog } from "@/components/CalendarPreviewDialog";
import { EmptyState, ErrorNote, PageHeader, TypeChip } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { courseColor, fmtDateTime } from "@/lib/format";
import type { EventPreview, Obligation } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Calendar() {
  const { me } = useMe();
  const tz = me?.profile.timezone;
  const q = useQuery<{ obligations: Obligation[] }>({ queryKey: ["obligations", "all"], queryFn: () => api("/obligations") });
  const [preview, setPreview] = useState<{ o: Obligation; p: EventPreview } | null>(null);

  const groups = useMemo(() => {
    const list = (q.data?.obligations ?? []).filter((o) => o.due_at && o.status !== "rejected");
    const byDay = new Map<string, Obligation[]>();
    for (const o of list.sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))) {
      const key = new Date(o.due_at as string).toLocaleDateString("en-CA", { timeZone: tz });
      byDay.set(key, [...(byDay.get(key) ?? []), o]);
    }
    return Array.from(byDay.entries());
  }, [q.data, tz]);

  const undated = (q.data?.obligations ?? []).filter((o) => !o.due_at && o.status !== "rejected");

  const openPreview = async (o: Obligation) => {
    try {
      const { preview: p } = await api<{ preview: EventPreview }>(`/obligations/${o.id}/calendar/preview`, { method: "POST" });
      setPreview({ o, p });
    } catch {
      /* handled by card actions elsewhere */
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Calendar" title="What's ahead." subtitle="Solid dots are real Google Calendar events. Hollow dots are suggestions or accepted items not yet written." />
      <div className="mb-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sage" /> On Google Calendar</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-sky" /> Accepted, not written</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber" /> Suggestion</span>
      </div>
      {q.isError && <ErrorNote message={errorMessage(q.error)} />}
      {q.data && groups.length === 0 && <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing scheduled" body="Dated items will appear here as you review suggestions." />}
      <ol className="relative space-y-6 border-l border-border/70 pl-5">
        {groups.map(([day, items]) => {
          const date = new Date(`${day}T12:00:00`);
          const isToday = day === new Date().toLocaleDateString("en-CA", { timeZone: tz });
          return (
            <li key={day} className="fade-up">
              <span className={cn("absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full", isToday ? "bg-clay" : "bg-border")} />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{isToday ? "Today · " : ""}{date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <ul className="mt-2 space-y-2">
                {items.map((o) => {
                  const course = me?.courses.find((c) => c.id === o.course_id);
                  const col = courseColor(course?.color);
                  const real = Boolean(o.provider_event_id);
                  const accepted = o.status === "accepted";
                  return (
                    <li key={o.id}>
                      <button onClick={() => (o.due_at ? void openPreview(o) : undefined)} className="paper-card flex w-full items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5">
                        <span className={cn("h-3 w-3 shrink-0 rounded-full", real ? "bg-sage" : accepted ? "border-2 border-sky" : "border-2 border-dashed border-amber")} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{o.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{o.all_day ? "All day" : fmtDateTime(o.due_at, false, tz).split(", ").slice(-1)[0]} · {course ? course.name : o.meeting_title}</p>
                        </div>
                        {course && <span className={cn("hidden h-2 w-2 rounded-full sm:block", col.dot)} />}
                        <TypeChip type={o.type} />
                        {real ? <Check className="h-4 w-4 text-sage" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
      {undated.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Waiting for a date</h2>
          <p className="mb-2 text-xs text-muted-foreground">These were mentioned without a clear deadline. <Link to="/review?tab=unclear" className="underline">Add dates in the review queue</Link>.</p>
          <ul className="paper-card divide-y divide-border/60">
            {undated.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 text-sm"><TypeChip type={o.type} /><span className="truncate">{o.title}</span><span className="ml-auto truncate text-xs text-muted-foreground">“{o.raw_date_phrase || "no date said"}”</span></li>
            ))}
          </ul>
        </section>
      )}
      {preview && <CalendarPreviewDialog obligation={preview.o} preview={preview.p} onClose={() => setPreview(null)} />}
    </div>
  );
}
