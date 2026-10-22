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
  // Show the notes as soon as they're written: on opening a summarised note, when
  // class ends, and again when a resumed class adds an update.
  useEffect(() => {
    if (note?.summary && rec.noteId !== id) setTab((t) => (t === "transcript" ? "summary" : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!note?.summary, note?.summary?.updates?.length]);

  if (!note) return <div className="p-10 text-[var(--mute)]">Opening…</div>;
  const live = rec.noteId === id && rec.state !== "idle";
  const md = note.summary ? `# ${note.title}\n\n${note.summary.notes}` : note.segments.map((s) => `${s.speaker ?? ""} ${s.text}`).join("\n");

  return (
    <div className="flex w-full flex-1 gap-8 px-5 md:px-8 xl:px-10">
    <div className="flex min-w-0 flex-1 flex-col">
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
    <Inspector note={note} live={live} />
    </div>
  );
}

/** Right-hand panel on wide screens: the session at a glance, who's talking, what's due. */
function Inspector({ note, live }: { note: Note; live: boolean }) {
  const { rec, update } = useApp();
  const secs = live ? rec.elapsed : note.durationSec || (note.segments.at(-1)?.end ?? 0);
  const words = note.segments.reduce((a, s) => a + s.text.split(" ").length, 0);
  const speakers = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of note.segments) if (s.speaker) count.set(s.speaker, (count.get(s.speaker) ?? 0) + s.text.split(" ").length);
    const total = [...count.values()].reduce((a, b) => a + b, 0) || 1;
    return [...count].sort((a, b) => b[1] - a[1]).map(([id, w], i) => ({ id, share: w / total, color: SPEAKER_TINTS[i % SPEAKER_TINTS.length], name: note.speakers.find((x) => x.id === id)?.name ?? id }));
  }, [note.segments, note.speakers]);
  const due = note.extractions.filter((e) => e.kind !== "important");
  const important = note.extractions.filter((e) => e.kind === "important");
  const rename = (id: string, cur: string) => {
    const name = prompt(`Who is ${cur}?`, cur);
    if (!name) return;
    const exists = note.speakers.some((s) => s.id === id);
    update(note.id, { speakers: exists ? note.speakers.map((s) => (s.id === id ? { ...s, name } : s)) : [...note.speakers, { id, name, share: 0 }] });
  };
  const box = "rounded-[20px] border border-[var(--line)] bg-[var(--card)] p-4";
  return (
    <aside className="sticky top-16 hidden h-fit max-h-[calc(100dvh-5rem)] w-[320px] shrink-0 space-y-3 overflow-y-auto pb-6 pt-12 lg:block">
      <div className={box}>
        <div className="flex items-center justify-between">
          <span className="eyebrow">{live ? (rec.state === "paused" ? "Paused" : "Recording") : "Class"}</span>
          {live ? <StatusDot dot={rec.state === "paused" ? "orange" : "red"} live={rec.state === "recording"} /> : <StageDots stage={note.stage} />}
        </div>
        <div className="mt-2 font-mono text-[2.2rem] leading-none tabular-nums tracking-tight">{fmtClock(secs)}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3 text-center">
          {[[words.toLocaleString(), "words"], [String(speakers.length || "–"), "voices"], [secs > 60 ? String(Math.round(words / (secs / 60))) : "–", "per min"]].map(([n, l]) => (
            <div key={l}>
              <div className="text-[17px] font-semibold tabular-nums">{n}</div>
              <div className="text-[11.5px] text-[var(--mute)]">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {speakers.length > 0 && (
        <div className={box}>
          <div className="eyebrow mb-2.5">Speakers</div>
          <div className="space-y-2.5">
            {speakers.map((sp) => (
              <button key={sp.id} onClick={() => rename(sp.id, sp.name)} className="group block w-full text-left" title="Rename">
                <div className="flex items-center gap-2 text-[14px]">
                  <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: sp.color }}>{sp.name[0]}</span>
                  <span className="flex-1 truncate font-medium group-hover:underline">{sp.name}</span>
                  <span className="text-[12px] tabular-nums text-[var(--mute)]">{Math.round(sp.share * 100)}%</span>
                </div>
                <div className="ml-8 mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bubble)]">
                  <motion.div className="h-full rounded-full" style={{ background: sp.color }} initial={{ width: 0 }} animate={{ width: `${sp.share * 100}%` }} transition={soft} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={box}>
        <div className="eyebrow mb-2.5">Due dates & tests</div>
        {due.length === 0 ? (
          <p className="text-[13.5px] text-[var(--mute)]">Nothing due yet. Anything with a date gets pinned here the moment it's said.</p>
        ) : (
          <div className="space-y-2">
            {due.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="w-10 shrink-0 rounded-lg bg-[var(--bubble)] py-1 text-center">
                  {e.when ? (
                    <>
                      <div className="text-[9.5px] font-semibold uppercase text-[var(--color-dot-red)]">{new Date(e.when).toLocaleDateString(undefined, { month: "short" })}</div>
                      <div className="text-[15px] font-semibold leading-none">{new Date(e.when).getDate()}</div>
                    </>
                  ) : (
                    <div className="text-[10px] text-[var(--mute)]">—</div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug">{e.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {important.length > 0 && (
        <div className={box}>
          <div className="eyebrow mb-2.5">They said this matters</div>
          <ul className="space-y-2 text-[13.5px] text-[var(--ink-2)]">
            {important.slice(0, 4).map((e) => (
              <li key={e.id} className="border-l-2 border-[var(--line)] pl-2.5">“{e.phrase}”</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
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
  const { update, rec, preview, liveEngine } = useApp();
  const [banner, setBanner] = useState(true);
  const [find, setFind] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(live); // a finished class opens at the top, a live one follows along
  const [behind, setBehind] = useState(false);
  const draft = live && preview?.note === note.id ? preview.text : "";
  const speakers = useMemo(() => {
    const ids = [...new Set(note.segments.map((s) => s.speaker).filter(Boolean))] as string[];
    return new Map(ids.map((id, i) => [id, { color: SPEAKER_TINTS[i % SPEAKER_TINTS.length], name: note.speakers.find((s) => s.id === id)?.name ?? id }]));
  }, [note.segments, note.speakers]);
  const flagged = useMemo(() => new Map(note.extractions.filter((e) => e.segmentId).map((e) => [e.segmentId!, e])), [note.extractions]);
  const shown = find ? note.segments.filter((s) => s.text.toLowerCase().includes(find.toLowerCase())) : note.segments;

  // The transcript scrolls inside its own box, so the page never grows. It follows
  // new words only while you're at the bottom; scroll up and it stays put.
  const onScroll = () => {
    const el = box.current!;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stick.current) setBehind(false);
  };
  const toEnd = () => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stick.current = true;
    setBehind(false);
  };
  useEffect(() => {
    if (stick.current) requestAnimationFrame(toEnd);
    else if (live) setBehind(true);
  }, [note.segments.length, draft, live]);

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
              <span>
                {liveEngine === "cloud"
                  ? "Live words come from your browser's speech service. Nevernote tells voices apart on this device and picks up names people say."
                  : "Everything stays on this device. Nevernote tells voices apart as you go and picks up names people say."}
              </span>
              <button onClick={() => setBanner(false)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {live && <div className="mt-4"><EnginePanel empty={note.segments.length === 0} /></div>}
      <div className="relative mt-3">
      <div ref={box} onScroll={onScroll} className="h-[calc(100dvh-420px)] min-h-[300px] overflow-y-auto md:h-[calc(100dvh-370px)] overscroll-contain rounded-2xl pb-28 pr-1 [overflow-anchor:none] md:pb-20">
      {note.segments.length === 0 && !draft ? (
        <div className="mt-16 text-center text-[var(--mute)]">
          {live ? (
            <span className="inline-flex items-center gap-2">
              <StatusDot dot="red" live /> Listening. Words appear as they're spoken.
            </span>
          ) : (
            "No words in this note yet."
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-0.5">
          <AnimatePresence initial={false}>
            {shown.map((s: Segment) => {
              const sp = s.speaker ? speakers.get(s.speaker) : undefined;
              const showName = s.speaker && s.speaker !== prevSpeaker;
              prevSpeaker = s.speaker;
              const flag = flagged.get(s.id);
              return (
                <motion.div key={s.id} layout="position" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={soft} className="group">
                  {showName && sp && (
                    <button onClick={() => rename(s.speaker!)} className="mb-1 mt-4 flex items-center gap-2 text-[13px] font-semibold md:ml-[64px]" title="Rename speaker">
                      <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] text-white" style={{ background: sp.color }}>{sp.name[0]}</span>
                      {sp.name}
                    </button>
                  )}
                  <div className="flex items-start gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-[var(--bubble)]/60 md:gap-4">
                    <span className="mt-[5px] hidden w-12 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-[var(--mute)] md:block">{fmtClock(s.start)}</span>
                    <div className="min-w-0 flex-1 border-l-2 pl-3 text-[17px] leading-relaxed" style={{ borderColor: sp ? `${sp.color}55` : "var(--line)" }}>
                      {highlight(s.text, find)}
                      {flag && <FlagTag e={flag} />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {draft && (
            <div className="flex items-start gap-3 px-1 py-1 md:gap-4">
              <span className="mt-[5px] hidden w-12 shrink-0 text-right font-mono text-[11.5px] text-[var(--mute)] md:block">now</span>
              <div className="min-w-0 flex-1 border-l-2 border-dashed border-[var(--line)] pl-3 text-[17px] leading-relaxed text-[var(--mute)]">
                {draft}
                <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-[var(--mute)]" />
              </div>
            </div>
          )}
        </div>
      )}
      <p className="mt-10 text-center text-[13px] text-[var(--mute)]">Always get consent when recording others.</p>
      </div>
      <AnimatePresence>
        {behind && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute inset-x-0 bottom-28 z-10 flex justify-center md:bottom-24">
            <button onClick={toEnd} className="rounded-full bg-[var(--fg)] px-4 py-2 text-[13px] font-medium text-[var(--bg)] shadow-lg">
              ↓ New words
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
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
    <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-1.5 rounded-full bg-[var(--fg)] px-2 py-0.5 align-middle text-[11px] font-medium text-[var(--bg)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-dot-red)]" />
      {label}
      {when && ` · ${when}`}
    </span>
  );
}

// ---------------- Summary ----------------

const clock = (sec: number) => {
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

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
      {(s.updates ?? []).map((u, i) => (
        <section key={u.at} className="relative rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 md:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--fg)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--bg)]">Update {i + 1}</span>
            <span className="text-[13px] font-medium">{new Date(u.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            <span className="text-[13px] text-[var(--mute)]">· from {clock(u.fromSec)} to {clock(u.toSec)} of the recording</span>
          </div>
          <article className="prose-nn" dangerouslySetInnerHTML={{ __html: marked.parse(u.notes, { async: false }) as string }} />
          {u.keyTerms.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {u.keyTerms.map((t) => (
                <span key={t.term} title={t.definition} className="rounded-full bg-[var(--bubble)] px-2.5 py-1 text-[12.5px]">{t.term}</span>
              ))}
            </div>
          )}
        </section>
      ))}
      {note.stage === "summarising" && (
        <section className="rounded-3xl border border-dashed border-[var(--line)] p-5 md:p-6">
          <div className="mb-3 text-[13px] font-medium text-[var(--ink-2)]">Adding what was said since…</div>
          <div className="space-y-2.5">
            {[88, 72, 80].map((w, i) => (
              <div key={i} className="skeleton h-3.5" style={{ width: `${w}%` }} />
            ))}
          </div>
        </section>
      )}
      {important.length > 0 && <Important items={important} />}
      {[...s.studyGuide, ...(s.updates ?? []).flatMap((u) => u.studyGuide)].length > 0 && <StudyGuide qa={[...s.studyGuide, ...(s.updates ?? []).flatMap((u) => u.studyGuide)]} />}
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-24 md:left-[248px] md:pb-6 md:pr-6 lg:pr-[376px]">
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
