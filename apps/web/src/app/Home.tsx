import { insights } from "@nevernote/core";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, spring } from "../components/ui.tsx";
import { NoteRow, StartButton } from "./Notes.tsx";
import { useApp } from "./state.tsx";

function compact(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
}

export function Home() {
  const { notes, settings, session } = useApp();
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
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-28 pt-4 md:px-10">
      <h1 className="text-[2rem] font-semibold tracking-tight">
        {hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}
        {name ? `, ${name}` : ""}
      </h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="relative overflow-hidden rounded-[26px] border-2 border-[#1c1915] bg-[#ffd27a] p-8 text-[#1c1915] shadow-[6px_6px_0_#1c1915] md:p-10">
          {/* voice ripples, like the front page */}
          {[0, 1, 2].map((i) => (
            <span key={i} className="nn-ripple pointer-events-none absolute -right-24 top-[calc(50%-260px)] h-[520px] w-[520px] rounded-full border-[6px] border-[#ff8a1f]/60" style={{ animationDelay: `${i * 1.05}s` }} />
          ))}
          <div className="relative">
            <div className="title-serif text-[2.2rem] leading-[1.02] md:text-[2.8rem]">
              Never miss <span className="text-[#e85d00]">a word.</span>
            </div>
            <p className="mt-2 max-w-md text-[15px] font-medium text-[#4a3a22]">Start it when class begins. Every word and every speaker, transcribed on this device. Notes and due dates when you're done.</p>
            <StartButton className="mt-6" />
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcoming.map(({ e, n }, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: i * 0.05 }}>
                <Link to={`/app/note/${n.id}`} className="glass block w-56 shrink-0 rounded-2xl p-4">
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
        <div className="mt-2">
          {notes.slice(0, 6).map((n, i) => (
            <NoteRow key={n.id} n={n} i={i} />
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
