// Insights for a guest: only the two totals are real. Everything else is a
// blurred preview with sample numbers, so nothing personal shows before sign-up.
import { animate, motion, useInView } from "motion/react";
import { Lock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { spring } from "../components/ui.tsx";
import { GoogleMark, upgradeGuest } from "./AuthGate.tsx";

// Muted, never neon: graphite, slate, sage, taupe and the highlighter yellow.
const CARD = "rounded-[28px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_1px_2px_rgb(0_0_0/0.04),0_24px_48px_-28px_rgb(0_0_0/0.22)]";
const C = ["#1d1d1f", "#4a6890", "#5d6b62", "#7d6d5b", "#e8c547"];

function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [to]);
  return <>{v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

export function SignUpButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <button onClick={() => void upgradeGuest()} className="press inline-flex items-center justify-center gap-3 rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] py-3.5 pl-2 pr-6 text-[15px] font-bold text-white">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
        <GoogleMark />
      </span>
      {label}
    </button>
  );
}

export function GuestInsights({ hours, words }: { hours: number; words: number }) {
  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { n: hours, d: 1, label: "hours of class" },
          { n: words, d: 0, label: "words captured" },
        ].map((x, i) => (
          <motion.div key={x.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.08 }} className={`${CARD} relative overflow-hidden p-7`}>
            <div className="text-[3.4rem] font-bold leading-none tracking-[-0.04em] tabular-nums">
              <CountUp to={x.n} decimals={x.d} />
            </div>
            <div className="mt-2 text-[15px] font-semibold text-[#6e6e73]">{x.label}</div>
            <MiniBars seed={i} className="absolute bottom-0 right-6 h-20 opacity-90" />
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }} className={`${CARD} flex flex-col gap-6 p-7 md:flex-row md:items-center md:justify-between`}>
        <div className="max-w-xl">
          <div className="text-[1.6rem] font-bold leading-tight tracking-[-0.03em]">
            There's a lot more here. <span className="text-[#6e6e73]">Free with an account.</span>
          </div>
          <p className="mt-2 text-[15px] text-[#6e6e73]">Your streak, every due date caught, how fast each class talks and time per subject. Everything you recorded as a guest comes with you.</p>
        </div>
        <SignUpButton label="Unlock my insights" />
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <Locked title="Streak" sub="Days in class, weekends never break it" delay={0}>
          <Heat />
        </Locked>
        <Locked title="Time per subject" sub="Where your hours go" delay={0.06}>
          <SubjectBars />
        </Locked>
        <Locked title="Due dates caught" sub="Tests, quizzes and homework" delay={0}>
          <Donut />
        </Locked>
        <Locked title="How fast class talks" sub="Words per minute, week by week" delay={0.06}>
          <Line />
        </Locked>
      </div>

      <div className="flex justify-center pt-4">
        <SignUpButton label="Sign up free to see all of it" />
      </div>
    </div>
  );
}

/** A chart card that fades in as it scrolls into view, blurred behind a lock. */
function Locked({ title, sub, delay, children }: { title: string; sub: string; delay: number; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ ...spring, delay }} className={`${CARD} relative overflow-hidden p-6`}>
      <div className="text-[1.25rem] font-bold tracking-[-0.02em]">{title}</div>
      <div className="text-[13.5px] text-[#6e6e73]">{sub}</div>
      <div className="pointer-events-none mt-5 h-44 select-none blur-[5px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-x-0 bottom-0 top-16 grid place-items-center">
        <button onClick={() => void upgradeGuest()} className="press-light inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-bold">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1d1d1f] text-white">
            <Lock size={12} strokeWidth={2.8} />
          </span>
          Free account
        </button>
      </div>
    </motion.div>
  );
}

function useSeen() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-40px" });
  return [ref, seen] as const;
}

function MiniBars({ seed, className = "" }: { seed: number; className?: string }) {
  const hs = seed ? [30, 52, 40, 70, 58, 88] : [45, 30, 62, 50, 78, 66];
  return (
    <div className={`flex items-end gap-1.5 ${className}`} aria-hidden>
      {hs.map((h, i) => (
        <motion.span
          key={i}
          className="w-3 rounded-t-[5px]"
          style={{ background: C[(i + seed) % C.length] }}
          initial={{ height: 0 }}
          animate={{ height: [`${h}%`, `${Math.max(18, h - 22)}%`, `${h}%`] }}
          transition={{ duration: 2.6, delay: 0.3 + i * 0.07, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function Heat() {
  const [ref, seen] = useSeen();
  return (
    <div ref={ref} className="grid h-full grid-flow-col grid-rows-7 gap-[5px]">
      {Array.from({ length: 7 * 18 }, (_, i) => {
        const v = (Math.sin(i * 1.7) + Math.cos(i * 0.6) + 2) / 4;
        const c = v > 0.75 ? C[0] : v > 0.55 ? C[1] : v > 0.4 ? C[2] : v > 0.28 ? C[4] : "#ececf0";
        return <motion.span key={i} className="rounded-[4px]" style={{ background: c }} initial={{ scale: 0 }} animate={seen ? { scale: 1 } : {}} transition={{ ...spring, delay: (i % 18) * 0.025 }} />;
      })}
    </div>
  );
}

function SubjectBars() {
  const [ref, seen] = useSeen();
  const rows: [string, number][] = [["Biology", 92], ["History", 74], ["Chemistry", 61], ["English", 45], ["Calculus", 33]];
  return (
    <div ref={ref} className="flex h-full flex-col justify-between">
      {rows.map(([s, w], i) => (
        <div key={s} className="flex items-center gap-3">
          <span className="w-20 text-[13px] font-semibold">{s}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-[#ececf0]">
            <motion.div className="h-full rounded-full" style={{ background: C[i] }} initial={{ width: 0 }} animate={seen ? { width: `${w}%` } : {}} transition={{ ...spring, delay: i * 0.08 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut() {
  const [ref, seen] = useSeen();
  const parts = [0.42, 0.28, 0.18, 0.12];
  const r = 54;
  const len = 2 * Math.PI * r;
  let at = 0;
  return (
    <div ref={ref} className="flex h-full items-center justify-center gap-8">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        {parts.map((p, i) => {
          const off = at;
          at += p;
          return (
            <motion.circle key={i} cx="70" cy="70" r={r} fill="none" stroke={C[i]} strokeWidth="22" strokeDasharray={`${p * len - 3} ${len}`} initial={{ strokeDashoffset: len }} animate={seen ? { strokeDashoffset: -off * len } : {}} transition={{ ...spring, delay: i * 0.12 }} />
          );
        })}
      </svg>
      <div className="space-y-2 text-[13px] font-semibold">
        {["Tests", "Homework", "Quizzes", "Projects"].map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[4px]" style={{ background: C[i] }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Line() {
  const [ref, seen] = useSeen();
  const pts = [120, 132, 118, 141, 150, 138, 156, 149, 163];
  const x = (i: number) => 10 + i * (300 / (pts.length - 1));
  const y = (v: number) => 150 - (v - 100) * 2;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  return (
    <div ref={ref} className="h-full">
      <svg viewBox="0 0 320 160" className="h-full w-full">
        <motion.path d={`${d} L${x(pts.length - 1)} 160 L10 160 Z`} fill={C[4]} initial={{ opacity: 0 }} animate={seen ? { opacity: 0.35 } : {}} transition={{ duration: 0.8, delay: 0.5 }} />
        <motion.path d={d} fill="none" stroke={C[1]} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={seen ? { pathLength: 1 } : {}} transition={{ duration: 1.2, ease: "easeOut" }} />
        {pts.map((v, i) => (
          <motion.circle key={i} cx={x(i)} cy={y(v)} r="6" fill="#fff" stroke={C[0]} strokeWidth="3" initial={{ scale: 0 }} animate={seen ? { scale: 1 } : {}} transition={{ ...spring, delay: 0.2 + i * 0.1 }} />
        ))}
      </svg>
    </div>
  );
}

/** On a guest's class: the notes are ready to write, behind one Google button. */
export function NotesTeaser({ lines }: { lines: string[] }) {
  const sample = lines.length ? lines : ["The teacher went over today's main ideas", "Key terms and what they mean", "What's due and when"];
  const sections: [string, string[]][] = [
    ["Main ideas", sample.slice(0, 3)],
    ["Key terms", sample.slice(3, 5).length ? sample.slice(3, 5) : sample.slice(0, 2)],
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className={`${CARD} relative overflow-hidden`}>
      <div className="pointer-events-none select-none space-y-5 p-7 pb-40 blur-[4px]" aria-hidden>
        {sections.map(([h, ls], si) => (
          <div key={h}>
            <div className="text-[1.15rem] font-bold">{h}</div>
            <ul className="mt-2 space-y-1.5">
              {ls.map((l, i) => (
                <motion.li key={i} className="flex gap-2 text-[15px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + (si * 3 + i) * 0.08 }}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1d1d1f]" />
                  {si === 0 && i === 0 ? <mark className="rounded bg-[#ffe58a] px-1">{l}</mark> : l}
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-end bg-[linear-gradient(180deg,rgb(255_255_255/0)_0%,rgb(255_255_255/0.85)_38%,#fff_62%)] px-6 pb-8 text-center">
        <motion.span className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-3 py-1 text-[12.5px] font-bold text-white" animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2.2, repeat: Infinity }}>
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffe58a]" /> Your notes are ready to write
        </motion.span>
        <div className="mt-3 text-[1.7rem] font-bold leading-tight tracking-[-0.035em]">
          One tap away. <span className="text-[#6e6e73]">Free.</span>
        </div>
        <p className="mt-1.5 max-w-md text-[14.5px] text-[#6e6e73]">Sign up and NoteLater writes the notes, study guide and key terms for this class right away. Your recordings come with you.</p>
        <div className="mt-5">
          <SignUpButton label="Write my notes" />
        </div>
      </div>
    </motion.div>
  );
}
