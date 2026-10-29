// Small looping product scenes for the feature cards: what each feature looks
// like in the app, with real UI detail, instead of an icon and a sentence.
// Everything animates with transform and opacity only, so it stays at 60fps.
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { spring } from "../components/ui.tsx";

/** Steps 0..n-1 every `ms` while on screen. Starts moving the moment it's seen. */
export function useLoop(n: number, ms: number, start = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-60px" });
  const [i, setI] = useState(start);
  useEffect(() => {
    if (!inView) return;
    setI((x) => (x + 1) % n);
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [inView, n, ms]);
  return [ref, i] as const;
}

// ---------- shared bits ----------

export const SPEAKERS = {
  R: { n: "Ms. Rivera", i: "R", c: "#1d1d1f" },
  J: { n: "Jordan", i: "J", c: "#4a6890" },
  S: { n: "Sam", i: "S", c: "#7d6d5b" },
  P: { n: "Priya", i: "P", c: "#5d6b62" },
} as const;
type Who = keyof typeof SPEAKERS;

/** A monogram with a little depth, like a contact photo placeholder. */
export function Avatar({ who, size = 26, ring }: { who: Who | "?"; size?: number; ring?: boolean }) {
  const s = who === "?" ? null : SPEAKERS[who];
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: s ? `radial-gradient(circle at 35% 28%, rgb(255 255 255 / 0.28), transparent 60%), ${s.c}` : "#e5e5ea",
        color: s ? "#fff" : "#8e8e93",
        boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 3.5px ${s?.c ?? "#c7c7cc"}` : "inset 0 -1px 2px rgb(0 0 0 / 0.18), 0 1px 2px rgb(0 0 0 / 0.12)",
        transition: "box-shadow .3s",
      }}
    >
      {s ? s.i : "?"}
    </span>
  );
}

/** Live voice bars, animated with scaleY on the compositor. */
export function Bars({ n = 24, height = 22, color = "#1d1d1f", on = true, width = 2.5, gap = 2 }: { n?: number; height?: number; color?: string; on?: boolean; width?: number; gap?: number }) {
  return (
    <span className="inline-flex items-center" style={{ height, gap }}>
      {Array.from({ length: n }, (_, k) => {
        const env = 0.35 + 0.65 * Math.sin(((k + 0.5) / n) * Math.PI);
        const h = Math.max(3, height * env * (0.55 + 0.45 * Math.abs(Math.sin(k * 1.9))));
        return (
          <span
            key={k}
            className={`rounded-full ${on ? "nn-bar" : "nn-bar-off"}`}
            style={{ width, height: h, background: color, ["--d" as string]: `${0.75 + (k % 5) * 0.11}s`, ["--dl" as string]: `${-(k % 7) * 0.13}s`, ["--lo" as string]: 0.25 + (k % 3) * 0.1 }}
          />
        );
      })}
    </span>
  );
}

/** A highlighter stroke that sweeps in behind a phrase. */
export function Mark({ on, children, tone = "#ffe58a" }: { on: boolean; children: ReactNode; tone?: string }) {
  return (
    <span className="relative isolate whitespace-nowrap">
      <motion.span
        aria-hidden
        className="absolute -inset-x-[3px] inset-y-[1px] -z-10 origin-left rounded-[4px]"
        style={{ background: tone }}
        initial={false}
        animate={{ scaleX: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
      />
      {children}
    </span>
  );
}

/** A macOS-style window: grey traffic lights, a centred title, a white body. */
function Window({ title, right, children, innerRef, className = "" }: { title: string; right?: ReactNode; children: ReactNode; innerRef?: React.Ref<HTMLDivElement>; className?: string }) {
  return (
    <div ref={innerRef} className={`relative h-[268px] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#f6f6f8,#ececef)] p-3 shadow-[inset_0_1px_0_white] ${className}`}>
      <div className="flex h-full flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_18px_36px_-22px_rgb(0_0_0/0.35)]">
        <div className="flex h-8 shrink-0 items-center border-b border-black/[0.05] bg-[#fbfbfc] px-3">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((k) => (
              <span key={k} className="h-[9px] w-[9px] rounded-full bg-[#dcdce0] shadow-[inset_0_-1px_0_rgb(0_0_0/0.06)]" />
            ))}
          </span>
          <span className="flex-1 truncate px-3 text-center text-[11.5px] font-semibold text-[#3a3a3c]">{title}</span>
          <span className="min-w-[33px] text-right text-[10.5px] text-[#8e8e93]">{right}</span>
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

const Rec = () => <span className="relative inline-block h-[7px] w-[7px] rounded-full bg-[#ff3b30] shadow-[0_0_0_3px_rgb(255_59_48/0.15)]" />;

// ---------- Every word, written down ----------

const SCRIPT: [Who, string, string][] = [
  ["R", "41:02", "Photosynthesis pulls carbon out of the air and stores it in the plant."],
  ["J", "41:09", "So where does it go after the plant dies?"],
  ["R", "41:12", "Into the soil, and over millions of years some of it into rock, like limestone."],
  ["S", "41:20", "Is limestone going to be on the quiz?"],
  ["R", "41:23", "Yes. Know the long-term sinks for Monday."],
];
const STARTS = SCRIPT.reduce<number[]>((a, l, k) => [...a, k ? a[k - 1] + SCRIPT[k - 1][2].split(" ").length + 4 : 0], []);
const TOTAL = STARTS[STARTS.length - 1] + SCRIPT[SCRIPT.length - 1][2].split(" ").length + 14;

export function TranscriptScene() {
  const [ref, t] = useLoop(TOTAL, 110, 18);
  const lines = SCRIPT.map((l, k) => ({ l, k, shown: Math.min(l[2].split(" ").length, t - STARTS[k]) })).filter((x) => x.shown > 0);
  const visible = lines.slice(-3);
  const secs = 2472 + Math.floor(t / 9);
  return (
    <Window
      innerRef={ref}
      title="Biology · Thursday"
      right={<span className="tabular-nums">{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</span>}
    >
      <div className="flex h-full">
        <div className="hidden w-[148px] shrink-0 flex-col gap-0.5 border-r border-black/[0.05] bg-[#f7f7f9] p-2 text-[11.5px] sm:flex">
          <div className="px-2 pb-1 pt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">Today</div>
          {[
            ["Biology", "Live", true],
            ["Calculus", "52 min", false],
            ["US History", "48 min", false],
            ["English", "Tue", false],
          ].map(([n, d, live]) => (
            <div key={n as string} className={`flex items-center justify-between rounded-[7px] px-2 py-1.5 ${live ? "bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : ""}`}>
              <span className={`truncate ${live ? "font-semibold text-[#1d1d1f]" : "text-[#424245]"}`}>{n}</span>
              <span className="flex items-center gap-1 text-[10px] text-[#8e8e93]">{live && <Rec />}{d}</span>
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-black/[0.04] px-3.5 py-2">
            <span className="flex items-center gap-2 text-[11px] font-medium text-[#3a3a3c]"><Rec /> Recording</span>
            <Bars n={30} height={16} width={2} color="#3a3a3c" />
            <span className="rounded-full bg-[#f2f2f4] px-2 py-0.5 text-[10px] font-medium text-[#6e6e73]">On device · offline</span>
          </div>
          <div className="relative flex flex-1 flex-col justify-end gap-2.5 overflow-hidden px-3.5 pb-3">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white to-transparent" />
            <AnimatePresence initial={false}>
              {visible.map(({ l: [who, at, text], k, shown }) => (
                <motion.div key={k} layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="flex gap-2.5">
                  <span className="w-[30px] shrink-0 pt-[3px] text-[10px] tabular-nums text-[#aeaeb2]">{at}</span>
                  <Avatar who={who} size={22} />
                  <div className="min-w-0 text-[12.5px] leading-[1.45] text-[#1d1d1f]">
                    <span className="mr-1.5 text-[11px] font-semibold" style={{ color: SPEAKERS[who].c }}>{SPEAKERS[who].n}</span>
                    {text.split(" ").slice(0, shown).join(" ")}
                    {shown < text.split(" ").length && <span className="nn-caret ml-0.5 inline-block h-[12px] w-[1.5px] translate-y-[2px] bg-[#1d1d1f]" />}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Window>
  );
}

// ---------- Knows who said what ----------

export function SpeakersScene() {
  const [ref, i] = useLoop(7, 1100, 0);
  const active: Who | "?" = (["R", "J", "S", "?", "P", "P", "R"] as const)[i];
  const rows: (Who | "?")[] = i >= 3 ? ["R", "J", "S", i === 3 ? "?" : "P"] : ["R", "J", "S"];
  const talk: Record<string, number> = { R: 0.72, J: 0.24, S: 0.18, P: 0.12, "?": 0.05 };
  return (
    <Window innerRef={ref} title="Speakers" right="4 voices">
      <div className="flex h-full flex-col gap-1.5 p-3">
        {rows.map((w, k) => {
          const on = active === w;
          return (
            <motion.div
              key={k}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring}
              className={`flex items-center gap-2.5 rounded-[11px] px-2.5 py-[7px] transition-colors duration-300 ${on ? "bg-[#f4f4f6]" : ""}`}
            >
              <Avatar who={w} size={26} ring={on} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1d1d1f]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={w} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
                      {w === "?" ? "New voice" : SPEAKERS[w].n}
                    </motion.span>
                  </AnimatePresence>
                  {w === "?" && <span className="rounded-full bg-[#1d1d1f] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">New</span>}
                  {w === "P" && i === 4 && <span className="truncate text-[10.5px] font-normal text-[#8e8e93]">named from “go ahead, Priya”</span>}
                </div>
                <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[#ececef]">
                  <motion.div className="h-full origin-left rounded-full" style={{ background: w === "?" ? "#c7c7cc" : SPEAKERS[w].c }} initial={{ scaleX: 0 }} animate={{ scaleX: talk[w] }} transition={{ type: "spring", stiffness: 90, damping: 20 }} />
                </div>
              </div>
              <span className="w-[42px] text-right">
                {on ? <Bars n={7} height={14} width={2} color={w === "?" ? "#8e8e93" : SPEAKERS[w].c} /> : <span className="text-[10px] tabular-nums text-[#aeaeb2]">{Math.round(talk[w] * 52)} min</span>}
              </span>
            </motion.div>
          );
        })}
      </div>
    </Window>
  );
}

// ---------- Deadline radar ----------

export function DeadlineScene() {
  const [ref, i] = useLoop(5, 1250, 0);
  return (
    <Window innerRef={ref} title="Biology · Live" right="41:58">
      <div className="space-y-2.5 px-3.5 pt-12 text-[12.5px] leading-[1.5] text-[#1d1d1f]">
        <div className="flex gap-2.5 opacity-55">
          <Avatar who="R" size={20} />
          <span>Okay, before you pack up…</span>
        </div>
        <div className="flex gap-2.5">
          <Avatar who="R" size={20} />
          <span>
            The lab report is <Mark on={i >= 1}>due Friday at 11:59</Mark>, on Canvas.
          </span>
        </div>
      </div>
      <AnimatePresence>
        {i >= 2 && (
          <motion.div
            key="n"
            initial={{ y: -80, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={spring}
            className="absolute inset-x-2.5 top-2 flex items-center gap-2.5 rounded-[14px] bg-white/90 p-2.5 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_16px_32px_-14px_rgb(0_0_0/0.4)]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-[13px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">N</span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-[11.5px] font-semibold"><span>Due Friday, 11:59 PM</span><span className="font-normal text-[#8e8e93]">now</span></div>
              <div className="truncate text-[11px] text-[#424245]">Lab report · Biology · said at 41:56</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {i >= 3 && (
          <motion.div key="c" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={spring} className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-[11px] bg-[#f4f4f6] px-3 py-2 text-[11px]">
            <span className="font-medium text-[#1d1d1f]">Reminder set for Thursday, 7 PM</span>
            <span className="text-[#8e8e93]">Undo</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Window>
  );
}

// ---------- Notes and flashcards ----------

export function NotesScene() {
  const [ref, i] = useLoop(6, 1150, 1);
  const bullets = ["Carbon moves from air to plants, soil and rock", "Limestone stores it for millions of years", "Decomposition releases it back to the air"];
  return (
    <Window innerRef={ref} title="The carbon cycle · Notes" right="3 min">
      <div className="flex h-full gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">Summary</div>
          {bullets.map((b, k) => (
            <motion.div key={b} initial={false} animate={{ opacity: i > k ? 1 : 0.18, x: i > k ? 0 : -6 }} transition={spring} className="mt-1.5 flex gap-2 text-[12px] leading-snug text-[#1d1d1f]">
              <span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full bg-[#1d1d1f]" /> {b}
            </motion.div>
          ))}
          <div className="mt-3 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">Key terms</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {["Carbon sink", "Limestone", "Respiration", "Decomposition"].map((t, k) => (
              <motion.span key={t} initial={false} animate={{ opacity: i > k ? 1 : 0.25, scale: i > k ? 1 : 0.94 }} transition={spring} className="rounded-[7px] bg-[#f2f2f4] px-2 py-1 text-[11px] font-medium text-[#1d1d1f] shadow-[inset_0_-1px_0_rgb(0_0_0/0.05)]">
                {t}
              </motion.span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-[9px] bg-[#fafafa] px-2.5 py-1.5 text-[11px] text-[#424245] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)]">
            <span className="font-semibold text-[#1d1d1f]">Due</span> Lab report · Fri 11:59 PM
          </div>
        </div>
        <div className="hidden w-[42%] shrink-0 flex-col sm:flex">
          <div className="relative flex-1 [perspective:700px]">
            <div className="absolute inset-x-3 top-2 bottom-0 rounded-[14px] bg-[#e9e9ec]" />
            <div className="absolute inset-x-1.5 top-1 bottom-1 rounded-[14px] bg-[#f1f1f3]" />
            <motion.div animate={{ rotateY: i % 2 ? 180 : 0 }} transition={{ type: "spring", stiffness: 110, damping: 17 }} className="absolute inset-x-0 top-0 bottom-2 [transform-style:preserve-3d]">
              <div className="absolute inset-0 flex flex-col justify-between rounded-[14px] bg-[linear-gradient(180deg,#2c2c2e,#1d1d1f)] p-3 text-white shadow-[0_14px_28px_-14px_rgb(0_0_0/0.6)] [backface-visibility:hidden]">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-white/50">Question</span>
                <span className="text-[13.5px] font-semibold leading-snug">Where is carbon stored the longest?</span>
                <span className="text-[10px] text-white/45">Tap to flip</span>
              </div>
              <div className="absolute inset-0 flex flex-col justify-between rounded-[14px] bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_14px_28px_-14px_rgb(0_0_0/0.35)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">Answer</span>
                <span className="text-[13.5px] font-semibold leading-snug text-[#1d1d1f]">In rock, like limestone, for millions of years.</span>
                <span className="text-[10px] text-[#8e8e93]">From 41:12 in class</span>
              </div>
            </motion.div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[10px] tabular-nums text-[#8e8e93]">
            <span>Card {3 + Math.floor(i / 2)} of 12</span>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#ececef]">
              <motion.span className="block h-full origin-left rounded-full bg-[#1d1d1f]" animate={{ scaleX: (3 + Math.floor(i / 2)) / 12 }} transition={spring} />
            </span>
          </div>
        </div>
      </div>
    </Window>
  );
}

// ---------- Straight to your calendar ----------

export function CalendarScene() {
  const [ref, i] = useLoop(4, 1300, 0);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <Window innerRef={ref} title="Calendar" right="Week 43">
      <div className="flex h-full flex-col p-3">
        <div className="text-[13px] font-bold tracking-tight text-[#1d1d1f]">October <span className="font-normal text-[#8e8e93]">2026</span></div>
        <div className="mt-2 grid flex-1 grid-cols-5 gap-1">
          {days.map((d, k) => (
            <div key={k} className="flex flex-col">
              <div className="text-center text-[9.5px] font-medium text-[#8e8e93]">{d}</div>
              <div className={`mx-auto mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[10.5px] tabular-nums ${k === 3 ? "bg-[#1d1d1f] font-semibold text-white" : "text-[#1d1d1f]"}`}>{19 + k}</div>
              <div className="relative mt-1 flex-1 space-y-1 rounded-[7px] bg-[#f6f6f8] p-1">
                {k === 1 && <div className="rounded-[5px] border-l-2 border-[#4a6890] bg-[#4a6890]/10 px-1 py-0.5 text-[8.5px] font-medium text-[#2c3e57]">Calc quiz</div>}
                {k === 2 && <div className="rounded-[5px] border-l-2 border-[#7d6d5b] bg-[#7d6d5b]/10 px-1 py-0.5 text-[8.5px] font-medium text-[#4a3f33]">Essay draft</div>}
                <AnimatePresence>
                  {k === 4 && i > 0 && (
                    <motion.div key="lab" initial={{ y: -60, opacity: 0, scale: 0.85 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 240, damping: 16 }} className="rounded-[5px] bg-[#1d1d1f] px-1 py-0.5 text-[8.5px] font-semibold leading-tight text-white shadow-[0_6px_12px_-6px_rgb(0_0_0/0.5)]">
                      Lab report
                      <div className="font-normal text-white/60">11:59 PM</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
        <AnimatePresence>
          {i >= 2 && (
            <motion.div key="t" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={spring} className="absolute inset-x-3 bottom-3 rounded-[10px] bg-white/95 px-2.5 py-1.5 text-[10.5px] text-[#424245] shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_10px_20px_-10px_rgb(0_0_0/0.35)]">
              <span className="font-semibold text-[#1d1d1f]">Added from Biology</span> · heard at 41:56
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Window>
  );
}

// ---------- Ask your notes ----------

export function AskScene() {
  const [ref, i] = useLoop(6, 1200, 0);
  return (
    <Window innerRef={ref} title="Ask your notes" right="All classes">
      <div className="flex h-full flex-col p-3.5">
        <div className="flex flex-1 flex-col justify-end gap-2">
          <div className="flex justify-end">
            <div className="rounded-[16px] rounded-br-[5px] bg-[#1d1d1f] px-3 py-1.5 text-[12.5px] text-white">What's on Monday's quiz?</div>
          </div>
          <AnimatePresence mode="wait">
            {i === 1 && (
              <motion.div key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-12 gap-1 rounded-[16px] rounded-bl-[5px] bg-[#f2f2f4] px-3 py-2.5">
                {[0, 1, 2].map((k) => (
                  <motion.span key={k} className="h-1.5 w-1.5 rounded-full bg-[#8e8e93]" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: k * 0.12 }} />
                ))}
              </motion.div>
            )}
            {i >= 2 && (
              <motion.div key="a" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="max-w-[92%] space-y-2 rounded-[16px] rounded-bl-[5px] bg-[#f2f2f4] p-2.5 text-[12.5px] leading-snug text-[#1d1d1f]">
                <div>
                  <b>Units 7 and 8</b>, mostly long-term carbon sinks. Ms. Rivera also said the nitrogen cycle will be on it.
                </div>
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: i >= 3 ? 1 : 0, y: i >= 3 ? 0 : 6 }} transition={spring} className="flex items-center gap-2 rounded-[11px] bg-white px-2 py-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1d1d1f]">
                    <span className="ml-[2px] h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold">“the nitrogen cycle will be on it”</span>
                    <span className="block text-[10px] text-[#8e8e93]">Biology · Tue 10:42</span>
                  </span>
                  <Bars n={12} height={12} width={1.5} gap={1.5} color="#aeaeb2" on={i >= 4} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-2.5 flex items-center justify-between rounded-full bg-[#f6f6f8] py-1.5 pl-3.5 pr-1.5 text-[11.5px] text-[#aeaeb2] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)]">
          Ask anything about your classes
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1d1d1f] text-[11px] font-bold text-white">↑</span>
        </div>
      </div>
    </Window>
  );
}
