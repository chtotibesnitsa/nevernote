// Study: flashcards from every class's notes (free account), and exam packs
// that fold a whole unit of lectures into one review guide (Pro).
import { unlockStep, type Note } from "@nevernote/core";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { marked } from "marked";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, LockBadge, soft, spring } from "../components/ui.tsx";
import { cardsOf, examPack, exportFlashcards, saveDoc, saveMarkdown, savePdf } from "../lib/export.ts";
import { useApp } from "./state.tsx";

type Tab = "cards" | "pack";

export function Study() {
  const { notes, tier } = useApp();
  const [tab, setTab] = useState<Tab>("cards");
  const [folder, setFolder] = useState<string | null>(null);
  const folders = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) if (n.folder) m.set(n.folder, (m.get(n.folder) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  }, [notes]);
  const inScope = useMemo(() => (folder ? notes.filter((n) => n.folder === folder) : notes), [notes, folder]);

  return (
    <div className="mx-auto w-full max-w-[980px] px-5 pb-28 pt-4 md:px-8">
      <h1 className="title-serif text-[2.2rem] leading-tight">Study</h1>
      <p className="mt-1 text-[15px] text-[var(--mute)]">Everything here is built from the notes Nevernote wrote for your classes.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-[var(--bubble)] p-1 shadow-[inset_0_0_0_1px_var(--line)]">
          {(
            [
              ["cards", "Flashcards", unlockStep(tier, "studyGuide")],
              ["pack", "Exam packs", unlockStep(tier, "examPack")],
            ] as const
          ).map(([k, label, step]) => (
            <button key={k} onClick={() => setTab(k)} className={`relative flex items-center gap-2 rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors ${tab === k ? "text-[var(--fg)]" : "text-[var(--mute)]"}`}>
              {tab === k && <motion.span layoutId="study-tab" transition={spring} className="absolute inset-0 rounded-full bg-[var(--card)] shadow-[0_1px_4px_rgb(0_0_0/0.15)]" />}
              <span className="relative">{label}</span>
              {step && (
                <span className="relative">
                  <LockBadge step={step} />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {[null, ...folders].map((f) => (
            <button key={f ?? "all"} onClick={() => setFolder(f)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${folder === f ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--bubble)] text-[var(--ink-2)]"}`}>
              {f ?? "All classes"}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-6">
          {tab === "cards" ? <Cards notes={inScope} name={folder ?? "All classes"} /> : <Pack notes={inScope} name={folder ?? "All classes"} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Locked({ title, body, step, reason }: { title: string; body: string; step: "signup" | "pro"; reason: string }) {
  const { openSignup, openPro } = useApp();
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-4 !rounded-[22px] p-5">
      <div className="max-w-[520px]">
        <div className="flex items-center gap-2 text-[16px] font-semibold">
          {title} <LockBadge step={step} />
        </div>
        <p className="mt-1 text-[13.5px] leading-snug text-[var(--mute)]">{body}</p>
      </div>
      <Button variant="primary" onClick={() => (step === "signup" ? openSignup(reason) : openPro(reason))}>
        {step === "signup" ? "Sign up free" : "See Pro"}
      </Button>
    </div>
  );
}

function Cards({ notes, name }: { notes: Note[]; name: string }) {
  const { tier, need } = useApp();
  const deck = useMemo(() => notes.filter((n) => n.summary).flatMap((n) => cardsOf(n.summary!).map((c) => ({ ...c, from: n.title }))), [notes]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState(0);
  const step = unlockStep(tier, "studyGuide");
  if (step) return <Locked step={step} reason="studyGuide" title="Flashcards from every class" body="Every study guide question and key term becomes a card you can flip through. Free with an account." />;
  if (!deck.length)
    return (
      <div className="panel !rounded-[22px] p-8 text-center">
        <div className="title-serif text-[1.6rem]">No cards yet</div>
        <p className="mx-auto mt-1 max-w-sm text-[14.5px] text-[var(--mute)]">Cards come from each class's AI notes. Record a class and open its Summary tab.</p>
        <Link to="/app/notes" className="press mt-5 inline-flex rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] px-5 py-2.5 text-sm font-semibold text-white">Go to Notetaker</Link>
      </div>
    );
  const c = deck[i % deck.length];
  const go = (d: number) => {
    setFlip(false);
    setTimeout(() => setI((x) => (x + d + deck.length) % deck.length), 120);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <div className="[perspective:1200px]">
          <motion.button onClick={() => setFlip((f) => !f)} animate={{ rotateY: flip ? 180 : 0 }} transition={soft} style={{ transformStyle: "preserve-3d" }} className="relative block h-[300px] w-full text-left">
            <span className="absolute inset-0 flex flex-col justify-between rounded-[26px] bg-[linear-gradient(180deg,#2c2c2e,#1d1d1f)] p-7 text-white shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)] [backface-visibility:hidden]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">Question · {c.from}</span>
              <span className="title-serif text-[1.7rem] leading-snug md:text-[2rem]">{c.front}</span>
              <span className="text-[12.5px] text-white/45">Tap to flip</span>
            </span>
            <span className="panel absolute inset-0 flex flex-col justify-between !rounded-[26px] p-7 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--mute)]">Answer</span>
              <span className="text-[1.25rem] font-medium leading-relaxed">{c.back}</span>
              <span className="text-[12.5px] text-[var(--mute)]">{c.from}</span>
            </span>
          </motion.button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="glass" onClick={() => go(-1)} aria-label="Previous">
            <ArrowLeft size={16} />
          </Button>
          <div className="flex gap-2">
            <Button variant="glass" onClick={() => go(1)}>
              <RotateCcw size={14} /> Again
            </Button>
            <Button variant="primary" onClick={() => (setKnown((k) => k + 1), go(1))}>
              Got it
            </Button>
          </div>
          <Button variant="glass" onClick={() => go(1)} aria-label="Next">
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="panel !rounded-[20px] p-5">
          <div className="title-serif text-[2.4rem] leading-none tabular-nums">
            {(i % deck.length) + 1}
            <span className="text-[1.2rem] text-[var(--mute)]"> / {deck.length}</span>
          </div>
          <div className="mt-1 text-[13px] text-[var(--mute)]">cards in {name}</div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
            <motion.div className="h-full origin-left rounded-full bg-[var(--fg)]" animate={{ scaleX: ((i % deck.length) + 1) / deck.length }} transition={spring} />
          </div>
          <div className="mt-3 text-[13px] font-medium">{known} known this session</div>
        </div>
        <button onClick={() => need("flashcards", "flashcards") && exportFlashcards(name, deck)} className="panel flex w-full items-center justify-between !rounded-[20px] p-4 text-left text-[14px] font-semibold transition hover:-translate-y-0.5">
          Send to Anki or Quizlet
          {unlockStep(tier, "flashcards") && <LockBadge step={unlockStep(tier, "flashcards")!} />}
        </button>
      </div>
    </div>
  );
}

function Pack({ notes, name }: { notes: Note[]; name: string }) {
  const { tier, need, toast } = useApp();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const chosen = picked ? notes.filter((n) => picked.has(n.id)) : notes;
  const pack = useMemo(() => examPack(name, chosen), [name, chosen]);
  const step = unlockStep(tier, "examPack");
  const toggle = (id: string) => setPicked((p) => {
    const s = new Set(p ?? notes.map((n) => n.id));
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  });
  return (
    <div className="space-y-5">
      {step && <Locked step={step} reason="examPack" title="Exam packs" body="Pick a class and get one review guide from all its lectures: what was covered, key terms, practice questions with answers and every due date." />}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="panel h-fit !rounded-[20px] p-4">
          <div className="text-[13px] font-semibold">Lectures in this pack</div>
          <div className="mt-2 max-h-[360px] space-y-0.5 overflow-y-auto">
            {notes.length === 0 && <p className="text-[13px] text-[var(--mute)]">No classes recorded yet.</p>}
            {notes.map((n) => {
              const on = !picked || picked.has(n.id);
              return (
                <button key={n.id} onClick={() => toggle(n.id)} className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-[13.5px] hover:bg-[var(--bubble)]">
                  <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] text-[11px] font-bold ${on ? "bg-[var(--fg)] text-[var(--bg)]" : "shadow-[inset_0_0_0_1.5px_var(--line)]"}`}>{on && "✓"}</span>
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  {!n.summary && <span className="text-[11px] text-[var(--mute)]">no notes</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3 text-center">
            {[[pack.lectures, "lectures"], [pack.terms, "terms"], [pack.questions, "questions"]].map(([n, l]) => (
              <div key={l}>
                <div className="text-[17px] font-semibold tabular-nums">{n}</div>
                <div className="text-[11px] text-[var(--mute)]">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel relative overflow-hidden !rounded-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-3">
            <span className="text-[14px] font-semibold">{name}: exam pack</span>
            <div className="flex gap-1.5">
              {(
                [
                  ["PDF", () => savePdf(`${name} exam pack`, pack.md) || toast({ title: "Allow pop-ups to save a PDF" })],
                  ["Google Docs", () => saveDoc(`${name} exam pack`, pack.md)],
                  ["Markdown", () => saveMarkdown(`${name} exam pack`, pack.md)],
                ] as const
              ).map(([l, run]) => (
                <button key={l} onClick={() => need("examPack", "examPack") && run()} className="press-light rounded-full bg-[var(--card)] px-3 py-1 text-[12.5px] font-semibold">
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className={`prose-nn max-h-[560px] overflow-y-auto px-6 py-5 !text-[15px] ${step ? "pointer-events-none select-none blur-[3px]" : ""}`} dangerouslySetInnerHTML={{ __html: marked.parse(pack.md.replace(/^# .*\n/, ""), { async: false }) as string }} />
          {pack.written === 0 && !step && <p className="px-6 pb-5 text-[13px] text-[var(--mute)]">None of these lectures have AI notes yet, so the pack only has titles. Open a class and write its notes first.</p>}
        </div>
      </div>
    </div>
  );
}
