import { FREE_INSTANT_SUMMARIES_PER_DAY, PRICING } from "@nevernote/core";
import { Apple, ArrowRight, Check, ChevronDown, Github, Play } from "lucide-react";
import { AnimatePresence, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hmu, Logo, soft, spring } from "../components/ui.tsx";
import { GITHUB_REPO, RELEASES } from "../lib/bridge.ts";
import { deviceOs, Downloads, IPhone, MacBook, useInstaller } from "./Devices.tsx";
import { GoogleMark, signInWithGoogle } from "../app/AuthGate.tsx";
import { cloudEnabled } from "../lib/cloud.ts";
import { BENCH } from "./bench.ts";
import { LOGOS } from "./logos.ts";
import { DesktopDemo } from "./DesktopDemo.tsx";
import { HeroFrames, pickSet, quadMatrix, type FrameSet } from "./HeroFrames.tsx";
import { AskScene, Avatar, Bars, CalendarScene, DeadlineScene, Mark, NotesScene, SPEAKERS, SpeakersScene, TranscriptScene, useLoop } from "./Scenes.tsx";

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

function Section({ id, a, b, sub, children, className = "", tone, line }: { id?: string; a: ReactNode; b?: ReactNode; sub?: string; children: ReactNode; className?: string; tone?: "grey"; line?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-20 ${tone === "grey" ? "bg-[#f5f5f7]" : ""}`}>
      <div className={`mx-auto max-w-[1180px] px-5 py-24 md:py-32 ${className}`}>
        <motion.div {...fade} className={`mx-auto text-center ${line ? "max-w-none" : "max-w-[860px]"}`}>
          <Title a={a} b={b} className={line ? "text-[2.5rem] leading-[1.04] md:text-[3rem] lg:whitespace-nowrap lg:text-[3.6rem]" : "text-[2.5rem] leading-[1.04] md:text-[4rem]"} />
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

const AppleMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size * 1.18} viewBox="0 0 17 20" aria-hidden>
    <path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 1.9 5.9 1 7.5c-1.9 3.2-.5 8 1.3 10.6.9 1.3 2 2.7 3.3 2.6 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-2.9-4.5zM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z" />
  </svg>
);
const WindowsMark = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
    <path fill="currentColor" d="M0 2.2 6.5 1.3v6.2H0zM7.3 1.2 16 0v7.5H7.3zM0 8.4h6.5v6.3L0 13.8zM7.3 8.4H16V16l-8.7-1.2z" />
  </svg>
);

/** A big, rounded, pressable 3D button: it sits on a ledge and pushes down when pressed. */
export function Press3D({ children, onClick, to, dark, className = "" }: { children: ReactNode; onClick?: () => void; to?: string; dark?: boolean; className?: string }) {
  const cls = `group relative inline-flex select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-full px-7 py-[15px] text-[17px] font-semibold tracking-[-0.01em] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[2px] active:translate-y-[4px] ${
    dark
      ? "bg-[linear-gradient(180deg,#4a4a4d,#1d1d1f_70%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-1px_0_rgb(0_0_0/0.5),0_5px_0_#000,0_18px_34px_-12px_rgb(0_0_0/0.55)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-1px_0_rgb(0_0_0/0.5),0_7px_0_#000,0_24px_40px_-14px_rgb(0_0_0/0.55)] active:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_0_#000,0_6px_14px_-8px_rgb(0_0_0/0.5)]"
      : "bg-[linear-gradient(180deg,#ffffff,#ececf0)] text-[#1d1d1f] shadow-[inset_0_1px_0_#fff,inset_0_-1px_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.06),0_5px_0_#c9c9cf,0_18px_30px_-14px_rgb(0_0_0/0.35)] hover:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.06),0_7px_0_#c9c9cf,0_24px_36px_-16px_rgb(0_0_0/0.35)] active:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.06),0_1px_0_#c9c9cf,0_6px_12px_-8px_rgb(0_0_0/0.3)]"
  } ${className}`;
  return to ? (
    <Link to={to} className={cls}>{children}</Link>
  ) : (
    <button onClick={onClick} className={cls}>{children}</button>
  );
}

/** Sign up with Google (or jump straight in), and the right download for this device. */
function HeroActions() {
  const nav = useNavigate();
  const { go, ui } = useInstaller();
  const [os] = useState(deviceOs);
  const google = () => {
    if (!cloudEnabled) return nav("/app");
    void signInWithGoogle();
  };
  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-3.5">
        <Press3D dark onClick={google}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white"><GoogleMark /></span>
          Sign up free with Google
        </Press3D>
        {os === "mac" || os === "win" ? (
          <Press3D onClick={() => go(os)}>
            {os === "mac" ? <AppleMark /> : <WindowsMark />}
            Download for {os === "mac" ? "Mac" : "Windows"}
          </Press3D>
        ) : (
          <Press3D to="/app">Open the app <ArrowRight size={18} className="transition group-hover:translate-x-0.5" /></Press3D>
        )}
      </div>
      <Link to="/app" className="rounded-full bg-white/60 px-4 py-1.5 text-[14px] font-medium text-[#424245] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(0_0_0/0.05)] backdrop-blur transition hover:bg-white hover:text-[#1d1d1f]">
        or try it now, no account needed →
      </Link>
      {ui}
    </div>
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
  // The title waits for the classroom's first frame, so the two arrive together.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(t);
  }, []);
  const introOpacity = useTransform(p, [0, 0.06], [1, 0]);
  const introY = useTransform(p, [0, 0.06], [0, -24]);
  const hint = useTransform(p, [0, 0.03], [1, 0]);
  const veil = useTransform(p, [0.8, 0.9], [1, 0]);

  return (
    <div ref={wrap} className="relative h-[340vh]" style={{ background: SCENE_BG }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <HeroFrames progress={progress} set={set} onFrame={screen.onFrame} onReady={() => setReady(true)} className="absolute inset-0" />
        <div ref={screen.el} style={{ width: 1024, height: 640, transformOrigin: "0 0", visibility: "hidden" }} className="pointer-events-none absolute left-0 top-0 will-change-transform">
          <DesktopDemo live={screen.live} />
        </div>
        <motion.div style={{ opacity: veil }} className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-[#f3f2f0] via-[#f3f2f0]/80 to-transparent" />

        <motion.div style={{ opacity: veil }} className="absolute inset-x-0 top-[104px] md:top-[128px]">
          <motion.div style={{ opacity: introOpacity, y: introY }} className="mx-auto max-w-[1100px] px-5 text-center">
            {/* The title arrives once the classroom is on screen, word by word. */}
            <h1 className="display text-[3.3rem] font-[760] leading-[0.95] tracking-[-0.045em] sm:text-[5rem] md:text-[6.6rem]">
              {["Save", "class"].map((w, k) => (
                <motion.span key={w} initial={{ opacity: 0, y: 40, filter: "blur(14px)" }} animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}} transition={{ ...soft, delay: 0.05 + k * 0.09 }} className="mr-[0.22em] inline-block">
                  {w}
                </motion.span>
              ))}
              <span className="whitespace-nowrap">
                {["for", "later."].map((w, k) => (
                  <motion.span key={w} initial={{ opacity: 0, y: 40, filter: "blur(14px)" }} animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}} transition={{ ...soft, delay: 0.23 + k * 0.09 }} className="soft mr-[0.22em] inline-block last:mr-0">
                    {w}
                  </motion.span>
                ))}
              </span>
            </h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ ...soft, delay: 0.45 }} className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-[#424245] md:text-[20px]">
              Nevernote listens to class, writes every word down and flags what matters. Free forever, on every device.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ ...soft, delay: 0.58 }} className="pointer-events-auto">
              <HeroActions />
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

/**
 * Plays the conversation on a loop while it's on screen: the student types,
 * Nevernote "types" back, the class card fills in line by line, then it
 * starts over. Reduced motion shows the whole thread, still.
 */
function useChatLoop(on: boolean, still: boolean) {
  const [shown, setShown] = useState(still ? CHAT.length : 0);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!on || still) return;
    const timers: number[] = [];
    let dead = false;
    const wait = (ms: number) => new Promise<void>((r) => void timers.push(window.setTimeout(r, ms)));
    void (async () => {
      while (!dead) {
        setShown(0);
        await wait(800);
        for (let i = 0; i < CHAT.length && !dead; i++) {
          const m = CHAT[i];
          if (m.me && m.t) {
            for (let c = 2; c < m.t.length; c += 2) {
              setDraft(m.t.slice(0, c));
              await wait(34);
            }
            setDraft(m.t);
            await wait(320);
            setDraft("");
          } else {
            setTyping(true);
            await wait(m.card ? 1300 : 950);
            setTyping(false);
          }
          setShown(i + 1);
          await wait(m.card ? 1800 : 700);
        }
        await wait(4200);
        setCycle((c) => c + 1);
      }
    })();
    return () => {
      dead = true;
      timers.forEach(clearTimeout);
    };
  }, [on, still]);
  return { shown, typing, draft, cycle };
}

function Chat() {
  const ref = useRef<HTMLDivElement>(null);
  const on = useInView(ref, { margin: "-120px" });
  const still = !!useReducedMotion();
  const { shown, typing, draft, cycle } = useChatLoop(on, still);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const last = CHAT[shown - 1];
  return (
    <div ref={ref} className="mt-14 flex justify-center [perspective:1400px]">
      <motion.div style={{ rotateX, scale }} whileHover={{ y: -6, rotateY: -3 }} transition={soft} className="w-full max-w-[390px]">
        <IPhone>
          <div className="flex h-full flex-col bg-white pt-[13%]">
            {/* iMessage header */}
            <div className="relative flex flex-col items-center gap-1 border-b border-black/[0.06] bg-[#f9f9f9]/90 pb-2.5 pt-1">
              <span className="absolute left-3 top-3 text-[26px] leading-none text-[#0a84ff]">‹</span>
              <motion.span animate={typing ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.9, repeat: typing ? Infinity : 0 }} className="grid h-11 w-11 place-items-center rounded-full bg-[linear-gradient(180deg,#a1a1a6,#6e6e73)] text-[17px] font-semibold text-white">N</motion.span>
              <span className="text-[11.5px] font-medium">Nevernote <span className="text-[#8e8e93]">›</span></span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-start gap-2 overflow-hidden px-3.5 pb-3 pt-3">
              <div className="text-center text-[11px] text-[#8e8e93]"><b className="font-semibold">Today</b> 10:52 AM</div>
              <AnimatePresence mode="popLayout">
                {CHAT.slice(0, shown).map((m, i) => (
                  <motion.div
                    key={`${cycle}-${i}`}
                    layout
                    initial={m.me ? { opacity: 0, y: 40, x: 30, scale: 0.6 } : { opacity: 0, y: 12, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -24, transition: { duration: 0.35, delay: i * 0.04 } }}
                    transition={spring}
                    style={{ originX: m.me ? 1 : 0, originY: 1 }}
                    className={`flex ${m.me ? "justify-end" : "justify-start"}`}
                  >
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
                        {m.card.map((l, j) => (
                          <motion.div key={l} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: still ? 0 : 0.25 + j * 0.35 }} className="mt-1.5 flex items-center gap-2 text-[14px]">
                            <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.6, 1] }} transition={{ duration: 0.5, delay: still ? 0 : 0.3 + j * 0.35 }} className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff3b30]" /> {l}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
                {typing && (
                  <motion.div key={`typing-${cycle}-${shown}`} layout initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.12 } }} transition={spring} style={{ originX: 0, originY: 1 }} className="flex justify-start">
                    <div className="flex gap-1 rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] px-3.5 py-3">
                      {[0, 1, 2].map((d) => (
                        <motion.span key={d} className="h-2 w-2 rounded-full bg-[#8e8e93]" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {last?.me && !typing && <motion.div key={`d-${cycle}-${shown}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-right text-[11px] text-[#8e8e93]">Delivered</motion.div>}
            </div>
            {/* compose bar: the student's question types itself in, then sends */}
            <div className="flex items-center gap-2 px-3 pb-[9%] pt-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e9e9eb] text-[20px] leading-none text-[#8e8e93]">+</span>
              <span className={`flex min-h-8 flex-1 items-center gap-1 rounded-[18px] border border-black/10 py-1 pl-3.5 pr-1 text-[14px] ${draft ? "text-black" : "text-[#c7c7cc]"}`}>
                <span className="min-w-0 flex-1 truncate">{draft || "iMessage"}</span>
                <AnimatePresence>
                  {draft && (
                    <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={spring} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0a84ff] text-[13px] font-bold leading-none text-white">↑</motion.span>
                  )}
                </AnimatePresence>
              </span>
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
        <motion.div
          key={f.t}
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ ...soft, delay: (i % 3) * 0.07 }}
          className={`card group p-2.5 transition-transform duration-500 [transition-timing-function:var(--ease-liquid)] hover:-translate-y-1 ${f.wide ? "md:col-span-2" : ""}`}
        >
          <f.scene />
          <div className="flex items-start justify-between gap-4 px-3.5 pb-4 pt-4">
            <div>
              <div className="text-[19px] font-[650] leading-tight tracking-[-0.022em] text-[#1d1d1f]">{f.t}</div>
              <p className="mt-1.5 text-[15px] leading-[1.5] text-[#6e6e73]">{f.b}</p>
            </div>
            {f.pro && <span className="mt-0.5 shrink-0 rounded-full bg-[#1d1d1f] px-2.5 py-1 text-[10.5px] font-semibold tracking-wide text-white">Pro</span>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------- Safety: a bento of what's happening live ----------

type Tag = "date" | "name";
type Seg = [string, Tag?];
const LIVE: { who: "R" | "J" | "?"; at: string; segs: Seg[] }[] = [
  { who: "R", at: "41:02", segs: [["Okay, before you pack up, the lab report is"], ["due Friday at 11:59", "date"], ["on Canvas."]] },
  { who: "R", at: "41:09", segs: [["Jordan,", "name"], ["can you pass these back to the front row?"]] },
  { who: "?", at: "41:31", segs: [["Sorry, is the quiz"], ["next Tuesday", "date"], ["or Wednesday?"]] },
  { who: "R", at: "41:36", segs: [["Tuesday. Good question,"], ["Priya.", "name"], ["Units seven and eight."]] },
];
const words = (s: Seg[]) => s.reduce((n, [t]) => n + t.split(" ").length, 0);
const LIVE_AT = LIVE.reduce<number[]>((a, l, k) => [...a, k ? a[k - 1] + words(LIVE[k - 1].segs) + 6 : 0], []);
const LIVE_END = LIVE_AT[LIVE.length - 1] + words(LIVE[LIVE.length - 1].segs);
const LIVE_LOOP = LIVE_END + 40;

/** Word index (from the start of the script) at which each segment is complete. */
function doneAt(line: number, seg: number) {
  let n = LIVE_AT[line];
  for (let k = 0; k <= seg; k++) n += LIVE[line].segs[k][0].split(" ").length;
  return n;
}
const FOUND: { at: number; kind: string; t: string; b: string; tone: string }[] = [
  { at: doneAt(0, 1), kind: "Due date", t: "Lab report", b: "Friday, 11:59 PM · on Canvas", tone: "#ffe58a" },
  { at: doneAt(1, 0), kind: "Person", t: "Jordan", b: "Classmate · mentioned at 41:09", tone: "#e3e3e8" },
  { at: LIVE_AT[2] + 1, kind: "New speaker", t: "Speaker 3", b: "New voice at 41:31", tone: "#1d1d1f" },
  { at: doneAt(2, 1), kind: "Test", t: "Quiz", b: "Next Tuesday · Units 7 and 8", tone: "#ffe58a" },
  { at: doneAt(3, 1), kind: "Speaker named", t: "Speaker 3 is Priya", b: "From “Good question, Priya”", tone: "#1d1d1f" },
];

function Tile({ children, className = "", label, title }: { children: ReactNode; className?: string; label: string; title: string }) {
  return (
    <motion.div {...fade} className={`card flex flex-col overflow-hidden p-5 ${className}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#86868b]">{label}</div>
      <div className="mt-1 text-[19px] font-[650] leading-tight tracking-[-0.022em] text-[#1d1d1f]">{title}</div>
      <div className="relative mt-4 flex-1">{children}</div>
    </motion.div>
  );
}

function LiveTranscript({ t }: { t: number }) {
  const named = t >= FOUND[4].at;
  const found = FOUND.filter((f) => t >= f.at).slice(-4).reverse();
  return (
    <div className="grid h-full gap-4 md:grid-cols-[1.45fr_1fr]">
      <div className="flex min-h-[290px] flex-col overflow-hidden rounded-[18px] bg-[#fafafa] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.05)]">
        <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-2.5">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#ff3b30] shadow-[0_0_0_3px_rgb(255_59_48/0.15)]" /> Biology · live
          </span>
          <Bars n={26} height={16} width={2} color="#3a3a3c" />
        </div>
        <div className="relative flex flex-1 flex-col justify-end gap-3 overflow-hidden px-4 pb-4 pt-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-[#fafafa] to-transparent" />
          {LIVE.map((l, k) => {
            const shown = t - LIVE_AT[k];
            if (shown <= 0) return null;
            const who = l.who === "?" ? (named ? "P" : "?") : l.who;
            let used = 0;
            return (
              <motion.div key={k} layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="flex gap-2.5">
                <Avatar who={who} size={24} ring={who === "P" && t < FOUND[4].at + 14} />
                <div className="min-w-0 flex-1 text-[14px] leading-[1.5] text-[#1d1d1f]">
                  <div className="mb-0.5 flex items-center gap-2 text-[11.5px]">
                    <span className="font-semibold" style={{ color: who === "?" ? "#6e6e73" : SPEAKERS[who].c }}>{who === "?" ? "Speaker 3" : SPEAKERS[who].n}</span>
                    {l.who === "?" && !named && <span className="rounded-full bg-[#1d1d1f] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">New</span>}
                    <span className="tabular-nums text-[#aeaeb2]">{l.at}</span>
                  </div>
                  {l.segs.map(([text, tag], j) => {
                    const ws = text.split(" ");
                    const n = Math.max(0, Math.min(ws.length, shown - used));
                    used += ws.length;
                    if (!n) return null;
                    const part = ws.slice(0, n).join(" ");
                    const complete = n === ws.length;
                    return (
                      <span key={j}>
                        {j > 0 && " "}
                        {tag === "date" ? <Mark on={complete}>{part}</Mark> : tag === "name" ? <span className={`rounded-[4px] transition-colors duration-500 ${complete ? "bg-[#e9e9ee] font-semibold" : ""}`}>{part}</span> : part}
                      </span>
                    );
                  })}
                  {shown > 0 && shown < words(l.segs) && <span className="nn-caret ml-0.5 inline-block h-[14px] w-[1.5px] translate-y-[2px] bg-[#1d1d1f]" />}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col">
        <div className="mb-2 flex items-center justify-between text-[12px] text-[#86868b]">
          <span className="font-semibold text-[#1d1d1f]">Picked out automatically</span>
          <span className="tabular-nums">{FOUND.filter((f) => t >= f.at).length} found</span>
        </div>
        <div className="relative flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {found.map((f) => (
              <motion.div
                key={f.kind + f.t}
                layout="position"
                initial={{ opacity: 0, y: -14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={spring}
                className="flex items-center gap-3 rounded-[14px] bg-white p-3 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_8px_18px_-12px_rgb(0_0_0/0.25)]"
              >
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: f.tone }} />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{f.kind}</div>
                  <div className="truncate text-[13.5px] font-semibold text-[#1d1d1f]">{f.t}</div>
                  <div className="truncate text-[12px] text-[#6e6e73]">{f.b}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const SCENARIOS = [
  ["Phone face-down on the desk", "Lay it next to your notebook. The screen can lock and it keeps listening and writing."],
  ["Laptop open, on your own work", "Leave it in a background tab while you finish something else. It only speaks up when a due date does."],
  ["Online class", "Zoom, Teams or Meet. Every voice on the call gets its own name in the transcript."],
  ["A lecture hall with no Wi-Fi", "Transcription runs on your device. Your notes are written the moment you're back online."],
  ["Class split by a break", "Tap Resume after the break. The second half joins the same note as its own dated update."],
  ["Mic unplugged or battery gone", "Everything up to that second is already saved. One tap picks it back up."],
];

function Safety() {
  const [ref, t] = useLoop(LIVE_LOOP, 120, 6);
  const phase = t % 60;
  const micOff = phase >= 30 && phase < 46;
  const secs = 2472 + Math.floor(t / 8);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div ref={ref} className="mt-16">
      <div className="grid gap-4 md:grid-cols-3">
        <Tile label="Live" title="Every word, the second it's said" className="md:col-span-2 md:row-span-2">
          <LiveTranscript t={t} />
        </Tile>
        <Tile label="Microphone" title={micOff ? "Mic unplugged. Nothing lost." : "Listening clearly"}>
          <div className="flex h-full min-h-[120px] flex-col justify-between gap-3">
            <div className="grid h-[54px] place-items-center rounded-[14px] bg-[#f5f5f7]">
              <Bars n={34} height={30} width={2.5} color={micOff ? "#c7c7cc" : "#1d1d1f"} on={!micOff} />
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#6e6e73]">{micOff ? "Saved up to 41:12" : <span className="tabular-nums">Recording · {clock}</span>}</span>
              <motion.span animate={{ opacity: micOff ? 1 : 0, scale: micOff ? 1 : 0.9 }} transition={spring} className="rounded-full bg-[#1d1d1f] px-3 py-1 text-[12px] font-semibold text-white shadow-[0_2px_0_#000]">
                Resume
              </motion.span>
            </div>
          </div>
        </Tile>
        <Tile label="Offline" title="No Wi-Fi? Still writing.">
          <div className="flex h-full min-h-[120px] flex-col justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="display text-[2.6rem] leading-none tabular-nums text-[#1d1d1f]">{(1840 + t * 2).toLocaleString("en-US")}</span>
              <span className="text-[13px] text-[#6e6e73]">words, on device</span>
            </div>
            <div className="h-[5px] overflow-hidden rounded-full bg-[#ececef]">
              <div className="h-full origin-left rounded-full bg-[#1d1d1f] transition-transform duration-150" style={{ transform: `scaleX(${0.2 + ((t % 120) / 120) * 0.8})` }} />
            </div>
          </div>
        </Tile>
        <Tile label="Background" title="Keeps going in another tab">
          <div className="overflow-hidden rounded-[12px] bg-[#f5f5f7] p-1.5 pb-0 text-[12px]">
            <div className="flex items-end gap-1">
              <span className="flex items-center gap-1.5 rounded-t-[8px] bg-white px-2.5 py-1.5 font-medium text-[#1d1d1f]">Google Docs</span>
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-[#6e6e73]">
                <span className={`h-[7px] w-[7px] rounded-full transition-opacity duration-300 ${t % 8 < 4 ? "bg-[#ff3b30]" : "bg-[#ff3b30]/25"}`} /> Nevernote
              </span>
            </div>
            <div className="space-y-1.5 rounded-t-[8px] bg-white p-3">
              {[0.92, 0.78, 0.86].map((w, k) => (
                <div key={k} className="h-[5px] rounded-full bg-[#ececef]" style={{ width: `${w * 100}%` }} />
              ))}
            </div>
          </div>
        </Tile>
        <Tile label="Autosave" title="Saved every few seconds">
          <div className="flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-full bg-[#f5f5f7]">
              <motion.span key={Math.floor(t / 25)} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
                <Check size={18} strokeWidth={3} className="text-[#1d1d1f]" />
              </motion.span>
            </span>
            <div className="text-[13px] leading-snug text-[#6e6e73]">
              <div className="font-semibold tabular-nums text-[#1d1d1f]">Saved {((t % 25) / 6 | 0) + 1}s ago</div>
              Never all at the end
            </div>
          </div>
        </Tile>
        <Tile label="Breaks" title="Resume, and it picks up">
          <div className="space-y-2">
            <div className="flex h-[10px] gap-1">
              <span className="w-[54%] rounded-full bg-[#1d1d1f]" />
              <span className="w-[8%] rounded-full bg-[repeating-linear-gradient(90deg,#d1d1d6_0_3px,transparent_3px_6px)]" />
              <span className="flex-1 overflow-hidden rounded-full bg-[#ececef]">
                <span className="block h-full origin-left rounded-full bg-[#6e6e73] transition-transform duration-150" style={{ transform: `scaleX(${(t % 120) / 120})` }} />
              </span>
            </div>
            <div className="flex justify-between text-[11.5px] tabular-nums text-[#86868b]"><span>10:00 · Part 1</span><span>11:05 · Update 2</span></div>
          </div>
        </Tile>
      </div>

      <motion.div {...fade} className="mt-16">
        <h3 className="text-center text-[22px] font-[650] tracking-[-0.022em] text-[#1d1d1f] md:text-[26px]">Wherever class happens</h3>
        <div className="mt-8 grid gap-x-10 gap-y-7 border-t border-black/[0.08] pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map(([h, b], k) => (
            <div key={h} className="flex gap-4">
              <span className="pt-[2px] text-[13px] font-semibold tabular-nums text-[#aeaeb2]">{String(k + 1).padStart(2, "0")}</span>
              <div>
                <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">{h}</div>
                <p className="mt-1 text-[14.5px] leading-[1.55] text-[#6e6e73]">{b}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ---------- How it works: four live states on coloured glass ----------

function RecordButton() {
  return (
    <div className="relative grid h-full place-items-center">
      {[0, 1, 2].map((k) => (
        <motion.span key={k} className="absolute h-28 w-28 rounded-full border border-[#1d1d1f]/15" animate={{ scale: [1, 2.1], opacity: [0.7, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: k * 0.8, ease: "easeOut" }} />
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
      <div className="flex justify-center"><Bars n={40} height={56} width={3} gap={3} color="#3a3a3c" /></div>
      <div className="min-h-[64px] rounded-[16px] bg-white px-4 py-3 text-[16px] leading-snug shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_14px_28px_-16px_rgb(0_0_0/0.3)]">
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
        <motion.div key={t} animate={{ opacity: i >= k ? 1 : 0, y: i >= k ? 0 : -16, scale: i >= k ? 1 : 0.95 }} transition={spring} className="flex w-full items-center gap-3 rounded-[18px] bg-white/95 p-3.5 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_14px_28px_-16px_rgb(0_0_0/0.3)]">
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
      <div className="w-full rounded-[18px] bg-white p-4 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_20px_40px_-20px_rgb(0_0_0/0.4)]">
        <div className="flex items-baseline justify-between"><span className="text-[16px] font-semibold tracking-tight">The carbon cycle</span><span className="text-[11px] text-[#6e6e73]">3 min read</span></div>
        {["Limestone: long-term carbon sink", "Decomposition is a source, not a sink", "Nitrogen cycle is on the test"].map((b, k) => (
          <motion.div key={b} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.3 + k * 0.12 }} className="mt-2 flex items-center gap-2 text-[13.5px] text-[#424245]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1d1d1f]" />
            {b}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const STEPS: { t: string; b: string; v: () => ReactNode }[] = [
  { t: "Hit record", b: "When class starts. Then do your own thing.", v: RecordButton },
  { t: "It listens", b: "Every word, every voice, right on your device.", v: Listening },
  { t: "It flags what matters", b: "Due dates and test hints ping you right away.", v: Flag },
  { t: "Catch up in minutes", b: "Notes, a study guide and replay, whenever.", v: CatchUp },
];

function Steps() {
  return (
    <div className="mt-16 grid gap-5 md:grid-cols-2">
      {STEPS.map((s, i) => (
        <motion.div key={s.t} {...fade} transition={{ ...soft, delay: (i % 2) * 0.08 }} className="card group overflow-hidden p-3">
          <div className="relative h-[280px] overflow-hidden rounded-[22px] bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff,#f1f1f4_55%,#e7e7eb)] shadow-[inset_0_1px_0_white,inset_0_0_0_1px_rgb(0_0_0/0.03)] [perspective:1100px]">
            {/* a soft floor, so things sit on something */}
            <div className="absolute inset-x-[12%] bottom-6 h-10 rounded-[50%] bg-black/[0.07] blur-xl" />
            <div className="relative h-full origin-bottom transition-transform duration-700 [transform:rotateX(7deg)_translateZ(0)] [transition-timing-function:var(--ease-liquid)] group-hover:[transform:rotateX(0deg)_translateY(-4px)]">
              <s.v />
            </div>
          </div>
          <div className="flex items-start gap-4 px-4 pb-5 pt-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_3px_0_#000,0_10px_18px_-8px_rgb(0_0_0/0.5)]">{i + 1}</span>
            <div>
              <div className="text-[22px] font-[650] tracking-[-0.022em] text-[#1d1d1f]">{s.t}</div>
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
            <img src="/shots/iphone.webp" alt="Nevernote on iPhone" className="block h-full w-full object-cover object-top" loading="lazy" />
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
            <span key={i} className="whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-[16px] font-medium tracking-tight text-[#1d1d1f] shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_6px_14px_-10px_rgb(0_0_0/0.3)]">{c}</span>
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
  ["Can I cancel Pro anytime?", "Yes, from the link in your receipt email, or in App Store subscriptions on iPhone. You keep everything you recorded and go back to the free plan."],
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
      <motion.div initial={{ opacity: 0, y: 6 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ ...soft, delay: 0.85 }} className="max-w-[88%] rounded-[12px] rounded-bl-[4px] bg-[#f0f0f3] px-2.5 py-1.5 text-[#1d1d1f]">
        The nitrogen cycle and decomposition.
        <span className="ml-1 inline-flex rounded-full bg-white px-1.5 text-[9px] font-semibold text-[#6e6e73]">▶ 10:42</span>
      </motion.div>
    </div>
  );
}
function MiniCalendar({ on }: { on: boolean }) {
  const days = ["M", "T", "W", "T", "F"];
  return (
    <div className="grid grid-cols-5 gap-1">
      {days.map((d, i) => (
        <div key={i} className={`relative h-[62px] rounded-[9px] p-1 text-center text-[9px] font-semibold ${i === 4 ? "bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "bg-[#f2f2f5]"}`}>
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

function MiniPractice({ on }: { on: boolean }) {
  return (
    <div className="text-[9.5px] leading-tight text-[#1d1d1f]">
      <div className="h-[7px] w-[70%] rounded-full bg-[#1d1d1f]/70" />
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {["Prophase", "Metaphase", "Anaphase", "Telophase"].map((t, i) => (
          <motion.div key={t} animate={on && i === 1 ? { backgroundColor: "#1d1d1f", color: "#ffffff", scale: [1, 1.08, 1] } : { backgroundColor: "#f0f0f3", color: "#1d1d1f", scale: 1 }} transition={{ duration: 0.4, delay: on ? 0.9 : 0 }} className="rounded-[6px] px-1.5 py-1 font-medium">
            {t} {i === 1 && on && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>✓</motion.span>}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const PRO: { t: string; b: string; demo: (p: { on: boolean }) => ReactNode; wide?: boolean }[] = [
  { t: "Instant AI notes", b: "Notes, key terms and a study guide the second class ends.", demo: MiniNotes },
  { t: "Ask your notes", b: "Answers jump to the moment it was said.", demo: MiniAsk },
  { t: "Due dates, auto-added", b: "Every deadline lands in Google or Apple Calendar.", demo: MiniCalendar },
  { t: "Exam packs", b: "A whole unit of lectures in one review guide.", demo: MiniPack },
  { t: "Export anywhere", b: "Markdown, Docs, flashcards, PDF. One tap.", demo: MiniExport },
  { t: "Practice tests", b: "Fresh tests and a study plan from your own classes.", demo: MiniPractice },
];

const UNLOCKS = [
  "No sponsor cards, no overnight wait",
  "30 questions a day across every class",
  "A reminder the night before each deadline",
  "A day-by-day study plan up to every test",
  "Flashcards for Anki and Quizlet",
  "Keeps an open-source student project going",
];

/** The digits slide when they change, like a real price counter. */
function Price({ value }: { value: string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: "70%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-70%", opacity: 0 }} transition={spring} className="display inline-block text-[3.7rem] leading-none tracking-[-0.045em] text-white sm:text-[4.6rem] md:text-[5.2rem]">
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Apps Nevernote's calendar sync and exports work with, as a slow row of discs. */
function Connections() {
  return (
    <div className="mt-7">
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="font-semibold text-white">Works with the apps you already use</span>
        <span className="hidden text-white/45 sm:inline">Calendar sync and one-tap export</span>
      </div>
      <div className="relative mt-3 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max gap-3 py-1 [animation-duration:38s] nn-marquee hover:[animation-play-state:paused]">
          {[...LOGOS, ...LOGOS].map((l, i) => (
            <span key={i} title={l.name} className="group/logo relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,rgb(255_255_255/0.13),rgb(255_255_255/0.05))] shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_16px_-10px_rgb(0_0_0/0.8)] ring-1 ring-white/10 transition duration-300 hover:bg-white">
              <svg viewBox="0 0 24 24" width={22} height={22} aria-label={l.name} className="fill-white/85 transition-colors duration-300" style={{ ["--brand" as string]: l.hex }}>
                <path d={l.path} className="group-hover/logo:fill-[var(--brand)]" />
              </svg>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProCard() {
  const [yearly, setYearly] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { margin: "-120px" });
  // The little previews replay every few seconds while the card is on screen.
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!seen) return;
    setOn(true);
    let k = 0;
    const t = setInterval(() => setOn(++k % 2 === 0), 3600);
    return () => clearInterval(t);
  }, [seen]);
  // A soft specular light that follows the pointer, and a gentle tilt.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.2);
  const rx = useTransform(my, [0, 1], [2.5, -2.5]);
  const ry = useTransform(mx, [0, 1], [-3, 3]);
  const light = useTransform([mx, my] as MotionValue<number>[], ([x, y]: number[]) => `radial-gradient(520px circle at ${x * 100}% ${y * 100}%, rgb(255 255 255 / 0.09), transparent 55%)`);
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
      onPointerLeave={() => (mx.set(0.5), my.set(0.2))}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400 }}
      className="relative rounded-[34px] p-[1.5px] [background:linear-gradient(150deg,#e8e8ec,#7c7c82_28%,#3a3a3e_52%,#c9c9ce_78%,#5c5c61)] shadow-[0_50px_100px_-40px_rgb(0_0_0/0.55),0_20px_40px_-30px_rgb(0_0_0/0.4)]"
    >
      <div className="relative h-full overflow-hidden rounded-[33px] bg-[linear-gradient(180deg,#252527,#151517)] p-6 text-white md:p-8">
        <motion.div aria-hidden style={{ background: light }} className="pointer-events-none absolute inset-0" />
        <div className="absolute inset-0 rounded-[33px] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="display text-[2.3rem] font-[780] leading-none tracking-[-0.045em] md:text-[2.7rem]">
              Nevernote <span className="bg-[linear-gradient(180deg,#ffffff,#9a9aa0)] bg-clip-text text-transparent">Pro</span>
            </h3>
            {/* Yearly is the default: it's the better deal, and the toggle shows exactly how much. */}
            <div className="relative flex rounded-full bg-white/[0.08] p-1 ring-1 ring-white/10">
              {([false, true] as const).map((y) => (
                <button key={String(y)} onClick={() => setYearly(y)} className={`relative z-10 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-300 ${yearly === y ? "text-[#1d1d1f]" : "text-white/70"}`}>
                  {yearly === y && <motion.span layoutId="nn-bill" transition={spring} className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)]" />}
                  {y ? "Yearly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
            <Price value={`$${perMonth}`} />
            <div className="whitespace-nowrap pb-2 text-[14px] leading-tight text-white/55">
              per month
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={String(yearly)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={soft}>
                  {yearly ? (
                    <>
                      <span className="line-through decoration-white/40">${(PRICING.monthly.price * 12).toFixed(2)}</span> ${PRICING.yearly.price} a year
                    </>
                  ) : (
                    "billed monthly"
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {yearly && (
                <motion.span initial={{ opacity: 0, scale: 0.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -4 }} exit={{ opacity: 0, scale: 0.6 }} transition={spring} className="mb-3 ml-auto rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-[#1d1d1f] shadow-[0_3px_0_#a1a1a6,0_10px_20px_-8px_rgb(0_0_0/0.6)]">
                  Save {save}%
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="mt-2 text-[14px] text-white/60">Less than one coffee a month, for every class, all year.</p>

          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PRO.map((f, k) => (
              <motion.div
                key={f.t}
                initial={{ opacity: 0, y: 16 }}
                animate={seen ? { opacity: 1, y: 0 } : {}}
                transition={{ ...soft, delay: 0.1 + k * 0.08 }}
                whileHover={{ y: -5, scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
                className={`flex flex-col rounded-[20px] bg-white/[0.06] p-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] ring-1 ring-white/[0.08] ${f.wide ? "col-span-2 sm:flex-row sm:items-center sm:gap-3" : ""}`}
              >
                <div className={`min-h-[76px] rounded-[14px] bg-[#fbfbfd] p-2.5 shadow-[0_8px_18px_-10px_rgb(0_0_0/0.7)] ${f.wide ? "sm:order-2 sm:min-h-0 sm:flex-1" : ""}`}>{f.demo({ on })}</div>
                <div className={f.wide ? "mt-2.5 px-1 sm:mt-0 sm:w-[40%]" : "mt-2.5 px-1 pb-0.5"}>
                  <div className="text-[14.5px] font-semibold tracking-tight text-white">{f.t}</div>
                  <div className="text-[12.5px] leading-snug text-white/55">{f.b}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6">
            <div className="text-[12.5px] font-semibold text-white">Also unlocks</div>
            <ul className="mt-3 grid gap-x-5 gap-y-2 text-[13px] text-white/75 sm:grid-cols-2">
              {UNLOCKS.map((u, k) => (
                <motion.li key={u} initial={{ opacity: 0, x: -6 }} animate={seen ? { opacity: 1, x: 0 } : {}} transition={{ ...soft, delay: 0.5 + k * 0.06 }} className="flex items-start gap-2.5">
                  <span className="mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white text-[#1d1d1f] shadow-[0_2px_0_#8e8e93]">
                    <Check size={10} strokeWidth={3.4} />
                  </span>
                  {u}
                </motion.li>
              ))}
            </ul>
          </div>

          <Connections />

          <Link
            to="/app/settings"
            className="group relative mt-7 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-white py-4 text-[16.5px] font-bold text-[#1d1d1f] shadow-[0_5px_0_#9a9aa0,0_24px_40px_-16px_rgb(0_0_0/0.8)] transition hover:-translate-y-0.5 active:translate-y-[4px] active:shadow-[0_1px_0_#9a9aa0]"
          >
            {/* a slow sheen of light across the button */}
            <motion.span aria-hidden initial={{ x: "-120%" }} animate={{ x: "320%" }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3.4, ease: "easeInOut" }} className="absolute inset-y-0 left-0 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />
            Get Pro {yearly ? "yearly" : "monthly"} <ArrowRight size={17} className="transition group-hover:translate-x-1" />
          </Link>
          <p className="mt-3 text-center text-[12.5px] text-white/50">Cancel anytime. Everything in Free stays free.</p>
        </div>
      </div>
    </motion.div>
  );
}

function Pricing() {
  return (
    <div className="mx-auto mt-16 grid max-w-[1120px] grid-cols-[minmax(0,1fr)] items-stretch gap-5 md:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
      <motion.div {...fade} className="card relative flex flex-col overflow-hidden !rounded-[34px] p-7 md:p-8">
        <h3 className="display text-[2.3rem] font-[780] leading-none tracking-[-0.045em] text-[#1d1d1f] md:text-[2.7rem]">Free <span className="soft">forever</span></h3>
        <div className="mt-5 flex items-end gap-3">
          <span className="display text-[4.6rem] leading-none tracking-[-0.045em] md:text-[5.2rem]">$0</span>
          <span className="pb-2 text-[14px] leading-tight text-[#6e6e73]">no limits<br />no card</span>
        </div>
        <ul className="mt-6 space-y-3 text-[15px] text-[#1d1d1f]">
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
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.5 }} className="relative mt-7">
          <div className="absolute inset-x-5 -bottom-2 h-full rounded-[20px] bg-white/50 ring-1 ring-black/5" />
          <div className="relative rounded-[20px] bg-white p-4 shadow-[0_14px_30px_-20px_rgb(0_0_0/0.35)] ring-1 ring-black/5">
            <div className="flex items-center justify-between text-[11.5px] text-[#86868b]">
              <span>Biology · Today</span>
              <span className="flex items-center gap-1"><Check size={11} strokeWidth={3} className="text-[#1d1d1f]" /> Saved</span>
            </div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-tight">The carbon cycle</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11.5px] font-medium">
              {["52 min", "3 speakers", "6,240 words", "2 due dates"].map((t) => (
                <span key={t} className="rounded-full bg-[#f2f2f5] px-2 py-0.5 text-[#424245]">{t}</span>
              ))}
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.6 }} className="mt-5 rounded-[20px] bg-[#f5f5f7] p-4">
          <div className="text-[14.5px] font-semibold text-[#1d1d1f]">Why free stays free</div>
          <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[#6e6e73]">Transcription runs on your own phone or laptop, so a class costs us nothing to hear. AI notes cost a fraction of a cent each. There's nothing to run out of.</p>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-black/[0.06] pt-4">
            {[["∞", "classes"], ["0", "minute caps"], [String(FREE_INSTANT_SUMMARIES_PER_DAY), "instant AI notes a day"]].map(([n, l]) => (
              <div key={l}>
                <div className="display text-[1.6rem] leading-none text-[#1d1d1f]">{n}</div>
                <div className="mt-1 text-[11.5px] leading-tight text-[#6e6e73]">{l}</div>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...soft, delay: 0.7 }} className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] leading-snug">
          {[
            ["As a guest", "Record and transcribe right away, no sign-up. Notes stay in this browser."],
            ["With a free account", "Sign in with Google to unlock AI notes, study guides, sync and calendar files."],
          ].map(([h, b]) => (
            <div key={h} className="rounded-[16px] p-3.5 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.07)]">
              <div className="font-semibold text-[#1d1d1f]">{h}</div>
              <div className="mt-1 text-[#6e6e73]">{b}</div>
            </div>
          ))}
        </motion.div>
        <div className="mt-auto pt-6"><Cta big>Start free</Cta></div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-[#6e6e73]">Recording and transcription have no limits at all. AI notes: 5 instant a day (updates count), and the rest arrive overnight or right away after a 5-second sponsor card.</p>
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

      <Section id="features" tone="grey" line a="Everything class says." b="Sorted for you." sub="Six things Nevernote does while you get on with your own work.">
        <Features />
      </Section>

      <Section a="Never loses a word." b="Even when things go wrong." sub="Words stream in as they're said, and Nevernote picks out due dates, names and new voices on its own. Mic unplugged or Wi-Fi gone, it keeps going.">
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
        <motion.div {...fade} className="relative overflow-hidden rounded-[40px] bg-[linear-gradient(180deg,#232325,#111113)] px-6 py-24 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] md:py-32">
          {/* one soft overhead light, like a lamp over a desk */}
          <div className="absolute inset-0 bg-[radial-gradient(55%_65%_at_50%_0%,rgb(255_255_255/0.1),transparent)]" />
          <div className="relative">
            <h2 className="display text-[3.4rem] font-[800] leading-[0.92] tracking-[-0.055em] text-white md:text-[7rem]">Lock in.</h2>
            <h2 className="display mt-1 text-[3.4rem] font-[800] leading-[0.92] tracking-[-0.055em] text-white/40 md:text-[7rem]">We've got class.</h2>
            <p className="mx-auto mt-7 max-w-[460px] text-[18px] text-white/65">Free on every device. Recording in ten seconds.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/app" className="group inline-flex items-center gap-2 rounded-full bg-white py-4 pl-8 pr-7 text-[17px] font-bold text-[#1d1d1f] shadow-[0_5px_0_#9a9aa0,0_24px_40px_-14px_rgb(0_0_0/0.8)] transition hover:-translate-y-0.5 active:translate-y-[4px] active:shadow-[0_1px_0_#9a9aa0]">
                Start free <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#platforms" className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,#3a3a3d,#2a2a2d)] px-7 py-4 text-[17px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_5px_0_#050505,0_24px_40px_-14px_rgb(0_0_0/0.8)] transition hover:-translate-y-0.5 active:translate-y-[4px] active:shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_1px_0_#050505]">
                Get the apps
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
