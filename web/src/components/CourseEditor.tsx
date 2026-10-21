import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { COURSE_COLORS, courseColor } from "@/lib/format";
import type { Course } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: Omit<Course, "id"> = { name: "", short_name: "", teacher: "", color: "sage", meeting_keywords: "", typical_schedule: "" };

export function CourseEditor() {
  const { me, refresh } = useMe();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Omit<Course, "id">>(EMPTY);
  const [open, setOpen] = useState<boolean>(false);

  const save = useMutation({
    mutationFn: (c: Omit<Course, "id"> & { id?: string }) => api("/courses", { method: "POST", json: c }),
    onSuccess: () => {
      setDraft(EMPTY);
      setOpen(false);
      void refresh();
      void qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => void refresh(),
  });

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {(me?.courses ?? []).map((c) => {
          const col = courseColor(c.color);
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", col.dot)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name} {c.short_name && <span className="text-muted-foreground">· {c.short_name}</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{[c.teacher, c.typical_schedule].filter(Boolean).join(" · ") || "No teacher or schedule yet"}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => remove.mutate(c.id)} aria-label="Remove course"><Trash2 className="h-4 w-4" /></Button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <form
          className="space-y-2 rounded-xl border border-dashed border-border bg-secondary/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Input required placeholder="Course name (AP US Government)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input placeholder="Short name (AP GOV)" value={draft.short_name} onChange={(e) => setDraft({ ...draft, short_name: e.target.value })} />
            <Input placeholder="Teacher" value={draft.teacher} onChange={(e) => setDraft({ ...draft, teacher: e.target.value })} />
            <Input placeholder="Schedule (Mon, Wed, Fri 9:00 AM)" value={draft.typical_schedule} onChange={(e) => setDraft({ ...draft, typical_schedule: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Keywords in recording titles (gov, government)" value={draft.meeting_keywords} onChange={(e) => setDraft({ ...draft, meeting_keywords: e.target.value })} />
          </div>
          <div className="flex items-center gap-1.5">
            {COURSE_COLORS.map((c) => (
              <button key={c.key} type="button" aria-label={c.label} onClick={() => setDraft({ ...draft, color: c.key })} className={cn("h-6 w-6 rounded-full border-2 transition-transform", c.dot, draft.color === c.key ? "scale-110 border-foreground" : "border-transparent")} />
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={save.isPending || !draft.name.trim()}>{save.isPending ? <Spinner /> : "Save course"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="rounded-xl"><Plus className="h-4 w-4" /> Add course</Button>
      )}
    </div>
  );
}
