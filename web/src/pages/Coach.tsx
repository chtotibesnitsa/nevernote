import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, MessageSquarePlus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import CoachPanel from "@/components/CoachPanel";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { ChatThread } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Full-height chat surface. The conversation owns the screen (like a real
 * messaging app) instead of floating in a short box, and past conversations
 * live in a drawer that stays out of the way until asked for.
 */
export default function Coach() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const threads = useQuery<{ threads: ChatThread[] }>({ queryKey: ["threads"], queryFn: () => api("/chat/threads") });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/chat/threads/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ["threads"] });
      if (id === threadId) navigate("/coach");
    },
  });

  const list = threads.data?.threads ?? [];

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col md:h-[calc(100dvh-4rem)]">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Memory Coach</p>
          <h1 className="font-display text-2xl font-medium leading-tight md:text-3xl">Ask your recordings.</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen}>
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
            {list.length > 0 && <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold">{list.length}</span>}
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/coach")}>
            <MessageSquarePlus className="h-4 w-4" /> <span className="hidden sm:inline">New</span>
          </Button>
        </div>
      </header>

      {historyOpen && (
        <div className="fade-up mb-3 rounded-2xl border border-border/70 bg-card/80 p-2">
          {list.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No past conversations yet.</p>
          ) : (
            <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto">
              {list.map((t) => (
                <li key={t.id} className={cn("group flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs", t.id === threadId ? "bg-secondary" : "hover:bg-secondary/60")}>
                  <button
                    onClick={() => {
                      navigate(`/coach/${t.id}`);
                      setHistoryOpen(false);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="text-muted-foreground">{timeAgo(t.updated_at)}</span>
                  </button>
                  <button onClick={() => remove.mutate(t.id)} className="shrink-0 text-muted-foreground transition-colors hover:text-clay" aria-label="Delete conversation">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setHistoryOpen(false)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-muted-foreground hover:bg-secondary/60">
            <X className="h-3 w-3" /> Close
          </button>
        </div>
      )}

      <CoachPanel key={threadId ?? "new"} threadId={threadId} onThreadCreated={(id) => navigate(`/coach/${id}`, { replace: true })} />
    </div>
  );
}
