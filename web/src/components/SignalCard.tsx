import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Quote, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui-bits";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { Signal, SignalCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<SignalCategory, string> = {
  assessment: "Test or quiz",
  assignment: "Assignment",
  reading: "Reading",
  project: "Project",
  presentation: "Presentation",
  logistics: "Event or logistics",
  materials: "Bring something",
  deadline: "Deadline wording",
  schedule_change: "Schedule change",
  future_mention: "Forward-looking",
};

const CATEGORY_TONE: Record<SignalCategory, string> = {
  assessment: "bg-clay-soft text-clay",
  assignment: "bg-amber-soft text-amber",
  reading: "bg-sky-soft text-sky",
  project: "bg-plum-soft text-plum",
  presentation: "bg-plum-soft text-plum",
  logistics: "bg-sage-soft text-sage",
  materials: "bg-sage-soft text-sage",
  deadline: "bg-amber-soft text-amber",
  schedule_change: "bg-sky-soft text-sky",
  future_mention: "bg-secondary text-muted-foreground",
};

/**
 * One deterministic keyword hit from a transcript. Shows the verbatim sentence
 * and lets the user promote it into the review queue or dismiss it. Never writes
 * a calendar event and never invents a date.
 */
export function SignalCard({ signal, timezone }: { signal: Signal; timezone?: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>(signal.resolved_date ? signal.resolved_date.slice(0, 10) : "");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["signals"] });
    void qc.invalidateQueries({ queryKey: ["obligations"] });
    void qc.invalidateQueries({ queryKey: ["digest"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
  };

  const promote = useMutation({
    mutationFn: () =>
      api<{ obligation_id: string }>(`/signals/${signal.id}/promote`, {
        method: "POST",
        json: { title: title.trim() || undefined, due_at: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : null },
      }),
    onSuccess: () => {
      toast.success("Added to your review queue.");
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const dismiss = useMutation({
    mutationFn: () => api(`/signals/${signal.id}/dismiss`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Dismissed.");
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const busy = promote.isPending || dismiss.isPending;

  return (
    <article className="paper-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={cn("chip", CATEGORY_TONE[signal.category])}>{CATEGORY_LABEL[signal.category]}</span>
        <span className="chip bg-secondary text-muted-foreground">“{signal.trigger_phrase}”</span>
        {signal.date_phrase && <span className="chip bg-sky-soft text-sky">{signal.date_phrase}</span>}
        {signal.resolved_date && <span className="chip bg-sage-soft text-sage">{fmtDateTime(signal.resolved_date, true, timezone)}</span>}
      </div>

      <blockquote className="flex gap-2 rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed">
        <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>{signal.excerpt}</span>
      </blockquote>

      <p className="mt-2 text-xs text-muted-foreground">
        {signal.meeting_title}
        {signal.meeting_id && (
          <>
            {" · "}
            <Link to={`/recordings/${signal.meeting_id}`} className="underline">Open recording</Link>
          </>
        )}
      </p>

      {editing ? (
        <div className="mt-3 space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title (defaults to the quote)" className="rounded-xl" />
          <div>
            <label className="text-xs font-medium text-muted-foreground">Due date (leave empty if it wasn&apos;t stated)</label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-xl" onClick={() => promote.mutate()} disabled={busy}>
              {promote.isPending ? <Spinner /> : <CalendarPlus className="h-3.5 w-3.5" />} Add to review queue
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditing(true)} disabled={busy}>
            <CalendarPlus className="h-3.5 w-3.5" /> This matters
          </Button>
          <Button size="sm" variant="ghost" className="rounded-xl text-muted-foreground" onClick={() => dismiss.mutate()} disabled={busy}>
            {dismiss.isPending ? <Spinner /> : <X className="h-3.5 w-3.5" />} Not relevant
          </Button>
        </div>
      )}
    </article>
  );
}
