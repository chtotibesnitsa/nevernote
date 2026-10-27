import { insights, type Device } from "@nevernote/core";
import { Laptop, Monitor, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Card, spring } from "../components/ui.tsx";
import { GuestInsights } from "./GuestUnlock.tsx";
import { useApp } from "./state.tsx";

// Sequential ramp for the streak grid: light grey -> graphite.
const RAMP = ["var(--line)", "#c7c7cc", "#8e8e93", "#4a4a4f", "#1d1d1f"];

export function Insights() {
  const { notes, tier } = useApp();
  const s = useMemo(() => insights(notes), [notes]);
  const [tip, setTip] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - 7 * 19);
    const cols: { key: string; d: Date; m: number }[][] = [];
    for (let w = 0; w < 20; w++) {
      const col = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + w * 7 + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        col.push({ key, d, m: d > today ? -1 : (s.heatmap[key] ?? 0) });
      }
      cols.push(col);
    }
    return cols;
  }, [s.heatmap]);
  const level = (m: number) => (m <= 0 ? 0 : m < 20 ? 1 : m < 50 ? 2 : m < 90 ? 3 : 4);

  const devices: { d: Device[]; label: string; icon: typeof Laptop }[] = [
    { d: ["mac", "windows", "linux"], label: "Desktop", icon: Laptop },
    { d: ["ios", "android"], label: "Phone", icon: Smartphone },
    { d: ["web"], label: "Web", icon: Monitor },
  ];
  const devWords = devices.map((x) => ({ ...x, w: x.d.reduce((a, k) => a + (s.byDevice[k] ?? 0), 0) }));
  const totalDev = devWords.reduce((a, x) => a + x.w, 0) || 1;
  const maxFolder = Math.max(1, ...s.byFolder.map((f) => f.minutes));

  return (
    <div className="w-full px-5 pb-28 pt-4 md:px-8 xl:px-10">
      <h1 className="title-serif text-[2.2rem] leading-tight">Insights</h1>
      {tier === "guest" ? (
        <GuestInsights hours={s.totalHours} words={s.totalWords} />
      ) : (
        <>
      <div className={`mt-6 grid gap-4 md:grid-cols-3`}>
        <Card className="p-6">
          <Big n={s.wpm} />
          <div className="eyebrow mt-1">words per minute in class</div>
          <Gauge value={Math.min(1, s.wpm / 200)} />
          <p className="mt-1 text-center text-xs text-[var(--mute)]">Lectures usually run 110–160 wpm</p>
        </Card>
        <Card className="p-6">
          <Big n={s.deadlinesCaught} />
          <div className="eyebrow mt-1">due dates & tests caught</div>
          <div className="mt-5 space-y-2 border-t border-[var(--line)] pt-4 text-[15px] text-[var(--ink-2)]">
            <div className="flex justify-between">
              <span>Speakers told apart</span>
              <span className="tabular-nums text-[var(--fg)]">{s.speakersHeard}</span>
            </div>
            <div className="flex justify-between">
              <span>Classes recorded</span>
              <span className="tabular-nums text-[var(--fg)]">{s.notes}</span>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <Big n={s.totalWords} />
          <div className="eyebrow mt-1">total words captured</div>
          <p className="mt-5 border-t border-[var(--line)] pt-4 text-[15px]">{s.books > 0 ? `That's ${s.books} full book${s.books > 1 ? "s" : ""} of class.` : `${(s.totalWords / 900).toFixed(0)}% of the way to your first book.`}</p>
          <div className="mt-3 flex h-7 overflow-hidden rounded-lg">
            {devWords
              .filter((x) => x.w > 0)
              .map((x, i) => (
                <motion.div
                  key={x.label}
                  initial={{ width: 0 }}
                  animate={{ width: `${(x.w / totalDev) * 100}%` }}
                  transition={{ ...spring, delay: i * 0.08 }}
                  className="flex min-w-[2.2rem] items-center gap-1 px-2 text-xs text-white"
                  style={{ background: ["#1d1d1f", "#4a4a4f", "#8e8e93"][i] }}
                >
                  <x.icon size={12} /> {x.w / totalDev > 0.18 && x.label}
                </motion.div>
              ))}
            {totalDev === 1 && <div className="flex-1 bg-[var(--line)]" />}
          </div>
        </Card>
      </div>

      <div className={`mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]`}>
        <Card className="p-6">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-semibold">{s.streak} day streak</div>
            <div className="eyebrow">Longest | {s.longestStreak} days</div>
          </div>
          <p className="mt-1 text-xs text-[var(--mute)]">Weekends never break a streak.</p>
          <div className="relative mt-5 flex gap-[5px] overflow-x-auto pb-1" onMouseLeave={() => setTip(null)}>
            {weeks.map((col, w) => (
              <div key={w} className="flex flex-col gap-[5px]">
                {col.map((c) => (
                  <motion.div
                    key={c.key}
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: c.m < 0 ? 0.25 : 1 }}
                    transition={{ ...spring, delay: w * 0.015 }}
                    onMouseEnter={() => setTip(`${c.d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${Math.round(Math.max(0, c.m))} min`)}
                    className="h-[15px] w-[15px] rounded-[4px]"
                    style={{ background: RAMP[level(c.m)] }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[var(--mute)]">
            <span>{tip ?? " "}</span>
            <span className="flex items-center gap-1">
              Less {RAMP.map((c) => <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />)} More
            </span>
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-2xl font-semibold">By class</div>
          <div className="mt-4 space-y-3">
            {s.byFolder.length === 0 && <p className="text-sm text-[var(--mute)]">Put notes in folders (APES, Chem…) to see time per class.</p>}
            {s.byFolder.slice(0, 7).map((f, i) => (
              <div key={f.folder}>
                <div className="flex justify-between text-sm">
                  <span>{f.folder}</span>
                  <span className="tabular-nums text-[var(--mute)]">{(f.minutes / 60).toFixed(1)} h</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                  <motion.div className="h-full rounded-full bg-[var(--fg)]" initial={{ width: 0 }} animate={{ width: `${(f.minutes / maxFolder) * 100}%` }} transition={{ ...spring, delay: i * 0.05 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}

function Big({ n }: { n: number }) {
  return <div className="title-serif text-[2.8rem] leading-none tabular-nums">{n.toLocaleString()}</div>;
}

function Gauge({ value }: { value: number }) {
  const r = 70;
  const c = Math.PI * r;
  return (
    <svg viewBox="0 0 180 100" className="mx-auto mt-4 w-44">
      <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="var(--line)" strokeWidth="16" strokeLinecap="round" />
      <motion.path
        d="M20 90 A70 70 0 0 1 160 90"
        fill="none"
        stroke="var(--fg)"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - value) }}
        transition={{ type: "spring", stiffness: 60, damping: 18 }}
      />
    </svg>
  );
}
