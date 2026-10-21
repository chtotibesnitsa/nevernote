import type { Note } from "@nevernote/core";
import { FileText, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, fmtClock, spring, StageDots, Wave } from "../components/ui.tsx";
import { useApp } from "./state.tsx";

const PAGE = 20;

function dayLabel(d: Date): string {
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  const md = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (d.toDateString() === today.toDateString()) return `Today, ${md}`;
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${md}`;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function StartButton({ className = "" }: { className?: string }) {
  const { rec, start, modelsReady, rec: { engineProgress } } = useApp();
  const nav = useNavigate();
  const busy = rec.state !== "idle";
  return (
    <Button
      variant={busy ? "glass" : "primary"}
      className={`!px-5 !py-2.5 ${className}`}
      onClick={async () => {
        if (busy && rec.noteId) return nav(`/app/note/${rec.noteId}`);
        const id = await start();
        if (id) nav(`/app/note/${id}`);
      }}
    >
      <span className="relative grid h-4 w-4 place-items-center">
        <span className={`absolute inset-0 rounded-full border-2 ${busy ? "border-[var(--color-dot-red)]" : "border-current"}`} />
        <motion.span layout className="h-1.5 w-1.5 rounded-full" style={{ background: busy ? "var(--color-dot-red)" : "currentColor" }} />
      </span>
      {engineProgress !== undefined
        ? `Getting the offline engine… ${Math.round(engineProgress * 100)}%`
        : busy
          ? "Back to live note"
          : modelsReady === false
            ? "Set up & start Notetaker"
            : "Start Notetaker"}
    </Button>
  );
}

export function NoteRow({ n, i }: { n: Note; i: number }) {
  const { rec } = useApp();
  const live = rec.noteId === n.id && rec.state !== "idle";
  const t = new Date(n.createdAt);
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(i, 8) * 0.03 }}>
      <Link to={`/app/note/${n.id}`} className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--bubble)]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--bubble)] text-[var(--ink-2)] transition group-hover:bg-[var(--card)]">
          <FileText size={20} strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px]">{n.title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-sm text-[var(--mute)]">
            {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "")}
            {n.folder && <span className="rounded-md bg-[var(--bubble)] px-1.5 text-xs">{n.folder}</span>}
            {n.extractions.some((e) => e.kind === "deadline" || e.kind === "exam") && <span className="text-xs text-[var(--color-leather)] dark:text-[var(--color-clay)]">• due dates</span>}
          </span>
        </span>
        {live ? (
          <span className="flex items-center gap-3 text-[var(--color-dot-green)]">
            <Wave level={rec.state === "recording" ? 0.5 : 0} active={rec.state === "recording"} />
            <span className="font-mono tabular-nums">{fmtClock(rec.elapsed)}</span>
          </span>
        ) : (
          <StageDots stage={n.stage} />
        )}
      </Link>
    </motion.div>
  );
}

export function Notes() {
  const { notes, loaded } = useApp();
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [revealing, setRevealing] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(s) || n.folder?.toLowerCase().includes(s) || n.segments.some((x) => x.text.toLowerCase().includes(s)));
  }, [notes, q]);

  // Load more as you scroll, with a short shimmer so new rows slide in instead of popping.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && shown < filtered.length && !revealing) {
        setRevealing(true);
        setTimeout(() => {
          setShown((s) => s + PAGE);
          setRevealing(false);
        }, 350);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, filtered.length, revealing]);

  const groups = useMemo(() => {
    const g: { label: string; items: Note[] }[] = [];
    for (const n of filtered.slice(0, shown)) {
      const label = dayLabel(new Date(n.createdAt));
      if (g[g.length - 1]?.label !== label) g.push({ label, items: [] });
      g[g.length - 1].items.push(n);
    }
    return g;
  }, [filtered, shown]);

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 pb-28 pt-4 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[2rem] font-semibold tracking-tight">Notetaker</h1>
        <StartButton />
      </div>
      <div className="mt-6 flex items-center gap-3 border-b border-[var(--line)] pb-2">
        <Search size={16} className="text-[var(--mute)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every word you've recorded" className="flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-[var(--mute)]" />
      </div>
      {!loaded ? (
        <Skeletons />
      ) : filtered.length === 0 ? (
        <Empty searching={!!q} />
      ) : (
        <div className="mt-4">
          {groups.map((g) => (
            <section key={g.label} className="mt-5">
              <div className="eyebrow px-3 pb-1">{g.label}</div>
              {g.items.map((n, i) => (
                <NoteRow key={n.id} n={n} i={i} />
              ))}
            </section>
          ))}
          <AnimatePresence>{revealing && <Skeletons rows={3} />}</AnimatePresence>
          <div ref={sentinel} className="h-8" />
        </div>
      )}
    </div>
  );
}

export function Skeletons({ rows = 5 }: { rows?: number }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6 space-y-3 px-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="skeleton h-12 w-12" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4" style={{ width: `${60 - i * 7}%` }} />
            <div className="skeleton h-3 w-20" />
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function Empty({ searching }: { searching: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-20 max-w-sm text-center">
      <div className="title-serif text-3xl">{searching ? "Nothing said that." : "A blank notebook."}</div>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">
        {searching ? "Try another word. Search looks through every transcript." : "Start the Notetaker when class begins. Everything stays on this device until you sign in."}
      </p>
      {!searching && <StartButton className="mt-6" />}
    </motion.div>
  );
}
