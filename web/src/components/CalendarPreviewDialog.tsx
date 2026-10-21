import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, ExternalLink, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GoogleConnect } from "@/components/ConnectButtons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import type { EventPreview, Obligation } from "@/lib/types";

interface Props {
  obligation: Obligation;
  preview: EventPreview;
  onClose: () => void;
}

interface CreateResult {
  event_id: string;
  html_link: string | null;
  duplicate_prevented: boolean;
}

export function CalendarPreviewDialog({ obligation: o, preview, onClose }: Props) {
  const qc = useQueryClient();
  const { me } = useMe();
  const [result, setResult] = useState<CreateResult | null>(null);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["obligations"] });
    void qc.invalidateQueries({ queryKey: ["digest"] });
    void qc.invalidateQueries({ queryKey: ["meeting"] });
  };
  const create = useMutation({
    mutationFn: () => api<CreateResult>(`/obligations/${o.id}/calendar/create`, { method: "POST" }),
    onSuccess: (d) => {
      setResult(d);
      invalidate();
      toast.success(d.duplicate_prevented ? "Already on your calendar — no duplicate created." : "Added to Google Calendar.");
    },
  });
  const update = useMutation({
    mutationFn: () => api<CreateResult>(`/obligations/${o.id}/calendar/update`, { method: "POST" }),
    onSuccess: (d) => {
      setResult(d);
      invalidate();
      toast.success("Calendar event updated.");
    },
  });
  const undo = useMutation({
    mutationFn: () => api(`/obligations/${o.id}/calendar/undo`, { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast("Event removed from Google Calendar.");
      onClose();
    },
  });

  const start = preview.payload.start.date ?? preview.payload.start.dateTime ?? "";
  const when = preview.payload.start.date
    ? new Date(`${preview.payload.start.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : new Date(start).toLocaleString("en-US", { timeZone: me?.profile.timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const hasEvent = Boolean(o.provider_event_id);
  const canWrite = preview.google_status === "ready";
  const error = create.error ?? update.error ?? undo.error;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-medium">{hasEvent ? (o.calendar_dirty ? "Proposed calendar update" : "Calendar event") : "Preview calendar event"}</DialogTitle>
          <DialogDescription>{hasEvent ? "This is what the event on your Google Calendar will look like." : "Nothing is written until you confirm."}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-card shadow-sm">
              <span className="text-[10px] font-semibold uppercase text-clay">{new Date(preview.payload.start.date ? `${preview.payload.start.date}T12:00:00` : start).toLocaleDateString("en-US", { month: "short" })}</span>
              <span className="text-lg font-semibold leading-none">{new Date(preview.payload.start.date ? `${preview.payload.start.date}T12:00:00` : start).getDate()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-medium leading-snug">{preview.payload.summary}</p>
              <p className="text-sm text-muted-foreground">{when}{preview.payload.start.date ? " · all day" : ""}</p>
            </div>
          </div>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-card p-3 font-sans text-xs leading-relaxed text-ink-soft">{preview.payload.description}</pre>
          <p className="mt-2 text-[11px] text-muted-foreground">Calendar: {preview.calendar_id ?? "not selected"} · private reference to the source lesson is attached to the event.</p>
        </div>

        {error && <ErrorNote message={errorMessage(error)} />}

        {result && (
          <div className="flex items-center justify-between rounded-xl bg-sage-soft px-3 py-2 text-sm text-sage">
            <span className="flex items-center gap-2"><CalendarCheck2 className="h-4 w-4" /> Event ID {result.event_id.slice(0, 12)}…</span>
            {result.html_link && <a href={result.html_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Open <ExternalLink className="h-3 w-3" /></a>}
          </div>
        )}

        {!canWrite && !hasEvent && (
          <div className="space-y-2">
            {preview.google_status === "select_calendar" ? (
              <ErrorNote message="Choose a destination calendar in Settings before adding events." />
            ) : preview.google_status === "not_connected" ? (
              <>
                <p className="text-sm text-muted-foreground">Your item is accepted and saved. Connect Google Calendar to add the event.</p>
                <GoogleConnect />
              </>
            ) : (
              <GoogleConnect />
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {hasEvent && (
            <Button variant="outline" onClick={() => undo.mutate()} disabled={undo.isPending}>{undo.isPending ? <Spinner /> : <Undo2 className="h-4 w-4" />} Undo (remove event)</Button>
          )}
          {hasEvent && o.calendar_dirty ? (
            <Button onClick={() => update.mutate()} disabled={update.isPending || !canWrite}>{update.isPending ? <Spinner /> : null} Apply update</Button>
          ) : !hasEvent && !result ? (
            <Button onClick={() => create.mutate()} disabled={create.isPending || !canWrite}>{create.isPending ? <Spinner /> : <CalendarCheck2 className="h-4 w-4" />} Accept and Add to Calendar</Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
