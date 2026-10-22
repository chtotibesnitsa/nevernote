import type { Note } from "@nevernote/core";
import { FileText, LayoutGrid, List, Search } from "lucide-react";
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
            {n.extractions.some((e) => e.kind === "deadline" || e.kind === "exam") && <span className="text-xs text-[var(--color-dot-red)]">• due dates</span>}
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

/** A note as a card: the first thing said, who spoke, what's due. */
export function NoteCard({ n, i }: { n: Note; i: number }) {
  const { rec } = useApp();
  const live = rec.noteId === n.id && rec.state !== "idle";
  const t = new Date(n.createdAt);
  const due = n.extractions.filter((e) => e.kind === "deadline" || e.kind === "exam");
  const words = n.segments.reduce((a, s) => a + s.text.split(" ").length, 0);
  const snippet = n.summary?.notes.replace(/[#*_>-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) || n.segments.slice(0, 3).map((s) => s.text).join(" ").slice(0, 150);
  const names = n.speakers.filter((s) => !/^S\d+$/.test(s.name)).slice(0, 3);
  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(i, 9) * 0.03 }}>
      <Link
        to={`/app/note/${n.id}`}
        className="group flex h-full flex-col rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]"
      >
        <div className="flex items-center gap-2 text-[12px] text-[var(--mute)]">
          {n.folder && <span className="rounded-md bg-[var(--bubble)] px-1.5 py-0.5 font-medium text-[var(--ink-2)]">{n.folder}</span>}
          <span>{t.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "")}</span>
          <span className="ml-auto">{live ? <Wave level={rec.state === "recording" ? 0.5 : 0} active={rec.state === "recording"} bars={5} /> : <StageDots stage={n.stage} />}</span>
        </div>
        <div className="mt-2.5 line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">{n.title}</div>
        <p className="mt-1.5 line-clamp-3 flex-1 text-[13.5px] leading-relaxed text-[var(--ink-2)]">{snippet || "No words yet."}</p>
        <div className="mt-3.5 flex items-center gap-3 border-t border-[var(--line)] pt-3 text-[12px] text-[var(--mute)]">
          <span className="tabular-nums">{live ? fmtClock(rec.elapsed) : fmtClock(n.durationSec || (n.segments.at(-1)?.end ?? 0))}</span>
          <span className="whitespace-nowrap">{words.toLocaleString()} words</span>
          {names.length > 0 && <span className="hidden min-w-0 truncate 2xl:inline">{names.map((x) => x.name).join(", ")}</span>}
          {due.length > 0 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--color-dot-red)]/10 px-2 py-0.5 font-medium text-[var(--color-dot-red)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-dot-red)]" /> {due.length} due
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function Notes() {
  const { notes, loaded } = useApp();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem("nn:view") as "grid" | "list") || "grid");
  const [shown, setShown] = useState(PAGE);
  const folders = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) if (n.folder) m.set(n.folder, (m.get(n.folder) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [notes]);
  const [revealing, setRevealing] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const inFolder = folder ? notes.filter((n) => n.folder === folder) : notes;
    if (!s) return inFolder;
    return inFolder.filter((n) => n.title.toLowerCase().includes(s) || n.folder?.toLowerCase().includes(s) || n.segments.some((x) => x.text.toLowerCase().includes(s)));
  }, [notes, q, folder]);

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

  const pick = (f: string | null) => {
    setFolder(f);
    setShown(PAGE);
  };
  const setMode = (v: "grid" | "list") => {
    setView(v);
    localStorage.setItem("nn:view", v);
  };

  return (
    <div className="flex w-full flex-1 gap-8 px-5 pb-28 pt-4 md:px-8 xl:px-10">
      {/* Classes rail */}
      <aside className="sticky top-16 hidden h-fit w-[210px] shrink-0 lg:block">
        <div className="eyebrow px-3 pb-2">Classes</div>
        {[[null, "All notes", notes.length] as const, ...folders.map(([f, c]) => [f, f, c] as const)].map(([f, label, c]) => (
          <button key={label} onClick={() => pick(f)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[14.5px] transition ${folder === f ? "bg-[var(--bubble)] font-medium text-[var(--fg)]" : "text-[var(--ink-2)] hover:bg-[var(--bubble)]/60"}`}>
            <span className="truncate">{label}</span>
            <span className="text-[12px] tabular-nums text-[var(--mute)]">{c}</span>
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[2rem] font-semibold tracking-tight">{folder ?? "Notetaker"}</h1>
          <StartButton />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4">
            <Search size={16} className="text-[var(--mute)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every word you've recorded" className="flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-[var(--mute)]" />
          </div>
          <div className="flex rounded-xl border border-[var(--line)] bg-[var(--card)] p-1">
            {(["grid", "list"] as const).map((v) => (
              <button key={v} onClick={() => setMode(v)} aria-label={`${v} view`} className={`grid h-8 w-8 place-items-center rounded-lg transition ${view === v ? "bg-[var(--bubble)] text-[var(--fg)]" : "text-[var(--mute)]"}`}>
                {v === "grid" ? <LayoutGrid size={15} /> : <List size={15} />}
              </button>
            ))}
          </div>
        </div>
        {folders.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {[null, ...folders.map(([f]) => f)].map((f) => (
              <button key={f ?? "all"} onClick={() => pick(f)} className={`shrink-0 rounded-full border px-3 py-1 text-[13px] ${folder === f ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--line)] text-[var(--ink-2)]"}`}>
                {f ?? "All"}
              </button>
            ))}
          </div>
        )}
        {!loaded ? (
          <Skeletons />
        ) : filtered.length === 0 ? (
          <Empty searching={!!q} />
        ) : (
          <div className="mt-4">
            {groups.map((g) => (
              <section key={g.label} className="mt-6">
                <div className="eyebrow px-1 pb-2">{g.label}</div>
                {view === "grid" ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {g.items.map((n, i) => <NoteCard key={n.id} n={n} i={i} />)}
                  </div>
                ) : (
                  g.items.map((n, i) => <NoteRow key={n.id} n={n} i={i} />)
                )}
              </section>
            ))}
            <AnimatePresence>{revealing && <Skeletons rows={3} />}</AnimatePresence>
            <div ref={sentinel} className="h-8" />
          </div>
        )}
      </div>
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
