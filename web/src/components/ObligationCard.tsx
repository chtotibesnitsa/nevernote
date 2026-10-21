import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Check, HelpCircle, Pencil, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { CalendarPreviewDialog } from "@/components/CalendarPreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Confidence, CourseChip, Evidence, Spinner, StatusChip, TypeChip } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime, relativeDue, toLocalInputValue, TYPE_LABEL } from "@/lib/format";
import type { EventPreview, Obligation, ObligationType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  obligation: Obligation;
  compact?: boolean;
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["obligations"] });
  void qc.invalidateQueries({ queryKey: ["digest"] });
  void qc.invalidateQueries({ queryKey: ["meeting"] });
  void qc.invalidateQueries({ queryKey: ["me"] });
}

export function ObligationCard({ obligation: o, compact = false }: Props) {
  const qc = useQueryClient();
  const { me } = useMe();
  const course = me?.courses.find((c) => c.id === o.course_id);
  const tz = me?.profile.timezone;
  const [editing, setEditing] = useState<boolean>(false);
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [draft, setDraft] = useState<{ title: string; description: string; type: ObligationType; due: string; allDay: boolean; courseId: string }>({
    title: o.title,
    description: o.description,
    type: o.type,
    due: toLocalInputValue(o.due_at, Boolean(o.all_day)),
    allDay: Boolean(o.all_day),
    courseId: o.course_id ?? "",
  });

  const reject = useMutation({
    mutationFn: () => api(`/obligations/${o.id}/reject`, { method: "POST" }),
    onSuccess: () => {
      invalidateAll(qc);
      toast("Rejected — no calendar event was created.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ask = useMutation({
    mutationFn: () => api(`/obligations/${o.id}/ask`, { method: "POST" }),
    onSuccess: () => {
      invalidateAll(qc);
      toast("Parked. It will stay in the queue until you add a date.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const accept = useMutation({
    mutationFn: () => api<{ preview: EventPreview }>(`/obligations/${o.id}/accept`, { method: "POST" }),
    onSuccess: (data) => {
      invalidateAll(qc);
      setPreview(data.preview);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: () => {
      const dueIso = draft.due ? new Date(draft.allDay ? `${draft.due}T09:00:00` : draft.due).toISOString() : null;
      return api(`/obligations/${o.id}`, {
        method: "PATCH",
        json: { title: draft.title, description: draft.description, type: draft.type, due_at: dueIso, all_day: draft.allDay, course_id: draft.courseId || null },
      });
    },
    onSuccess: () => {
      invalidateAll(qc);
      setEditing(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const openPreview = useMutation({
    mutationFn: () => api<{ preview: EventPreview }>(`/obligations/${o.id}/calendar/preview`, { method: "POST" }),
    onSuccess: (d) => setPreview(d.preview),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const due = relativeDue(o.due_at);
  const reviewable = o.status === "needs_review" || o.status === "needs_clarification";
  const onCalendar = Boolean(o.provider_event_id);

  return (
    <article className={cn("paper-card overflow-hidden fade-up", o.status === "rejected" && "opacity-60")}>
      <div className={cn("h-1", due.tone === "overdue" ? "bg-clay" : due.tone === "soon" ? "bg-amber" : due.tone === "later" ? "bg-sage" : "bg-plum/50")} />
      <div className="p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeChip type={o.type} />
          <CourseChip course={course} />
          <StatusChip status={o.status} dirty={Boolean(o.calendar_dirty)} />
          <span className="ml-auto"><Confidence value={o.confidence} /></span>
        </div>

        {!editing ? (
          <>
            <h3 className="mt-3 text-lg font-medium leading-snug">{o.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
              <span className={cn("font-semibold", due.tone === "overdue" ? "text-clay" : due.tone === "soon" ? "text-amber" : due.tone === "none" ? "text-plum" : "text-sage")}>
                {o.due_at ? `Due ${fmtDateTime(o.due_at, Boolean(o.all_day), tz)}` : "Date unclear"}
              </span>
              <span className="text-muted-foreground">· {due.label}</span>
              {o.raw_date_phrase && <span className="text-muted-foreground">· said “{o.raw_date_phrase}”</span>}
            </p>
            {o.description && !compact && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{o.description}</p>}
            {o.date_reasoning && !compact && <p className="mt-1.5 text-xs text-muted-foreground"><span className="font-semibold">Why this date:</span> {o.date_reasoning}</p>}
            {!compact && <div className="mt-3"><Evidence excerpt={o.evidence_excerpt} /></div>}
            <p className="mt-2 text-xs text-muted-foreground">
              From <Link to={`/recordings/${o.meeting_id}?seg=${firstSegment(o)}`} className="font-medium text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground">{o.meeting_title ?? "recording"}</Link>
              {o.meeting_started_at && <> · {fmtDateTime(o.meeting_started_at, true, tz)}</>}
            </p>
          </>
        ) : (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
            <div className="grid gap-2 sm:grid-cols-3">
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ObligationType })}>
                {(Object.keys(TYPE_LABEL) as ObligationType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.courseId} onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}>
                <option value="">No course</option>
                {me?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked, due: e.target.checked ? draft.due.slice(0, 10) : draft.due ? `${draft.due.slice(0, 10)}T09:00` : "" })} /> All day</label>
            </div>
            <Input type={draft.allDay ? "date" : "datetime-local"} value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? <Spinner /> : "Save"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {!editing && (
          <div className="mt-4 flex flex-wrap gap-2">
            {reviewable && (
              <>
                <Button size="sm" className="rounded-xl" onClick={() => accept.mutate()} disabled={accept.isPending || !o.due_at} title={!o.due_at ? "Add a date first" : undefined}>
                  {accept.isPending ? <Spinner /> : <Check className="h-4 w-4" />} Accept
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit{!o.due_at && " & add date"}</Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => reject.mutate()} disabled={reject.isPending}><X className="h-3.5 w-3.5" /> Reject</Button>
                {o.status !== "needs_clarification" && <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => ask.mutate()} disabled={ask.isPending}><HelpCircle className="h-3.5 w-3.5" /> Ask me later</Button>}
              </>
            )}
            {o.status === "accepted" && !onCalendar && (
              <>
                <Button size="sm" className="rounded-xl" onClick={() => openPreview.mutate()} disabled={openPreview.isPending}>{openPreview.isPending ? <Spinner /> : <CalendarPlus className="h-4 w-4" />} Add to Google Calendar</Button>
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => reject.mutate()}><X className="h-3.5 w-3.5" /> Reject</Button>
              </>
            )}
            {onCalendar && (
              <>
                {o.calendar_dirty ? <Button size="sm" className="rounded-xl" onClick={() => openPreview.mutate()}>Review proposed update</Button> : null}
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => openPreview.mutate()}>Event details / undo</Button>
              </>
            )}
            {o.status === "rejected" && <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setEditing(true)}>Reconsider</Button>}
          </div>
        )}
      </div>
      {preview && <CalendarPreviewDialog obligation={o} preview={preview} onClose={() => setPreview(null)} />}
    </article>
  );
}

function firstSegment(o: Obligation): string {
  try {
    const ids = JSON.parse(o.evidence_segment_ids) as string[];
    return ids[0] ?? "";
  } catch {
    return "";
  }
}
