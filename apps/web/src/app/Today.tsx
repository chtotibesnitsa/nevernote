// The daily check-in on Home: a quick yes or no on anything NoteLater isn't sure
// was a real deadline, and the next two weeks at a glance.
import { answer, comingUp, reviewQueue, type Extraction, type Note } from "@notelater/core";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { CalendarPlus, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { spring } from "../components/ui.tsx";
import { download, icsFor } from "../lib/ics.ts";
import { useApp } from "./state.tsx";

const KIND: Record<string, string> = { deadline: "Due", exam: "Test", event: "Event", reminder: "Reminder" };

const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
const fmtDay = (iso?: string) => (iso ? day(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "No date heard");

export function Today() {
  const { notes, update, toast, need, tier } = useApp();
  const queue = useMemo(() => reviewQueue(notes), [notes]);
  // Unchecked ones show on their day too, marked as not sure yet.
  const ahead = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    const unsure = queue.filter((p) => p.e.when && p.e.when.slice(0, 10) >= now).map((p) => ({ ...p, unsure: true }));
    return [...comingUp(notes), ...unsure].sort((a, b) => a.e.when!.localeCompare(b.e.when!));
  }, [notes, queue]);
  const [gone, setGone] = useState<"left" | "right">("right");

  const reply = (e: Extraction, n: Note, yes: boolean) => {
    setGone(yes ? "right" : "left");
    update(n.id, { extractions: answer(n, e.id, yes ? "confirmed" : "dismissed") });
    if (!yes) return toast({ title: "Removed", body: `"${e.title}" won't show up anywhere.`, action: { label: "Undo", run: () => update(n.id, { extractions: n.extractions }) } });
    if (tier === "pro") toast({ title: "Tracked", body: e.when ? "It's in your calendar feed and you'll get a reminder the night before." : "Saved to your list." });
    else
      toast({
        title: "Tracked",
        body: e.when ? `${fmtDay(e.when)} · ${n.folder ?? n.title}` : "Saved to your list.",
        action: e.when ? { label: "Add to calendar", run: () => need("calendarFile", "calendarFile") && download(`${e.title}.ics`, icsFor([e], n.folder)) } : undefined,
      });
  };

  if (!queue.length && !ahead.length) return null;
  const top = queue[0];
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="panel relative overflow-hidden !rounded-[26px] p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[19px] font-bold tracking-tight">Is this real?</h2>
          <AnimatePresence mode="popLayout">
            <motion.span key={queue.length} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="text-[13px] font-semibold tabular-nums text-[var(--mute)]">
              {queue.length ? `${queue.length} to check` : "All caught up"}
            </motion.span>
          </AnimatePresence>
        </div>
        <p className="mt-0.5 text-[13px] text-[var(--mute)]">NoteLater heard these but isn't sure. Swipe or tap.</p>
        <div className="relative mt-5 h-[218px]">
          {/* The next two cards peek out underneath. */}
          {queue.slice(1, 3).map((p, i) => (
            <motion.div key={p.e.id} layout transition={spring} className="absolute inset-x-0 top-0 h-[190px] rounded-[22px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_10px_24px_-16px_rgb(0_0_0/0.3)]" style={{ transform: `translateY(${(i + 1) * 12}px) scale(${1 - (i + 1) * 0.04})`, zIndex: 2 - i, opacity: 1 - (i + 1) * 0.25 }} />
          ))}
          <AnimatePresence custom={gone}>
            {top ? (
              <Card key={top.e.id} p={top} onAnswer={(yes) => reply(top.e, top.n, yes)} />
            ) : (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="grid h-[190px] place-items-center rounded-[22px] bg-[var(--bubble)] text-center">
                <div>
                  <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring, delay: 0.1 }} className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-white shadow-[0_4px_0_#000]">
                    <Check size={22} strokeWidth={3} />
                  </motion.div>
                  <div className="mt-3 text-[15px] font-semibold">Nothing to check</div>
                  <div className="text-[13px] text-[var(--mute)]">New ones show up here after class.</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Week items={ahead} />
    </section>
  );
}

function Card({ p, onAnswer }: { p: { e: Extraction; n: Note }; onAnswer: (yes: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const yes = useTransform(x, [20, 120], [0, 1]);
  const no = useTransform(x, [-120, -20], [1, 0]);
  const end = (_: unknown, i: PanInfo) => {
    if (i.offset.x > 110 || i.velocity.x > 600) onAnswer(true);
    else if (i.offset.x < -110 || i.velocity.x < -600) onAnswer(false);
  };
  const { e, n } = p;
  return (
    <motion.div
      drag="x"
      dragSnapToOrigin
      onDragEnd={end}
      style={{ x, rotate, zIndex: 5 }}
      initial={{ y: 24, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      variants={{ out: (dir: "left" | "right") => ({ x: dir === "right" ? 420 : -420, rotate: dir === "right" ? 18 : -18, opacity: 0, transition: { duration: 0.32 } }) }}
      exit="out"
      transition={spring}
      whileTap={{ cursor: "grabbing" }}
      className="absolute inset-x-0 top-0 flex h-[190px] cursor-grab touch-pan-y flex-col rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_18px_36px_-18px_rgb(0_0_0/0.35)]"
    >
      <motion.span style={{ opacity: yes }} className="pointer-events-none absolute right-4 top-4 rounded-full bg-[#1d1d1f] px-3 py-1 text-[12px] font-bold text-white">TRACK IT</motion.span>
      <motion.span style={{ opacity: no }} className="pointer-events-none absolute right-4 top-4 rounded-full bg-[var(--bubble)] px-3 py-1 text-[12px] font-bold text-[var(--ink-2)]">NOPE</motion.span>
      <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-[var(--mute)]">
        <span className="rounded-full bg-[#fff4cc] px-2 py-0.5 text-[#1d1d1f]">{KIND[e.kind] ?? "Item"}</span>
        <span className={e.when ? "text-[var(--color-dot-red)]" : ""}>{fmtDay(e.when)}</span>
      </div>
      <div className="mt-2 line-clamp-1 text-[18px] font-bold tracking-tight">{e.title}</div>
      <Link to={`/app/note/${n.id}${e.segmentId ? `?seg=${e.segmentId}` : ""}`} onPointerDown={(ev) => ev.stopPropagation()} className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[var(--ink-2)] hover:text-[var(--fg)]">
        “{e.phrase}” <span className="text-[var(--mute)]">· {n.folder ?? n.title}</span>
      </Link>
      <div className="mt-auto flex gap-2">
        <button onClick={() => onAnswer(false)} onPointerDown={(ev) => ev.stopPropagation()} className="press-light flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[14px] font-semibold">
          <X size={16} strokeWidth={2.6} /> Not real
        </button>
        <button onClick={() => onAnswer(true)} onPointerDown={(ev) => ev.stopPropagation()} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] py-2.5 text-[14px] font-bold text-white">
          <Check size={16} strokeWidth={3} /> Track it
        </button>
      </div>
    </motion.div>
  );
}

/** The next 14 days as a strip of days with what's on each. */
function Week({ items }: { items: { e: Extraction; n: Note; unsure?: boolean }[] }) {
  const { need } = useApp();
  const days = useMemo(() => {
    const out: { iso: string; list: typeof items }[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push({ iso, list: items.filter((p) => p.e.when!.slice(0, 10) === iso) });
    }
    return out;
  }, [items]);
  const [pick, setPick] = useState(() => days.find((d) => d.list.length)?.iso ?? days[0].iso);
  const sel = days.find((d) => d.iso === pick) ?? days[0];
  const dated = items.filter((p) => p.e.when && !p.unsure);
  return (
    <div className="panel !rounded-[26px] p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[19px] font-bold tracking-tight">Next two weeks</h2>
        {dated.length > 0 && (
          <button onClick={() => need("calendarFile", "calendarFile") && download("NoteLater due dates.ics", icsFor(dated.map((p) => ({ ...p.e, title: `${p.e.title} · ${p.n.folder ?? p.n.title}` }))))} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-[var(--ink-2)] transition hover:bg-[var(--bubble)] hover:text-[var(--fg)]">
            <CalendarPlus size={15} /> Add all
          </button>
        )}
      </div>
      <div className="no-scrollbar -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => {
          const dt = day(d.iso);
          const on = d.iso === sel.iso;
          return (
            <motion.button key={d.iso} onClick={() => setPick(d.iso)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.02 }} whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }} className={`relative flex w-[46px] shrink-0 flex-col items-center rounded-[14px] py-2 transition-colors ${on ? "text-white" : "hover:bg-[var(--bubble)]"}`}>
              {on && <motion.span layoutId="week-pick" transition={spring} className="absolute inset-0 rounded-[14px] bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] shadow-[0_3px_0_#000]" />}
              <span className={`relative text-[10.5px] font-semibold uppercase ${on ? "text-white/70" : "text-[var(--mute)]"}`}>{i === 0 ? "Today" : dt.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="relative text-[17px] font-bold tabular-nums">{dt.getDate()}</span>
              <span className="relative mt-1 flex h-1.5 gap-0.5">
                {d.list.slice(0, 3).map((p) => (
                  <span key={p.e.id} className={`h-1.5 w-1.5 rounded-full ${p.e.kind === "exam" ? "bg-[var(--color-dot-red)]" : on ? "bg-white" : "bg-[#1d1d1f]"}`} />
                ))}
              </span>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={sel.iso} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-4 space-y-2">
          {sel.list.length === 0 && <p className="py-5 text-center text-[14px] text-[var(--mute)]">Nothing due {sel.iso === days[0].iso ? "today" : "this day"}.</p>}
          {sel.list.map((p) => (
            <Link key={p.e.id} to={`/app/note/${p.n.id}${p.e.segmentId ? `?seg=${p.e.segmentId}` : ""}`} className={`group flex items-center gap-3 rounded-[16px] px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_10px_20px_-14px_rgb(0_0_0/0.4)] ${p.unsure ? "border border-dashed border-black/15 bg-white" : "bg-[var(--bubble)]"}`}>
              <span className={`h-9 w-1 rounded-full ${p.e.kind === "exam" ? "bg-[var(--color-dot-red)]" : "bg-[#1d1d1f]"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.e.title}</span>
                <span className="block truncate text-[12.5px] text-[var(--mute)]">
                  {p.unsure ? "Not sure yet · " : ""}
                  {KIND[p.e.kind]} · {p.n.folder ?? p.n.title}
                  {!p.e.allDay && p.e.when ? ` · ${day(p.e.when).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
                </span>
              </span>
              <span className="text-[var(--mute)] transition group-hover:translate-x-0.5">→</span>
            </Link>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
