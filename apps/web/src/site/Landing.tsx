import { PRICING } from "@nevernote/core";
import {
  Apple, ArrowRight, AudioLines, BellRing, BookOpenCheck, Brain, CalendarPlus, Check, CloudOff, FlaskConical, Github, Globe, GraduationCap,
  Laptop, Lock, MessageCircleQuestion, Mic, Monitor, Pause, Scale, School, Smartphone, Sparkles, Stethoscope, Tablet, Users, Video,
} from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Hmu, Logo, soft, spring, StatusDot } from "../components/ui.tsx";
import { GITHUB_REPO, RELEASES } from "../lib/bridge.ts";
import { BENCH } from "./bench.ts";

const os = typeof navigator !== "undefined" && /Win/i.test(navigator.platform) ? "windows" : "mac";

const DEMO = [
  { who: "Ms. Rivera", c: "#6b4f3a", t: "Who can tell me where carbon is stored the longest?" },
  { who: "Jordan", c: "#3f6f8a", t: "Sedimentary rock, like limestone?" },
  { who: "Ms. Rivera", c: "#6b4f3a", t: "Good. Limestone holds carbon for millions of years." },
  { who: "Ms. Rivera", c: "#6b4f3a", t: "Your lab report is due Friday at 11:59 p.m.", tag: "Due · Fri, Oct 24" },
  { who: "Sam", c: "#7a5a8c", t: "Will the nitrogen cycle be on the test?" },
  { who: "Ms. Rivera", c: "#6b4f3a", t: "Yes. Write that down, it will be on the test.", tag: "★ Important" },
];

function Demo() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x >= DEMO.length + 3 ? 1 : x + 1)), 1500);
    return () => clearInterval(t);
  }, []);
  const shown = DEMO.slice(0, Math.min(n, DEMO.length));
  const done = n > DEMO.length;
  const toast = n >= 4 && n <= DEMO.length + 1;
  return (
    <div className="glass relative mx-auto w-full max-w-[640px] overflow-hidden rounded-[28px] p-2 text-left">
      <div className="rounded-[22px] bg-[var(--card)] p-5 sm:p-7">
        <div className="flex items-center gap-1.5">
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
          ))}
          <span className="ml-auto inline-flex items-center gap-2 text-xs text-[var(--mute)]">
            <span className="inline-flex gap-1">
              <StatusDot dot={done ? "green" : "red"} live={!done} size={6} />
              <StatusDot dot={done ? "green" : "orange"} live={false} size={6} />
              <StatusDot dot={done ? "green" : "orange"} size={6} />
            </span>
            {done ? "Notes ready" : "Recording · offline"}
          </span>
        </div>
        <div className="title-serif mt-4 text-3xl sm:text-4xl">APES Notes 10/21</div>
        <div className="mt-5 flex h-[300px] flex-col justify-end gap-2 overflow-hidden scroll-fade">
          <AnimatePresence initial={false}>
            {shown.map((d, i) => (
              <motion.div key={i} layout initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={soft}>
                {(i === 0 || shown[i - 1].who !== d.who) && (
                  <div className="mb-1 ml-1 text-xs font-semibold" style={{ color: d.c }}>
                    {d.who}
                  </div>
                )}
                <div className="inline-block max-w-[92%] rounded-2xl bg-[var(--bubble)] px-4 py-2 text-[15px] sm:text-base">
                  {d.t}
                  {d.tag && <span className="ml-2 rounded-full bg-[var(--color-clay)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-leather)] dark:text-[var(--color-clay)]">{d.tag}</span>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60 }}
            transition={spring}
            className="glass-solid absolute right-5 top-16 w-60 rounded-2xl p-3 text-left"
          >
            <div className="text-xs font-semibold">Due: Lab report</div>
            <div className="text-xs text-[var(--ink-2)]">Fri, Oct 24 · 11:59 PM · APES</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: soft };

function Nav() {
  const [open, setOpen] = useState(false);
  const links: [string, string][] = [["#features", "Features"], ["#how", "How it works"], ["#platforms", "Platforms"], ["#pricing", "Pricing"], ["#faq", "FAQ"]];
  return (
    <div className="fixed inset-x-0 top-3 z-40 px-3">
      <nav className="glass mx-auto flex max-w-[1120px] items-center gap-6 rounded-full py-2 pl-5 pr-2">
        <Link to="/" aria-label="Nevernote home">
          <Logo size={20} />
        </Link>
        <div className="hidden gap-5 text-sm text-[var(--ink-2)] lg:flex">
          {links.map(([h, t]) => (
            <a key={h} href={h} className="transition hover:text-[var(--fg)]">{t}</a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/app" className="hidden rounded-full bg-[var(--fg)] px-4 py-1.5 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 sm:block">
            Start free
          </Link>
          <Hmu />
          <button className="rounded-full p-2 lg:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 bg-current" />
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="glass-solid mx-auto mt-2 flex max-w-[1120px] flex-col rounded-3xl p-3 lg:hidden">
            {links.map(([h, t]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-base">{t}</a>
            ))}
            <Link to="/app" className="mt-1 rounded-2xl bg-[var(--fg)] px-4 py-3 text-center font-medium text-[var(--bg)]">Start free</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ id, eyebrow, title, sub, children, className = "" }: { id?: string; eyebrow?: string; title: ReactNode; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-[1120px] scroll-mt-24 px-5 py-20 md:py-28 ${className}`}>
      <motion.div {...fade} className="mx-auto max-w-[760px] text-center">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="title-serif mt-3 text-4xl leading-[1.05] md:text-[3.4rem]">{title}</h2>
        {sub && <p className="mx-auto mt-4 max-w-[620px] text-lg text-[var(--ink-2)]">{sub}</p>}
      </motion.div>
      {children}
    </section>
  );
}

const Accent = ({ children }: { children: ReactNode }) => <em className="text-[var(--color-clay)]">{children}</em>;

const PLATFORMS = [
  { icon: Smartphone, name: "iPhone", note: "Records with the screen locked" },
  { icon: Tablet, name: "iPad", note: "Big-screen notes and study guides" },
  { icon: Apple, name: "Mac", note: "Apple Silicon and Intel" },
  { icon: Monitor, name: "Windows", note: "Windows 10 and 11" },
  { icon: Globe, name: "Web", note: "Nothing to install" },
];

/** A short back-and-forth that shows the pain point and the fix. */
const CHAT: { me?: boolean; t?: string; audio?: string; card?: { title: string; lines: string[] } }[] = [
  { me: true, t: "wait did she say when the essay is due?? i was finishing my calc homework" },
  { audio: "0:04 · from 10:42 in APUSH" },
  { t: "Thursday at 11:59 PM, 1,200 words on the New Deal. I already set a reminder for Wednesday night." },
  { me: true, t: "and is the quiz still friday" },
  { card: { title: "From today's class", lines: ["Quiz moved to Monday, units 7 and 8", "Essay due Thu 11:59 PM", "Bring your textbook tomorrow"] } },
];

function Chat() {
  return (
    <div className="mx-auto mt-12 flex max-w-[560px] flex-col gap-3">
      {CHAT.map((m, i) => (
        <motion.div key={i} {...fade} transition={{ ...soft, delay: i * 0.12 }} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
          {m.t && (
            <div className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-[15px] ${m.me ? "rounded-br-md bg-[var(--fg)] text-[var(--bg)]" : "rounded-bl-md bg-[var(--bubble)]"}`}>{m.t}</div>
          )}
          {m.audio && (
            <div className="flex items-center gap-3 rounded-3xl rounded-bl-md bg-[var(--bubble)] px-4 py-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-clay)] text-white">▶</span>
              <span className="flex items-end gap-[3px]">
                {[6, 12, 18, 9, 15, 20, 11, 7, 14, 17, 8, 12].map((h, j) => (
                  <motion.span key={j} className="w-[3px] rounded-full bg-[var(--color-clay)]" animate={{ height: [h, h * 0.4, h] }} transition={{ duration: 1.2, repeat: Infinity, delay: j * 0.07 }} />
                ))}
              </span>
              <span className="text-xs text-[var(--mute)]">{m.audio}</span>
            </div>
          )}
          {m.card && (
            <div className="glass w-[85%] rounded-3xl rounded-bl-md p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mute)]">{m.card.title}</div>
              {m.card.lines.map((l) => (
                <div key={l} className="mt-2 flex items-center gap-2 text-[15px]">
                  <BellRing size={15} className="shrink-0 text-[var(--color-clay)]" /> {l}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

const ROOMS = [
  { icon: Mic, t: "Phone on the desk", b: "Picks up the whole room, not just whoever is closest." },
  { icon: Laptop, t: "Laptop open", b: "Mac and Windows record with the built-in mic." },
  { icon: Video, t: "Online class", b: "Leave it running next to your speakers on a Zoom or Teams call." },
  { icon: CloudOff, t: "No Wi-Fi", b: "Everything is heard and written down offline." },
  { icon: Pause, t: "Breaks", b: "Pause for the bell, resume after. One note per class." },
];

const FEATURES = [
  { icon: AudioLines, t: "Every word, written down", b: "A full transcript that appears a second after it's said, right on your device.", pro: false },
  { icon: Users, t: "Knows who said what", b: "Teacher, classmates, guest speaker. Name a voice once and it sticks.", pro: false },
  { icon: BellRing, t: "Deadline radar", b: "\"Due Friday\", \"on the test\", \"quiz moved\". You get a ping the moment it's said.", pro: false },
  { icon: BookOpenCheck, t: "Notes and study guides", b: "Clean notes, key terms and flip-card questions for every class, written for you.", pro: false },
  { icon: CalendarPlus, t: "Straight into your calendar", b: "Every deadline lands in Google or Apple Calendar with a reminder the night before.", pro: true },
  { icon: MessageCircleQuestion, t: "Ask your notes", b: "\"What's on Monday's quiz?\" Answers from every class, with the moment it was said.", pro: true },
];

const STEPS = [
  { t: "Hit record and lock in", b: "Start Nevernote when class starts. Then do your own thing: homework, reading, the project due tomorrow." },
  { t: "It pays attention for you", b: "Everything said is transcribed on your device, offline, and every voice gets a label." },
  { t: "It catches what matters", b: "Due dates, test announcements and \"this will be on the exam\" become a notification right away." },
  { t: "Study later, on your schedule", b: "Replay any moment, read the notes, quiz yourself with the study guide. On any device." },
];

const AUDIENCES = [
  { icon: School, t: "High school", b: "AP and honors classes with a deadline every week." },
  { icon: GraduationCap, t: "College lectures", b: "Three-hour lecture halls where the professor never posts slides." },
  { icon: Stethoscope, t: "Med and nursing", b: "Dense terms, fast talkers, everything on the boards." },
  { icon: Scale, t: "Law", b: "Cold calls and case names you'll want word for word." },
  { icon: FlaskConical, t: "Labs and STEM", b: "Procedures and numbers you can replay before the lab report." },
  { icon: Brain, t: "Learning differences", b: "ADHD, dyslexia, processing time. The whole class, at your own pace." },
];

const FAQ: [string, string][] = [
  ["Is it really free?", "Yes. Recording, transcription, speaker labels, deadline alerts, sync and AI notes are free. Transcription runs on your own device, so it costs us nothing, and AI notes cost a fraction of a cent. Pro adds calendar auto-add, Ask your notes and instant notes every time."],
  ["Does my audio get uploaded?", "No. Speech recognition and speaker labels run on your phone or computer. If you sign in, only the transcript text syncs, so your other devices can show it and AI notes can be written. Your audio stays on the device that recorded it."],
  ["Does it work without internet?", "Yes. Record and transcribe with Wi-Fi off. Notes are written as soon as you're back online, and the dots go from orange to green."],
  ["How accurate is it?", "We test it in increasingly hard classroom recordings, from a quiet room to a loud one with an echo. The open-source Parakeet engine misses about 4 words in 100 in a quiet room and about 13 in a noisy classroom. The full results are on GitHub."],
  ["Can it record with my phone locked?", "Yes, on iPhone. It keeps listening with the screen off, so you can put it face down and forget about it."],
  ["What happens to long classes?", "There is no recording limit. A three-hour lecture becomes one note, with notes and a study guide for the whole thing."],
  ["Which languages does it understand?", "English by default. The desktop app has a multilingual engine for 25 European languages, including Spanish, French, German, Italian and Russian."],
  ["Is it okay to record class?", "Ask first. Many schools and states require consent from your teacher or everyone in the room. Nevernote reminds you before every recording."],
  ["Can I cancel Pro anytime?", "Yes, in your App Store subscriptions. You keep everything you recorded and go back to the free plan."],
];

export function Landing() {
  const { scrollY } = useScroll();
  const blobY = useTransform(scrollY, [0, 800], [0, 180]);
  const blobX = useTransform(scrollY, [0, 800], [0, -80]);
  return (
    <div className="site relative min-h-screen overflow-x-clip">
      <Nav />
      <motion.div style={{ y: blobY }} className="liquid pointer-events-none absolute left-[55%] top-16 h-[520px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(232_151_62/0.28),transparent_62%)] blur-3xl" />
      <motion.div style={{ y: blobY, x: blobX }} className="liquid pointer-events-none absolute left-[30%] top-48 h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(200_121_74/0.18),transparent_60%)] blur-3xl [animation-delay:-6s]" />

      {/* Hero */}
      <header className="relative mx-auto max-w-[1120px] px-5 pb-10 pt-32 text-center md:pt-44">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={soft} className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm">
          <Sparkles size={14} className="text-[var(--color-clay)]" /> Free forever · Works offline · Open source
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ ...soft, delay: 0.05 }} className="title-serif mx-auto mt-6 max-w-[960px] text-[3.1rem] leading-[0.98] sm:text-[4.4rem] md:text-[5.8rem]">
          Do class <Accent>whenever</Accent> you want.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.12 }} className="mx-auto mt-6 max-w-[640px] text-lg text-[var(--ink-2)] md:text-xl">
          Record it. Save it. Replay it. Nevernote is a mic that pays attention better than anyone in the room, so you never miss a deadline again and can lock in on your own work.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.18 }} className="mt-9 flex flex-wrap justify-center gap-3">
          <Link to="/app" className="group inline-flex items-center gap-2 rounded-full bg-[var(--fg)] px-7 py-3.5 font-medium text-[var(--bg)] shadow-[0_14px_34px_-12px_rgb(28_25_21/0.6)] transition hover:-translate-y-0.5">
            Start free in your browser <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
          </Link>
          <a href="#platforms" className="glass inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-medium transition hover:-translate-y-0.5">
            <Smartphone size={18} /> Get the apps
          </a>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...soft, delay: 0.25 }} className="mt-16">
          <Demo />
        </motion.div>
      </header>

      {/* Platform strip */}
      <div className="mx-auto max-w-[1120px] px-5 py-10">
        <p className="text-center text-sm text-[var(--mute)]">One account, every device you take class on</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-10 gap-y-4 text-[var(--ink-2)]">
          {PLATFORMS.map((p) => (
            <span key={p.name} className="inline-flex items-center gap-2 text-lg font-medium">
              <p.icon size={20} /> {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* Pain point */}
      <Section eyebrow="Sound familiar?" title={<>Stop scrambling to <Accent>catch up</Accent> after class.</>} sub="You zoned out for one minute and missed the only thing that mattered. Nevernote didn't.">
        <Chat />
      </Section>

      {/* Any room */}
      <Section eyebrow="Any room" title={<>Wherever class happens, <Accent>it's listening.</Accent></>}>
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-5">
          {ROOMS.map((r, i) => (
            <motion.div key={r.t} {...fade} transition={{ ...soft, delay: i * 0.06 }} className="glass rounded-[24px] p-5 text-left transition hover:-translate-y-1">
              <r.icon size={22} className="text-[var(--color-clay)]" />
              <div className="mt-4 font-semibold">{r.t}</div>
              <p className="mt-1 text-sm text-[var(--ink-2)]">{r.b}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Features */}
      <Section id="features" eyebrow="Features" title={<>Everything you need to <Accent>never miss a thing.</Accent></>}>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.t} {...fade} transition={{ ...soft, delay: i * 0.06 }} className="group relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-7 transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgb(60_40_20/0.35)]">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(232_151_62/0.18),transparent_65%)] opacity-0 transition group-hover:opacity-100" />
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--bubble)]">
                <f.icon size={20} className="text-[var(--color-clay)]" />
              </div>
              <div className="mt-5 flex items-center gap-2 text-lg font-semibold">
                {f.t}
                {f.pro && <span className="rounded-full bg-[var(--fg)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--bg)]">Pro</span>}
              </div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--ink-2)]">{f.b}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section id="how" eyebrow="How it works" title={<>Four steps. <Accent>Zero</Accent> missed deadlines.</>}>
        <div className="relative mx-auto mt-14 max-w-[640px]">
          <div className="absolute bottom-6 left-[23px] top-6 w-px bg-gradient-to-b from-[var(--color-clay)] via-[var(--line)] to-transparent" />
          {STEPS.map((s, i) => (
            <motion.div key={s.t} {...fade} transition={{ ...soft, delay: i * 0.08 }} className="relative flex gap-5 pb-10 text-left last:pb-0">
              <div className="glass-solid z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full font-serif text-xl">{i + 1}</div>
              <div className="pt-2">
                <div className="text-xl font-semibold">{s.t}</div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--ink-2)]">{s.b}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div {...fade} className="mt-12 text-center">
          <Link to="/app" className="inline-flex items-center gap-2 rounded-full bg-[var(--fg)] px-6 py-3 font-medium text-[var(--bg)]">
            Try it now <ArrowRight size={18} />
          </Link>
        </motion.div>
      </Section>

      {/* Accuracy */}
      <Section id="accuracy" eyebrow="Tested, not promised" title={<>Built for <Accent>real</Accent> classrooms.</>} sub="We run every engine through the same recordings, from a quiet room to a loud one with an echo, side chatter and students far from the mic. Lower is better.">
        <motion.div {...fade} className="mt-10 overflow-x-auto rounded-[26px] border border-[var(--line)] bg-[var(--card)]">
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
                    {r.ours && <span className="ml-2 rounded-full bg-[var(--color-clay)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">ours</span>}
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

      {/* Audiences */}
      <Section eyebrow="Made for you" title={<>Whatever you study, <Accent>it keeps up.</Accent></>}>
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <motion.div key={a.t} {...fade} transition={{ ...soft, delay: i * 0.05 }} className="rounded-[24px] bg-gradient-to-br from-[var(--bubble)] to-[var(--card)] p-6 text-left transition hover:-translate-y-1">
              <a.icon size={24} className="text-[var(--color-clay)]" />
              <div className="mt-6 text-lg font-semibold">{a.t}</div>
              <p className="mt-1 text-sm text-[var(--ink-2)]">{a.b}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Platforms */}
      <Section id="platforms" eyebrow="Platforms" title={<>On your phone, your laptop, <Accent>or neither.</Accent></>} sub="Sign in once and every recording, transcript and study guide follows you. No app? Just open the website.">
        <div className="mt-12 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {PLATFORMS.map((p, i) => {
            const href = p.name === "Web" ? "/app" : p.name === "Mac" || p.name === "Windows" ? RELEASES : undefined;
            const inner = (
              <>
                <p.icon size={28} />
                <div className="mt-4 text-lg font-semibold">{p.name}</div>
                <p className="mt-1 text-sm text-[var(--ink-2)]">{p.note}</p>
                <div className="mt-4 text-sm font-medium text-[var(--color-clay)]">{href ? (p.name === "Web" ? "Open now →" : "Download →") : "App Store, coming soon"}</div>
              </>
            );
            return (
              <motion.div key={p.name} {...fade} transition={{ ...soft, delay: i * 0.06 }}>
                {href ? (
                  href.startsWith("/") ? <Link to={href} className="glass block h-full rounded-[24px] p-6 text-left transition hover:-translate-y-1">{inner}</Link> : <a href={href} className="glass block h-full rounded-[24px] p-6 text-left transition hover:-translate-y-1">{inner}</a>
                ) : (
                  <div className="glass h-full rounded-[24px] p-6 text-left">{inner}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" eyebrow="Pricing" title={<>Free. <Accent>Actually</Accent> free.</>} sub="No trial that runs out, no minute caps on recording.">
        <div className="mx-auto mt-12 grid max-w-[880px] gap-4 md:grid-cols-2">
          <motion.div {...fade} className="rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-8 text-left">
            <div className="text-lg font-semibold">Free</div>
            <div className="title-serif mt-1 text-5xl">$0</div>
            <ul className="mt-6 space-y-2.5 text-[15px]">
              {["Unlimited recording and offline transcription", "Speaker labels", "Deadline and test alerts", "AI notes, study guides and key terms", "Sync across iPhone, iPad, Mac, Windows and web", "Insights and streaks"].map((f) => (
                <li key={f} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-[var(--color-dot-green)]" /> {f}</li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-[var(--mute)]">3 instant AI notes a day. The rest arrive overnight, or right away after a 5-second sponsor card.</p>
            <Link to="/app" className="mt-6 block rounded-full border border-[var(--line)] py-3 text-center font-medium transition hover:bg-[var(--bubble)]">Start free</Link>
          </motion.div>
          <motion.div {...fade} transition={{ ...soft, delay: 0.08 }} className="relative overflow-hidden rounded-[28px] bg-[#16120e] p-8 text-left text-[#f6f1e9]">
            <div className="liquid pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgb(232_151_62/0.55),transparent_60%)] blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-lg font-semibold">Pro <Lock size={15} className="text-[var(--color-clay)]" /></div>
              <div className="title-serif mt-1 text-5xl">${PRICING.monthly.price}<span className="text-xl text-[#bfb4a6]"> /mo</span></div>
              <div className="text-sm text-[#bfb4a6]">or {PRICING.yearly.label} ({PRICING.yearly.note})</div>
              <ul className="mt-6 space-y-2.5 text-[15px]">
                {["Everything in Free", "Deadlines added to your calendar automatically", "Ask your notes anything", "Exam packs across a whole unit", "Instant notes every time, no sponsor cards", "Export to Notion, Docs, Markdown and PDF"].map((f) => (
                  <li key={f} className="flex gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-[var(--color-clay)]" /> {f}</li>
                ))}
              </ul>
              <Link to="/app/settings" className="mt-6 block rounded-full bg-[#f6f1e9] py-3 text-center font-medium text-[#16120e] transition hover:opacity-90">Go Pro</Link>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" eyebrow="FAQ" title="Questions, answered.">
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

      {/* Closing CTA */}
      <section className="mx-auto max-w-[1120px] px-5 pb-20">
        <motion.div {...fade} className="relative overflow-hidden rounded-[36px] bg-[#16120e] px-6 py-16 text-center text-[#f6f1e9] md:py-24">
          <div className="liquid pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgb(232_151_62/0.35),transparent_60%)] blur-3xl" />
          <div className="relative">
            <StatusDot dot="red" live size={12} />
            <h2 className="title-serif mx-auto mt-5 max-w-[720px] text-4xl leading-[1.05] md:text-6xl">Lock in on your work. <em className="text-[var(--color-clay)]">We've got class.</em></h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[#cfc6ba]">Free on every device. Start recording in ten seconds.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/app" className="inline-flex items-center gap-2 rounded-full bg-[#f6f1e9] px-7 py-3.5 font-medium text-[#16120e]">Start free <ArrowRight size={18} /></Link>
              <a href={RELEASES} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 font-medium">Download for desktop</a>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="mx-auto max-w-[1120px] px-5 pb-12">
        <div className="grid gap-8 border-t border-[var(--line)] pt-10 text-sm sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo size={18} />
            <p className="mt-3 max-w-[220px] text-[var(--mute)]">The mic that pays attention in class, so you don't have to.</p>
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
