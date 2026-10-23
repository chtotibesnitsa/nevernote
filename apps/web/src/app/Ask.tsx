// Ask your notes (Pro): a full-screen chat over every class, with saved chats,
// follow-ups, and tools (quiz me, explain simply, study plan, catch me up).
// Answers quote what was said, and each quote jumps to that moment.
import type { AskTool, Note } from "@nevernote/core";
import { ArrowUp, BookOpenCheck, CalendarClock, Check, Copy, History, Lightbulb, MessageSquarePlus, Rewind, Sparkles, Trash2 } from "lucide-react";
import { marked } from "marked";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, LockBadge, spring } from "../components/ui.tsx";
import { ask } from "../lib/cloud.ts";
import { useApp } from "./state.tsx";

interface Turn {
  q: string;
  a?: string;
  tool?: AskTool;
  at?: number;
}
interface Chat {
  id: string;
  title: string;
  scope: string | null;
  turns: Turn[];
  at: number;
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

const TOOLS: { id: AskTool; label: string; icon: typeof Sparkles; hint: string; ask: string }[] = [
  { id: "answer", label: "Ask", icon: Sparkles, hint: "Ask anything about your classes", ask: "" },
  { id: "quiz", label: "Quiz me", icon: BookOpenCheck, hint: "What should the quiz cover? (or just send)", ask: "Quiz me on these classes" },
  { id: "explain", label: "Explain simply", icon: Lightbulb, hint: "What should I explain simply?", ask: "Explain the hardest idea from these classes simply" },
  { id: "plan", label: "Study plan", icon: CalendarClock, hint: "Plan for which test? (or just send)", ask: "Make me a study plan for the next test" },
  { id: "recap", label: "Catch me up", icon: Rewind, hint: "Which class did you miss? (or just send)", ask: "Catch me up on what I missed" },
];

const SUGGEST = ["What's on the next test?", "What's due this week?", "What did I miss on Tuesday?", "Which topics did the teacher stress most?"];

const load = (): Chat[] => {
  try {
    const chats = JSON.parse(localStorage.getItem("nn:chats") ?? "null") as Chat[] | null;
    if (chats) return chats;
    // The single chat from before history existed becomes the first saved chat.
    const old = JSON.parse(localStorage.getItem("nn:ask") ?? "[]") as Turn[];
    return old.length ? [{ id: "first", title: old[0].q.slice(0, 60), scope: null, turns: old, at: Date.now() }] : [];
  } catch {
    return [];
  }
};

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export function Ask() {
  const { notes, tier, need } = useApp();
  const [chats, setChats] = useState<Chat[]>(load);
  const [openId, setOpenId] = useState<string | null>(() => chats[0]?.id ?? null);
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const [tool, setTool] = useState<AskTool>("answer");
  const [fresh, setFresh] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const chat = chats.find((c) => c.id === openId) ?? null;
  const [scope, setScope] = useState<string | null>(chat?.scope ?? null);
  const folders = useMemo(() => [...new Set(notes.map((n) => n.folder).filter(Boolean))] as string[], [notes]);
  const locked = tier !== "pro";
  const busy = !!chat?.turns.some((t) => t.a === undefined);

  useEffect(() => {
    try {
      localStorage.setItem("nn:chats", JSON.stringify(chats.slice(0, 40).map((c) => ({ ...c, turns: c.turns.slice(-30) }))));
    } catch {
      /* private mode: chats just aren't kept */
    }
  }, [chats]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chat?.turns.length, chat?.turns.at(-1)?.a]);

  const newChat = () => {
    setOpenId(null);
    setScope(null);
    setTool("answer");
    setDrawer(false);
    input.current?.focus();
  };

  const send = async (text: string, how: AskTool = tool) => {
    const question = text.trim() || TOOLS.find((t) => t.id === how)!.ask;
    if (!question || busy || !need("askNotes", "ask")) return;
    let id = chat?.id;
    const history = (chat?.turns ?? []).filter((t) => t.a).map((t) => ({ q: t.q, a: t.a! }));
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      const c: Chat = { id, title: question.slice(0, 60), scope, turns: [], at: Date.now() };
      setChats((all) => [c, ...all]);
      setOpenId(id);
    }
    const cid = id;
    setQ("");
    setChats((all) => all.map((c) => (c.id === cid ? { ...c, at: Date.now(), turns: [...c.turns, { q: question, tool: how, at: Date.now() }] } : c)));
    const ids = scope ? notes.filter((n) => n.folder === scope).map((n) => n.id) : undefined;
    const r = await ask(question, ids, { tool: how, history });
    const a = r.answer ?? (r.error === "pro" ? "Ask is part of Pro." : `Couldn't answer just now: ${r.error}`);
    setFresh(`${cid}:${question}`);
    setChats((all) => all.map((c) => (c.id === cid ? { ...c, turns: c.turns.map((t, i) => (i === c.turns.length - 1 ? { ...t, a } : t)) } : c)));
    setTool("answer");
  };

  const remove = (id: string) => {
    setChats((all) => all.filter((c) => c.id !== id));
    if (openId === id) setOpenId(null);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <button onClick={newChat} className="press flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] py-2.5 text-[14px] font-bold text-white">
        <MessageSquarePlus size={16} /> New chat
      </button>
      <div className="eyebrow mt-6 px-2">Your chats</div>
      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
        {chats.length === 0 && <p className="px-2 py-3 text-[13px] text-[var(--mute)]">Chats you start are saved here.</p>}
        <AnimatePresence initial={false}>
          {chats.map((c) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring} className="group relative">
              <button
                onClick={() => {
                  setOpenId(c.id);
                  setScope(c.scope);
                  setDrawer(false);
                }}
                className={`relative w-full rounded-[12px] px-3 py-2 text-left transition-colors ${c.id === openId ? "" : "hover:bg-[var(--bubble)]"}`}
              >
                {c.id === openId && <motion.span layoutId="chat-pick" transition={spring} className="absolute inset-0 rounded-[12px] bg-white shadow-[0_0_0_1px_var(--line),0_6px_14px_-8px_rgb(0_0_0/0.25)]" />}
                <span className="relative block truncate pr-6 text-[13.5px] font-semibold">{c.title}</span>
                <span className="relative block text-[11.5px] text-[var(--mute)]">
                  {c.scope ?? "All classes"} · {ago(c.at)}
                </span>
              </button>
              <button onClick={() => remove(c.id)} aria-label="Delete chat" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--mute)] opacity-0 transition hover:bg-black/5 hover:text-[var(--fg)] group-hover:opacity-100">
                <Trash2 size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[520px] w-full md:h-[calc(100dvh-5.25rem)]">
      {/* Saved chats: a column on wide screens, a drawer on phones. */}
      <aside className="hidden w-[250px] shrink-0 border-r border-[var(--line)] px-3 pb-4 pt-2 lg:block">{sidebar}</aside>
      <AnimatePresence>
        {drawer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm lg:hidden">
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={spring} onClick={(e) => e.stopPropagation()} className="h-full w-[280px] bg-[var(--card)] p-4 pt-6 shadow-2xl">
              {sidebar}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-5 pt-1 md:px-8">
          <button onClick={() => setDrawer(true)} className="rounded-full p-2 text-[var(--ink-2)] hover:bg-[var(--bubble)] lg:hidden" aria-label="Chats">
            <History size={18} />
          </button>
          <h1 className="truncate text-[20px] font-bold tracking-tight">{chat?.title ?? "Ask your notes"}</h1>
          {locked && <LockBadge step={tier === "guest" ? "signup" : "pro"} />}
          <div className="no-scrollbar ml-auto flex max-w-[55%] gap-1.5 overflow-x-auto">
            {[null, ...folders].map((f) => (
              <button
                key={f ?? "all"}
                onClick={() => setScope(f)}
                className={`relative shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${scope === f ? "text-white" : "bg-[var(--bubble)] text-[var(--ink-2)] hover:text-[var(--fg)]"}`}
              >
                {scope === f && <motion.span layoutId="ask-scope" transition={spring} className="absolute inset-0 rounded-full bg-[#1d1d1f]" />}
                <span className="relative">{f ?? "All classes"}</span>
              </button>
            ))}
          </div>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto px-5 md:px-8">
          <div className="mx-auto flex max-w-[780px] flex-col gap-5 py-6">
            {!chat?.turns.length && (locked ? <LockedDemo tier={tier} onUnlock={() => need("askNotes", "ask")} /> : <Welcome onPick={(t) => (t.id === "answer" ? input.current?.focus() : void send("", t.id))} onSuggest={(s) => void send(s, "answer")} />)}
            <AnimatePresence initial={false}>
              {chat?.turns.map((t, i) => (
                <motion.div key={`${chat.id}-${i}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-2">
                  <div className="ml-auto w-fit max-w-[85%] rounded-[20px] rounded-br-[6px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] px-4 py-2.5 text-[15px] text-white shadow-[0_8px_18px_-12px_rgb(0_0_0/0.6)]">
                    {t.tool && t.tool !== "answer" && <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wider text-white/55">{TOOLS.find((x) => x.id === t.tool)?.label}</span>}
                    {t.q}
                  </div>
                  {t.a !== undefined ? <Answer text={t.a} notes={notes} animate={fresh === `${chat.id}:${t.q}` && i === chat.turns.length - 1} /> : <Thinking />}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="px-5 pb-4 md:px-8">
          <div className="mx-auto max-w-[780px]">
            <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
              {TOOLS.map((t) => {
                const on = tool === t.id;
                return (
                  <motion.button key={t.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setTool(t.id)} className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${on ? "text-white" : "bg-[var(--bubble)] text-[var(--ink-2)] hover:text-[var(--fg)]"}`}>
                    {on && <motion.span layoutId="ask-tool" transition={spring} className="absolute inset-0 rounded-full bg-[#1d1d1f] shadow-[0_3px_0_#000]" />}
                    <t.icon size={14} className="relative" />
                    <span className="relative">{t.label}</span>
                  </motion.button>
                );
              })}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(q);
              }}
              className="flex items-end gap-2 rounded-[24px] bg-white p-1.5 pl-4 shadow-[0_0_0_1px_var(--line),0_18px_40px_-24px_rgb(0_0_0/0.45)] transition focus-within:shadow-[0_0_0_1.5px_#1d1d1f,0_18px_40px_-24px_rgb(0_0_0/0.45)]"
            >
              <textarea
                ref={input}
                rows={1}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(q);
                  }
                }}
                placeholder={tool === "answer" && scope ? `Ask about ${scope}` : TOOLS.find((t) => t.id === tool)!.hint}
                className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-[var(--mute)]"
              />
              <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={busy} aria-label="Send" className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-white disabled:opacity-50">
                <ArrowUp size={18} strokeWidth={2.6} />
              </motion.button>
            </form>
            <p className="mt-2 text-center text-[11.5px] text-[var(--mute)]">Answers come only from your classes, with a link to the moment it was said.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Welcome({ onPick, onSuggest }: { onPick: (t: (typeof TOOLS)[number]) => void; onSuggest: (s: string) => void }) {
  return (
    <div className="pt-6">
      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="title-serif text-center text-[2.4rem] leading-tight">
        What do you want to know?
      </motion.h2>
      <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
        {TOOLS.slice(1).map((t, i) => (
          <motion.button
            key={t.id}
            onClick={() => onPick(t)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 + i * 0.05 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-3 rounded-[20px] bg-white p-4 text-left shadow-[0_0_0_1px_var(--line),0_12px_26px_-20px_rgb(0_0_0/0.5)]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-white shadow-[0_3px_0_#000] transition group-hover:rotate-[-6deg]">
              <t.icon size={18} />
            </span>
            <span>
              <span className="block text-[15px] font-bold">{t.label}</span>
              <span className="block text-[12.5px] text-[var(--mute)]">{t.ask}</span>
            </span>
          </motion.button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {SUGGEST.map((s, i) => (
          <motion.button key={s} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }} onClick={() => onSuggest(s)} className="press-light rounded-full bg-[var(--card)] px-3.5 py-2 text-[13px] font-medium">
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** Not on Pro yet: a conversation that plays itself, then the way in. */
const DEMO: [string, string][] = [
  ["What's on Monday's quiz?", "**Units 7 and 8**, mostly long-term carbon sinks. Ms. Rivera said “the nitrogen cycle will be on it too” (Biology, Tue 10:42)."],
  ["Quiz me on it", "**1.** Which reservoir stores carbon longest?\nA) Atmosphere B) Limestone C) Plants D) Oceans\n\n**2.** Is decomposition a carbon source or sink?"],
  ["Make me a study plan", "**Sat** 25 min: flashcards on sinks and sources\n**Sun** 30 min: practice FRQ on the carbon cycle\n**Mon** 15 min: quick review before class"],
];

function LockedDemo({ tier, onUnlock }: { tier: string; onUnlock: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % (DEMO.length * 2 + 2)), 1500);
    return () => clearInterval(t);
  }, []);
  const shown = DEMO.slice(0, Math.ceil(Math.min(step, DEMO.length * 2) / 2));
  return (
    <div className="rounded-[28px] bg-[var(--bubble)] p-5 md:p-7">
      <div className="min-h-[300px] space-y-3">
        <AnimatePresence>
          {shown.map(([q, a], i) => (
            <motion.div key={q} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="space-y-2">
              <div className="ml-auto w-fit rounded-[20px] rounded-br-[6px] bg-[#1d1d1f] px-4 py-2 text-[14.5px] text-white">{q}</div>
              {step >= (i + 1) * 2 ? (
                <motion.div initial={{ opacity: 0, scale: 0.96, originX: 0 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="prose-nn w-fit max-w-[90%] rounded-[20px] rounded-bl-[6px] bg-white px-4 py-2.5 !text-[14px]" dangerouslySetInnerHTML={{ __html: marked.parse(a, { async: false, breaks: true }) as string }} />
              ) : (
                <Thinking />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-5">
        <p className="max-w-md text-[14px] text-[var(--ink-2)]">{tier === "guest" ? "Sign up free, then add Pro to ask across every class." : "Pro: ask, get quizzed, explain anything simply and get study plans across every class. From $2.50 a month."}</p>
        <Button variant="primary" onClick={onUnlock}>
          {tier === "guest" ? "Sign up free" : "Unlock Ask"}
        </Button>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex w-16 gap-1 rounded-[20px] rounded-bl-[6px] bg-white px-4 py-3.5 shadow-[0_0_0_1px_var(--line)]">
      {[0, 1, 2].map((k) => (
        <motion.span key={k} className="h-1.5 w-1.5 rounded-full bg-[var(--mute)]" animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.7, repeat: Infinity, delay: k * 0.12 }} />
      ))}
    </div>
  );
}

/** An answer, typed out the first time it appears, with its moments and a copy button. */
function Answer({ text, notes, animate }: { text: string; notes: Note[]; animate: boolean }) {
  const [n, setN] = useState(animate ? 0 : text.length);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (n >= text.length) return;
    const step = Math.max(3, Math.round(text.length / 60));
    const t = setTimeout(() => setN((x) => Math.min(text.length, x + step)), 16);
    return () => clearTimeout(t);
  }, [n, text]);
  const done = n >= text.length;
  const moments = useMemo(() => (done ? momentsIn(text, notes) : []), [done, text, notes]);
  return (
    <div className="space-y-2">
      <div className="prose-nn w-fit max-w-[94%] rounded-[20px] rounded-bl-[6px] bg-white px-4 py-3 !text-[15px] !leading-relaxed shadow-[0_0_0_1px_var(--line),0_12px_26px_-22px_rgb(0_0_0/0.5)]" dangerouslySetInnerHTML={{ __html: marked.parse(text.slice(0, n), { async: false }) as string }} />
      {done && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-1.5">
          {moments.map((m, i) => (
            <motion.span key={m.seg} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring, delay: i * 0.06 }}>
              <Link to={`/app/note/${m.note.id}?seg=${m.seg}`} className="press-light inline-flex items-center gap-1.5 rounded-full bg-[var(--card)] px-3 py-1.5 text-[12.5px] font-semibold">
                ▶ {m.note.folder ?? m.note.title} · {Math.floor(m.at / 60)}:{String(Math.floor(m.at % 60)).padStart(2, "0")}
              </Link>
            </motion.span>
          ))}
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
            className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-[var(--mute)] transition hover:bg-[var(--bubble)] hover:text-[var(--fg)]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </motion.span>
            </AnimatePresence>
            {copied ? "Copied" : "Copy"}
          </button>
        </motion.div>
      )}
    </div>
  );
}

