import { insights } from "@nevernote/core";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, spring, StatusDot } from "../components/ui.tsx";
import { isDesktop } from "../lib/bridge.ts";
import { NoteCard, StartButton } from "./Notes.tsx";
import { useApp } from "./state.tsx";

function compact(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
}

export function Home() {
  const { notes, settings, session, asr, retryAsr } = useApp();
  const stats = useMemo(() => insights(notes), [notes]);
  const name = settings.name || session?.user.user_metadata?.full_name?.split(" ")[0] || "";
  const upcoming = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return notes
      .flatMap((n) => n.extractions.filter((e) => e.when && e.when.slice(0, 10) >= now && e.kind !== "important").map((e) => ({ e, n })))
      .sort((a, b) => a.e.when!.localeCompare(b.e.when!))
      .slice(0, 5);
  }, [notes]);
  const hour = new Date().getHours();

  return (
    <div className="w-full px-5 pb-28 pt-4 md:px-8 xl:px-10">
      <h1 className="text-[2rem] font-semibold tracking-tight">
        {hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}
        {name ? `, ${name}` : ""}
      </h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="relative overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--card)] p-7 md:p-9">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="title-serif text-[2.2rem] leading-[1.05] md:text-[2.6rem]">
                Never miss <em>a word.</em>
              </div>
              <p className="mt-2 max-w-md text-[15px] text-[var(--ink-2)]">Start it when class begins. Every word and every speaker, transcribed on this device. Notes and due dates when you're done.</p>
              <StartButton className="mt-6" />
            </div>
            <div className="grid shrink-0 gap-2 text-[14px] text-[var(--ink-2)] sm:grid-cols-3 xl:grid-cols-1">
              {!isDesktop && (
                <span className="flex items-center gap-2.5 rounded-xl bg-[var(--bubble)] px-3.5 py-2.5">
                  <StatusDot dot={asr.state === "ready" ? "green" : asr.state === "error" ? "red" : "orange"} live={asr.state === "loading"} />
                  {asr.state === "ready" ? "Transcriber ready" : asr.state === "error" ? (
                    <button onClick={retryAsr} className="underline">Transcriber failed · retry</button>
                  ) : `Getting transcriber ready${asr.p ? ` · ${Math.round(asr.p * 100)}%` : ""}`}
                </span>
              )}
              <span className="flex items-center gap-2.5 rounded-xl bg-[var(--bubble)] px-3.5 py-2.5"><StatusDot dot="green" /> Works offline</span>
              <span className="flex items-center gap-2.5 rounded-xl bg-[var(--bubble)] px-3.5 py-2.5"><StatusDot dot="green" /> Speakers and due dates</span>
            </div>
          </div>
        </motion.div>
        <Card className="p-6">
          <div className="space-y-4">
            <Stat big={compact(stats.totalWords)} label="words captured" />
            <Stat big={stats.totalHours.toFixed(1)} label="hours of class" />
            <Stat big={String(stats.streak)} label={`day streak${stats.longestStreak > stats.streak ? ` · best ${stats.longestStreak}` : ""}`} />
          </div>
          <Link to="/app/insights" className="mt-5 block border-t border-[var(--line)] pt-4 text-sm text-[var(--ink-2)] hover:text-[var(--fg)]">
            All insights →
          </Link>
        </Card>
      </div>

      {upcoming.length > 0 && (
        <section className="mt-10">
          <div className="eyebrow mb-3">Coming up</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {upcoming.map(({ e, n }, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: i * 0.05 }}>
                <Link to={`/app/note/${n.id}`} className="block h-full rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 transition hover:-translate-y-0.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-dot-red)]">
                    {new Date(e.when!).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div className="mt-1 font-medium leading-snug">{e.title}</div>
                  <div className="mt-1 truncate text-xs text-[var(--mute)]">{n.folder ?? n.title}</div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Recent</div>
          <Link to="/app/notes" className="text-sm text-[var(--ink-2)] hover:text-[var(--fg)]">
            All notes →
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notes.slice(0, 6).map((n, i) => (
            <NoteCard key={n.id} n={n} i={i} />
          ))}
          {notes.length === 0 && <p className="px-3 py-6 text-[15px] text-[var(--mute)]">Your classes will show up here.</p>}
        </div>
      </section>
    </div>
  );
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="title-serif text-[2.4rem] leading-none">{big}</span>
      <span className="text-[15px] text-[var(--ink-2)]">{label}</span>
    </div>
  );
}
