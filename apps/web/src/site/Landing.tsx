import { PRICING } from "@nevernote/core";
import { Apple, Check, Github, Globe, Monitor, Smartphone } from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { useEffect, useState } from "react";
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

function Nav() {
  return (
    <div className="fixed inset-x-0 top-3 z-40 px-3">
      <nav className="glass mx-auto flex max-w-[1080px] items-center gap-6 rounded-full py-2 pl-5 pr-2">
        <Link to="/">
          <Logo size={20} />
        </Link>
        <div className="hidden gap-5 text-sm text-[var(--ink-2)] md:flex">
          <a href="#how" className="hover:text-[var(--fg)]">How it works</a>
          <a href="#accuracy" className="hover:text-[var(--fg)]">Accuracy</a>
          <a href="#pricing" className="hover:text-[var(--fg)]">Pricing</a>
          <a href={GITHUB_REPO} className="hover:text-[var(--fg)]">GitHub</a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/app" className="hidden rounded-full px-3 py-1.5 text-sm font-medium hover:bg-[var(--bubble)] sm:block">
            Open app
          </Link>
          <Hmu />
        </div>
      </nav>
    </div>
  );
}

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: soft };

export function Landing() {
  const { scrollY } = useScroll();
  const blobY = useTransform(scrollY, [0, 800], [0, 160]);
  return (
    <div className="paper-grain min-h-screen overflow-x-hidden">
      <Nav />
      <motion.div style={{ y: blobY }} className="pointer-events-none absolute left-1/2 top-24 -z-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(200_121_74/0.22),transparent_60%)] blur-3xl" />

      <header className="relative mx-auto max-w-[1080px] px-5 pb-16 pt-36 text-center md:pt-44">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={soft} className="eyebrow">
          Free · Open source · Works offline
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ ...soft, delay: 0.05 }} className="title-serif mx-auto mt-4 max-w-[900px] text-[3.2rem] leading-[0.98] sm:text-[4.6rem] md:text-[5.6rem]">
          Never miss <em className="text-[var(--color-leather)] dark:text-[var(--color-clay)]">a word</em> in class.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.12 }} className="mx-auto mt-6 max-w-[600px] text-lg text-[var(--ink-2)]">
          Nevernote transcribes the whole room on your own computer, tells every speaker apart, and turns the lecture into notes, a study guide and due-date reminders on your phone.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.18 }} className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={RELEASES} className="inline-flex items-center gap-2 rounded-full bg-[var(--fg)] px-6 py-3 font-medium text-[var(--bg)] shadow-[0_12px_30px_-12px_rgb(28_25_21/0.7)] transition hover:opacity-90">
            {os === "windows" ? <Monitor size={18} /> : <Apple size={18} />} Download for {os === "windows" ? "Windows" : "Mac"}
          </a>
          <Link to="/app" className="glass inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium">
            <Globe size={18} /> Use it in the browser
          </Link>
        </motion.div>
        <p className="mt-3 text-sm text-[var(--mute)]">
          Also on {os === "windows" ? "Mac" : "Windows"} · iPhone app coming to the App Store
        </p>
        <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...soft, delay: 0.25 }} className="mt-16">
          <Demo />
        </motion.div>
      </header>

      <section id="how" className="mx-auto max-w-[1080px] px-5 py-20">
        <motion.h2 {...fade} className="title-serif text-center text-4xl md:text-5xl">
          Three dots. That's the whole idea.
        </motion.h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { dot: "red" as const, t: "It listens", b: "Hit Start when class begins, on your laptop or phone. Pause and resume whenever. No Wi-Fi needed, nothing uploaded." },
            { dot: "orange" as const, t: "It writes everything down", b: "Every word, transcribed on your device by open-source speech models, with each speaker labelled after class." },
            { dot: "green" as const, t: "It studies with you", b: "Back online, you get clean notes, a study guide, key terms, and every due date and test it heard, on all your devices." },
          ].map((s, i) => (
            <motion.div key={s.t} {...fade} transition={{ ...soft, delay: i * 0.08 }} className="glass rounded-[26px] p-7">
              <StatusDot dot={s.dot} live size={10} />
              <div className="title-serif mt-5 text-2xl">{s.t}</div>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{s.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1080px] px-5 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Catches what's due", "“Lab report due Friday at 11:59” becomes a reminder the second it's said, even offline."],
            ["Knows who's talking", "Teacher, the kid in the back, your lab partner. Rename them once and it remembers."],
            ["Your audio stays yours", "Transcription runs on your machine. The server only ever sees text, and only if you sign in."],
            ["Open source, for real", "Every line is on GitHub. Fork it, check it, make it better for your school."],
          ].map(([t, b], i) => (
            <motion.div key={t} {...fade} transition={{ ...soft, delay: i * 0.05 }} className="rounded-[26px] border border-[var(--line)] bg-[var(--card)] p-7">
              <div className="text-lg font-semibold">{t}</div>
              <p className="mt-1.5 text-[15px] text-[var(--ink-2)]">{b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="accuracy" className="mx-auto max-w-[1080px] px-5 py-20">
        <motion.div {...fade} className="text-center">
          <div className="eyebrow">Tested, not promised</div>
          <h2 className="title-serif mt-3 text-4xl md:text-5xl">Harder rooms, fewer misses.</h2>
          <p className="mx-auto mt-3 max-w-[620px] text-[var(--ink-2)]">
            We run every engine through the same classroom trials, from a quiet room to a loud one with an echo, side chatter and students far from the mic. Lower is better.
          </p>
        </motion.div>
        <motion.div {...fade} className="mt-10 overflow-x-auto rounded-[26px] border border-[var(--line)] bg-[var(--card)]">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--mute)]">
                <th className="px-5 py-3 font-medium">Word error rate</th>
                {BENCH.tiers.map((t) => (
                  <th key={t} className="px-4 py-3 font-medium">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BENCH.rows.map((r) => (
                <tr key={r.engine} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-5 py-3">
                    <span className={r.ours ? "font-semibold" : ""}>{r.engine}</span>
                    {r.ours && <span className="ml-2 rounded-full bg-[var(--fg)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--bg)]">default</span>}
                  </td>
                  {r.wer.map((w, i) => (
                    <td key={i} className={`px-4 py-3 tabular-nums ${r.ours ? "font-semibold" : "text-[var(--ink-2)]"}`}>
                      {w}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
        <p className="mt-3 text-center text-xs text-[var(--mute)]">
          {BENCH.note}{" "}
          <a className="underline" href={`${GITHUB_REPO}/tree/main/bench`}>
            Run it yourself
          </a>
        </p>
      </section>

      <section id="pricing" className="mx-auto max-w-[1080px] px-5 py-20">
        <motion.h2 {...fade} className="title-serif text-center text-4xl md:text-5xl">
          Free. Actually free.
        </motion.h2>
        <div className="mx-auto mt-12 grid max-w-[860px] gap-4 md:grid-cols-2">
          <motion.div {...fade} className="rounded-[28px] border border-[var(--line)] bg-[var(--card)] p-8">
            <div className="text-lg font-semibold">Free</div>
            <div className="title-serif mt-1 text-5xl">$0</div>
            <ul className="mt-6 space-y-2.5 text-[15px]">
              {["Unlimited recording and offline transcription", "Speaker labels", "AI notes, study guides and key terms", "Due-date and test reminders", "Sync between laptop and phone", "Insights and streaks"].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check size={18} className="mt-0.5 shrink-0 text-[var(--color-dot-green)]" /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-[var(--mute)]">Three instant AI summaries a day; the rest arrive overnight, or instantly after a 5-second sponsor card.</p>
          </motion.div>
          <motion.div {...fade} transition={{ ...soft, delay: 0.08 }} className="relative overflow-hidden rounded-[28px] bg-[#14110e] p-8 text-[#f4efe6]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgb(200_121_74/0.5),transparent_60%)] blur-2xl" />
            <div className="relative">
              <div className="text-lg font-semibold">Pro</div>
              <div className="title-serif mt-1 text-5xl">
                ${PRICING.monthly.price}
                <span className="text-xl text-[#bfb4a6]"> /mo</span>
              </div>
              <div className="text-sm text-[#bfb4a6]">or {PRICING.yearly.label}</div>
              <ul className="mt-6 space-y-2.5 text-[15px]">
                {["Everything in Free", "Due dates added to Google Calendar automatically", "Ask your notes anything", "Exam packs across a whole unit", "Instant notes, no sponsor cards", "Export to Notion, Docs, PDF"].map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check size={18} className="mt-0.5 shrink-0 text-[var(--color-clay)]" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-[760px] px-5 py-16">
        <h2 className="title-serif text-center text-4xl">Questions</h2>
        <div className="mt-8 divide-y divide-[var(--line)]">
          {[
            ["Does my audio get uploaded?", "No. Speech recognition and speaker labelling run on your computer or phone. If you sign in, the text of your transcript syncs so your phone can show it and so AI notes can be written. Audio stays on the device that recorded it."],
            ["How is it free?", "On-device transcription costs nothing to run, and AI notes cost a fraction of a cent per class. Pro subscribers and the occasional sponsor card cover the rest."],
            ["Do I need internet in class?", "No. Record and transcribe with Wi-Fi off. Notes are written as soon as you reconnect, and the dots go from orange to green."],
            ["Which languages?", "English by default. The Parakeet v3 engine adds 24 more European languages, including Spanish, French, German, Italian and Russian."],
            ["Is it okay to record class?", "Ask first. Many schools and states require consent from your teacher or everyone in the room. Nevernote reminds you on every recording."],
            ["What runs it?", "Open models only: NVIDIA Parakeet and Moonshine for speech, pyannote and TitaNet for speakers, Silero for voice detection, all through sherpa-onnx."],
          ].map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-lg">
                {q}
                <span className="text-[var(--mute)] transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1080px] flex-col items-center justify-between gap-4 px-5 pb-12 pt-6 text-sm text-[var(--mute)] sm:flex-row">
        <Logo size={18} />
        <div className="flex items-center gap-5">
          <a href={GITHUB_REPO} className="inline-flex items-center gap-1.5 hover:text-[var(--fg)]">
            <Github size={15} /> Source
          </a>
          <a href={RELEASES} className="inline-flex items-center gap-1.5 hover:text-[var(--fg)]">
            <Monitor size={15} /> Downloads
          </a>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone size={15} /> iPhone soon
          </span>
        </div>
        <span>Made by a student, for students.</span>
      </footer>
    </div>
  );
}
