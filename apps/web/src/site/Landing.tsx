import { PRICING } from "@nevernote/core";
import { Apple, ArrowRight, Check, Github, Monitor, Smartphone, Globe, Lock, Play, Wifi, WifiOff, Mic } from "lucide-react";
import { AnimatePresence, motion, useInView, useMotionValue, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Hmu, Logo, soft, spring } from "../components/ui.tsx";
import { GITHUB_REPO, RELEASES } from "../lib/bridge.ts";
import { BENCH } from "./bench.ts";
import { DesktopDemo } from "./DesktopDemo.tsx";
import { HeroFrames, pickSet, screenRect, type FrameSet } from "./HeroFrames.tsx";
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

function useViewport() {
  const [v, setV] = useState(() => ({ w: typeof innerWidth === "number" ? innerWidth : 1280, h: typeof innerHeight === "number" ? innerHeight : 800 }));
  useEffect(() => {
    const on = () => setV({ w: innerWidth, h: innerHeight });
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  return v;
}

/** The laptop screen, live: starts exactly where the last frame left it, then settles into the page. */
function Handover({ p, set }: { p: MotionValue<number>; set: FrameSet }) {
  const { w: vw, h: vh } = useViewport();
  const from = screenRect(set, vw, vh);
  const portrait = set.w < set.h;
  const ew = portrait ? vw - 24 : Math.min(vw - 64, (vh - 150) * 1.6, 1180);
  const to = { w: ew, h: ew / 1.6, x: (vw - ew) / 2, y: portrait ? (vh - ew / 1.6) / 2 : Math.max(80, (vh - ew / 1.6) / 2 + 20) };
  const range = [0.955, 1];
  const opacity = useTransform(p, [0.94, 0.955], [0, 1]);
  const x = useTransform(p, range, [from.x, to.x]);
  const y = useTransform(p, range, [from.y, to.y]);
  const scale = useTransform(p, range, [from.w / to.w, 1]);
  const radius = useTransform(p, range, [0, portrait ? 14 : 22]);
  const shadow = useTransform(p, range, ["0 0 0 rgb(0 0 0 / 0)", "0 40px 80px -30px rgb(0 0 0 / 0.35)"]);
  return (
    <motion.div style={{ opacity, x, y, width: to.w, scale, borderRadius: radius, boxShadow: shadow, transformOrigin: "0 0" }} className="absolute left-0 top-0 overflow-hidden will-change-transform">
      <DesktopDemo live />
    </motion.div>
  );
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
  // The camera lands on the screen a little early, so the live page can take over.
  const progress = useCallback(() => Math.min(1, pv.current / 0.94), []);
  const [set, setSet] = useState<FrameSet>(pickSet);
  useEffect(() => {
    const mq = matchMedia("(max-aspect-ratio: 1/1)");
    const on = () => setSet(pickSet());
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const introOpacity = useTransform(p, [0, 0.06], [1, 0]);
  const introY = useTransform(p, [0, 0.06], [0, -24]);
  const hint = useTransform(p, [0, 0.03], [1, 0]);
  const canvasOpacity = useTransform(p, [0.965, 0.99], [1, 0]);
  const bg = useTransform(p, [0.955, 1], [SCENE_BG, "#fbfbfd"]);
  const veil = useTransform(p, [0.8, 0.9], [1, 0]);

  return (
    <div ref={wrap} className="relative h-[600vh]">
      <motion.div style={{ background: bg }} className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div style={{ opacity: canvasOpacity }} className="absolute inset-0">
          <HeroFrames progress={progress} set={set} />
        </motion.div>
        <motion.div style={{ opacity: veil }} className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-[#f3f2f0] via-[#f3f2f0]/80 to-transparent" />
        <Handover p={p} set={set} />

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
              <Ghost href={RELEASES}><Apple size={17} /> Download</Ghost>
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
      </motion.div>
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

function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[54px] bg-[linear-gradient(145deg,#e8e8ed,#b9b9c0_40%,#d7d7dc)] p-[10px] shadow-[0_50px_100px_-40px_rgb(0_0_0/0.45),inset_0_0_0_1px_rgb(255_255_255/0.7)] ${className}`}>
      <div className="relative overflow-hidden rounded-[45px] bg-white">
        <div className="absolute left-1/2 top-[10px] z-10 h-[28px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
        {children}
      </div>
    </div>
  );
}

function Chat() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  return (
    <div ref={ref} className="mt-14 flex justify-center [perspective:1400px]">
      <motion.div style={{ rotateX, scale }} className="w-full max-w-[390px]">
        <Phone>
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
        </Phone>
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

function Safety() {
  const [ref, i] = useLoop(TOASTS.length + 1, 1800);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setFlash((f) => !f), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div {...fade} ref={ref} className="relative mt-16 overflow-hidden rounded-[32px] bg-[radial-gradient(120%_100%_at_15%_0%,#eef0f5_0%,#d6dbe5_50%,#c3c9d6_100%)] p-4 md:p-8">
      <div className="absolute -left-10 top-20 h-72 w-[520px] rounded-full bg-white/50 blur-3xl" />
      {/* a browser tab that flashes while recording */}
      <div className="relative mx-auto max-w-[760px] overflow-hidden rounded-[16px] bg-white/70 shadow-[0_30px_60px_-30px_rgb(20_30_60/0.4)] backdrop-blur-xl">
        <div className="flex items-end gap-1 bg-[#e8e9ee]/80 px-3 pt-2.5">
          <div className="flex items-center gap-2 rounded-t-[10px] bg-white px-3.5 py-2 text-[13px]">
            <span className={`h-2.5 w-2.5 rounded-full transition ${flash ? "bg-[#ff3b30]" : "bg-[#ff3b30]/25"}`} />
            <span className="font-medium">{flash ? "🔴 Recording · 41:12" : "Biology · Nevernote"}</span>
          </div>
          <div className="px-3.5 py-2 text-[13px] text-[#86868b]">Google Docs</div>
          <div className="px-3.5 py-2 text-[13px] text-[#86868b]">Canvas</div>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-2.5">
            {["Keeps recording in a background tab", "Warns before you close the tab", "Saves every few seconds, never all at the end", "Logs every stop, with one-tap Resume"].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-[14.5px]"><Check size={16} className="shrink-0 text-[#34c759]" /> {t}</div>
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
                    <div className="flex justify-between text-[13px] font-semibold"><span>{n.t}</span><span className="font-normal text-[#86868b]">now</span></div>
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
          <span key={r} className="lglass rounded-full px-4 py-2 text-[14px] text-[#1d1d1f]">{r}</span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------- How it works: four live states, not four icons ----------

function RecordButton() {
  return (
    <div className="relative grid h-[180px] place-items-center">
      <span className="absolute h-24 w-24 animate-ping rounded-full bg-[#ff3b30]/15 [animation-duration:2.4s]" />
      <span className="relative grid h-[84px] w-[84px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_30%,#ffffff,#e5e5ea)] shadow-[0_18px_30px_-12px_rgb(0_0_0/0.35),inset_0_-3px_6px_rgb(0_0_0/0.08)]">
        <span className="h-[56px] w-[56px] rounded-full bg-[radial-gradient(circle_at_40%_30%,#ff7a70,#ff3b30_55%,#c4161c)] shadow-[inset_0_2px_3px_rgb(255_255_255/0.5),0_6px_14px_-4px_rgb(255_59_48/0.6)]" />
      </span>
    </div>
  );
}

function Listening() {
  const words = "Your lab report is due Friday at 11:59".split(" ");
  const [ref, i] = useLoop(words.length + 4, 260);
  return (
    <div ref={ref} className="flex h-[180px] flex-col justify-center gap-4 px-5">
      <div className="flex h-10 items-center justify-center gap-[3px]">
        {Array.from({ length: 34 }, (_, k) => (
          <span key={k} className="nn-eq w-[3px] rounded-full bg-[#1d1d1f]/70" style={{ height: 8 + ((k * 13) % 30), animationDelay: `${(k % 9) * 0.08}s` }} />
        ))}
      </div>
      <div className="min-h-[44px] text-[15px] leading-snug">
        <span className="mr-1.5 text-[12px] font-semibold text-[#ff7a2f]">Ms. Rivera</span>
        {words.slice(0, i).join(" ")}
        <span className="nn-caret ml-0.5 inline-block h-[15px] w-[1.5px] translate-y-[2px] bg-[#1d1d1f]" />
      </div>
    </div>
  );
}

function Flag() {
  return (
    <div className="flex h-[180px] items-center px-4">
      <div className="lglass flex w-full items-center gap-3 rounded-[18px] p-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-sm font-semibold text-white">N</span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">Due Friday 11:59 PM</div>
          <div className="truncate text-[12.5px] text-[#424245]">Lab report · Biology · on Canvas</div>
        </div>
      </div>
    </div>
  );
}

function CatchUp() {
  return (
    <div className="flex h-[180px] items-center px-4">
      <div className="w-full rounded-[16px] bg-white p-3.5 shadow-[0_12px_30px_-16px_rgb(0_0_0/0.35)]">
        <div className="flex items-baseline justify-between"><span className="text-[15px] font-semibold tracking-tight">The carbon cycle</span><span className="text-[11px] text-[#86868b]">3 min read</span></div>
        {["Limestone: long-term carbon sink", "Decomposition is a source", "Nitrogen cycle on the test"].map((b) => (
          <div key={b} className="mt-1.5 flex items-center gap-2 text-[12.5px] text-[#424245]"><span className="h-1 w-1 rounded-full bg-[#aeaeb2]" />{b}</div>
        ))}
      </div>
    </div>
  );
}

const STEPS: { t: string; b: string; v: () => ReactNode }[] = [
  { t: "Hit record", b: "When class starts. Then do your own thing.", v: RecordButton },
  { t: "It listens", b: "Every word, every voice, on your device.", v: Listening },
  { t: "It flags what matters", b: "Due dates and test hints ping you right away.", v: Flag },
  { t: "Catch up in minutes", b: "Notes, study guide and replay, whenever.", v: CatchUp },
];

// ---------- Accuracy chart ----------

const ROOMS = [
  { label: "Quiet room", i: 1 },
  { label: "Classroom noise", i: 3 },
  { label: "Loud room", i: 4 },
];
const pct = (s: string) => parseFloat(s);

function Accuracy() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-100px" });
  const ours = BENCH.rows.find((r) => r.ours)!;
  const whisper = BENCH.rows.find((r) => /whisper/i.test(r.engine))!;
  const times = (pct(whisper.wer[4]) / pct(ours.wer[4])).toFixed(1);
  const max = 60;
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div ref={ref} className="mt-16 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <motion.div {...fade} className="card flex flex-col justify-between p-8">
        <div>
          <div className="text-[14px] font-medium text-[#6e6e73]">In a loud classroom</div>
          <div className="display mt-2 text-[5.5rem] leading-none md:text-[7rem]">{times}×</div>
          <div className="mt-2 text-[20px] font-medium leading-snug tracking-tight">fewer mistakes than Whisper.</div>
          <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">Same recordings, same rooms. Nevernote runs it on your device, for free, forever.</p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3 border-t border-black/[0.06] pt-6">
          {[["$0", "forever"], ["0", "minute caps"], ["100%", "on your device"]].map(([n, l]) => (
            <div key={l}>
              <div className="display text-[1.8rem] leading-none">{n}</div>
              <div className="mt-1 text-[12.5px] text-[#6e6e73]">{l}</div>
            </div>
          ))}
        </div>
      </motion.div>
      <motion.div {...fade} transition={{ ...soft, delay: 0.08 }} className="card p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-[17px] font-semibold tracking-tight">Mistakes per 100 words <span className="font-normal text-[#86868b]">· lower is better</span></div>
          <div className="flex gap-4 text-[13px] text-[#424245]">
            {BENCH.rows.map((r) => (
              <span key={r.engine} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.ours ? "#1d1d1f" : /whisper/i.test(r.engine) ? "#a1a1a6" : "#d2d2d7" }} />
                {r.ours ? "Nevernote" : r.engine}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-6">
          {ROOMS.map((room, ri) => (
            <div key={room.label}>
              <div className="mb-2 text-[13px] font-medium text-[#6e6e73]">{room.label}</div>
              <div className="space-y-[3px]">
                {BENCH.rows.map((r, k) => {
                  const v = pct(r.wer[room.i]);
                  const id = `${room.label}-${r.engine}`;
                  return (
                    <div key={r.engine} className="group flex items-center gap-3" onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}>
                      <div className="relative h-[18px] flex-1">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: seen ? `${(v / max) * 100}%` : 0 }}
                          transition={{ ...soft, delay: 0.15 + ri * 0.12 + k * 0.05 }}
                          className="h-full rounded-r-[4px]"
                          style={{ background: r.ours ? "#1d1d1f" : /whisper/i.test(r.engine) ? "#a1a1a6" : "#d2d2d7", opacity: hover && hover !== id ? 0.55 : 1 }}
                        />
                        {hover === id && (
                          <div className="absolute -top-9 left-0 z-10 whitespace-nowrap rounded-[10px] bg-[#1d1d1f] px-2.5 py-1 text-[12px] text-white shadow-lg">
                            {r.ours ? "Nevernote" : r.engine}: {v} of every 100 words wrong
                          </div>
                        )}
                      </div>
                      <span className={`w-12 text-right text-[13px] tabular-nums ${r.ours ? "font-semibold text-[#1d1d1f]" : "text-[#6e6e73]"}`}>{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-[#86868b]">
          {BENCH.note} <a className="underline" href={`${GITHUB_REPO}/tree/main/bench`}>Run it yourself</a>
        </p>
      </motion.div>
    </div>
  );
}

// ---------- Devices ----------

function Mac({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative">
      <div className="rounded-[18px] bg-[#1d1d1f] p-[9px] pb-[11px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]">
        <img src={src} alt={alt} className="block aspect-[16/10] w-full rounded-[8px] bg-white object-cover object-top" loading="lazy" />
      </div>
      <div className="mx-[-6%] h-[14px] rounded-b-[14px] bg-[linear-gradient(180deg,#e3e3e8,#b7b7bd)] shadow-[0_30px_50px_-20px_rgb(0_0_0/0.45)]">
        <div className="mx-auto h-[5px] w-[16%] rounded-b-[6px] bg-[#a6a6ab]" />
      </div>
    </div>
  );
}

function Devices() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [28, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [180, 0]);
  return (
    <div ref={ref} className="mt-16 [perspective:1800px]">
      <motion.div style={{ rotateX, y }} className="relative mx-auto max-w-[980px]">
        <Mac src="/shots/mac.webp" alt="Nevernote on a Mac, showing a class transcript with notes" />
        <motion.div style={{ y: phoneY }} className="absolute -bottom-10 right-[-2%] w-[24%] min-w-[120px] md:right-[-6%]">
          <Phone className="!rounded-[34px] !p-[6px]">
            <img src="/shots/iphone.webp" alt="Nevernote on iPhone" className="block aspect-[390/844] w-full object-cover object-top" loading="lazy" />
          </Phone>
        </motion.div>
      </motion.div>
    </div>
  );
}

const PLATFORMS: { icon: typeof Apple; name: string; note: string; img: string; href?: string; cta: string }[] = [
  { icon: Apple, name: "Mac", note: "Apple Silicon and Intel", img: "/shots/mac.webp", href: RELEASES, cta: "Download" },
  { icon: Monitor, name: "Windows", note: "Windows 10 and 11", img: "/shots/windows.webp", href: RELEASES, cta: "Download" },
  { icon: Smartphone, name: "iPhone and iPad", note: "Records with the screen locked", img: "/shots/iphone.webp", cta: "App Store soon" },
  { icon: Globe, name: "Web", note: "Nothing to install", img: "/shots/web.webp", href: "/app", cta: "Open now" },
];

function Downloads() {
  return (
    <div className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLATFORMS.map((p, i) => {
        const inner = (
          <>
            <div className="relative h-[170px] overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#f5f5f7,#e8e8ed)]">
              <img src={p.img} alt="" loading="lazy" className={`absolute left-1/2 top-5 -translate-x-1/2 rounded-[10px] shadow-[0_20px_40px_-18px_rgb(0_0_0/0.45)] transition duration-500 group-hover:-translate-y-1.5 ${p.img.includes("iphone") ? "w-[34%]" : "w-[86%]"}`} />
            </div>
            <div className="flex items-center gap-2 px-2 pt-4 text-[17px] font-semibold tracking-tight"><p.icon size={17} /> {p.name}</div>
            <p className="px-2 text-[14px] text-[#6e6e73]">{p.note}</p>
            <div className="px-2 pb-2 pt-3 text-[14px] font-medium text-[#0066cc]">{p.cta}{p.href ? " ›" : ""}</div>
          </>
        );
        const cls = "card group block h-full p-2.5 transition duration-500 hover:-translate-y-1";
        return (
          <motion.div key={p.name} {...fade} transition={{ ...soft, delay: i * 0.05 }}>
            {p.href?.startsWith("/") ? <Link to={p.href} className={cls}>{inner}</Link> : p.href ? <a href={p.href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>}
          </motion.div>
        );
      })}
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
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div key={s.t} {...fade} transition={{ ...soft, delay: i * 0.07 }} className="card overflow-hidden p-2.5">
              <div className="rounded-[20px] bg-[linear-gradient(180deg,#f7f7f9,#ededf0)]"><s.v /></div>
              <div className="px-3 pb-4 pt-4">
                <div className="text-[13px] font-medium text-[#86868b]">Step {i + 1}</div>
                <div className="mt-0.5 text-[18px] font-semibold tracking-tight">{s.t}</div>
                <p className="mt-1 text-[15px] leading-relaxed text-[#6e6e73]">{s.b}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div {...fade} className="mt-12 flex justify-center">
          <Cta big>Try it now</Cta>
        </motion.div>
      </Section>

      <Section id="accuracy" a="More accurate." b="And it's free." sub="Every engine, the same classroom recordings, from a quiet room to a loud one with an echo.">
        <Accuracy />
      </Section>

      <Section id="platforms" tone="grey" a="On every device." b="In every class." sub="Sign in once and every class follows you, from the phone on your desk to the laptop in your bag.">
        <Devices />
        <Downloads />
        <Marquee />
      </Section>

      <Section id="pricing" a="Free." b="Actually free." sub="No trial that runs out. No minute caps. No card. The most accurate free transcriber for class, forever.">
        <div className="mx-auto mt-16 grid max-w-[940px] gap-4 md:grid-cols-[1.25fr_1fr]">
          <motion.div {...fade} className="card relative overflow-hidden p-8 md:p-10">
            <div className="text-[15px] font-medium text-[#6e6e73]">Free, forever</div>
            <div className="display mt-1 text-[5rem] leading-none">$0</div>
            <ul className="mt-7 grid gap-2.5 text-[15.5px] sm:grid-cols-2">
              {["Unlimited recording", "Transcribed on your device", "Speaker names", "Deadline and test alerts", "AI notes and study guides", "Sync across every device"].map((f) => (
                <li key={f} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-[#34c759]" /> {f}</li>
              ))}
            </ul>
            <div className="mt-8"><Cta big>Start free</Cta></div>
            <p className="mt-4 text-[12.5px] text-[#86868b]">3 instant AI notes a day. The rest arrive overnight, or right away after a 5-second sponsor card.</p>
          </motion.div>
          <motion.div {...fade} transition={{ ...soft, delay: 0.08 }} className="relative overflow-hidden rounded-[28px] bg-[#f5f5f7] p-8 md:p-10">
            <div className="flex items-center gap-2 text-[15px] font-medium text-[#6e6e73]">Pro <Lock size={13} /></div>
            <div className="display mt-1 text-[3rem] leading-none">${PRICING.monthly.price}<span className="text-[1.1rem] font-normal tracking-normal text-[#86868b]"> /mo</span></div>
            <div className="mt-1 text-[13px] text-[#86868b]">or {PRICING.yearly.label} ({PRICING.yearly.note})</div>
            <ul className="mt-6 space-y-2.5 text-[15px] text-[#424245]">
              {["Due dates in your calendar", "Ask your notes anything", "Exam packs for a whole unit", "Instant notes every time"].map((f) => (
                <li key={f} className="flex gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-[#86868b]" /> {f}</li>
              ))}
            </ul>
            <Link to="/app/settings" className="mt-7 inline-flex text-[15px] font-medium text-[#0066cc]">See Pro ›</Link>
          </motion.div>
        </div>
      </Section>

      <Section id="faq" tone="grey" a="Questions," b="answered.">
        <div className="mx-auto mt-12 max-w-[780px] divide-y divide-black/[0.08] text-left">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-medium tracking-tight">
                {q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#86868b] shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15.5px] leading-relaxed text-[#6e6e73]">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-[1180px] px-5 py-24">
        <motion.div {...fade} className="relative overflow-hidden rounded-[36px] bg-[radial-gradient(120%_100%_at_50%_0%,#ffffff,#eef0f4_60%,#e2e5eb)] px-6 py-20 text-center shadow-[0_0_0_1px_rgb(0_0_0/0.04)] md:py-28">
          <Title a="Lock in." b="We've got class." className="text-[2.6rem] leading-[1.02] md:text-[4.4rem]" />
          <p className="mx-auto mt-4 max-w-[480px] text-[17px] text-[#6e6e73]">Free on every device. Recording in ten seconds.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Cta big>Start free</Cta>
            <Ghost href={RELEASES}><Apple size={17} /> Download for desktop</Ghost>
          </div>
          <p className="mt-10 text-[13.5px] text-[#86868b]">
            Want even more? <Link to="/app/settings" className="text-[#0066cc]">Pro</Link> adds calendar sync, Ask your notes and instant notes for ${PRICING.monthly.price}/mo. Everything above stays free.
          </p>
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
