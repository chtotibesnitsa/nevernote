// Study games built from a class's cards: a multiple-choice quiz and a match
// game (free), AI practice tests (Pro), and links out to good free sources.
// Every right or wrong answer feeds the same spaced-repetition schedule the
// flashcards use, so the deck learns what you actually know.
import { cardKey, isDue, mcQuestions, review, shuffle, subjectsOf, unlockStep, type Card, type McQuestion, type Note, type Recall } from "@notelater/core";
import { Check, ExternalLink, RotateCcw, Sparkles, Timer, Trophy, X } from "lucide-react";
import { marked } from "marked";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, LockBadge, soft, spring } from "../components/ui.tsx";
import { ask } from "../lib/cloud.ts";
import { useApp } from "./state.tsx";

// ---- Spaced repetition, kept per device ----

const SRS_KEY = "nn:srs";
function loadSrs(): Record<string, Recall> {
  try {
    return JSON.parse(localStorage.getItem(SRS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useSrs() {
  const [srs, setSrs] = useState(loadSrs);
  const mark = useCallback((c: Card, right: boolean) => {
    setSrs((cur) => {
      const next = { ...cur, [cardKey(c)]: review(cur[cardKey(c)], right) };
      try {
        localStorage.setItem(SRS_KEY, JSON.stringify(next));
      } catch {
        /* private mode: the session still works */
      }
      return next;
    });
  }, []);
  const due = useCallback((c: Card) => isDue(srs[cardKey(c)], new Date()), [srs]);
  const box = useCallback((c: Card) => srs[cardKey(c)]?.box ?? 0, [srs]);
  return { mark, due, box };
}

function Empty({ what }: { what: string }) {
  return (
    <div className="panel !rounded-[22px] p-8 text-center">
      <div className="title-serif text-[1.6rem]">Not enough cards yet</div>
      <p className="mx-auto mt-1 max-w-sm text-[14.5px] text-[var(--mute)]">{what} needs at least four cards from your class notes. Record a class or two and they show up here.</p>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="panel !rounded-[18px] px-4 py-3">
      <motion.div key={String(value)} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="title-serif text-[1.9rem] leading-none tabular-nums">
        {value}
      </motion.div>
      <div className="mt-1 text-[12px] text-[var(--mute)]">{label}</div>
    </div>
  );
}

// ---- Quiz ----

export function Quiz({ deck }: { deck: Card[] }) {
  const { mark } = useSrs();
  const [round, setRound] = useState(0);
  const qs = useMemo(() => mcQuestions(deck, 10), [deck, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  if (qs.length < 1) return <Empty what="Quiz" />;
  const done = i >= qs.length;
  const q: McQuestion | undefined = qs[i];

  const pick = (k: number) => {
    if (picked !== null || !q) return;
    setPicked(k);
    const right = k === q.answer;
    const card = deck.find((c) => c.front === q.prompt || c.back === q.prompt);
    if (card) mark(card, right);
    if (right) {
      setScore((s) => s + 1);
      setStreak((s) => (setBest((b) => Math.max(b, s + 1)), s + 1));
    } else setStreak(0);
    setTimeout(() => (setPicked(null), setI((x) => x + 1)), right ? 750 : 1500);
  };
  const again = () => (setRound((r) => r + 1), setI(0), setScore(0), setStreak(0));

  if (done)
    return (
      <Finish title={score === qs.length ? "Perfect round" : score >= qs.length * 0.7 ? "Nice work" : "Keep going"} line={`${score} of ${qs.length} right · best streak ${best}`} onAgain={again} pct={score / qs.length} />
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <div className="mb-3 flex gap-1">
          {qs.map((_, k) => (
            <motion.span key={k} className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: k < i ? "#1d1d1f" : k === i ? "#6e6e73" : "#e5e5ea" }} transition={spring} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={`${round}-${i}`} initial={{ opacity: 0, x: 40, rotate: 1 }} animate={{ opacity: 1, x: 0, rotate: 0 }} exit={{ opacity: 0, x: -40, rotate: -1 }} transition={soft}>
            <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff,#f5f5f7)] p-7 shadow-[0_0_0_1px_#e5e5ea,0_24px_48px_-28px_rgb(0_0_0/0.25)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6e6e73]">Question {i + 1} · {q!.from ?? "your notes"}</div>
              <div className="title-serif mt-3 text-[1.5rem] leading-snug md:text-[1.8rem]">{q!.prompt}</div>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {q!.options.map((o, k) => {
                const right = picked !== null && k === q!.answer;
                const wrong = picked === k && k !== q!.answer;
                return (
                  <motion.button
                    key={k}
                    onClick={() => pick(k)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={wrong ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: picked !== null && !right ? 0.45 : 1, y: 0, scale: right ? 1.02 : 1 }}
                    transition={{ ...spring, delay: picked === null ? 0.05 + k * 0.05 : 0 }}
                    whileHover={picked === null ? { y: -3 } : undefined}
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-start gap-3 rounded-[18px] p-4 text-left text-[14.5px] leading-snug transition-colors ${right ? "bg-[#1d1d1f] text-white shadow-[0_4px_0_#000]" : wrong ? "bg-[var(--card)] shadow-[0_0_0_2px_#ff3b30]" : "bg-[var(--card)] shadow-[0_0_0_1px_var(--line),0_3px_0_var(--line)]"}`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${right ? "bg-white text-[#1d1d1f]" : "bg-[var(--bubble)]"}`}>
                      {right ? <Check size={13} strokeWidth={3} /> : wrong ? <X size={13} strokeWidth={3} /> : "ABCD"[k]}
                    </span>
                    <span className="min-w-0 flex-1">{o}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="grid h-fit grid-cols-3 gap-3 lg:grid-cols-1">
        <Stat value={score} label="right" />
        <Stat value={streak} label="streak" />
        <Stat value={`${i + 1}/${qs.length}`} label="question" />
      </div>
    </div>
  );
}

function Finish({ title, line, onAgain, pct }: { title: string; line: string; onAgain: () => void; pct: number }) {
  const { plan, openPro } = useApp();
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={soft} className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#2c2c2e,#1d1d1f)] p-10 text-center text-white">
      {Array.from({ length: 18 }).map((_, k) => (
        <motion.span
          key={k}
          className="absolute h-2 w-2 rounded-full bg-white"
          style={{ left: `${(k * 53) % 100}%`, top: "60%" }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 0.8, 0], y: -140 - ((k * 37) % 120), x: ((k % 5) - 2) * 18 }}
          transition={{ duration: 1.6, delay: 0.1 + (k % 6) * 0.08, ease: "easeOut" }}
        />
      ))}
      <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.1 }} className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-white text-[#1d1d1f] shadow-[0_5px_0_#9a9aa0]">
        <Trophy size={28} strokeWidth={2.4} />
      </motion.div>
      <div className="title-serif mt-5 text-[2.2rem] leading-none">{title}</div>
      <p className="mt-2 text-[14.5px] text-white/65">{line}</p>
      <div className="mx-auto mt-5 h-2 max-w-xs overflow-hidden rounded-full bg-white/15">
        <motion.div className="h-full origin-left rounded-full bg-white" initial={{ scaleX: 0 }} animate={{ scaleX: pct }} transition={{ ...soft, delay: 0.3 }} />
      </div>
      <button onClick={onAgain} className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14.5px] font-bold text-[#1d1d1f] shadow-[0_4px_0_#9a9aa0] transition active:translate-y-[3px] active:shadow-[0_1px_0_#9a9aa0]">
        <RotateCcw size={15} /> Play again
      </button>
      {plan !== "pro" && (
        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...soft, delay: 0.8 }} onClick={() => openPro("practiceTest")} className="mx-auto mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-white/70 transition hover:text-white">
          <Sparkles size={14} /> Want a real practice test from this class? Try Pro
        </motion.button>
      )}
    </motion.div>
  );
}

// ---- Match ----

const BEST_KEY = "nn:match-best";

export function Match({ deck }: { deck: Card[] }) {
  const { mark } = useSrs();
  const [round, setRound] = useState(0);
  const pairs = useMemo(() => {
    const seen = new Set<string>();
    return shuffle(deck)
      .filter((c) => c.back.length < 160 && !seen.has(c.back) && seen.add(c.back))
      .slice(0, 6);
  }, [deck, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiles = useMemo(() => shuffle(pairs.flatMap((c, k) => [{ id: `f${k}`, pair: k, text: c.front, side: "front" as const }, { id: `b${k}`, pair: k, text: c.back, side: "back" as const }])), [pairs]);
  const [sel, setSel] = useState<string | null>(null);
  const [miss, setMiss] = useState<string[]>([]);
  const [gone, setGone] = useState<Set<number>>(new Set());
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const missed = useRef(new Set<number>());
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0) || 0);
  const done = pairs.length > 0 && gone.size === pairs.length;

  useEffect(() => {
    if (!start || done) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [start, done]);
  const secs = start ? ((done ? now : Date.now()) - start) / 1000 : 0;

  useEffect(() => {
    if (!done || !start) return;
    const t = (Date.now() - start) / 1000;
    setNow(Date.now());
    if (!best || t < best) {
      setBest(t);
      try {
        localStorage.setItem(BEST_KEY, String(t));
      } catch {
        /* fine */
      }
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pairs.length < 4) return <Empty what="Match" />;

  const tap = (t: (typeof tiles)[number]) => {
    if (gone.has(t.pair)) return;
    if (!start) setStart(Date.now());
    if (!sel) return setSel(t.id);
    if (sel === t.id) return setSel(null);
    const other = tiles.find((x) => x.id === sel)!;
    if (other.pair === t.pair && other.side !== t.side) {
      setGone((g) => new Set(g).add(t.pair));
      mark(pairs[t.pair], !missed.current.has(t.pair));
    } else {
      missed.current.add(other.pair).add(t.pair);
      setMiss([sel, t.id]);
      setTimeout(() => setMiss([]), 450);
    }
    setSel(null);
  };
  const again = () => {
    setRound((r) => r + 1);
    setGone(new Set());
    setStart(null);
    setSel(null);
    missed.current = new Set();
  };

  if (done) return <Finish title={secs <= best + 0.01 ? "New best time" : "All matched"} line={`${secs.toFixed(1)} seconds · best ${best.toFixed(1)}s`} onAgain={again} pct={1} />;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bubble)] px-3 py-1.5 text-[13px] font-semibold tabular-nums">
          <Timer size={14} /> {secs.toFixed(1)}s
        </span>
        {best > 0 && <span className="text-[13px] text-[var(--mute)]">Best {best.toFixed(1)}s</span>}
        <span className="ml-auto text-[13px] text-[var(--mute)]">Tap a term, then its meaning</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence>
          {tiles.map(
            (t, k) =>
              !gone.has(t.pair) && (
                <motion.button
                  key={`${round}-${t.id}`}
                  layout
                  onClick={() => tap(t)}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={miss.includes(t.id) ? { opacity: 1, scale: 1, y: 0, x: [0, -7, 7, -4, 4, 0] } : { opacity: 1, scale: sel === t.id ? 1.04 : 1, y: sel === t.id ? -4 : 0 }}
                  exit={{ opacity: 0, scale: 0.6, rotate: k % 2 ? 6 : -6, transition: { duration: 0.25 } }}
                  transition={{ ...spring, delay: start ? 0 : k * 0.02 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  className={`min-h-[96px] rounded-[18px] p-3.5 text-left leading-snug transition-colors ${t.side === "front" ? "text-[14.5px] font-semibold" : "text-[12.5px]"} ${sel === t.id ? "bg-[#1d1d1f] text-white shadow-[0_4px_0_#000]" : miss.includes(t.id) ? "bg-[var(--card)] shadow-[0_0_0_2px_#ff3b30]" : "bg-[var(--card)] shadow-[0_0_0_1px_var(--line),0_3px_0_var(--line)]"}`}
                >
                  {t.text}
                </motion.button>
              ),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- Practice test (Pro) ----

const SAMPLE = `1. Which stage of mitosis lines chromosomes up along the middle of the cell?\n   A. Prophase  B. Metaphase  C. Anaphase  D. Telophase\n2. In your own words, why does the Calvin cycle need ATP?\n3. Your teacher said a "positive feedback loop speeds the change up". Give one example from class.`;

export function Practice({ notes, name }: { notes: Note[]; name: string }) {
  const { tier, openPro, openSignup, toast } = useApp();
  const step = unlockStep(tier, "practiceTest");
  const [kind, setKind] = useState<"quiz" | "plan">("quiz");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ kind: "quiz" | "plan"; questions: string; answers: string } | null>(null);
  const [show, setShow] = useState(false);
  const written = notes.filter((n) => n.summary);

  const run = async () => {
    if (step) return step === "signup" ? openSignup("pro") : openPro(kind === "quiz" ? "practiceTest" : "studyPlan");
    if (!written.length) return toast({ title: "No class notes here yet", body: "Write the AI notes for a class first, then make a test from it." });
    setBusy(true);
    setShow(false);
    const r = await ask(kind === "quiz" ? `Write a practice test for ${name}.` : `Make my study plan for ${name}, starting today.`, written.slice(0, 8).map((n) => n.id), { tool: kind });
    setBusy(false);
    if (r.error) return r.error === "pro" ? openPro("practiceTest") : toast({ title: "Couldn't write that", body: r.error });
    const [q, a = ""] = (r.answer ?? "").split(/^#{2,3}\s*Answers.*$/im);
    setOut({ kind, questions: q.trim(), answers: a.trim() });
  };

  const html = (md: string) => marked.parse(md, { async: false }) as string;
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="panel !rounded-[20px] p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            Made from {name} {step && <LockBadge step={step} />}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-[var(--mute)]">Questions come from what your teacher actually said in {written.length || "your"} {written.length === 1 ? "class" : "classes"}, never a generic bank.</p>
          <div className="mt-3 grid gap-2">
            {(
              [
                ["quiz", "Practice test", "5 questions, answers hidden"],
                ["plan", "Study plan", "Day by day up to the test"],
              ] as const
            ).map(([k, l, d]) => (
              <button key={k} onClick={() => setKind(k)} className={`relative rounded-[14px] p-3 text-left transition ${kind === k ? "text-[var(--bg)]" : "hover:bg-[var(--bubble)]"}`}>
                {kind === k && <motion.span layoutId="practice-kind" transition={spring} className="absolute inset-0 rounded-[14px] bg-[var(--fg)]" />}
                <span className="relative block text-[13.5px] font-semibold">{l}</span>
                <span className={`relative block text-[12px] ${kind === k ? "opacity-70" : "text-[var(--mute)]"}`}>{d}</span>
              </button>
            ))}
          </div>
          <Button variant="primary" className="mt-3 w-full justify-center" onClick={run} disabled={busy}>
            <Sparkles size={15} /> {busy ? "Writing…" : out ? "Write another" : kind === "quiz" ? "Write my test" : "Plan my week"}
          </Button>
        </div>
      </div>
      <div className="panel relative min-h-[320px] overflow-hidden !rounded-[22px]">
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 p-6">
              {[90, 70, 82, 55, 76].map((w, k) => (
                <motion.div key={k} className="h-3.5 rounded-full bg-[var(--bubble)]" style={{ width: `${w}%` }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: k * 0.12 }} />
              ))}
            </motion.div>
          ) : out ? (
            <motion.div key={out.questions.slice(0, 20)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={soft} className="p-6">
              <div className="prose-nn !text-[15px] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: html(out.questions) }} />
              {out.answers && (
                <div className="mt-5 border-t border-[var(--line)] pt-4">
                  <Button variant={show ? "glass" : "primary"} onClick={() => setShow((s) => !s)}>
                    {show ? "Hide answers" : "Check my answers"}
                  </Button>
                  <AnimatePresence>
                    {show && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={soft} className="overflow-hidden">
                        <div className="prose-nn mt-4 !text-[14.5px] [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: html(out.answers) }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="sample" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--mute)]">What you'll get</div>
              <div className={`prose-nn mt-2 !text-[15px] ${step ? "select-none blur-[2px]" : "opacity-60"}`} dangerouslySetInnerHTML={{ __html: html(SAMPLE) }} />
              {step && (
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center bg-[linear-gradient(180deg,transparent,var(--card)_45%)] px-6 pb-6 pt-16 text-center">
                  <div className="text-[16px] font-semibold">Unlimited practice tests from your own classes</div>
                  <p className="mt-1 max-w-sm text-[13px] text-[var(--mute)]">Part of Pro, with Ask, exam packs and calendar sync. Less than a coffee a month.</p>
                  <Button variant="primary" className="mt-3" onClick={run}>
                    See Pro
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- Go deeper: good free sources for the terms in your notes ----

const SOURCES = [
  ["Khan Academy", (t: string) => `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(t)}`],
  ["YouTube", (t: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t} explained`)}`],
  ["Wikipedia", (t: string) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(t)}`],
] as const;

export function Deeper({ notes, name }: { notes: Note[]; name: string }) {
  const terms = useMemo(() => {
    const seen = new Set<string>();
    return notes
      .flatMap((n) => (n.summary?.keyTerms ?? []).map((t) => ({ ...t, from: n.folder ?? n.title })))
      .filter((t) => !seen.has(t.term.toLowerCase()) && seen.add(t.term.toLowerCase()))
      .slice(0, 24);
  }, [notes]);
  const subjects = useMemo(() => [...new Set(notes.flatMap((n) => subjectsOf(`${n.folder ?? ""} ${n.title}`)))], [notes]);
  if (!terms.length)
    return (
      <div className="panel !rounded-[22px] p-8 text-center">
        <div className="title-serif text-[1.6rem]">Nothing to look up yet</div>
        <p className="mx-auto mt-1 max-w-sm text-[14.5px] text-[var(--mute)]">Key terms from your class notes show up here with the best free lessons for each.</p>
      </div>
    );
  return (
    <div>
      <p className="text-[14px] text-[var(--mute)]">
        The terms from {name}, each with a lesson, a video and a reference.
        {subjects.length > 0 && <> Subjects: {subjects.map((s) => s.replace("-", " ")).join(", ")}.</>}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {terms.map((t, k) => (
          <motion.div key={t.term} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(k, 12) * 0.03 }} whileHover={{ y: -4 }} className="panel group flex flex-col !rounded-[20px] p-4">
            <div className="text-[15px] font-semibold">{t.term}</div>
            <div className="mt-1 line-clamp-3 flex-1 text-[12.5px] leading-snug text-[var(--mute)]">{t.definition}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SOURCES.map(([l, url]) => (
                <a key={l} href={url(t.term)} target="_blank" rel="noreferrer" className="press-light inline-flex items-center gap-1 rounded-full bg-[var(--bubble)] px-2.5 py-1 text-[12px] font-semibold transition hover:bg-[var(--fg)] hover:text-[var(--bg)]">
                  {l} <ExternalLink size={11} />
                </a>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
