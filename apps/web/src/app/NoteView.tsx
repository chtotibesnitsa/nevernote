import { stageInfo, type Extraction, type Note, type Segment } from "@nevernote/core";
import { ArrowLeft, CalendarPlus, Copy, Folder, MoreHorizontal, Pause, Play, Search, Sparkles, Square, Trash2, X } from "lucide-react";
import { marked } from "marked";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Chip, fmtClock, soft, spring, StageDots, StatusDot } from "../components/ui.tsx";
import { ask, cloudEnabled } from "../lib/cloud.ts";
import { download, icsFor } from "../lib/ics.ts";
import { CutBanner, EnginePanel } from "./RecordingUI.tsx";
import { useApp } from "./state.tsx";

type Tab = "thoughts" | "transcript" | "summary";

const SPEAKER_TINTS = ["#6b4f3a", "#3f6f8a", "#7a5a8c", "#3f8a64", "#a2613a", "#5d6b3a", "#8a3f4f"];

export function NoteView() {
  const { id = "" } = useParams();
  const { get, load, update, remove, rec, pause, resume, stop } = useApp();
  const nav = useNavigate();
  const note = get(id);
  const [tab, setTab] = useState<Tab>("transcript");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    void load(id);
  }, [id, load]);
  useEffect(() => {
    if (note?.summary && rec.noteId !== id) setTab((t) => (t === "transcript" ? "summary" : t));
    // only on first load of a summarised note
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!note?.summary]);

  if (!note) return <div className="p-10 text-[var(--mute)]">Opening…</div>;
  const live = rec.noteId === id && rec.state !== "idle";
  const md = note.summary ? `# ${note.title}\n\n${note.summary.notes}` : note.segments.map((s) => `${s.speaker ?? ""} ${s.text}`).join("\n");

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col px-5 md:px-12">
      <div className="flex items-center justify-between py-1">
        <button onClick={() => nav("/app/notes")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--bubble)]" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <div className="relative flex items-center gap-2">
          <CalendarButton note={note} />
          <Button variant="glass" className="!py-1.5" onClick={() => navigator.clipboard.writeText(md)}>
            <Copy size={14} /> Copy
          </Button>
          <button onClick={() => setMenu((m) => !m)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--bubble)]" aria-label="More">
            <MoreHorizontal size={18} />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={spring} className="glass-strong absolute right-0 top-11 z-20 w-48 rounded-2xl p-1.5">
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-[var(--bubble)]"
                  onClick={() => download(`${note.title}.md`, md, "text/markdown")}
                >
                  Export Markdown
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--color-dot-red)] hover:bg-[var(--bubble)]"
                  onClick={async () => {
                    if (live) await stop();
                    await remove(note.id);
                    nav("/app/notes");
                  }}
                >
                  <Trash2 size={14} /> Delete note
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <input
        value={note.title}
        onChange={(e) => update(note.id, { title: e.target.value })}
        className="title-serif mt-4 w-full bg-transparent text-[2.6rem] leading-tight outline-none md:text-[3.2rem]"
        aria-label="Title"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip>{relDay(new Date(note.createdAt))}</Chip>
        <FolderChip note={note} />
        <span className="ml-1">
          <StageDots stage={note.stage} withLabel />
        </span>
      </div>

      <div className="mt-6">
        <CutBanner noteId={note.id} live={live} />
      </div>
      <div className="relative flex gap-7 border-b border-[var(--line)]">
        {(
          [
            ["thoughts", "My thoughts"],
            ["transcript", "Transcript"],
            ["summary", "Summary"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`relative flex items-center gap-1.5 pb-3 text-[17px] transition-colors ${tab === k ? "text-[var(--fg)]" : "text-[var(--mute)] hover:text-[var(--ink-2)]"}`}>
            {k === "transcript" && live && <TranscriptGlyph />}
            {k === "summary" && <Sparkles size={15} />}
            {label}
            {tab === k && <motion.span layoutId="note-tab" transition={spring} className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-[var(--fg)]" />}
          </button>
        ))}
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="pb-44 pt-6">
            {tab === "transcript" && <Transcript note={note} live={live} />}
            {tab === "summary" && <SummaryTab note={note} />}
            {tab === "thoughts" && (
              <textarea
                value={note.thoughts}
                onChange={(e) => update(note.id, { thoughts: e.target.value })}
                placeholder="Jot anything. Your notes get folded into the AI summary."
                className="min-h-[50vh] w-full resize-none bg-transparent font-serif text-[19px] leading-relaxed outline-none placeholder:text-[var(--mute)]"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomBar note={note} live={live} onPause={pause} onResume={resume} onStop={stop} />
    </div>
  );
}

function relDay(d: Date): string {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TranscriptGlyph() {
  return (
    <span className="inline-flex h-3 items-center gap-[2px]">
      {[0.5, 1, 0.7].map((h, i) => (
        <span key={i} className="w-[2px] rounded-full bg-[var(--color-dot-green)]" style={{ height: `${h * 12}px`, animation: `wave 1s ${i * 0.15}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

function FolderChip({ note }: { note: Note }) {
  const { update, notes } = useApp();
  const [editing, setEditing] = useState(false);
  const folders = useMemo(() => [...new Set(notes.map((n) => n.folder).filter(Boolean))] as string[], [notes]);
  if (editing)
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          list="folders"
          defaultValue={note.folder}
          placeholder="Class, e.g. APES"
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          onBlur={(e) => {
            update(note.id, { folder: e.target.value.trim() || undefined });
            setEditing(false);
          }}
          className="w-36 rounded-lg border border-[var(--line)] bg-transparent px-2.5 py-1 text-[13px] outline-none"
        />
        <datalist id="folders">
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </span>
    );
  return (
    <Chip dashed={!note.folder} onClick={() => setEditing(true)}>
      <Folder size={13} /> {note.folder ?? "Add folder"}
    </Chip>
  );
}

// ---------------- Transcript ----------------

function Transcript({ note, live }: { note: Note; live: boolean }) {
  const { update, rec } = useApp();
  const [banner, setBanner] = useState(true);
  const [find, setFind] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const speakers = useMemo(() => {
    const ids = [...new Set(note.segments.map((s) => s.speaker).filter(Boolean))] as string[];
    return new Map(ids.map((id, i) => [id, { color: SPEAKER_TINTS[i % SPEAKER_TINTS.length], name: note.speakers.find((s) => s.id === id)?.name ?? id }]));
  }, [note.segments, note.speakers]);
  const flagged = useMemo(() => new Map(note.extractions.filter((e) => e.segmentId).map((e) => [e.segmentId!, e])), [note.extractions]);
  const shown = find ? note.segments.filter((s) => s.text.toLowerCase().includes(find.toLowerCase())) : note.segments;

  useEffect(() => {
    const onScroll = () => (stick.current = window.innerHeight + window.scrollY > document.body.scrollHeight - 200);
    addEventListener("scroll", onScroll);
    return () => removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (live && stick.current) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [note.segments.length, live]);

  const rename = (id: string) => {
    const name = prompt(`Who is ${speakers.get(id)?.name}?`, speakers.get(id)?.name);
    if (!name) return;
    const exists = note.speakers.some((s) => s.id === id);
    update(note.id, { speakers: exists ? note.speakers.map((s) => (s.id === id ? { ...s, name } : s)) : [...note.speakers, { id, name, share: 0 }] });
  };

  let prevSpeaker: string | undefined;
  return (
    <div>
      <div className="sticky top-14 z-10 overflow-hidden rounded-2xl bg-[var(--bubble)]">
        <div className="flex items-center gap-3 px-4 py-3 text-[15px]">
          <span className="font-mono tabular-nums text-[var(--ink-2)]">⏱ {fmtClock(live ? rec.elapsed : note.durationSec || (note.segments.at(-1)?.end ?? 0))}</span>
          <span className="flex-1" />
          <Search size={16} className="text-[var(--mute)]" />
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find" className="w-24 bg-transparent text-sm outline-none placeholder:text-[var(--mute)] focus:w-40" style={{ transition: "width .3s var(--ease-liquid)" }} />
        </div>
        <AnimatePresence>
          {banner && (live || note.stage === "labelling") && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5 text-sm text-[var(--ink-2)]">
              <span>Everything stays on this device. Nevernote tells voices apart as you go and picks up names people say.</span>
              <button onClick={() => setBanner(false)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {live && <div className="mt-4"><EnginePanel empty={note.segments.length === 0} /></div>}
      {note.segments.length === 0 ? (
        <div className="mt-16 text-center text-[var(--mute)]">
          {live ? (
            <span className="inline-flex items-center gap-2">
              <StatusDot dot="red" live /> Listening. Words appear a moment after each pause.
            </span>
          ) : (
            "No words in this note yet."
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {shown.map((s: Segment) => {
              const sp = s.speaker ? speakers.get(s.speaker) : undefined;
              const showName = s.speaker && s.speaker !== prevSpeaker;
              prevSpeaker = s.speaker;
              const flag = flagged.get(s.id);
              return (
                <motion.div key={s.id} layout="position" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={soft} className="group">
                  {showName && sp && (
                    <button onClick={() => rename(s.speaker!)} className="mb-1 ml-1 mt-3 text-[13px] font-semibold" style={{ color: sp.color }} title="Rename speaker">
                      {sp.name}
                    </button>
                  )}
                  <div className="flex items-start gap-2">
                    <div className="max-w-[88%] rounded-2xl bg-[var(--bubble)] px-4 py-2.5 text-[17px] leading-relaxed" style={sp ? { boxShadow: `inset 3px 0 0 ${sp.color}33` } : undefined}>
                      {highlight(s.text, find)}
                      {flag && <FlagTag e={flag} />}
                    </div>
                    <span className="mt-3 font-mono text-[11px] text-[var(--mute)] opacity-0 transition group-hover:opacity-100">{fmtClock(s.start)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <div ref={end} />
      <p className="mt-10 text-center text-[13px] text-[var(--mute)]">Always get consent when recording others.</p>
    </div>
  );
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-[var(--color-clay)]/30 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function FlagTag({ e }: { e: Extraction }) {
  const label = { deadline: "Due", exam: "Test", event: "Event", reminder: "Reminder", important: "★ Important" }[e.kind];
  const when = e.when ? new Date(e.when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
  return (
    <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-1 rounded-full bg-[var(--color-clay)]/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-[var(--color-leather)] dark:text-[var(--color-clay)]">
      {label}
      {when && ` · ${when}`}
    </span>
  );
}

// ---------------- Summary ----------------

function SummaryTab({ note }: { note: Note }) {
  const { session, online, summarize, plan } = useApp();
  const [sponsor, setSponsor] = useState(false);
  const s = note.summary;
  const due = note.extractions.filter((e) => e.kind !== "important");
  const important = note.extractions.filter((e) => e.kind === "important");

  if (!s) {
    const info = stageInfo(note.stage);
    return (
      <div className="space-y-8">
        <div className="rounded-3xl border border-dashed border-[var(--line)] p-8 text-center">
          <div className="inline-flex items-center gap-2">
            <StatusDot dot={info.dot} live={info.live} />
            <span className="font-medium">{info.label}</span>
          </div>
          {note.stage === "summarising" ? (
            <div className="mx-auto mt-6 max-w-md space-y-2.5">
              {[90, 75, 82, 60].map((w, i) => (
                <div key={i} className="skeleton h-3.5" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <p className="mx-auto mt-3 max-w-md text-[15px] text-[var(--ink-2)]">
              {!cloudEnabled
                ? "AI notes need the Nevernote sync server. Your transcript and the due dates below are already here."
                : !session
                  ? "Sign in (free) and Nevernote writes notes, a study guide and key terms for every class."
                  : !online
                    ? "You're offline. This class is saved, and its notes get written the moment you're back on Wi-Fi."
                    : note.stage === "queued"
                      ? "Queued. Free notes past 3 a day are written overnight."
                      : "Ready when you are."}
            </p>
          )}
          {cloudEnabled && session && online && note.segments.length > 0 && note.stage !== "summarising" && (
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="primary" onClick={() => summarize(note.id)}>
                <Sparkles size={15} /> Write my notes
              </Button>
              {note.stage === "queued" && plan === "free" && (
                <Button variant="glass" onClick={() => setSponsor(true)}>
                  Get them now (5-second sponsor)
                </Button>
              )}
            </div>
          )}
        </div>
        <SponsorCard open={sponsor} onDone={() => (setSponsor(false), void summarize(note.id, true))} onClose={() => setSponsor(false)} />
        <DueList items={due} note={note} />
        {important.length > 0 && <Important items={important} />}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <DueList items={due} note={note} />
      <article
        className="prose-nn"
        dangerouslySetInnerHTML={{ __html: marked.parse(s.notes, { async: false }) as string }}
      />
      {important.length > 0 && <Important items={important} />}
      {s.studyGuide.length > 0 && <StudyGuide qa={s.studyGuide} />}
      {s.keyTerms.length > 0 && (
        <section>
          <h3 className="eyebrow mb-3">Key terms</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {s.keyTerms.map((t) => (
              <div key={t.term} className="rounded-2xl bg-[var(--bubble)] p-4">
                <dt className="font-serif text-lg">{t.term}</dt>
                <dd className="mt-1 text-sm text-[var(--ink-2)]">{t.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <p className="text-xs text-[var(--mute)]">Written by {s.model.split("/").pop()} · check anything important against the transcript.</p>
    </div>
  );
}

function DueList({ items, note }: { items: Extraction[]; note: Note }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="eyebrow mb-3">Due dates & tests</h3>
      <div className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)]">
        {items.map((e) => (
          <div key={e.id} className="flex items-center gap-4 bg-[var(--card)] px-4 py-3">
            <div className="w-14 shrink-0 text-center">
              {e.when ? (
                <>
                  <div className="text-[11px] font-semibold uppercase text-[var(--color-dot-red)]">{new Date(e.when).toLocaleDateString(undefined, { month: "short" })}</div>
                  <div className="font-serif text-2xl leading-none">{new Date(e.when).getDate()}</div>
                </>
              ) : (
                <span className="text-xs text-[var(--mute)]">no date</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{e.title}</div>
              <div className="truncate text-[13px] text-[var(--mute)]">“{e.phrase}”</div>
            </div>
            {e.when && (
              <button onClick={() => download(`${e.title}.ics`, icsFor([e], note.folder))} className="rounded-full p-2 text-[var(--ink-2)] hover:bg-[var(--bubble)]" title="Add to calendar">
                <CalendarPlus size={17} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Important({ items }: { items: Extraction[] }) {
  return (
    <section>
      <h3 className="eyebrow mb-3">They said this matters</h3>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className="rounded-2xl border-l-[3px] border-[var(--color-clay)] bg-[var(--bubble)] px-4 py-3 font-serif text-[17px] italic">
            “{e.phrase}”
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudyGuide({ qa }: { qa: { question: string; answer: string }[] }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  return (
    <section>
      <h3 className="eyebrow mb-3">Study guide · tap to flip</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {qa.map((q, i) => {
          const f = flipped.has(i);
          return (
            <motion.button
              key={i}
              onClick={() => setFlipped((s) => (s.has(i) ? (s.delete(i), new Set(s)) : new Set(s.add(i))))}
              animate={{ rotateY: f ? 180 : 0 }}
              transition={soft}
              style={{ transformStyle: "preserve-3d" }}
              className="relative min-h-[120px] rounded-2xl text-left"
            >
              <span className="absolute inset-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 [backface-visibility:hidden]">
                <span className="font-serif text-lg leading-snug">{q.question}</span>
              </span>
              <span className="absolute inset-0 rounded-2xl bg-[var(--fg)] p-4 text-[15px] text-[var(--bg)] [backface-visibility:hidden] [transform:rotateY(180deg)]">{q.answer}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/** House "sponsor" card: a 5-second pause in exchange for instant free notes. Swap in an ad network later. */
function SponsorCard({ open, onDone, onClose }: { open: boolean; onDone: () => void; onClose: () => void }) {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    if (!open) return setLeft(5);
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [open]);
  useEffect(() => {
    if (open && left <= 0) onDone();
  }, [left, open, onDone]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative overflow-hidden rounded-3xl bg-[var(--fg)] p-6 text-[var(--bg)]">
          <button onClick={onClose} className="absolute right-4 top-4 opacity-60" aria-label="Close">
            <X size={16} />
          </button>
          <div className="text-xs uppercase tracking-widest opacity-60">Sponsored · {left}s</div>
          <div className="title-serif mt-2 text-2xl">Nevernote is free because of people like you.</div>
          <p className="mt-1 text-sm opacity-80">Star it on GitHub, tell a friend in your class, or go Pro to skip this forever.</p>
          <motion.div className="absolute bottom-0 left-0 h-1 bg-[var(--color-clay)]" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 5, ease: "linear" }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------- Bottom bar ----------------

function BottomBar({ note, live, onPause, onResume, onStop }: { note: Note; live: boolean; onPause: () => void; onResume: () => void; onStop: () => Promise<void> }) {
  const { rec, plan, nudge, openPro, session } = useApp();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const submit = async (question: string) => {
    if (!question.trim()) return;
    if (plan !== "pro" || !session) {
      nudge("askedQuestion");
      openPro("ask");
      return;
    }
    setAsking(true);
    const r = await ask(question, [note.id]);
    setAsking(false);
    setAnswer(r.answer ?? (r.error === "pro" ? null : `Couldn't answer: ${r.error}`));
  };

  // Portalled: the page transition's transform would otherwise trap a fixed bar inside the scrolling page.
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-24 md:left-[248px] md:pb-6 md:pr-6">
      <div className="pointer-events-auto w-full max-w-[860px]">
        <AnimatePresence>
          {answer && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-solid mb-2 rounded-2xl p-4 text-[15px] leading-relaxed">
              <button className="float-right text-[var(--mute)]" onClick={() => setAnswer(null)} aria-label="Close">
                <X size={14} />
              </button>
              {answer}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div layout transition={spring} className="flex items-center gap-2">
          {live && (
            <motion.div layout className="glass-solid flex items-center gap-1 rounded-full p-1">
              <Button variant="ghost" className="!px-4" onClick={() => void onStop()} disabled={rec.state === "finishing"}>
                <Square size={13} fill="var(--color-dot-green)" color="var(--color-dot-green)" /> {rec.state === "finishing" ? "Finishing…" : "Stop"}
              </Button>
              {rec.state === "paused" ? (
                <Button variant="ghost" onClick={onResume}>
                  <Play size={14} /> Resume
                </Button>
              ) : (
                <Button variant="ghost" onClick={onPause} disabled={rec.state === "finishing"}>
                  <Pause size={14} /> Pause
                </Button>
              )}
            </motion.div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(q);
            }}
            className="glass-solid flex min-w-0 flex-1 items-center gap-2 rounded-full py-1.5 pl-5 pr-1.5"
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={asking ? "Thinking…" : "Ask anything"} className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-[var(--mute)]" />
            <button type="button" onClick={() => void submit("What did I miss? Summarise the last ten minutes in three bullets.")} className="whitespace-nowrap rounded-full bg-[var(--bubble)] px-3.5 py-1.5 text-sm font-medium">
              What did I miss?
            </button>
            {plan !== "pro" && (
              <button type="button" onClick={() => openPro("ask")} className="hidden rounded-full px-2 text-[11px] font-semibold text-[var(--color-leather)] sm:block dark:text-[var(--color-clay)]">
                PRO
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}

function CalendarButton({ note }: { note: Note }) {
  const { plan, openPro } = useApp();
  const dated = note.extractions.filter((e) => e.when && e.kind !== "important");
  return (
    <Button
      variant="glass"
      className="!py-1.5"
      onClick={() => {
        if (plan === "pro") download(`${note.title}.ics`, icsFor(dated, note.folder));
        else if (dated.length) {
          download(`${note.title}.ics`, icsFor(dated, note.folder));
          setTimeout(() => openPro("calendar"), 600);
        } else openPro("calendar");
      }}
    >
      <CalendarPlus size={14} /> {dated.length ? `${dated.length} to calendar` : "Connect calendar"}
    </Button>
  );
}
