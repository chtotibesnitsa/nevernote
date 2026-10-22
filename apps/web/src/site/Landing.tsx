import { PRICING } from "@nevernote/core";
import { Apple, ArrowRight, Check, ChevronDown, Github, Play, Wifi, WifiOff, Mic } from "lucide-react";
import { AnimatePresence, motion, useInView, useMotionValue, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Hmu, Logo, soft, spring } from "../components/ui.tsx";
import { GITHUB_REPO, RELEASES } from "../lib/bridge.ts";
import { Downloads, IPhone, MacBook } from "./Devices.tsx";
import { BENCH } from "./bench.ts";
import { DesktopDemo } from "./DesktopDemo.tsx";
import { HeroFrames, pickSet, quadMatrix, type FrameSet } from "./HeroFrames.tsx";
import { AskScene, CalendarScene, DeadlineScene, NotesScene, SpeakersScene, TranscriptScene, useLoop } from "./Scenes.tsx";

const fade = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: soft };
const SCENE_BG = "#f3f2f0";

/** Black pill, the primary action everywhere on the site. */
function Cta({ to = "/app", children, big }: { to?: string; children: ReactNode; big?: boolean }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_20px_-8px_rgb(0_0_0/0.45)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_14px_28px_-10px_rgb(0_0_0/0.5)] active:translate-y-0 ${big ? "py-3 pl-6 pr-5 text-[16px]" : "py-[7px] pl-4 pr-3.5 text-[14px]"}`}
    >
      {children}
      <ArrowRight size={big ? 17 : 14} className="transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function Ghost({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="lglass inline-flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-3 text-[16px] font-medium text-[#1d1d1f] transition hover:-translate-y-0.5">
      {children}
    </a>
  );
}

function Nav() {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setCondensed(y > 40));
  const links: [string, string][] = [["#features", "Features"], ["#how", "How it works"], ["#accuracy", "Accuracy"], ["#pricing", "Pricing"]];
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3">
      <motion.nav
        layout
        transition={spring}
        className={`flex w-full items-center gap-6 rounded-full py-1.5 pl-5 pr-1.5 ${condensed ? "lglass max-w-[820px]" : "max-w-[1180px] bg-transparent"}`}
      >
        <Link to="/" aria-label="Nevernote home" className="shrink-0">
          <Logo size={20} />
        </Link>
        <div className="ml-auto hidden items-center gap-6 text-[14px] text-[#424245] md:flex">
          {links.map(([h, t]) => (
            <a key={h} href={h} className="transition hover:text-[#1d1d1f]">{t}</a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Cta>Start free</Cta>
          <span className="hidden sm:block"><Hmu compact /></span>
          <button className="grid h-9 w-9 place-items-center rounded-full md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <span className="block h-0.5 w-4 bg-current shadow-[0_5px_0_currentColor]" />
          </button>
        </div>
      </motion.nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="lglass absolute inset-x-3 top-[64px] flex flex-col rounded-3xl p-3 md:hidden">
            {links.map(([h, t]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-base">{t}</a>
            ))}
            <div className="px-4 py-2"><Hmu /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Section title: a statement in ink, the payoff in grey. */
function Title({ a, b, as: As = "h2", className = "" }: { a: ReactNode; b?: ReactNode; as?: "h1" | "h2"; className?: string }) {
  return (
    <As className={`display text-balance ${className}`}>
      {a} {b && <span className="soft">{b}</span>}
    </As>
  );
}

function Section({ id, a, b, sub, children, className = "", tone }: { id?: string; a: ReactNode; b?: ReactNode; sub?: string; children: ReactNode; className?: string; tone?: "grey" }) {
  return (
    <section id={id} className={`scroll-mt-20 ${tone === "grey" ? "bg-[#f5f5f7]" : ""}`}>
      <div className={`mx-auto max-w-[1180px] px-5 py-24 md:py-32 ${className}`}>
        <motion.div {...fade} className="mx-auto max-w-[860px] text-center">
          <Title a={a} b={b} className="text-[2.5rem] leading-[1.04] md:text-[4rem]" />
          {sub && <p className="mx-auto mt-5 max-w-[600px] text-[19px] leading-relaxed text-[#6e6e73]">{sub}</p>}
        </motion.div>
        {children}
      </div>
    </section>
  );
}

// ---------- Hero ----------

const BEATS: { at: number; a: string; b: string; sub: string }[] = [
  { at: 0.12, a: "Most of class is filler.", b: "One line isn't.", sub: "Attendance, tangents, the slide read out loud. Somewhere in there is the thing you need." },
  { at: 0.32, a: "Everyone's watching the board.", b: "One of them doesn't have to.", sub: "Nevernote hears every word the teacher says and writes it down on the laptop." },
  { at: 0.52, a: "Every word. Every speaker.", b: "Every due date.", sub: "Transcribed on the device, offline, with who said what and when it's due." },
  { at: 0.72, a: "Spend class on", b: "your own work.", sub: "Catch up later in five minutes. Or look over. It's all there." },
];

function Beat({ p, at, next, children }: { p: MotionValue<number>; at: number; next: number; children: ReactNode }) {
  // One line at a time: the next beat starts only after this one has gone.
  const r = [at - 0.03, at, next - 0.065, next - 0.035];
  const opacity = useTransform(p, r, [0, 1, 1, 0]);
  const y = useTransform(p, r, [28, 0, 0, -28]);
  return (
    <motion.div style={{ opacity, y }} className="pointer-events-none absolute inset-x-0 top-0 mx-auto max-w-[900px] px-5 text-center will-change-transform">
      {children}
    </motion.div>
  );
}

/**
 * The live app, laid onto the laptop screen in the frames with the screen's own
 * perspective, frame by frame. It's the same picture as the screen texture, so
 * it fades in on top without a seam; from then on the screen *is* the live app,
 * and the camera simply finishes its move with it. No second box, no swap.
 */
function useScreenTracker(set: FrameSet) {
  const el = useRef<HTMLDivElement>(null);
  const quads = useRef<number[][] | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    quads.current = null;
    let gone = false;
    fetch(`${set.dir}/quads.json`)
      .then((r) => r.json())
      .then((q: Record<string, number[]>) => {
        if (!gone) quads.current = Array.from({ length: set.count }, (_, i) => q[`s${String(i).padStart(3, "0")}`]);
      })
      .catch(() => {});
    return () => void (gone = true);
  }, [set]);
  const liveRef = useRef(false);
  const onFrame = useCallback(
    (f: number) => {
      const box = el.current;
      const qs = quads.current;
      if (!box) return;
      const p = f / (set.count - 1);
      // Fades in while the screen is still small and tilted, over the frames' own copy of it.
      const o = Math.min(1, Math.max(0, (p - 0.78) / 0.07));
      if (!qs || o <= 0) {
        box.style.visibility = "hidden";
        return;
      }
      const i = Math.min(set.count - 2, Math.floor(f));
      const t = f - i;
      const a = qs[i];
      const b = qs[i + 1] ?? a;
      if (!a || !b) return;
      // Frame pixels to page pixels: the canvas covers the viewport (object-fit: cover).
      const vw = innerWidth;
      const vh = innerHeight;
      const s = Math.max(vw / set.w, vh / set.h);
      const ox = (vw - set.w * s) / 2;
      const oy = (vh - set.h * s) / 2;
      const q = a.map((v, k) => (v + ((b[k] ?? v) - v) * t) * s + (k % 2 ? oy : ox));
      box.style.visibility = "visible";
      box.style.opacity = String(o);
      box.style.transform = quadMatrix(1024, 640, q);
      if (!liveRef.current && p > 0.985) {
        liveRef.current = true;
        setLive(true);
      }
    },
    [set],
  );
  return { el, live, onFrame };
}

function Hero() {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  const p = useMotionValue(0);
  const pv = useRef(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    pv.current = v;
    p.set(v);
  });
  // The camera lands on the laptop at 92% of the way, then rests there with the app running.
  const progress = useCallback(() => Math.min(1, pv.current / 0.92), []);
  const [set, setSet] = useState<FrameSet>(pickSet);
  useEffect(() => {
    const mq = matchMedia("(max-aspect-ratio: 1/1)");
    const on = () => setSet(pickSet());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const screen = useScreenTracker(set);
  const introOpacity = useTransform(p, [0, 0.06], [1, 0]);
  const introY = useTransform(p, [0, 0.06], [0, -24]);
  const hint = useTransform(p, [0, 0.03], [1, 0]);
  const veil = useTransform(p, [0.8, 0.9], [1, 0]);

  return (
    <div ref={wrap} className="relative h-[340vh]" style={{ background: SCENE_BG }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <HeroFrames progress={progress} set={set} onFrame={screen.onFrame} className="absolute inset-0" />
        <div ref={screen.el} style={{ width: 1024, height: 640, transformOrigin: "0 0", visibility: "hidden" }} className="pointer-events-none absolute left-0 top-0 will-change-transform">
          <DesktopDemo live={screen.live} />
        </div>
        <motion.div style={{ opacity: veil }} className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-[#f3f2f0] via-[#f3f2f0]/80 to-transparent" />

        <motion.div style={{ opacity: veil }} className="absolute inset-x-0 top-[92px] md:top-[108px]">
          <motion.div style={{ opacity: introOpacity, y: introY }} className="mx-auto max-w-[900px] px-5 text-center">
            <motion.div initial={{ opacity: 0, y: 20, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={soft}>
              <Title as="h1" a="Save class" b="for later." className="text-[2.6rem] leading-[1] sm:text-[3.8rem] md:text-[4.6rem]" />
            </motion.div>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.1 }} className="mx-auto mt-4 max-w-[520px] text-[17px] leading-relaxed text-[#424245] md:text-[19px]">
              Nevernote listens to class, writes every word down and flags what matters. Free, on every device.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.18 }} className="pointer-events-auto mt-6 flex flex-wrap justify-center gap-3">
              <Cta big>Start free</Cta>
              <Ghost href="#platforms"><Apple size={17} /> Download</Ghost>
            </motion.div>
          </motion.div>
          {BEATS.map((b, i) => (
            <Beat key={i} p={p} at={b.at} next={BEATS[i + 1]?.at ?? 0.9}>
              <Title a={b.a} b={b.b} className="text-[2.1rem] leading-[1.02] sm:text-[3.2rem] md:text-[3.8rem]" />
              <p className="mx-auto mt-4 max-w-[540px] text-[17px] leading-relaxed text-[#424245]">{b.sub}</p>
            </Beat>
          ))}
        </motion.div>

        <motion.div style={{ opacity: hint }} className="absolute inset-x-0 bottom-6 flex justify-center">
          <div className="lglass flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-[#6e6e73]">
            Scroll into the laptop
            <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>↓</motion.span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ---------- Zoned out: iMessage on an iPhone ----------

const CHAT: { me?: boolean; t?: string; audio?: string; card?: string[] }[] = [
  { me: true, t: "wait did she say when the lab is due?? i was finishing calc" },
  { audio: "0:04 · from 10:41 in Biology" },
  { t: "Friday 11:59 PM on Canvas. Reminder's set for Thursday night." },
  { me: true, t: "and is nitrogen on the test" },
  { card: ["Test covers the nitrogen cycle too", "Lab report due Fri 11:59 PM", "Read chapter 9 by Monday"] },
];

function Chat() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  return (
    <div ref={ref} className="mt-14 flex justify-center [perspective:1400px]">
      <motion.div style={{ rotateX, scale }} className="w-full max-w-[390px]">
        <IPhone>
          <div className="px-4 pb-6 pt-14">
            <div className="flex flex-col items-center gap-1 border-b border-black/[0.06] pb-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-lg font-semibold text-white">N</span>
              <span className="text-[12px] font-medium">Nevernote</span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {CHAT.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 14, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ ...spring, delay: 0.2 + i * 0.4 }} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                  {m.t && <div className={`max-w-[80%] rounded-[20px] px-3.5 py-2 text-[15px] leading-snug ${m.me ? "rounded-br-[6px] bg-[#0a84ff] text-white" : "rounded-bl-[6px] bg-[#e9e9eb] text-black"}`}>{m.t}</div>}
                  {m.audio && (
                    <div className="flex items-center gap-2.5 rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] px-3 py-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0a84ff] text-white"><Play size={12} fill="currentColor" /></span>
                      <span className="flex items-center gap-[2.5px]">
                        {[6, 12, 18, 9, 15, 20, 11, 7, 14, 17, 8, 12, 9, 6].map((h, j) => (
                          <span key={j} className="nn-eq w-[2.5px] rounded-full bg-[#6b6b70]" style={{ height: h, animationDelay: `${j * 0.07}s` }} />
                        ))}
                      </span>
                      <span className="text-[11px] text-[#6b6b70]">{m.audio}</span>
                    </div>
                  )}
                  {m.card && (
                    <div className="w-[82%] rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b6b70]">From today's class</div>
                      {m.card.map((l) => (
                        <div key={l} className="mt-1.5 flex items-center gap-2 text-[14px]"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff3b30]" /> {l}</div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
              <div className="mt-1 text-right text-[11px] text-[#8e8e93]">Delivered</div>
            </div>
          </div>
        </IPhone>
      </motion.div>
    </div>
  );
}

// ---------- Features ----------

const FEATURES: { t: string; b: string; scene: () => ReactNode; pro?: boolean; wide?: boolean }[] = [
  { t: "Every word, written down", b: "A live transcript on your own device, a second after it's said.", scene: TranscriptScene, wide: true },
  { t: "Knows who said what", b: "Teacher, classmates, guests. Names get picked up from the conversation.", scene: SpeakersScene },
  { t: "Deadline radar", b: "\"Due Friday\" becomes a notification the moment it's said.", scene: DeadlineScene },
  { t: "Notes and flashcards", b: "Clean notes, key terms and a study guide for every class.", scene: NotesScene, wide: true },
  { t: "Straight to your calendar", b: "Every due date lands in Google or Apple Calendar.", scene: CalendarScene, pro: true },
  { t: "Ask your notes", b: "\"What's on Monday's quiz?\" Answered with the moment it was said.", scene: AskScene, pro: true, wide: true },
];

function Features() {
  return (
    <div className="mt-16 grid gap-4 md:grid-cols-3">
      {FEATURES.map((f, i) => (
        <motion.div key={f.t} {...fade} transition={{ ...soft, delay: (i % 3) * 0.06 }} className={`card group p-2.5 transition duration-500 hover:-translate-y-1 ${f.wide ? "md:col-span-2" : ""}`}>
          <f.scene />
          <div className="px-3.5 pb-4 pt-4">
            <div className="flex items-center gap-2 text-[18px] font-semibold tracking-tight">
              {f.t}
              {f.pro && <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6e6e73]">Pro</span>}
            </div>
            <p className="mt-1 text-[15px] leading-relaxed text-[#6e6e73]">{f.b}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------- Safety: macOS-style glass notifications over a desktop ----------

const TOASTS = [
  { icon: Mic, t: "Mic disconnected at 41:12", b: "Everything up to here is saved. Plug it back in and tap Resume.", action: "Resume" },
  { icon: WifiOff, t: "Wi-Fi dropped", b: "Still recording and transcribing, fully offline." },
  { icon: Wifi, t: "Back online", b: "Your notes are being written now." },
];

/** Soft coloured light drifting behind glass. */
function Aurora({ colors, className = "" }: { colors: string[]; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {colors.map((c, k) => (
        <motion.span
          key={k}
          className="absolute h-[70%] w-[60%] rounded-full blur-3xl"
          style={{ background: c, left: `${[-10, 45, 15, 60][k % 4]}%`, top: `${[-20, -10, 40, 35][k % 4]}%` }}
          animate={{ x: [0, 40, -20, 0], y: [0, 30, -25, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: 14 + k * 3, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** A live voice waveform: smooth bars in a blue-violet-pink gradient that go flat when the mic drops. */
function Waveform({ on, bars = 56, height = 64 }: { on: boolean; bars?: number; height?: number }) {
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height }}>
      {Array.from({ length: bars }, (_, k) => {
        const env = Math.sin((k / (bars - 1)) * Math.PI);
        const h = 6 + env * (height - 10) * (0.45 + 0.55 * Math.abs(Math.sin(k * 1.7)));
        return (
          <motion.span
            key={k}
            className="w-[3px] rounded-full"
            style={{ background: `linear-gradient(180deg, hsl(${215 + (k / bars) * 110} 90% 66%), hsl(${235 + (k / bars) * 110} 85% 58%))` }}
            animate={on ? { height: [h * 0.35, h, h * 0.55, h * 0.9, h * 0.35] } : { height: 3 }}
            transition={on ? { duration: 1.1 + (k % 5) * 0.12, repeat: Infinity, ease: "easeInOut", delay: (k % 7) * 0.06 } : { duration: 0.4 }}
          />
        );
      })}
    </div>
  );
}

function Safety() {
  const [ref, i] = useLoop(TOASTS.length + 1, 2000);
  const [flash, setFlash] = useState(false);
  const [saved, setSaved] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setFlash((f) => !f), 900);
    const u = setInterval(() => setSaved((x) => (x >= 4 ? 1 : x + 1)), 1000);
    return () => {
      clearInterval(t);
      clearInterval(u);
    };
  }, []);
  const micOff = i === 1;
  return (
    <motion.div {...fade} ref={ref} className="relative mt-16 overflow-hidden rounded-[36px] bg-[#eef0fb] p-4 md:p-8">
      <Aurora colors={["#b9ccff", "#e3c8ff", "#ffd3e2", "#c4ecff"]} />
      {/* a browser tab that flashes while recording */}
      <div className="relative mx-auto max-w-[820px] overflow-hidden rounded-[20px] bg-white/60 shadow-[0_40px_80px_-40px_rgb(40_40_120/0.45),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-2xl">
        <div className="flex items-end gap-1 bg-white/40 px-3 pt-2.5">
          <div className="flex items-center gap-2 rounded-t-[10px] bg-white px-3.5 py-2 text-[13px]">
            <span className={`h-2.5 w-2.5 rounded-full transition ${micOff ? "bg-[#c7c7cc]" : flash ? "bg-[#ff3b30]" : "bg-[#ff3b30]/25"}`} />
            <span className="font-medium">{micOff ? "Paused · 41:12" : flash ? "Recording · 41:12" : "Biology · Nevernote"}</span>
          </div>
          <div className="px-3.5 py-2 text-[13px] text-[#6e6e73]">Google Docs</div>
          <div className="hidden px-3.5 py-2 text-[13px] text-[#6e6e73] sm:block">Canvas</div>
        </div>
        <div className="bg-white/70 px-5 pt-5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 font-semibold tracking-tight">
              <span className={`h-2 w-2 rounded-full ${micOff ? "bg-[#c7c7cc]" : "animate-pulse bg-[#ff3b30]"}`} /> {micOff ? "Mic lost, everything saved" : "Listening to Ms. Rivera"}
            </span>
            <span className="tabular-nums text-[#6e6e73]">Saved {saved}s ago</span>
          </div>
          <div className="mt-3 rounded-[16px] bg-[linear-gradient(180deg,#f7f7fb,#eef0f8)] py-3">
            <Waveform on={!micOff} />
          </div>
        </div>
        <div className="grid gap-3 bg-white/70 p-5 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-2.5">
            {["Keeps recording in a background tab", "Warns before you close the tab", "Saves every few seconds, never all at the end", "Logs every stop, with one-tap Resume"].map((t, k) => (
              <motion.div key={t} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.2 + k * 0.08 }} className="flex items-center gap-2.5 text-[14.5px]">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1d1d1f] text-white"><Check size={11} strokeWidth={3} /></span> {t}
              </motion.div>
            ))}
          </div>
          <div className="relative h-[230px]">
            <AnimatePresence>
              {TOASTS.slice(0, i).map((n, k) => (
                <motion.div
                  key={n.t}
                  initial={{ opacity: 0, y: -24, scale: 0.94 }}
                  animate={{ opacity: 1, y: (i - 1 - k) * 74, scale: 1 - (i - 1 - k) * 0.03 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={spring}
                  className="lglass absolute inset-x-0 top-0 flex items-start gap-3 rounded-[18px] p-3.5"
                  style={{ zIndex: k }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-white"><n.icon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-[13px] font-semibold"><span>{n.t}</span><span className="font-normal text-[#6e6e73]">now</span></div>
                    <div className="text-[12.5px] leading-snug text-[#424245]">{n.b}</div>
                  </div>
                  {n.action && <span className="self-center rounded-full bg-[#1d1d1f] px-3 py-1 text-[12px] font-medium text-white">{n.action}</span>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="relative mt-6 flex flex-wrap justify-center gap-2">
        {["Phone on the desk", "Laptop open", "Zoom, Teams, Meet", "No Wi-Fi", "Breaks and resumes"].map((r) => (
          <span key={r} className="lglass rounded-full px-4 py-2 text-[14px] font-medium text-[#1d1d1f]">{r}</span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------- How it works: four live states on coloured glass ----------

function RecordButton() {
  return (
    <div className="relative grid h-full place-items-center">
      {[0, 1, 2].map((k) => (
        <motion.span key={k} className="absolute h-28 w-28 rounded-full border-2 border-[#ff3b30]/40" animate={{ scale: [1, 2.1], opacity: [0.7, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: k * 0.8, ease: "easeOut" }} />
      ))}
      <motion.span whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} className="relative grid h-[112px] w-[112px] cursor-pointer place-items-center rounded-full bg-[radial-gradient(circle_at_50%_30%,#ffffff,#e5e5ea)] shadow-[0_24px_40px_-14px_rgb(0_0_0/0.4),inset_0_-4px_8px_rgb(0_0_0/0.08)]">
        <span className="h-[76px] w-[76px] rounded-full bg-[radial-gradient(circle_at_40%_30%,#ff8a80,#ff3b30_55%,#c4161c)] shadow-[inset_0_3px_4px_rgb(255_255_255/0.5),0_8px_18px_-4px_rgb(255_59_48/0.6)]" />
      </motion.span>
    </div>
  );
}

function Listening() {
  const words = "Your lab report is due Friday at 11:59".split(" ");
  const [ref, i] = useLoop(words.length + 4, 260);
  return (
    <div ref={ref} className="flex h-full flex-col justify-center gap-4 px-6">
      <Waveform on bars={40} height={56} />
      <div className="lglass min-h-[64px] rounded-[16px] px-4 py-3 text-[16px] leading-snug">
        <span className="mr-1.5 text-[12px] font-semibold text-[#424245]">Ms. Rivera</span>
        {words.slice(0, i).join(" ")}
        <span className="nn-caret ml-0.5 inline-block h-[16px] w-[1.5px] translate-y-[2px] bg-[#1d1d1f]" />
      </div>
    </div>
  );
}

function Flag() {
  const [ref, i] = useLoop(3, 1600);
  return (
    <div ref={ref} className="relative flex h-full flex-col items-center justify-center gap-2.5 px-6">
      {[
        ["Due Friday 11:59 PM", "Lab report · Biology · on Canvas"],
        ["Test next Tuesday", "Unit 3 · 40 multiple choice + 2 FRQ"],
      ].map(([t, b], k) => (
        <motion.div key={t} animate={{ opacity: i >= k ? 1 : 0, y: i >= k ? 0 : -16, scale: i >= k ? 1 : 0.95 }} transition={spring} className="lglass flex w-full items-center gap-3 rounded-[18px] p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-sm font-semibold text-white">N</span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{t}</div>
            <div className="truncate text-[13px] text-[#424245]">{b}</div>
          </div>
          <span className="ml-auto self-start text-[11px] text-[#6e6e73]">now</span>
        </motion.div>
      ))}
    </div>
  );
}

function CatchUp() {
  return (
    <div className="flex h-full items-center px-6">
      <motion.div whileHover={{ y: -4, rotateX: 4 }} transition={spring} className="w-full rounded-[18px] bg-white/90 p-4 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.4)] backdrop-blur">
        <div className="flex items-baseline justify-between"><span className="text-[16px] font-semibold tracking-tight">The carbon cycle</span><span className="text-[11px] text-[#6e6e73]">3 min read</span></div>
        {["Limestone: long-term carbon sink", "Decomposition is a source, not a sink", "Nitrogen cycle is on the test"].map((b, k) => (
          <motion.div key={b} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.3 + k * 0.12 }} className="mt-2 flex items-center gap-2 text-[13.5px] text-[#424245]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1d1d1f]" />
            {b}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

const STEPS: { t: string; b: string; v: () => ReactNode; glow: string[] }[] = [
  { t: "Hit record", b: "When class starts. Then do your own thing.", v: RecordButton, glow: ["#ffc2bd", "#ffd9c7", "#ffe9f0"] },
  { t: "It listens", b: "Every word, every voice, right on your device.", v: Listening, glow: ["#b8ccff", "#d6c8ff", "#c6ecff"] },
  { t: "It flags what matters", b: "Due dates and test hints ping you right away.", v: Flag, glow: ["#ffe2a8", "#ffd0b8", "#fff1c9"] },
  { t: "Catch up in minutes", b: "Notes, a study guide and replay, whenever.", v: CatchUp, glow: ["#bfeccc", "#c8e6ff", "#e0f6d6"] },
];

function Steps() {
  return (
    <div className="mt-16 grid gap-5 md:grid-cols-2">
      {STEPS.map((s, i) => (
        <motion.div key={s.t} {...fade} transition={{ ...soft, delay: (i % 2) * 0.08 }} whileHover={{ y: -6 }} className="card group overflow-hidden p-3">
          <div className="relative h-[280px] overflow-hidden rounded-[24px] bg-[#f4f4f7] [perspective:900px]">
            <Aurora colors={s.glow} />
            <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]" />
            <div className="relative h-full">
              <s.v />
            </div>
          </div>
          <div className="flex items-start gap-4 px-4 pb-5 pt-5">
            <span className="display text-[2.6rem] leading-none text-[#1d1d1f]/15">{i + 1}</span>
            <div>
              <div className="text-[22px] font-semibold tracking-tight">{s.t}</div>
              <p className="mt-1 text-[16px] leading-relaxed text-[#6e6e73]">{s.b}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------- Accuracy chart ----------

const ROOMS = [
  { label: "Quiet room", i: 1 },
  { label: "Classroom noise", i: 3 },
  { label: "Loud room", i: 4 },
];
const pct = (s: string) => parseFloat(s);
const name = (r: { engine: string; ours: boolean }) => (r.ours ? "Nevernote" : r.engine);
const BAR: Record<string, string> = {
  ours: "linear-gradient(90deg,#1d1d1f,#4a4a4f)",
  whisper: "linear-gradient(90deg,#9a9aa0,#b9b9be)",
  other: "linear-gradient(90deg,#c9c9ce,#dcdce0)",
};
const barOf = (r: { engine: string; ours: boolean }) => (r.ours ? BAR.ours : /whisper/i.test(r.engine) ? BAR.whisper : BAR.other);

/** Counts up from 0 once it scrolls into view. */
function CountUp({ to, decimals = 1, start }: { to: number; decimals?: number; start: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1600);
      setV(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, start]);
  return <>{v.toFixed(decimals)}</>;
}

function Accuracy() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-100px" });
  const ours = BENCH.rows.find((r) => r.ours)!;
  const whisper = BENCH.rows.find((r) => /whisper/i.test(r.engine))!;
  const times = pct(whisper.wer[4]) / pct(ours.wer[4]);
  const max = 60;
  const [hover, setHover] = useState<{ room: number; engine: string } | null>(null);
  return (
    <div ref={ref} className="mt-16 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <motion.div {...fade} className="card relative flex flex-col justify-between overflow-hidden p-8">
        <Aurora colors={["#dfe6ff", "#efe3ff", "#e3f3ff"]} className="opacity-70" />
        <div className="relative">
          <div className="text-[14px] font-medium text-[#6e6e73]">In a loud classroom</div>
          <div className="display mt-2 text-[5.5rem] leading-none tabular-nums md:text-[7.5rem]">
            <CountUp to={times} start={seen} />×
          </div>
          <div className="mt-2 text-[21px] font-semibold leading-snug tracking-tight">fewer mistakes than Whisper.</div>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">Same recordings, same rooms. The Mac and Windows apps run it on your device, free forever.</p>
        </div>
        <div className="relative mt-8 grid grid-cols-3 gap-3 border-t border-black/[0.06] pt-6">
          {[["$0", "free forever"], ["∞", "hours, no caps"], [`${(100 - pct(ours.wer[1])).toFixed(0)}%`, "words right, quiet room"]].map(([n, l]) => (
            <div key={l}>
              <div className="display text-[1.9rem] leading-none">{n}</div>
              <div className="mt-1 text-[12.5px] text-[#6e6e73]">{l}</div>
            </div>
          ))}
        </div>
      </motion.div>
      <motion.div {...fade} transition={{ ...soft, delay: 0.08 }} className="card p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-[17px] font-semibold tracking-tight">Mistakes per 100 words <span className="font-normal text-[#6e6e73]">· lower is better</span></div>
          <div className="flex gap-4 text-[13px] text-[#424245]">
            {BENCH.rows.map((r) => (
              <span key={r.engine} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: barOf(r) }} />
                {name(r)}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-6" onMouseLeave={() => setHover(null)}>
          {ROOMS.map((room, ri) => (
            <div key={room.label}>
              <div className="mb-2 text-[13px] font-medium text-[#6e6e73]">{room.label}</div>
              <div className="space-y-[5px]">
                {BENCH.rows.map((r, k) => {
                  const v = pct(r.wer[room.i]);
                  const on = hover?.room === ri && hover.engine === r.engine;
                  const dim = hover && !on;
                  return (
                    <div key={r.engine} className="relative flex cursor-default items-center gap-3" onMouseEnter={() => setHover({ room: ri, engine: r.engine })}>
                      <div className="relative h-[22px] flex-1">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: seen ? `${(v / max) * 100}%` : 0, opacity: dim ? 0.35 : 1, scaleY: on ? 1.25 : 1 }}
                          transition={{ type: "spring", stiffness: 90, damping: 16, delay: hover ? 0 : 0.15 + ri * 0.14 + k * 0.06 }}
                          className="relative h-full origin-left overflow-hidden rounded-full"
                          style={{ background: barOf(r) }}
                        >
                          <motion.span
                            className="absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.45),transparent)]"
                            animate={{ x: ["-120%", "320%"] }}
                            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 1 + k * 0.4 + ri * 0.3, repeatDelay: 2.4 }}
                          />
                        </motion.div>
                        <AnimatePresence>
                          {on && (
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.98 }}
                              transition={spring}
                              className="absolute bottom-[calc(100%+10px)] z-20 w-[260px] rounded-[16px] bg-[#1d1d1f]/95 p-3.5 text-white shadow-[0_20px_40px_-12px_rgb(0_0_0/0.5)] backdrop-blur"
                              style={{ left: `min(${(v / max) * 100}%, calc(100% - 260px))` }}
                            >
                              <div className="flex items-baseline justify-between">
                                <span className="text-[13px] font-semibold">{name(r)}</span>
                                <span className="text-[11px] text-white/60">{room.label}</span>
                              </div>
                              <div className="mt-1 flex items-baseline gap-2">
                                <span className="display text-[2rem] leading-none">{(100 - v).toFixed(1)}%</span>
                                <span className="text-[12px] text-white/70">words right</span>
                              </div>
                              <div className="mt-1 text-[12px] text-white/70">{v} of every 100 words wrong{!r.ours && ` · ${(v / pct(ours.wer[room.i])).toFixed(1)}× Nevernote's mistakes`}</div>
                              <div className="mt-3 grid grid-cols-5 gap-1.5 border-t border-white/10 pt-2.5">
                                {BENCH.tiers.map((t, ti) => (
                                  <div key={t} className="text-center">
                                    <div className="mx-auto flex h-8 w-2.5 items-end overflow-hidden rounded-full bg-white/10">
                                      <motion.div initial={{ height: 0 }} animate={{ height: `${100 - pct(r.wer[ti])}%` }} transition={{ ...soft, delay: ti * 0.04 }} className="w-full rounded-full bg-white" />
                                    </div>
                                    <div className="mt-1 text-[9.5px] leading-tight text-white/60">{t.replace(" room", "").replace("Classroom ", "")}</div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className={`w-12 text-right text-[13px] tabular-nums ${r.ours ? "font-semibold text-[#1d1d1f]" : "text-[#6e6e73]"}`}>{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-[#6e6e73]">
          {BENCH.note}{" "}
          <a className="font-medium text-[#1d1d1f] underline decoration-black/20 underline-offset-2 hover:decoration-black" href={`${GITHUB_REPO}/tree/main/bench`}>Run it yourself</a>
        </p>
      </motion.div>
    </div>
  );
}

// ---------- Devices ----------

function Devices() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [28, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [180, 0]);
  return (
    <div ref={ref} className="mt-16 [perspective:1800px]">
      <motion.div style={{ rotateX, y }} className="relative mx-auto max-w-[1040px]">
        <MacBook src="/shots/mac.webp" alt="Nevernote on a Mac, showing a class transcript with notes" />
        <motion.div style={{ y: phoneY }} className="absolute -bottom-12 right-[-1%] w-[22%] min-w-[118px] md:right-[-3%]">
          <IPhone small>
            <img src="/shots/iphone.webp" alt="Nevernote on iPhone" className="block aspect-[390/844] w-full object-cover object-top" loading="lazy" />
          </IPhone>
        </motion.div>
      </motion.div>
    </div>
  );
}

const CLASSES = ["AP and honors", "College lectures", "Med and nursing", "Law school", "Labs and STEM", "Learning differences", "Language classes", "Online classes", "Seminars", "Office hours", "Study groups", "Guest speakers"];

function Marquee() {
  return (
    <div className="relative mt-12 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      {[0, 1].map((row) => (
        <div key={row} className={`flex w-max gap-3 py-1.5 ${row ? "nn-marquee-r" : "nn-marquee"}`}>
          {[...CLASSES, ...CLASSES].map((c, i) => (
            <span key={i} className="lglass whitespace-nowrap rounded-full px-5 py-2.5 text-[16px] font-medium tracking-tight text-[#1d1d1f]">{c}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. Recording, transcription, speaker labels, deadline alerts, sync and AI notes are free. Transcription runs on your own device, so it costs us nothing, and AI notes cost a fraction of a cent. Pro adds calendar auto-add, Ask your notes and instant notes every time."],
  ["Does my audio get uploaded?", "No. Speech recognition and speaker labels run on your phone or computer. Only the transcript text syncs, so your other devices can show it and notes can be written. Your audio stays on the device that recorded it."],
  ["Isn't this just skipping class?", "No. You're still in the room, and you still get everything that was said. Nevernote just means you don't have to spend the whole hour taking notes to catch the five minutes that count."],
  ["Does it work without internet?", "Yes. Record and transcribe with Wi-Fi off. Notes are written as soon as you're back online."],
  ["How accurate is it?", "We test it on real classroom recordings, from a quiet room to a loud one with an echo. The open-source Parakeet engine misses about 4 words in 100 in a quiet room and about 13 in a noisy classroom. The full results are on GitHub."],
  ["Can I try it without an account?", "Yes, on the website. Guest mode keeps notes in your browser only. Sign up with Google any time to keep them and use them on your phone and laptop."],
  ["Is it okay to record class?", "Ask first. Many schools and states require consent from your teacher or everyone in the room. Nevernote reminds you before every recording."],
  ["Can I cancel Pro anytime?", "Yes, in your App Store subscriptions. You keep everything you recorded and go back to the free plan."],
];

// ---------- Pricing ----------

const FREE = ["Unlimited recording, every class", "Unlimited transcription on your device", "Every speaker, named", "Due date and test alerts", "AI notes and study guides", "Sync on every device"];

// Pro's features are shown working, as tiny live previews, instead of icons.
function MiniNotes({ on }: { on: boolean }) {
  return (
    <div className="space-y-[7px] pt-1">
      <div className="h-[9px] w-[46%] rounded-full bg-[#1d1d1f]/80" />
      {[92, 78, 85, 64].map((w, i) => (
        <motion.div key={i} initial={{ width: 0 }} animate={on ? { width: `${w}%` } : { width: 0 }} transition={{ ...soft, delay: 0.25 + i * 0.18 }} className="h-[6px] rounded-full bg-[#1d1d1f]/15" />
      ))}
      <motion.div initial={{ opacity: 0, y: 4 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ ...soft, delay: 1.1 }} className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1f] px-2 py-[2px] text-[9.5px] font-semibold text-white">
        Study guide · 6 questions
      </motion.div>
    </div>
  );
}
function MiniAsk({ on }: { on: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 text-[10.5px] leading-snug">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ ...soft, delay: 0.2 }} className="self-end rounded-[12px] rounded-br-[4px] bg-[#1d1d1f] px-2.5 py-1.5 text-white">
        What's on Tuesday's test?
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ ...soft, delay: 0.85 }} className="max-w-[88%] rounded-[12px] rounded-bl-[4px] bg-white px-2.5 py-1.5 text-[#1d1d1f] shadow-[0_1px_2px_rgb(0_0_0/0.08)]">
        The nitrogen cycle and decomposition.
        <span className="ml-1 inline-flex rounded-full bg-[#f2f2f5] px-1.5 text-[9px] font-semibold text-[#6e6e73]">▶ 10:42</span>
      </motion.div>
    </div>
  );
}
function MiniCalendar({ on }: { on: boolean }) {
  const days = ["M", "T", "W", "T", "F"];
  return (
    <div className="grid grid-cols-5 gap-1">
      {days.map((d, i) => (
        <div key={i} className={`relative h-[62px] rounded-[9px] p-1 text-center text-[9px] font-semibold ${i === 4 ? "bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "bg-white/50"}`}>
          <div className="text-[#86868b]">{d}</div>
          <div className="text-[13px] text-[#1d1d1f]">{20 + i}</div>
          {i === 4 && (
            <motion.div initial={{ opacity: 0, y: -18, scale: 0.9 }} animate={on ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ ...spring, delay: 0.5 }} className="absolute inset-x-0.5 bottom-1 rounded-[5px] bg-[#1d1d1f] px-0.5 py-[2px] text-[7.5px] leading-tight whitespace-nowrap text-white">
              Due
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}
function MiniPack({ on }: { on: boolean }) {
  return (
    <div className="relative h-[70px]">
      {["Unit 4 · Review", "Lecture 12", "Lecture 11"].map((t, i) => (
        <motion.div
          key={t}
          initial={{ rotate: 0, x: 0, y: 0 }}
          animate={on ? { rotate: (i - 1) * -7, x: (1 - i) * 26, y: i * 3 } : {}}
          transition={{ ...spring, delay: 0.3 + i * 0.08 }}
          style={{ zIndex: 3 - i }}
          className="absolute left-1/2 top-1 -ml-[46px] h-[58px] w-[92px] rounded-[10px] bg-white p-2 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.35)] ring-1 ring-black/5"
        >
          <div className="text-[8.5px] font-semibold text-[#1d1d1f]">{t}</div>
          <div className="mt-1.5 space-y-1">{[80, 60, 70].map((w, k) => <div key={k} className="h-[3px] rounded-full bg-[#1d1d1f]/12" style={{ width: `${w}%` }} />)}</div>
        </motion.div>
      ))}
    </div>
  );
}
function MiniExport({ on }: { on: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-2">
      {["Markdown", "Google Docs", "Flashcards", "PDF"].map((t, i) => (
        <motion.span key={t} initial={{ opacity: 0, scale: 0.8 }} animate={on ? { opacity: 1, scale: 1 } : {}} transition={{ ...spring, delay: 0.2 + i * 0.12 }} className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-[#1d1d1f] shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-black/5">
          {t}
        </motion.span>
      ))}
    </div>
  );
}

const PRO: { t: string; b: string; demo: (p: { on: boolean }) => ReactNode; wide?: boolean }[] = [
  { t: "Instant AI notes", b: "Notes, key terms and a study guide the second class ends.", demo: MiniNotes },
  { t: "Ask your notes", b: "Answers jump to the moment it was said.", demo: MiniAsk },
  { t: "Due dates, auto-added", b: "Every deadline lands in Google or Apple Calendar.", demo: MiniCalendar },
  { t: "Exam packs", b: "A whole unit of lectures in one review guide.", demo: MiniPack },
  { t: "Export anywhere", b: "Markdown, Docs, flashcards. One tap.", demo: MiniExport, wide: true },
];

/** The digits slide and un-blur when they change, like a real price counter. */
function Price({ value }: { value: string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: "60%", opacity: 0, filter: "blur(6px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} exit={{ y: "-60%", opacity: 0, filter: "blur(6px)" }} transition={spring} className="display inline-block text-[3.7rem] leading-none tracking-[-0.045em] sm:text-[4.6rem] md:text-[5.2rem]">
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ProCard() {
  const [yearly, setYearly] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { once: true, margin: "-120px" });
  // A soft light that follows the pointer across the glass, and a gentle tilt.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.3);
  const rx = useTransform(my, [0, 1], [3, -3]);
  const ry = useTransform(mx, [0, 1], [-4, 4]);
  const light = useTransform([mx, my] as MotionValue<number>[], ([x, y]: number[]) => `radial-gradient(600px circle at ${x * 100}% ${y * 100}%, rgb(255 255 255 / 0.75), transparent 45%)`);
  const perMonth = yearly ? (PRICING.yearly.price / 12).toFixed(2) : PRICING.monthly.price.toFixed(2);
  const save = Math.round((1 - PRICING.yearly.price / (PRICING.monthly.price * 12)) * 100);
  return (
    <motion.div
      ref={ref}
      {...fade}
      transition={{ ...soft, delay: 0.08 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => (mx.set(0.5), my.set(0.3))}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400 }}
      className="relative rounded-[34px] p-[1px] [background:linear-gradient(160deg,rgb(255_255_255/0.95),rgb(205_208_222/0.7)_40%,rgb(255_255_255/0.9)_70%,rgb(196_190_210/0.7))] shadow-[0_50px_100px_-40px_rgb(40_44_70/0.45),0_20px_40px_-30px_rgb(40_44_70/0.3)]"
    >
      <div className="relative h-full overflow-hidden rounded-[33px] p-7 md:p-9">
        {/* pearl: muted lavender, mist blue and champagne under frosted glass */}
        <div className="absolute inset-0 bg-[#eef0f6]" />
        <motion.div aria-hidden animate={{ x: [0, 30, -10, 0], y: [0, -20, 15, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[#d9d3ee] blur-[80px]" />
        <motion.div aria-hidden animate={{ x: [0, -40, 10, 0], y: [0, 25, -10, 0] }} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} className="absolute -right-24 top-24 h-[380px] w-[380px] rounded-full bg-[#cfdcf0] blur-[80px]" />
        <motion.div aria-hidden animate={{ x: [0, 20, -20, 0] }} transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-32 left-1/4 h-[360px] w-[460px] rounded-full bg-[#f1e6da] blur-[90px]" />
        <motion.div aria-hidden style={{ background: light }} className="pointer-events-none absolute inset-0 mix-blend-soft-light" />
        <div className="absolute inset-0 rounded-[33px] shadow-[inset_0_1px_0_rgb(255_255_255/0.9),inset_0_0_0_1px_rgb(255_255_255/0.35)]" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[15px] font-semibold text-[#1d1d1f]">Nevernote Pro</span>
            {/* Yearly is the default: it's the better deal, and the toggle shows exactly how much. */}
            <div className="relative flex rounded-full bg-white/55 p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-black/5 backdrop-blur-xl">
              {([false, true] as const).map((y) => (
                <button key={String(y)} onClick={() => setYearly(y)} className="relative z-10 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-[#1d1d1f]">
                  {yearly === y && <motion.span layoutId="nn-bill" transition={spring} className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12),inset_0_1px_0_#fff]" />}
                  {y ? "Yearly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
            <Price value={`$${perMonth}`} />
            <div className="whitespace-nowrap pb-2 text-[14px] leading-tight text-[#6e6e73]">
              per month
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={String(yearly)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={soft}>
                  {yearly ? (
                    <>
                      <span className="line-through decoration-[#aeaeb2]">${(PRICING.monthly.price * 12).toFixed(2)}</span> ${PRICING.yearly.price} a year
                    </>
                  ) : (
                    "billed monthly"
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {yearly && (
                <motion.span initial={{ opacity: 0, scale: 0.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -4 }} exit={{ opacity: 0, scale: 0.6 }} transition={spring} className="mb-3 ml-auto rounded-full bg-[#1d1d1f] px-3 py-1 text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.5)]">
                  Save {save}%
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="mt-2 text-[14px] text-[#424245]">Less than one coffee a month for every class, all year.</p>

          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {PRO.map((f, k) => (
              <motion.div
                key={f.t}
                initial={{ opacity: 0, y: 14 }}
                animate={on ? { opacity: 1, y: 0 } : {}}
                transition={{ ...soft, delay: 0.1 + k * 0.08 }}
                whileHover={{ y: -3 }}
                className={`flex flex-col rounded-[20px] bg-white/45 p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_10px_24px_-18px_rgb(30_34_60/0.35)] ring-1 ring-white/70 backdrop-blur-xl ${f.wide ? "col-span-2 sm:flex-row sm:items-center sm:gap-5" : ""}`}
              >
                <div className={`min-h-[78px] ${f.wide ? "sm:order-2 sm:min-h-0 sm:flex-1" : ""}`}>{f.demo({ on })}</div>
                <div className={f.wide ? "mt-2 sm:mt-0 sm:w-[46%]" : "mt-2.5"}>
                  <div className="text-[14.5px] font-semibold tracking-tight text-[#1d1d1f]">{f.t}</div>
                  <div className="text-[12.5px] leading-snug text-[#6e6e73]">{f.b}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <Link
            to="/app/settings"
            className="group relative mt-7 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[#1d1d1f] py-4 text-[16px] font-semibold text-white shadow-[0_5px_0_#000,0_24px_40px_-16px_rgb(0_0_0/0.55)] transition hover:-translate-y-0.5 active:translate-y-[4px] active:shadow-[0_1px_0_#000]"
          >
            {/* a slow sheen of light across the button */}
            <motion.span aria-hidden initial={{ x: "-120%" }} animate={{ x: "220%" }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }} className="absolute inset-y-0 left-0 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            Get Pro {yearly ? "yearly" : ""} <ArrowRight size={17} className="transition group-hover:translate-x-1" />
          </Link>
          <p className="mt-3 text-center text-[12.5px] text-[#6e6e73]">Cancel anytime. Everything in Free stays free.</p>
        </div>
      </div>
    </motion.div>
  );
}

function Pricing() {
  return (
    <div className="mx-auto mt-16 grid max-w-[1080px] grid-cols-[minmax(0,1fr)] items-stretch gap-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
      <motion.div {...fade} className="lglass relative flex flex-col overflow-hidden rounded-[34px] p-8 md:p-9">
        <div className="text-[15px] font-semibold text-[#1d1d1f]">Free forever</div>
        <div className="mt-5 flex items-end gap-3">
          <span className="display text-[4.6rem] leading-none tracking-[-0.045em] md:text-[5.2rem]">$0</span>
          <span className="pb-2 text-[14px] leading-tight text-[#6e6e73]">no limits<br />no card</span>
        </div>
        <ul className="mt-8 space-y-3.5 text-[15.5px] text-[#1d1d1f]">
          {FREE.map((f, i) => (
            <motion.li key={f} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.1 + i * 0.06 }} className="flex items-center gap-3">
              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#3a3a3c] to-[#1d1d1f] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_4px_-1px_rgb(0_0_0/0.3)]">
                <Check size={12} strokeWidth={3.2} />
              </span>
              {f}
            </motion.li>
          ))}
        </ul>
        {/* What a free class looks like when it's done. */}
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.5 }} className="relative mt-9">
          <div className="absolute inset-x-5 -bottom-2 h-full rounded-[20px] bg-white/50 ring-1 ring-black/5" />
          <div className="relative rounded-[20px] bg-white p-4 shadow-[0_14px_30px_-20px_rgb(0_0_0/0.35)] ring-1 ring-black/5">
            <div className="flex items-center justify-between text-[11.5px] text-[#86868b]">
              <span>Biology · Today</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" /> Saved</span>
            </div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-tight">The carbon cycle</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] font-medium">
              {["52 min", "3 speakers", "6,240 words", "2 due dates"].map((t) => (
                <span key={t} className="rounded-full bg-[#f2f2f5] px-2 py-0.5 text-[#424245]">{t}</span>
              ))}
            </div>
          </div>
        </motion.div>
        <div className="mt-auto pt-9"><Cta big>Start free</Cta></div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-[#6e6e73]">Recording and transcription have no limits at all. AI notes: 3 instant a day, the rest arrive overnight or right away after a 5-second sponsor card.</p>
      </motion.div>
      <ProCard />
    </div>
  );
}

// ---------- FAQ ----------

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto mt-12 max-w-[820px] space-y-3 text-left [perspective:1200px]">
      {FAQ.map(([q, a], i) => {
        const on = open === i;
        return (
          <motion.div
            key={q}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            animate={{ scale: on ? 1.015 : 1 }}
            transition={{ ...soft, delay: i * 0.03 }}
            className={`overflow-hidden rounded-[22px] bg-white transition-shadow duration-500 ${on ? "shadow-[0_24px_50px_-24px_rgb(0_0_0/0.3),0_0_0_1px_rgb(0_0_0/0.04)]" : "shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.04)] hover:shadow-[0_10px_30px_-18px_rgb(0_0_0/0.3),0_0_0_1px_rgb(0_0_0/0.05)]"}`}
          >
            <button onClick={() => setOpen(on ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[18px] font-semibold tracking-tight" aria-expanded={on}>
              {q}
              <motion.span animate={{ rotate: on ? 180 : 0, backgroundColor: on ? "#1d1d1f" : "#f2f2f5", color: on ? "#fff" : "#424245" }} transition={spring} className="grid h-9 w-9 shrink-0 place-items-center rounded-full">
                <ChevronDown size={17} strokeWidth={2.5} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 220, damping: 28 }}>
                  <motion.p initial={{ rotateX: -35, y: -10, opacity: 0 }} animate={{ rotateX: 0, y: 0, opacity: 1 }} exit={{ rotateX: -20, opacity: 0 }} transition={spring} style={{ transformOrigin: "top" }} className="px-6 pb-6 text-[16px] leading-relaxed text-[#424245]">
                    {a}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

export function Landing() {
  // The website is light-only, whatever the app's theme is.
  useEffect(() => {
    const html = document.documentElement;
    const was = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.background = "#fbfbfd";
    return () => {
      if (was) html.classList.add("dark");
      html.style.background = "";
    };
  }, []);

  return (
    <div className="site relative min-h-screen overflow-x-clip">
      <Nav />
      <Hero />

      <Section a="Zoned out?" b="Covered." sub="You looked away for one minute and missed the only thing that mattered. Nevernote didn't.">
        <Chat />
      </Section>

      <Section id="features" tone="grey" a="Everything class says." b="Sorted for you.">
        <Features />
      </Section>

      <Section a="Never loses a word." b="Even when things go wrong." sub="Mic unplugged, Wi-Fi gone, tab in the background. It keeps going, saves as it goes and tells you exactly what happened.">
        <Safety />
      </Section>

      <Section id="how" tone="grey" a="Four steps." b="Zero stress.">
        <Steps />
        <motion.div {...fade} className="mt-12 flex justify-center">
          <Cta big>Try it now</Cta>
        </motion.div>
      </Section>

      <Section id="accuracy" a="More accurate." b="Free forever." sub="Every engine, the same classroom recordings, from a quiet room to a loud one with an echo.">
        <Accuracy />
      </Section>

      <Section id="platforms" tone="grey" a="On every device." b="In every class." sub="Sign in once and every class follows you, from the phone on your desk to the laptop in your bag.">
        <Devices />
        <Downloads />
        <Marquee />
      </Section>

      <Section id="pricing" a="Free forever." b="Everything unlimited." sub="Record every class, all year. No trial, no minute caps, no card. The free plan never runs out.">
        <Pricing />
      </Section>

      <Section id="faq" tone="grey" a="Questions," b="answered.">
        <Faq />
      </Section>

      <section className="mx-auto max-w-[1180px] px-5 py-24">
        <motion.div {...fade} className="relative overflow-hidden rounded-[40px] bg-[#0b0b0d] px-6 py-24 text-center md:py-32">
          <Aurora colors={["#2b3a8f", "#5b2a86", "#1e5a7a"]} className="opacity-60" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgb(255_255_255/0.08),transparent)]" />
          <div className="relative">
            <h2 className="font-[Geist_Variable] text-[3.4rem] font-[800] leading-[0.92] tracking-[-0.055em] text-white md:text-[7rem]">Lock in.</h2>
            <h2 className="mt-1 font-[Geist_Variable] text-[3.4rem] font-[800] leading-[0.92] tracking-[-0.055em] text-white/45 md:text-[7rem]">We've got class.</h2>
            <p className="mx-auto mt-7 max-w-[460px] text-[18px] text-white/70">Free on every device. Recording in ten seconds.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link to="/app" className="group inline-flex items-center gap-2 rounded-full bg-white py-3.5 pl-7 pr-6 text-[16px] font-semibold text-[#1d1d1f] shadow-[0_4px_0_#c7c7cc,0_20px_40px_-12px_rgb(255_255_255/0.25)] transition active:translate-y-[3px] active:shadow-[0_1px_0_#c7c7cc]">
                Start free <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#platforms" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3.5 text-[16px] font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15">
                <Apple size={17} /> Download for desktop
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="mx-auto max-w-[1180px] px-5 pb-12">
        <div className="grid gap-8 border-t border-black/[0.08] pt-10 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo size={18} />
            <p className="mt-3 max-w-[220px] text-[#86868b]">The mic that pays attention in class, so you can work on what matters.</p>
          </div>
          {[
            ["Product", [["Features", "#features"], ["How it works", "#how"], ["Pricing", "#pricing"], ["Accuracy", "#accuracy"]]],
            ["Get it", [["Web app", "/app"], ["Mac and Windows", RELEASES], ["iPhone and iPad", "#platforms"]]],
            ["Company", [["Open source", GITHUB_REPO], ["Privacy", "/privacy"], ["Support", "/support"]]],
          ].map(([h, ls]) => (
            <div key={h as string}>
              <div className="font-semibold">{h as string}</div>
              <div className="mt-3 flex flex-col gap-2 text-[#86868b]">
                {(ls as string[][]).map(([t, href]) =>
                  href.startsWith("/") ? <Link key={t} to={href} className="hover:text-[#1d1d1f]">{t}</Link> : <a key={t} href={href} className="hover:text-[#1d1d1f]">{t}</a>,
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 text-xs text-[#86868b] sm:flex-row">
          <span>© {new Date().getFullYear()} Nevernote. Made by a student, for students.</span>
          <a href={GITHUB_REPO} className="inline-flex items-center gap-1.5 hover:text-[#1d1d1f]"><Github size={14} /> Star us on GitHub</a>
        </div>
      </footer>
    </div>
  );
}
