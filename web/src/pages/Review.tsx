import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ObligationCard } from "@/components/ObligationCard";
import { SignalCard } from "@/components/SignalCard";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, PageHeader } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import type { Obligation, Signal } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "queue", label: "To review", statuses: ["needs_review"] },
  { key: "unclear", label: "Needs a date", statuses: ["needs_clarification"] },
  { key: "flagged", label: "Flagged mentions", statuses: [] as string[] },
  { key: "accepted", label: "Accepted", statuses: ["accepted", "calendar_created", "calendar_updated"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

export default function Review() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get("tab")) ?? TABS[0];
  const { me } = useMe();
  const q = useQuery<{ obligations: Obligation[] }>({ queryKey: ["obligations", "all"], queryFn: () => api("/obligations"), refetchInterval: (query) => (query.state.data?.obligations.length === 0 ? 5000 : false) });
  const signals = useQuery<{ signals: Signal[]; keyword_count: number }>({ queryKey: ["signals", "flagged"], queryFn: () => api("/signals?status=flagged") });
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.key] = (q.data?.obligations ?? []).filter((o) => t.statuses.includes(o.status)).length;
    c.flagged = signals.data?.signals.length ?? 0;
    return c;
  }, [q.data, signals.data]);
  const items = useMemo(() => {
    const list = (q.data?.obligations ?? []).filter((o) => tab.statuses.includes(o.status));
    return list.sort((a, b) => {
      const ad = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return b.confidence - a.confidence;
    });
  }, [q.data, tab]);

  return (
    <div>
      <PageHeader eyebrow="Review queue" title="Your decisions." subtitle="Sorted by urgency, then confidence. One at a time — bulk approval is off on purpose." />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-secondary/70 p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setParams(t.key === "queue" ? {} : { tab: t.key })} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", tab.key === t.key ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
            <span className={cn("rounded-full px-1.5 text-[11px]", tab.key === t.key ? "bg-secondary" : "bg-transparent")}>{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>
      {tab.key === "flagged" ? (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            Every sentence in your transcripts is swept for {(signals.data?.keyword_count ?? 0).toLocaleString()} upcoming-related keywords plus date and future-tense patterns — independently of the AI, so nothing forward-looking slips through. These are mentions the AI didn&apos;t already turn into a task.
          </p>
          {signals.isError && <ErrorNote message={errorMessage(signals.error)} />}
          {signals.data && signals.data.signals.length === 0 && (
            <EmptyState icon={<Inbox className="h-5 w-5" />} title="No extra mentions" body="Everything forward-looking in your transcripts is already a task in your queue." />
          )}
          <div className="space-y-3">
            {(signals.data?.signals ?? []).map((s) => <SignalCard key={s.id} signal={s} timezone={me?.profile.timezone} />)}
          </div>
        </>
      ) : (
      <>
      {q.isError && <ErrorNote message={errorMessage(q.error)} />}
      {q.data && items.length === 0 && (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title={tab.key === "queue" ? "Queue is clear" : `Nothing ${tab.label.toLowerCase()}`}
          body={tab.key === "queue" ? "New suggestions appear here after a recording is imported and extracted." : "Items move here as you make decisions."}
          action={tab.key === "queue" ? <Button asChild variant="outline" className="rounded-xl"><Link to="/recordings">Browse recordings</Link></Button> : undefined}
        />
      )}
      <div className="space-y-4">
        {items.map((o) => <ObligationCard key={o.id} obligation={o} />)}
      </div>
      </>
      )}
    </div>
  );
}
