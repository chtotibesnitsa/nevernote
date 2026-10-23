// Ask your notes (Pro): questions across every class, answered from the
// transcripts and notes, with the moment it was said.
import { ArrowUp } from "lucide-react";
import { marked } from "marked";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Note } from "@nevernote/core";
import { Button, LockBadge, spring } from "../components/ui.tsx";
import { ask } from "../lib/cloud.ts";
import { useApp } from "./state.tsx";

interface Turn {
  q: string;
  a?: string;
  scope: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

/** The lines an answer quoted, found in the transcripts, so each answer can jump to where it was said. */
function momentsIn(answer: string, notes: Note[]) {
  const quotes = [...answer.matchAll(/[“"]([^”"]{12,240})[”"]/g)].map((m) => norm(m[1])).filter((q) => q.split(" ").length >= 3);
  const out: { note: Note; seg: string; at: number; text: string }[] = [];
  for (const q of quotes.slice(0, 4)) {
    const probe = q.split(" ").slice(0, 6).join(" ");
    for (const n of notes) {
      const s = n.segments.find((x) => norm(x.text).includes(probe));
      if (s && !out.some((o) => o.seg === s.id)) {
        out.push({ note: n, seg: s.id, at: s.start, text: q });
        break;
      }
    }
  }
  return out;
}

const SUGGEST = ["What's on the next test?", "What's due this week?", "What did I miss on Tuesday?", "Explain the hardest idea from this week simply"];

export function Ask() {
  const { notes, tier, need } = useApp();
  const [scope, setScope] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("nn:ask") ?? "[]");
    } catch {
      return [];
    }
  });
  const end = useRef<HTMLDivElement>(null);
  const folders = useMemo(() => [...new Set(notes.map((n) => n.folder).filter(Boolean))] as string[], [notes]);
  const locked = tier !== "pro";

  useEffect(() => {
    try {
      localStorage.setItem("nn:ask", JSON.stringify(turns.slice(-20)));
    } catch {
      /* private mode: the chat just isn't kept */
    }
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const send = async (question: string) => {
    if (!question.trim() || !need("askNotes", "ask")) return;
    const ids = scope ? notes.filter((n) => n.folder === scope).map((n) => n.id) : undefined;
    setQ("");
    setTurns((t) => [...t, { q: question, scope: scope ?? "All classes" }]);
    const r = await ask(question, ids);
    setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a: r.answer ?? `Couldn't answer: ${r.error}` } : x)));
  };

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col px-5 pb-36 pt-4 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title-serif text-[2.2rem] leading-tight">Ask your notes</h1>
        {locked && <LockBadge step={tier === "guest" ? "signup" : "pro"} />}
      </div>
      <p className="mt-1 text-[15px] text-[var(--mute)]">Answers come from what was actually said in class, with when it was said.</p>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {[null, ...folders].map((f) => (
          <button
            key={f ?? "all"}
            onClick={() => setScope(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${scope === f ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--bubble)] text-[var(--ink-2)] hover:text-[var(--fg)]"}`}
          >
            {f ?? "All classes"}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-4">
        {turns.length === 0 && (
          <div className="panel !rounded-[24px] p-6">
            {locked ? (
              <>
                <div className="space-y-3 text-[14.5px]">
                  <div className="ml-auto w-fit rounded-[18px] rounded-br-[6px] bg-[var(--fg)] px-4 py-2 text-[var(--bg)]">What's on Monday's quiz?</div>
                  <div className="w-fit max-w-[85%] rounded-[18px] rounded-bl-[6px] bg-[var(--bubble)] px-4 py-2.5 leading-relaxed">
                    <b>Units 7 and 8</b>, mostly long-term carbon sinks. Ms. Rivera also said the nitrogen cycle will be on it <span className="text-[var(--mute)]">(Biology, Tue 10:42)</span>.
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
                  <p className="text-[14px] text-[var(--ink-2)]">{tier === "guest" ? "Sign up free, then add Pro to ask across every class." : "Ask is part of Pro: 30 questions a day across every class."}</p>
                  <Button variant="primary" onClick={() => need("askNotes", "ask")}>{tier === "guest" ? "Sign up free" : "See Pro"}</Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[15px] font-semibold">Try one of these</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGEST.map((s) => (
                    <button key={s} onClick={() => void send(s)} className="press-light rounded-full bg-[var(--card)] px-3.5 py-2 text-[13.5px] font-medium">
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-2">
              <div className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-[6px] bg-[var(--fg)] px-4 py-2 text-[15px] text-[var(--bg)]">{t.q}</div>
              <div className="text-right text-[11px] text-[var(--mute)]">{t.scope}</div>
              {t.a ? (
                <>
                  <div className="prose-nn w-fit max-w-[92%] rounded-[18px] rounded-bl-[6px] bg-[var(--bubble)] px-4 py-3 !text-[15px] !leading-relaxed" dangerouslySetInnerHTML={{ __html: marked.parse(t.a, { async: false }) as string }} />
                  <div className="flex flex-wrap gap-1.5">
                    {momentsIn(t.a, notes).map((m) => (
                      <Link key={m.seg} to={`/app/note/${m.note.id}?seg=${m.seg}`} className="press-light inline-flex items-center gap-1.5 rounded-full bg-[var(--card)] px-3 py-1.5 text-[12.5px] font-semibold">
                        ▶ {m.note.folder ?? m.note.title} · {Math.floor(m.at / 60)}:{String(Math.floor(m.at % 60)).padStart(2, "0")}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex w-14 gap-1 rounded-[18px] rounded-bl-[6px] bg-[var(--bubble)] px-3.5 py-3">
                  {[0, 1, 2].map((k) => (
                    <motion.span key={k} className="h-1.5 w-1.5 rounded-full bg-[var(--mute)]" animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: k * 0.12 }} />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(q);
        }}
        className="panel sticky bottom-24 mt-6 flex items-center gap-2 !rounded-full py-1.5 pl-5 pr-1.5 md:bottom-6"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={scope ? `Ask about ${scope}` : "Ask anything about your classes"} className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-[var(--mute)]" />
        {turns.length > 0 && (
          <button type="button" onClick={() => setTurns([])} className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--mute)] hover:text-[var(--fg)]">
            Clear
          </button>
        )}
        <button type="submit" aria-label="Ask" className="press grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-white">
          <ArrowUp size={17} strokeWidth={2.6} />
        </button>
      </form>
    </div>
  );
}
