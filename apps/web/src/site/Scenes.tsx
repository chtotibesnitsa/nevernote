// Small looping product scenes for the feature cards: what each feature looks
// like in use, in iMessage and macOS dress, instead of an icon and a sentence.
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { spring } from "../components/ui.tsx";

/** Steps 0..n-1 every `ms` while on screen. */
export function useLoop(n: number, ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-60px" });
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [inView, n, ms]);
  return [ref, i] as const;
}

/** macOS / iOS style app icon: a squircle with depth, not a thin outline. */
export function AppIcon({ icon: Icon, from, to, size = 48 }: { icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; from: string; to: string; size?: number }) {
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(160deg, ${from}, ${to})`,
        boxShadow: `0 1px 0 rgb(255 255 255 / 0.55) inset, 0 -2px 6px rgb(0 0 0 / 0.12) inset, 0 8px 18px -8px ${to}`,
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
      <Icon size={size * 0.5} strokeWidth={2.2} className="relative text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]" />
    </span>
  );
}

function Stage({ children, tint = "from-[#fff6ec] to-[#f6ece0]", innerRef }: { children: ReactNode; tint?: string; innerRef: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={innerRef} data-tint={tint} className="relative h-[220px] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#f7f7f9,#ededf0)] shadow-[inset_0_1px_0_white]">
      {children}
    </div>
  );
}

const Bubble = ({ me, children, color }: { me?: boolean; children: ReactNode; color?: string }) => (
  <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[85%] rounded-[18px] px-3.5 py-2 text-[13.5px] leading-snug ${me ? "rounded-br-[6px] bg-[#0a84ff] text-white" : "rounded-bl-[6px] bg-white text-[#1c1915] shadow-[0_1px_2px_rgb(0_0_0/0.06)]"}`}>
      {color && <div className="mb-0.5 text-[11px] font-semibold" style={{ color }}>{color === "#c8794a" ? "Ms. Rivera" : color === "#3f7fbf" ? "Jordan" : "Sam"}</div>}
      {children}
    </div>
  </div>
);

const LINES: [string, string][] = [
  ["#c8794a", "Photosynthesis pulls carbon out of the air."],
  ["#3f7fbf", "Where does it go after the plant dies?"],
  ["#c8794a", "Into the soil, and some of it into rock."],
  ["#8a5cc2", "Can we use notes on the quiz?"],
];

export function TranscriptScene() {
  const [ref, i] = useLoop(LINES.length + 2, 1300);
  return (
    <Stage innerRef={ref}>
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {LINES.slice(0, Math.min(i + 1, LINES.length)).map(([c, t], k) => (
            <motion.div key={k} layout initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}>
              <Bubble color={c}>{t}</Bubble>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#16120e] px-3 py-1.5 text-[11px] font-medium text-white shadow-lg">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff453a]" /> 12:41 · offline
      </div>
    </Stage>
  );
}

const PEOPLE = [
  { n: "Ms. Rivera", c: "#c8794a", e: "👩🏽‍🏫" },
  { n: "Jordan", c: "#3f7fbf", e: "🧑🏻" },
  { n: "Sam", c: "#8a5cc2", e: "👩🏼‍🦱" },
];

export function SpeakersScene() {
  const [ref, i] = useLoop(PEOPLE.length, 1400);
  return (
    <Stage innerRef={ref} tint="from-[#f4f6ff] to-[#eef0fa]">
      <div className="absolute inset-0 flex items-center justify-center gap-5">
        {PEOPLE.map((p, k) => (
          <div key={p.n} className="flex flex-col items-center gap-2">
            <motion.div
              animate={{ scale: i === k ? 1.12 : 0.94, boxShadow: i === k ? `0 0 0 4px ${p.c}, 0 14px 30px -10px ${p.c}` : "0 0 0 0px transparent, 0 6px 16px -8px rgb(0 0 0 / 0.25)" }}
              transition={spring}
              className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-b from-white to-[#e9e9ef] text-3xl"
            >
              {p.e}
            </motion.div>
            <motion.span animate={{ opacity: i === k ? 1 : 0.55 }} className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: p.c }}>
              {p.n}
            </motion.span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <div className="flex items-end gap-[3px]">
          {Array.from({ length: 22 }, (_, k) => (
            <motion.span key={k} className="w-[3px] rounded-full" style={{ background: PEOPLE[i].c }} animate={{ height: [6, 8 + ((k * 7) % 18), 6] }} transition={{ duration: 0.8, repeat: Infinity, delay: k * 0.04 }} />
          ))}
        </div>
      </div>
    </Stage>
  );
}

export function DeadlineScene() {
  const [ref, i] = useLoop(3, 1600);
  return (
    <Stage innerRef={ref} tint="from-[#fff1ec] to-[#fbe5dc]">
      <div className="absolute inset-x-5 top-14 space-y-2 opacity-60 blur-[1px]">
        <Bubble color="#c8794a">Okay, before you pack up…</Bubble>
        <Bubble color="#c8794a">The lab report is due Friday at 11:59.</Bubble>
      </div>
      <AnimatePresence>
        {i > 0 && (
          <motion.div
            key="n"
            initial={{ y: -90, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -90, opacity: 0 }}
            transition={spring}
            className="absolute inset-x-3 top-3 flex items-center gap-3 rounded-[18px] border border-white/80 bg-white/75 p-3 shadow-[0_18px_40px_-16px_rgb(60_40_20/0.45)] backdrop-blur-xl"
          >
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-b from-[#2a241e] to-[#16120e] font-serif text-lg text-white">N</span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-[12px] font-semibold"><span>Due Friday</span><span className="font-normal text-[#8a8076]">now</span></div>
              <div className="truncate text-[12.5px] text-[#4a433b]">Lab report · 11:59 PM · APES</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Stage>
  );
}

export function NotesScene() {
  const [ref, i] = useLoop(4, 1500);
  const bullets = ["Carbon moves air → plants → soil → rock", "Limestone stores it for millions of years", "Lab report due Fri 11:59 PM"];
  return (
    <Stage innerRef={ref} tint="from-[#f3faf4] to-[#e6f3e8]">
      <div className="absolute left-4 top-4 w-[62%] rounded-[16px] bg-white p-3.5 shadow-[0_12px_30px_-14px_rgb(0_0_0/0.3)]">
        <div className="text-[16px] font-semibold tracking-tight">Carbon cycle</div>
        {bullets.map((b, k) => (
          <motion.div key={b} initial={false} animate={{ opacity: i > k ? 1 : 0.15, x: i > k ? 0 : -6 }} transition={spring} className="mt-1.5 flex gap-1.5 text-[11.5px] leading-snug text-[#4a433b]">
            <span className="text-[#aeaeb2]">●</span> {b}
          </motion.div>
        ))}
      </div>
      <div className="absolute bottom-5 right-4 h-[110px] w-[44%] [perspective:600px]">
        <motion.div animate={{ rotateY: i % 2 ? 180 : 0 }} transition={{ type: "spring", stiffness: 120, damping: 16 }} className="relative h-full w-full [transform-style:preserve-3d]">
          <div className="absolute inset-0 grid place-items-center rounded-[16px] bg-gradient-to-b from-[#3a3a3c] to-[#1d1d1f] p-3 text-center text-[12.5px] font-medium text-white shadow-lg [backface-visibility:hidden]">Where is carbon stored longest?</div>
          <div className="absolute inset-0 grid place-items-center rounded-[16px] bg-white p-3 text-center text-[12.5px] font-medium shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">In rock, like limestone.</div>
        </motion.div>
      </div>
    </Stage>
  );
}

export function CalendarScene() {
  const [ref, i] = useLoop(3, 1500);
  const days = ["M", "T", "W", "T", "F"];
  return (
    <Stage innerRef={ref} tint="from-[#fff4f4] to-[#fde8e8]">
      <div className="absolute inset-4 rounded-[18px] bg-white p-3 shadow-[0_12px_30px_-14px_rgb(0_0_0/0.3)]">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-[#ff3b30]">October</span>
          <span className="text-[11px] text-[#8a8076]">Week 43</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {days.map((d, k) => (
            <div key={k} className="text-center">
              <div className="text-[10px] text-[#8a8076]">{d}</div>
              <div className={`mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full text-[12px] ${k === 4 ? "bg-[#ff3b30] font-semibold text-white" : ""}`}>{20 + k}</div>
              <div className="mt-1.5 h-[86px] rounded-[8px] bg-[#f5f3f0] p-1">
                {k === 1 && <div className="rounded-[5px] bg-[#7aa6c2]/30 px-1 py-0.5 text-left text-[8.5px]">Calc quiz</div>}
                <AnimatePresence>
                  {k === 4 && i > 0 && (
                    <motion.div key="lab" initial={{ y: -70, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="rounded-[5px] bg-[#ff3b30] px-1 py-0.5 text-left text-[8.5px] font-semibold text-white">
                      Lab report 11:59
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}

export function AskScene() {
  const [ref, i] = useLoop(4, 1500);
  return (
    <Stage innerRef={ref} tint="from-[#eef6ff] to-[#e2eefc]">
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-2">
        <Bubble me>What's on Monday's quiz?</Bubble>
        <AnimatePresence mode="wait">
          {i === 1 && (
            <motion.div key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-14 gap-1 rounded-[18px] rounded-bl-[6px] bg-white px-3 py-2.5 shadow-sm">
              {[0, 1, 2].map((k) => (
                <motion.span key={k} className="h-2 w-2 rounded-full bg-[#b0aaa3]" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: k * 0.12 }} />
              ))}
            </motion.div>
          )}
          {i >= 2 && (
            <motion.div key="a" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
              <Bubble>Units 7 and 8. Ms. Rivera said it Tuesday at 10:42: “the nitrogen cycle will be on it.”</Bubble>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Stage>
  );
}
