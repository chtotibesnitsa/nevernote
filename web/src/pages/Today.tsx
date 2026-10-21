import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Flag, Inbox, Library, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ObligationCard } from "@/components/ObligationCard";
import { SignalCard } from "@/components/SignalCard";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, PageHeader, Spinner, TypeChip } from "@/components/ui-bits";
import { WordFlip } from "@/components/WordFlip";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { fmtDateTime, relativeDue, timeAgo } from "@/lib/format";
import type { Digest, Meeting, Signal } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Today() {
  const { user } = useAuth();
  const { me, refresh } = useMe();
  const qc = useQueryClient();
  const digest = useQuery<Digest>({ queryKey: ["digest", "week"], queryFn: () => api<Digest>("/digest?period=week") });
  const meetings = useQuery<{ meetings: Meeting[] }>({ queryKey: ["meetings", "", ""], queryFn: () => api("/meetings") });
  const seed = useMutation({
    mutationFn: () => api("/demo/seed", { method: "POST" }),
    onSuccess: () => {
      toast.success("Demo lesson imported. Extraction is running — the review queue fills in a few seconds.");
      void refresh();
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const d = digest.data;
  const attention = (d?.unreviewed.length ?? 0) + (d?.unclear.length ?? 0);
  const noData = me && me.counts.meetings === 0;

  return (
    <div>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting}, ${firstName}.`}
        subtitle={attention > 0 ? `${attention} item${attention === 1 ? "" : "s"} waiting for your decision.` : "Nothing is waiting on you right now."}
      />

      {noData && (
        <section className="paper-card mb-6 p-6 fade-up">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-soft text-amber sm:flex"><Sparkles className="h-6 w-6" /></div>
            <div className="flex-1">
              <h2 className="text-xl font-medium leading-snug">
                Start once, then never{" "}
                <WordFlip words={["note again.", "miss a task.", "miss a deadline.", "miss a beat."]} wordClassName="font-display font-semibold word-accent" />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Connect Wispr Flow, import a Markdown export in Settings, or load one clearly-labelled fictional demo lesson to see the whole flow.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="rounded-xl"><Link to="/settings#import">Import Wispr Markdown</Link></Button>
                <Button variant="outline" className="rounded-xl" onClick={() => seed.mutate()} disabled={seed.isPending}>{seed.isPending ? <Spinner /> : null} Load demo lesson</Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat to="/review" label="To review" value={d?.unreviewed.length ?? 0} tone="amber" icon={<Inbox className="h-4 w-4" />} />
        <Stat to="/review?tab=unclear" label="Need a date" value={d?.unclear.length ?? 0} tone="plum" icon={<CalendarClock className="h-4 w-4" />} />
        <Stat to="/review?tab=flagged" label="Flagged mentions" value={me?.counts.flagged_mentions ?? 0} tone="sage" icon={<Flag className="h-4 w-4" />} />
        <Stat to="/recordings" label="Recordings" value={me?.counts.meetings ?? 0} tone="sky" icon={<Library className="h-4 w-4" />} />
      </div>

      {digest.isError && <div className="mb-6"><ErrorNote message={errorMessage(digest.error)} /></div>}

      {d && d.overdue.length > 0 && (
        <Section title="Slipped past" hint="Accepted items whose date has passed. Mark them done by rejecting, or fix the date.">
          {d.overdue.slice(0, 3).map((o) => <ObligationCard key={o.id} obligation={o} compact />)}
        </Section>
      )}

      {(me?.counts.flagged_mentions ?? 0) > 0 && (
        <Section
          title="Flagged from your transcripts"
          hint="Keyword and date sweep caught these forward-looking mentions that aren't tasks yet."
          action={<Link to="/review?tab=flagged" className="inline-flex items-center gap-1 text-sm font-medium text-primary">Review all <ArrowRight className="h-4 w-4" /></Link>}
        >
          <FlaggedPreview timezone={me?.profile.timezone} />
        </Section>
      )}

      {d && (d.unreviewed.length > 0 || d.unclear.length > 0) && (
        <Section title="What needs attention" hint="New suggestions from your recordings. Each one shows the quote it came from." action={<Link to="/review" className="inline-flex items-center gap-1 text-sm font-medium text-primary">Open queue <ArrowRight className="h-4 w-4" /></Link>}>
          {[...d.unreviewed, ...d.unclear].slice(0, 3).map((o) => <ObligationCard key={o.id} obligation={o} />)}
        </Section>
      )}

      {d && d.upcoming.length > 0 && (
        <Section title="Coming up" hint="Accepted work in the next 8 days.">
          <ul className="paper-card divide-y divide-border/60">
            {d.upcoming.filter((o) => o.status !== "needs_review" && o.status !== "needs_clarification").map((o) => {
              const rel = relativeDue(o.due_at);
              return (
                <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(o.due_at, Boolean(o.all_day), d.timezone)} · {o.meeting_title}</p>
                  </div>
                  <TypeChip type={o.type} />
                  <span className={cn("text-xs font-semibold", rel.tone === "soon" ? "text-amber" : "text-muted-foreground")}>{rel.label}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {d && d.not_on_calendar.length > 0 && (
        <Section title="Accepted, not on your calendar yet" hint="These are approved but haven't been written to Google Calendar.">
          {d.not_on_calendar.slice(0, 3).map((o) => <ObligationCard key={o.id} obligation={o} compact />)}
        </Section>
      )}

      <Section title="Recent lessons" action={<Link to="/recordings" className="inline-flex items-center gap-1 text-sm font-medium text-primary">All recordings <ArrowRight className="h-4 w-4" /></Link>}>
        {meetings.data && meetings.data.meetings.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {meetings.data.meetings.slice(0, 4).map((m) => (
              <li key={m.id}>
                <Link to={`/recordings/${m.id}`} className="paper-card block p-4 transition-transform hover:-translate-y-0.5">
                  <p className="text-xs text-muted-foreground">{fmtDateTime(m.started_at, true, me?.profile.timezone)}{m.source_type === "demo" && " · demo"}</p>
                  <p className="mt-1 line-clamp-1 font-medium">{m.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.summary || "No summary"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{m.processing_status === "processing" || m.processing_status === "pending" ? "Extracting…" : `${m.obligation_count ?? 0} item${m.obligation_count === 1 ? "" : "s"} found`}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          !noData && <EmptyState icon={<Library className="h-5 w-5" />} title="No recordings yet" body="Import your first lesson from Settings." />
        )}
      </Section>

      <section className="paper-card mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Sync health</p>
          <p className="text-xs text-muted-foreground">
            {me?.connections.wispr.status === "connected"
              ? `Wispr Flow connected · auto-syncing every 10 min · last success ${timeAgo(me.sync.last_success_at)} · ${me.sync.imported_count} imported`
              : "Wispr Flow not connected — using Markdown import (fallback mode)."}
            {me?.sync.last_error && <span className="text-clay"> · Last error: {me.sync.last_error}</span>}
          </p>
        </div>
        <SyncNowButton />
      </section>
    </div>
  );
}

/** Top few deterministic keyword hits, newest and highest-scoring first. */
function FlaggedPreview({ timezone }: { timezone?: string }) {
  const q = useQuery<{ signals: Signal[] }>({ queryKey: ["signals", "flagged"], queryFn: () => api("/signals?status=flagged") });
  if (!q.data) return null;
  return <>{q.data.signals.slice(0, 3).map((s) => <SignalCard key={s.id} signal={s} timezone={timezone} />)}</>;
}

export function SyncNowButton() {
  const { me, refresh } = useMe();
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: () => api<{ imported: number; checked: number; redated?: number }>("/wispr/sync", { method: "POST" }),
    onSuccess: (d) => {
      toast.success(`Sync finished: ${d.imported} new or updated of ${d.checked} checked${d.redated ? `, ${d.redated} re-dated` : ""}.`);
      void refresh();
      void qc.invalidateQueries();
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      void refresh();
    },
  });
  const disabled = me?.connections.wispr.status !== "connected";
  return (
    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => sync.mutate()} disabled={disabled || sync.isPending} title={disabled ? "Connect Wispr Flow first" : undefined}>
      {sync.isPending ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />} Sync now
    </Button>
  );
}

/** Re-runs the deterministic keyword scan (and AI extraction when reachable) across every recording. */
export function RescanAllButton() {
  const { refresh } = useMe();
  const qc = useQueryClient();
  const rescan = useMutation({
    mutationFn: () => api<{ rescanned: number; flagged: number; ai_available: boolean }>("/meetings/rescan", { method: "POST" }),
    onSuccess: (d) => {
      toast.success(`Re-scanned ${d.rescanned} recording(s): ${d.flagged} mention(s) flagged${d.ai_available ? "" : " (keyword scan only; AI unreachable)"}.`);
      void refresh();
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => rescan.mutate()} disabled={rescan.isPending}>
      {rescan.isPending ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />} Re-scan all
    </Button>
  );
}

function Stat({ to, label, value, tone, icon }: { to: string; label: string; value: number; tone: "amber" | "plum" | "sage" | "sky"; icon: React.ReactNode }) {
  const tones = { amber: "bg-amber-soft text-amber", plum: "bg-plum-soft text-plum", sage: "bg-sage-soft text-sage", sky: "bg-sky-soft text-sky" };
  return (
    <Link to={to} className="paper-card p-4 transition-transform hover:-translate-y-0.5">
      <div className={cn("mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg", tones[tone])}>{icon}</div>
      <p className="font-display text-3xl font-medium leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
