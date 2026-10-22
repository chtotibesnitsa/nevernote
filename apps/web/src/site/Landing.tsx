import { PRICING } from "@nevernote/core";
import {
  Apple, ArrowRight, AudioLines, BellRing, BookOpenCheck, Brain, CalendarPlus, Check, CloudOff, FlaskConical, Github, Globe, GraduationCap,
  Laptop, Lock, MessageCircleQuestion, Mic, Monitor, Pause, Scale, School, Smartphone, Stethoscope, Tablet, Users, Video,
} from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Hmu, Logo, soft, spring } from "../components/ui.tsx";
import { GITHUB_REPO, RELEASES } from "../lib/bridge.ts";
import { BENCH } from "./bench.ts";
import { ClassStory } from "./ClassStory.tsx";
import { AppIcon, AskScene, CalendarScene, DeadlineScene, NotesScene, SpeakersScene, TranscriptScene } from "./Scenes.tsx";

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: soft };

/** Amber call to action with the arrow chip, like a macOS default button. */
function Cta({ to = "/app", children, big }: { to?: string; children: ReactNode; big?: boolean }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border-[2.5px] border-[#1c1915] bg-[#ff9a2e] font-extrabold text-[#1c1915] shadow-[4px_4px_0_#1c1915] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#1c1915] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#1c1915] ${big ? "py-3 pl-6 pr-3 text-[16px]" : "py-1.5 pl-4 pr-1.5 text-sm"}`}
    >
      {children}
      <span className={`grid place-items-center rounded-full bg-[#1c1915] text-white transition group-hover:translate-x-0.5 ${big ? "h-8 w-8" : "h-6 w-6"}`}>
        <ArrowRight size={big ? 16 : 13} strokeWidth={2.6} />
      </span>
    </Link>
  );
}

function Nav() {
  const { scrollY } = useScroll();
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setCondensed(y > innerHeight * 0.9));
  const links: [string, string][] = [["#features", "Features"], ["#how", "How it works"], ["#pricing", "Pricing"], ["#faq", "FAQ"]];
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3">
      <motion.nav
        layout
        transition={spring}
        className={`flex w-full items-center gap-6 ${condensed ? "max-w-[760px] rounded-full border-[2.5px] border-[#1c1915] bg-white/85 py-1.5 pl-5 pr-1.5 shadow-[4px_4px_0_#1c1915] backdrop-blur-2xl" : "max-w-[1180px] rounded-none border border-transparent bg-transparent px-3 py-2"}`}
      >
        <Link to="/" aria-label="Nevernote home" className="shrink-0">
          <Logo size={20} />
        </Link>
        <div className="ml-auto hidden items-center gap-6 text-[14px] text-[var(--ink-2)] md:flex">
          {links.map(([h, t]) => (
            <a key={h} href={h} className="transition hover:text-[var(--fg)]">{t}</a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Cta>Start free</Cta>
          <span className="sm:hidden"><Hmu compact /></span>
          <span className="hidden sm:block"><Hmu compact={condensed} /></span>
          <button className="grid h-9 w-9 place-items-center rounded-full md:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <span className="block h-0.5 w-4 bg-current shadow-[0_5px_0_currentColor]" />
          </button>
        </div>
      </motion.nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="absolute inset-x-3 top-[64px] flex flex-col rounded-3xl border border-white/80 bg-white/85 p-3 shadow-xl backdrop-blur-2xl md:hidden">
            {links.map(([h, t]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-base">{t}</a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One short title per section, kept on one line on desktop. */
function Section({ id, title, sub, children, className = "" }: { id?: string; title: ReactNode; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-[1120px] scroll-mt-24 px-5 py-20 md:py-28 ${className}`}>
      <motion.div {...fade} className="mx-auto text-center">
        <h2 className="title-serif text-balance text-[2.5rem] leading-[1.04] md:whitespace-nowrap md:text-[3.6rem]">{title}</h2>
        {sub && <p className="mx-auto mt-4 max-w-[560px] text-lg text-[var(--ink-2)]">{sub}</p>}
      </motion.div>
      {children}
    </section>
  );
}

const Accent = ({ children }: { children: ReactNode }) => <span className="text-[#ff7a00]">{children}</span>;

// ---------- Hero ----------

const BEATS: { at: number; title: ReactNode; sub: string }[] = [
  { at: 0.12, title: <>Most of class is <Accent>filler.</Accent></>, sub: "Attendance, side tangents, the same slide read out loud. Somewhere in there is the one thing you need." },
  { at: 0.34, title: <>Nevernote catches <Accent>what matters.</Accent></>, sub: "Every word, every speaker, every due date. Written down on your laptop while you work on something else." },
  { at: 0.56, title: <>Never miss a <Accent>beat.</Accent></>, sub: "The transcript fills in on the side of your screen. The pill at the bottom means it's listening." },
  { at: 0.78, title: <>Spend class on <Accent>your</Accent> work.</>, sub: "Read the notes later, in five minutes, on your own schedule. Stay ahead of everyone in the room." },
];

function Beat({ p, at, next, children }: { p: MotionValue<number>; at: number; next: number; children: ReactNode }) {
  // Scroll-driven ranges must stay within 0..1; the last beat simply stays.
  const last = next >= 1;
  const opacity = useTransform(p, last ? [at - 0.035, at] : [at - 0.035, at, next - 0.035, next], last ? [0, 1] : [0, 1, 1, 0]);
  const y = useTransform(p, last ? [at - 0.035, at] : [at - 0.035, at, next - 0.035, next], last ? [24, 0] : [24, 0, 0, -24]);
  const filter = useTransform(p, [at - 0.035, at], ["blur(8px)", "blur(0px)"]);
  return (
    <motion.div style={{ opacity, y, filter }} className="pointer-events-none absolute inset-x-0 top-0 mx-auto max-w-[860px] px-5 text-center">
      {children}
    </motion.div>
  );
}

function Hero() {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  // A plain copy of the scroll progress: the titles and the camera read the same number.
  const p = useMotionValue(0);
  const pv = useRef(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    pv.current = v;
    p.set(v);
  });
  const progress = useCallback(() => pv.current, []);
  const introOpacity = useTransform(p, [0, 0.07], [1, 0]);
  const introY = useTransform(p, [0, 0.07], [0, -20]);
  const hint = useTransform(p, [0, 0.04], [1, 0]);

  return (
    <div ref={wrap} className="relative h-[460vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#fff7ee_0%,#fbefe2_45%,#f4e3d1_100%)]" />
        <div className="absolute inset-0">
          <ClassStory progress={progress} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[44%] bg-gradient-to-b from-[#fff7ee] via-[#fff7ee]/85 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#fdfcfa] to-transparent" />

        <div className="absolute inset-x-0 top-[96px] md:top-[112px]">
          <motion.div style={{ opacity: introOpacity, y: introY }} className="mx-auto max-w-[860px] px-5 text-center">
            <motion.h1 initial={{ opacity: 0, y: 18, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={soft} className="title-serif whitespace-nowrap text-[2.3rem] leading-[0.98] sm:text-[3.6rem] md:text-[4.4rem]">
              Save class <Accent>for later.</Accent>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.1 }} className="mx-auto mt-4 max-w-[520px] text-[17px] text-[var(--ink-2)] md:text-lg">
              Nevernote listens, writes it all down and pulls out what matters. You work on what actually moves you forward.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.18 }} className="pointer-events-auto mt-6 flex justify-center">
              <Cta big>Start free</Cta>
            </motion.div>
          </motion.div>
          {BEATS.map((b, i) => (
            <Beat key={i} p={p} at={b.at} next={BEATS[i + 1]?.at ?? 1.2}>
              <h2 className="title-serif text-balance text-[2.1rem] leading-[1] sm:text-[3.2rem] md:whitespace-nowrap md:text-[3.8rem]">{b.title}</h2>
              <p className="mx-auto mt-4 max-w-[540px] text-[17px] text-[var(--ink-2)]">{b.sub}</p>
            </Beat>
          ))}
        </div>

        <motion.div style={{ opacity: hint }} className="absolute inset-x-0 bottom-6 flex justify-center">
          <div className="flex flex-col items-center gap-1 text-xs text-[var(--mute)]">
            Scroll
            <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity }} className="block h-5 w-[2px] rounded-full bg-[var(--mute)]/60" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ---------- Sections ----------

/** iMessage thread: the pain point and the fix. */
const CHAT: { me?: boolean; t?: string; audio?: string; card?: string[] }[] = [
  { me: true, t: "wait did she say when the essay is due?? i was finishing calc" },
  { audio: "0:04 · from 10:42 in APUSH" },
  { t: "Thursday 11:59 PM, 1,200 words on the New Deal. Reminder's set for Wednesday night." },
  { me: true, t: "and is the quiz still friday" },
  { card: ["Quiz moved to Monday, units 7 and 8", "Essay due Thu 11:59 PM", "Bring your textbook tomorrow"] },
];

function Chat() {
  return (
    <motion.div {...fade} className="mx-auto mt-12 max-w-[440px] rounded-[44px] border border-white bg-white/70 p-3 shadow-[0_1px_0_white_inset,0_40px_80px_-40px_rgb(60_40_20/0.45)] backdrop-blur-xl">
      <div className="rounded-[34px] bg-white px-4 pb-5 pt-4">
        <div className="flex flex-col items-center gap-1 border-b border-[#ececec] pb-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-[#2a241e] to-[#16120e] font-serif text-xl text-white">N</span>
          <span className="text-[12px] font-medium">Nevernote</span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {CHAT.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 14, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ ...spring, delay: i * 0.35 }} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
              {m.t && <div className={`max-w-[80%] rounded-[20px] px-3.5 py-2 text-[15px] leading-snug ${m.me ? "rounded-br-[6px] bg-[#0a84ff] text-white" : "rounded-bl-[6px] bg-[#e9e9eb] text-black"}`}>{m.t}</div>}
              {m.audio && (
                <div className="flex items-center gap-2.5 rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] px-3 py-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0a84ff] text-[11px] text-white">▶</span>
                  <span className="flex items-center gap-[2.5px]">
                    {[6, 12, 18, 9, 15, 20, 11, 7, 14, 17, 8, 12, 9, 6].map((h, j) => (
                      <motion.span key={j} className="w-[2.5px] rounded-full bg-[#6b6b70]" animate={{ height: [h, h * 0.4, h] }} transition={{ duration: 1.2, repeat: Infinity, delay: j * 0.07 }} />
                    ))}
                  </span>
                  <span className="text-[11px] text-[#6b6b70]">{m.audio}</span>
                </div>
              )}
              {m.card && (
                <div className="w-[80%] rounded-[20px] rounded-bl-[6px] bg-[#e9e9eb] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b6b70]">From today's class</div>
                  {m.card.map((l) => (
                    <div key={l} className="mt-1.5 flex items-center gap-2 text-[14px]"><BellRing size={14} className="shrink-0 text-[#ff9f0a]" /> {l}</div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
          <div className="mt-1 text-right text-[11px] text-[#8e8e93]">Delivered</div>
        </div>
      </div>
    </motion.div>
  );
}

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
const ICON = {
  amber: ["#f7b267", "#e07a2c"],
  blue: ["#64b5ff", "#0a7cff"],
  green: ["#6fdc8c", "#24a148"],
  purple: ["#c49bff", "#8a4dff"],
  red: ["#ff8a7a", "#ff3b30"],
  teal: ["#6fe0d6", "#13a89e"],
  ink: ["#5a524a", "#1c1915"],
} as const;

const FEATURES: { t: string; b: string; scene: ComponentType; pro?: boolean; cta: string }[] = [
  { t: "Every word, written down", b: "A live transcript, on your device, a second after it's said.", scene: TranscriptScene, cta: "Try it" },
  { t: "Knows who said what", b: "Teacher, classmates, guests. Name a voice once and it sticks.", scene: SpeakersScene, cta: "See speakers" },
  { t: "Deadline radar", b: "\"Due Friday\" turns into a notification the moment it's said.", scene: DeadlineScene, cta: "Get alerts" },
  { t: "Notes and flashcards", b: "Clean notes, key terms and a study guide for every class.", scene: NotesScene, cta: "See notes" },
  { t: "Straight to your calendar", b: "Every due date lands in Google or Apple Calendar.", scene: CalendarScene, pro: true, cta: "Go Pro" },
  { t: "Ask your notes", b: "\"What's on Monday's quiz?\" Answers with the moment it was said.", scene: AskScene, pro: true, cta: "Go Pro" },
];

function Features() {
  return (
    <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <motion.div key={f.t} {...fade} transition={{ ...soft, delay: (i % 3) * 0.07 }} className="group rounded-[30px] border-[2.5px] border-[#1c1915] bg-white shadow-[5px_5px_0_#1c1915] p-2.5 transition duration-300 hover:-translate-y-1.5 hover:shadow-[8px_10px_0_#1c1915]">
          <f.scene />
          <div className="px-3 pb-3 pt-4">
            <div className="flex items-center gap-2 text-[17px] font-semibold">
              {f.t}
              {f.pro && <span className="rounded-full bg-[#1c1915] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">Pro</span>}
            </div>
            <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--ink-2)]">{f.b}</p>
            <Link to={f.pro ? "/app/settings" : "/app"} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-[13px] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition group-hover:border-[var(--color-clay)]/40">
              {f.cta} <ArrowRight size={13} />
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const ROOMS: { icon: Icon; c: readonly [string, string]; t: string; b: string }[] = [
  { icon: Mic, c: ICON.red, t: "Phone on the desk", b: "Hears the whole room." },
  { icon: Laptop, c: ICON.ink, t: "Laptop open", b: "Built-in mic, Mac or PC." },
  { icon: Video, c: ICON.blue, t: "Online class", b: "Zoom, Teams, Meet." },
  { icon: CloudOff, c: ICON.teal, t: "No Wi-Fi", b: "Fully offline." },
  { icon: Pause, c: ICON.amber, t: "Breaks", b: "Pause, resume, one note." },
];

const STEPS: { icon: Icon; c: readonly [string, string]; t: string; b: string }[] = [
  { icon: Mic, c: ICON.red, t: "Hit record", b: "Start Nevernote when class starts, then do your own thing." },
  { icon: AudioLines, c: ICON.green, t: "It listens", b: "Every word transcribed on your device, every voice labeled." },
  { icon: BellRing, c: ICON.amber, t: "It flags what matters", b: "Due dates and test announcements ping you right away." },
  { icon: BookOpenCheck, c: ICON.purple, t: "You catch up in minutes", b: "Notes, study guide and replay, whenever you want." },
];

const AUDIENCES: { icon: Icon; c: readonly [string, string]; t: string; b: string }[] = [
  { icon: School, c: ICON.blue, t: "High school", b: "AP and honors, a deadline every week." },
  { icon: GraduationCap, c: ICON.ink, t: "College", b: "Three-hour lectures, no slides posted." },
  { icon: Stethoscope, c: ICON.red, t: "Med and nursing", b: "Dense terms, fast talkers." },
  { icon: Scale, c: ICON.amber, t: "Law", b: "Case names, word for word." },
  { icon: FlaskConical, c: ICON.green, t: "Labs and STEM", b: "Procedures you can replay." },
  { icon: Brain, c: ICON.purple, t: "Learning differences", b: "The whole class, at your pace." },
];

const PLATFORMS: { icon: Icon; c: readonly [string, string]; name: string; note: string; href?: string }[] = [
  { icon: Smartphone, c: ICON.ink, name: "iPhone", note: "Records with the screen locked" },
  { icon: Tablet, c: ICON.blue, name: "iPad", note: "Big-screen study guides" },
  { icon: Apple, c: ICON.ink, name: "Mac", note: "Apple Silicon and Intel", href: RELEASES },
  { icon: Monitor, c: ICON.blue, name: "Windows", note: "Windows 10 and 11", href: RELEASES },
  { icon: Globe, c: ICON.amber, name: "Web", note: "Nothing to install", href: "/app" },
];

const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. Recording, transcription, speaker labels, deadline alerts, sync and AI notes are free. Transcription runs on your own device, so it costs us nothing, and AI notes cost a fraction of a cent. Pro adds calendar auto-add, Ask your notes and instant notes every time."],
  ["Does my audio get uploaded?", "No. Speech recognition and speaker labels run on your phone or computer. Only the transcript text syncs, so your other devices can show it and notes can be written. Your audio stays on the device that recorded it."],
  ["Isn't this just skipping class?", "No. You're still in the room, and you still get everything that was said. Nevernote just means you don't have to spend the whole hour taking notes to catch the five minutes that count."],
  ["Does it work without internet?", "Yes. Record and transcribe with Wi-Fi off. Notes are written as soon as you're back online, and the dots go from orange to green."],
  ["How accurate is it?", "We test it on real classroom recordings, from a quiet room to a loud one with an echo. The open-source Parakeet engine misses about 4 words in 100 in a quiet room and about 13 in a noisy classroom. The full results are on GitHub."],
  ["Can I try it without an account?", "Yes, on the website. Guest mode keeps notes in your browser only. Sign up with Google any time to keep them and use them on your phone and laptop."],
  ["Is it okay to record class?", "Ask first. Many schools and states require consent from your teacher or everyone in the room. Nevernote reminds you before every recording."],
  ["Can I cancel Pro anytime?", "Yes, in your App Store subscriptions. You keep everything you recorded and go back to the free plan."],
];

function Tile({ icon, c, t, b, i }: { icon: Icon; c: readonly [string, string]; t: string; b: string; i: number }) {
  return (
    <motion.div {...fade} transition={{ ...soft, delay: i * 0.05 }} className="rounded-[26px] border-[2.5px] border-[#1c1915] bg-white shadow-[5px_5px_0_#1c1915] p-5 text-left  transition duration-500 hover:-translate-y-1">
      <AppIcon icon={icon} from={c[0]} to={c[1]} size={46} />
      <div className="mt-4 font-semibold">{t}</div>
      <p className="mt-0.5 text-sm text-[var(--ink-2)]">{b}</p>
    </motion.div>
  );
}

export function Landing() {
  // The website is light-only, whatever the app's theme is.
  useEffect(() => {
    const html = document.documentElement;
    const was = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.background = "#fdfcfa";
    return () => {
      if (was) html.classList.add("dark");
      html.style.background = "";
    };
  }, []);

  return (
    <div className="site relative min-h-screen overflow-x-clip">
      <Nav />
      <Hero />

      <Section title={<>Zoned out? <Accent>Covered.</Accent></>} sub="You looked away for one minute and missed the only thing that mattered. Nevernote didn't.">
        <Chat />
      </Section>

      <Section id="features" title={<>What it does <Accent>for you.</Accent></>}>
        <Features />
      </Section>

      <Section title={<>Works in <Accent>any room.</Accent></>}>
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-5">
          {ROOMS.map((r, i) => <Tile key={r.t} {...r} i={i} />)}
        </div>
      </Section>

      <Section id="how" title={<>Four steps, <Accent>zero</Accent> stress.</>}>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div key={s.t} {...fade} transition={{ ...soft, delay: i * 0.07 }} className="relative rounded-[26px] border-[2.5px] border-[#1c1915] bg-white shadow-[5px_5px_0_#1c1915] p-6 text-left ">
              <span className="absolute right-5 top-5 font-serif text-3xl text-[var(--line)]">{i + 1}</span>
              <AppIcon icon={s.icon} from={s.c[0]} to={s.c[1]} />
              <div className="mt-5 text-lg font-semibold">{s.t}</div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--ink-2)]">{s.b}</p>
            </motion.div>
          ))}
        </div>
        <motion.div {...fade} className="mt-12 flex justify-center">
          <Cta big>Try it now</Cta>
        </motion.div>
      </Section>

      <Section id="accuracy" title={<>Tested in <Accent>real</Accent> classrooms.</>} sub="Every engine, the same recordings, from a quiet room to a loud one with an echo. Lower is better.">
        <motion.div {...fade} className="mt-10 overflow-x-auto rounded-[26px] border-[2.5px] border-[#1c1915] bg-white shadow-[5px_5px_0_#1c1915]">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--mute)]">
                <th className="px-5 py-3 font-medium">Word error rate</th>
                {BENCH.tiers.map((t) => <th key={t} className="px-4 py-3 font-medium">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {BENCH.rows.map((r) => (
                <tr key={r.engine} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-5 py-3">
                    <span className={r.ours ? "font-semibold" : ""}>{r.engine}</span>
                    {r.ours && <span className="ml-2 rounded-full bg-[#1c1915] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">ours</span>}
                  </td>
                  {r.wer.map((w, i) => <td key={i} className={`px-4 py-3 tabular-nums ${r.ours ? "font-semibold" : "text-[var(--ink-2)]"}`}>{w}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
        <p className="mt-3 text-center text-xs text-[var(--mute)]">
          {BENCH.note} <a className="underline" href={`${GITHUB_REPO}/tree/main/bench`}>Run it yourself</a>
        </p>
      </Section>

      <Section title={<>Built for <Accent>every</Accent> class.</>}>
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
          {AUDIENCES.map((a, i) => <Tile key={a.t} {...a} i={i} />)}
        </div>
      </Section>

      <Section id="platforms" title={<>On <Accent>every</Accent> device.</>} sub="Sign in once and every class follows you. No app? Just open the website.">
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-5">
          {PLATFORMS.map((p, i) => {
            const inner = (
              <>
                <AppIcon icon={p.icon} from={p.c[0]} to={p.c[1]} size={46} />
                <div className="mt-4 font-semibold">{p.name}</div>
                <p className="mt-0.5 text-sm text-[var(--ink-2)]">{p.note}</p>
                <div className="mt-3 text-sm font-medium text-[var(--color-clay)]">{p.href ? (p.name === "Web" ? "Open now →" : "Download →") : "App Store soon"}</div>
              </>
            );
            const cls = "block h-full rounded-[26px] border-[2.5px] border-[#1c1915] bg-white shadow-[5px_5px_0_#1c1915] p-5 text-left  transition duration-500 hover:-translate-y-1";
            return (
              <motion.div key={p.name} {...fade} transition={{ ...soft, delay: i * 0.05 }}>
                {p.href?.startsWith("/") ? <Link to={p.href} className={cls}>{inner}</Link> : p.href ? <a href={p.href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>}
              </motion.div>
            );
          })}
        </div>
      </Section>

      <Section id="pricing" title={<>Free. <Accent>Actually</Accent> free.</>} sub="No trial that runs out. No minute caps. No card.">
        <div className="mx-auto mt-12 grid max-w-[880px] gap-4 md:grid-cols-2">
          <motion.div {...fade} className="rounded-[30px] border-[2.5px] border-[#1c1915] bg-white shadow-[5px_5px_0_#1c1915] p-8 text-left ">
            <div className="text-lg font-semibold">Free</div>
            <div className="title-serif mt-1 text-5xl">$0</div>
            <ul className="mt-6 space-y-2.5 text-[15px]">
              {["Unlimited recording, transcribed offline", "Speaker labels", "Deadline and test alerts", "AI notes, study guides and key terms", "Your own note style and rules", "Sync across phone, laptop and web"].map((f) => (
                <li key={f} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-[var(--color-dot-green)]" /> {f}</li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-[var(--mute)]">3 instant AI notes a day. The rest arrive overnight, or right away after a 5-second sponsor card.</p>
            <Link to="/app" className="mt-6 block rounded-full border-[2.5px] border-[#1c1915] bg-[#ff9a2e] py-3 text-center font-extrabold shadow-[3px_3px_0_#1c1915] transition hover:-translate-y-0.5">Start free</Link>
          </motion.div>
          <motion.div {...fade} transition={{ ...soft, delay: 0.08 }} className="relative overflow-hidden rounded-[30px] border-[2.5px] border-[#1c1915] bg-[#ffd27a] p-8 text-left shadow-[5px_5px_0_#1c1915]">
            <div className="liquid pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgb(240_162_90/0.45),transparent_60%)] blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-lg font-semibold">Pro <Lock size={15} className="text-[var(--color-clay)]" /></div>
              <div className="title-serif mt-1 text-5xl">${PRICING.monthly.price}<span className="text-xl text-[var(--mute)]"> /mo</span></div>
              <div className="text-sm text-[var(--mute)]">or {PRICING.yearly.label} ({PRICING.yearly.note})</div>
              <ul className="mt-6 space-y-2.5 text-[15px]">
                {["Everything in Free", "Due dates added to your calendar", "Ask your notes anything", "Exam packs across a whole unit", "Instant notes every time", "A style for every class"].map((f) => (
                  <li key={f} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-[var(--color-clay)]" /> {f}</li>
                ))}
              </ul>
              <div className="mt-6 flex"><Link to="/app/settings" className="block w-full rounded-full border-[2.5px] border-[#1c1915] bg-[#1c1915] py-3 text-center font-extrabold text-white shadow-[3px_3px_0_#ff9a2e]">Go Pro</Link></div>
            </div>
          </motion.div>
        </div>
      </Section>

      <Section id="faq" title="Questions, answered.">
        <div className="mx-auto mt-10 max-w-[760px] divide-y divide-[var(--line)] text-left">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                {q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--bubble)] text-[var(--mute)] transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-2)]">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section className="mx-auto max-w-[1120px] px-5 pb-20">
        <motion.div {...fade} className="relative overflow-hidden rounded-[40px] border-[3px] border-[#1c1915] bg-[#ffd27a] px-6 py-16 text-center shadow-[8px_8px_0_#1c1915] md:py-24">
          <div className="liquid pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(240_162_90/0.35),transparent_60%)] blur-3xl" />
          <div className="relative">
            <h2 className="title-serif text-[2.6rem] leading-[1.02] md:whitespace-nowrap md:text-6xl">Lock in. <Accent>We've got class.</Accent></h2>
            <p className="mx-auto mt-4 max-w-[480px] text-[var(--ink-2)]">Free on every device. Recording in ten seconds.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Cta big>Start free</Cta>
              <a href={RELEASES} className="inline-flex items-center gap-2 rounded-full border-[2.5px] border-[#1c1915] bg-white px-6 py-3 font-extrabold shadow-[4px_4px_0_#1c1915]">Download for desktop</a>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pb-16">
        <motion.div {...fade} className="flex flex-col items-center justify-between gap-5 rounded-[28px] border-[2.5px] border-[#1c1915] bg-white p-6 shadow-[5px_5px_0_#1c1915] md:flex-row md:p-7">
          <div className="text-left">
            <div className="flex items-center gap-2 text-lg font-extrabold">
              Want even more? <span className="rounded-full bg-[#1c1915] px-2 py-0.5 text-[11px] uppercase text-white">Pro</span>
            </div>
            <p className="mt-1 text-[15px] text-[var(--ink-2)]">Due dates straight into your calendar, ask your notes anything, exam packs across a whole unit, instant notes every time. ${PRICING.monthly.price}/mo, cancel anytime. Everything above stays free.</p>
          </div>
          <Link to="/app/settings" className="shrink-0 rounded-full border-[2.5px] border-[#1c1915] bg-[#ffd27a] px-6 py-2.5 font-extrabold shadow-[3px_3px_0_#1c1915] transition hover:-translate-y-0.5">See Pro</Link>
        </motion.div>
      </section>

      <footer className="mx-auto max-w-[1120px] px-5 pb-12">
        <div className="grid gap-8 border-t border-[var(--line)] pt-10 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo size={18} />
            <p className="mt-3 max-w-[220px] text-[var(--mute)]">The mic that pays attention in class, so you can work on what matters.</p>
          </div>
          {[
            ["Product", [["Features", "#features"], ["How it works", "#how"], ["Pricing", "#pricing"], ["Accuracy", "#accuracy"]]],
            ["Get it", [["Web app", "/app"], ["Mac and Windows", RELEASES], ["iPhone and iPad", "#platforms"]]],
            ["Company", [["Open source", GITHUB_REPO], ["Privacy", "/privacy"], ["Support", "/support"]]],
          ].map(([h, ls]) => (
            <div key={h as string}>
              <div className="font-semibold">{h as string}</div>
              <div className="mt-3 flex flex-col gap-2 text-[var(--mute)]">
                {(ls as string[][]).map(([t, href]) =>
                  href.startsWith("/") ? <Link key={t} to={href} className="hover:text-[var(--fg)]">{t}</Link> : <a key={t} href={href} className="hover:text-[var(--fg)]">{t}</a>,
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 text-xs text-[var(--mute)] sm:flex-row">
          <span>© {new Date().getFullYear()} Nevernote. Made by a student, for students.</span>
          <a href={GITHUB_REPO} className="inline-flex items-center gap-1.5 hover:text-[var(--fg)]"><Github size={14} /> Star us on GitHub</a>
        </div>
      </footer>
    </div>
  );
}
