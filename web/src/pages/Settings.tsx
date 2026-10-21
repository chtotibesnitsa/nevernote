import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, FileUp, LogOut, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { GoogleConnect, WisprConnect } from "@/components/ConnectButtons";
import { CourseEditor } from "@/components/CourseEditor";
import { SecurityCard } from "@/components/SecurityCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote, PageHeader, Spinner } from "@/components/ui-bits";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { RescanAllButton, SyncNowButton } from "@/pages/Today";

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

export default function Settings() {
  const { me, refresh } = useMe();
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const importRef = useRef<HTMLDivElement>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("");
  const [school, setSchool] = useState<string>("");

  useEffect(() => {
    if (me) {
      setTimezone(me.profile.timezone);
      setSchool(me.profile.school_name);
    }
  }, [me]);
  useEffect(() => {
    if (window.location.hash === "#import") importRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const importMd = useMutation({
    mutationFn: () => api<{ meeting: { id: string; title: string }; duplicate: boolean; segment_count: number }>("/import/markdown", { method: "POST", json: { markdown, course_id: courseId || null } }),
    onSuccess: (d) => {
      setMarkdown("");
      void qc.invalidateQueries();
      if (d.duplicate) toast("This recording was already imported — nothing changed.");
      else toast.success(`Imported “${d.meeting.title}” (${d.segment_count} transcript lines). Extraction running.`);
      navigate(`/recordings/${d.meeting.id}`);
    },
  });
  const saveProfile = useMutation({
    mutationFn: () => api("/profile", { method: "PUT", json: { timezone, school_name: school } }),
    onSuccess: () => {
      void refresh();
      toast.success("Saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const calendars = useQuery<{ calendars: GoogleCalendar[]; selected_calendar_id: string | null }>({
    queryKey: ["google-calendars"],
    queryFn: () => api("/google/calendars"),
    enabled: me?.connections.google.status === "connected",
  });
  const selectCal = useMutation({
    mutationFn: (calendar_id: string) => api("/google/calendar", { method: "PUT", json: { calendar_id } }),
    onSuccess: () => {
      void refresh();
      void qc.invalidateQueries({ queryKey: ["google-calendars"] });
      toast.success("Destination calendar updated.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const wipe = useMutation({
    mutationFn: () => api("/account", { method: "DELETE" }),
    onSuccess: () => {
      qc.clear();
      toast("All NeverNote data deleted.");
      void refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      toast.error("That file is too large (1.5 MB max). Split the export.");
      return;
    }
    setMarkdown(await file.text());
  };

  const exportData = async () => {
    try {
      const data = await api<unknown>("/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nevernote-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Connections & data." />

      <Card title="Wispr Flow" hint={me?.connections.wispr.status === "connected" ? "Official read-only MCP connection. Your full Notetaker history is backfilled on connect, and new meetings arrive automatically within ~10 minutes of Wispr finishing its AI summary." : "Fallback mode: Markdown import is active. Connect Wispr Flow to pull every Notetaker transcript automatically."}>
        <WisprConnect />
        <Button asChild variant="ghost" size="sm" className="mt-3 rounded-xl">
          <Link to="/guide"><BookOpen className="h-3.5 w-3.5" /> Step-by-step setup guide</Link>
        </Button>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Last sync: {timeAgo(me?.sync.last_sync_at ?? null)} · last success: {timeAgo(me?.sync.last_success_at ?? null)} · imported {me?.sync.imported_count ?? 0}
            {me?.connections.wispr.status === "connected" && " · auto every 10 min"}
          </span>
          <span className="flex gap-2"><SyncNowButton /><RescanAllButton /></span>
        </div>
        {me?.ai && (
          <p className="mt-2 text-xs text-muted-foreground">
            Deterministic scanner: {me.ai.keyword_count.toLocaleString()} due-date keywords, runs on every transcript without AI. Rork Toolkit model: {me.ai.available ? "reachable" : "not reachable from the server — answers and extraction fall back to keyword matching"}.
          </p>
        )}
        {me?.sync.last_error && <div className="mt-2"><ErrorNote message={`Last sync error: ${me.sync.last_error}`} /></div>}
      </Card>

      <div ref={importRef} id="import" />
      <Card title="Import Wispr Markdown" hint="In Wispr Flow open a meeting → ··· → Copy to Markdown, then paste here or upload the .md file. Duplicates are detected automatically.">
        <div className="space-y-3">
          <Textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={8} placeholder={"# AP US GOVT Notes 09/17\nDate: 2026-09-17 8:52 AM\n\n## Summary\n…\n\n## Transcript\nTeacher: …"} className="rounded-xl font-mono text-xs" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input px-3 py-2 text-sm hover:bg-secondary">
              <FileUp className="h-4 w-4" /> Upload .md / .txt
              <input type="file" accept=".md,.txt,text/markdown,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Auto-detect course</option>
              {me?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button className="ml-auto rounded-xl" onClick={() => importMd.mutate()} disabled={importMd.isPending || markdown.trim().length < 40}>{importMd.isPending ? <Spinner /> : null} Import</Button>
          </div>
          {importMd.isError && <ErrorNote message={errorMessage(importMd.error)} />}
        </div>
      </Card>

      <Card title="Google Calendar" hint="Separate from sign-in. Events are only written when you press “Accept and Add to Calendar”.">
        <GoogleConnect />
        {me?.connections.google.status === "connected" && (
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">Destination calendar</label>
            {calendars.isLoading && <p className="text-sm text-muted-foreground">Loading calendars…</p>}
            {calendars.isError && <ErrorNote message={errorMessage(calendars.error)} />}
            {calendars.data && (
              <select className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={calendars.data.selected_calendar_id ?? ""} onChange={(e) => selectCal.mutate(e.target.value)}>
                <option value="" disabled>Choose a calendar</option>
                {calendars.data.calendars.map((c) => <option key={c.id} value={c.id}>{c.summary}{c.primary ? " (primary)" : ""}</option>)}
              </select>
            )}
          </div>
        )}
      </Card>

      <Card title="Profile">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs font-medium text-muted-foreground">Timezone</label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">School</label><Input value={school} onChange={(e) => setSchool(e.target.value)} className="mt-1" /></div>
        </div>
        <Button size="sm" className="mt-3 rounded-xl" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>Save</Button>
      </Card>

      <Card title="Courses" hint="Schedules help resolve “next class”; keywords auto-assign recordings.">
        <CourseEditor />
      </Card>

      <Card title="Security" hint="This instance opens for one Google account only, and every new sign-in needs a code from your authenticator app.">
        <SecurityCard />
      </Card>

      <Card title="Your data" hint="Everything lives in your private vault. Export it any time or delete it all.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => void exportData()}><Download className="h-4 w-4" /> Export JSON</Button>
          <Button variant="outline" className="rounded-xl text-clay" onClick={() => { if (confirm("Delete every recording, item, chat and connection in NeverNote? This cannot be undone.")) wipe.mutate(); }} disabled={wipe.isPending}><Trash2 className="h-4 w-4" /> Delete all my data</Button>
          <Button variant="ghost" className="ml-auto rounded-xl" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="paper-card p-5 fade-up">
      <h2 className="text-lg font-medium">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}
