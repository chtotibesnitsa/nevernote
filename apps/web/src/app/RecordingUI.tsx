// Everything around a live recording that isn't the transcript itself: the mic
// permission walkthrough, the transcriber loading panel, and the cutoff log with
// its STOPPED / Resume controls.
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpLeft, Mic, Pause, Play, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, fmtClock, soft, spring } from "../components/ui.tsx";
import { isDesktop } from "../lib/bridge.ts";
import { getCuts, type CutEntry } from "../lib/cutoffs.ts";
import { useApp } from "./state.tsx";

const STEPS = [
  ["Look at the address bar", "A small camera or tune icon shows up next to the web address."],
  ["Set Microphone to Allow", "Click it, then flip Microphone on."],
  ["Pick your mic", "Choose the mic you want from the list below, then try again."],
];

/** Greys out the page while the browser asks for the mic, and explains what to do if it's blocked. */
export function MicOverlay() {
  const { rec, start } = useApp();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [pick, setPick] = useState(() => localStorage.getItem("nn:mic") ?? "");
  const denied = !!rec.error && /NotAllowed|Permission|NotFound|Denied/i.test(rec.error);
  const asking = rec.state === "starting" && !rec.noteId;
  const open = !isDesktop && (asking || denied);
  useEffect(() => {
    if (!open) return;
    void navigator.mediaDevices?.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === "audioinput")));
  }, [open, rec.error]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-black/45 px-5 backdrop-blur-md">
          {asking && (
            <motion.div initial={{ opacity: 0, x: -10, y: -10 }} animate={{ opacity: 1, x: [0, -6, 0], y: [0, -6, 0] }} transition={{ x: { repeat: Infinity, duration: 1.2 }, y: { repeat: Infinity, duration: 1.2 }, opacity: { duration: 0.3 } }} className="absolute left-6 top-5 flex items-center gap-2 text-white">
              <ArrowUpLeft size={34} strokeWidth={3} /> <span className="text-lg font-extrabold">Click Allow up here</span>
            </motion.div>
          )}
          <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} transition={spring} className="glass-strong w-full max-w-[460px] rounded-[28px] p-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-[var(--color-dot-red)] text-white shadow-[0_14px_30px_-10px_rgb(239_68_68/0.7)]">
              <Mic size={30} strokeWidth={2.6} />
            </div>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{asking ? "Allow your microphone" : "Microphone is blocked"}</h2>
            <p className="mt-1.5 text-[15px] text-[var(--ink-2)]">{asking ? "Your browser is asking. Audio stays on this device." : "Nevernote can't hear class until you allow it."}</p>
            {denied && (
              <ol className="mt-5 space-y-2.5 text-left">
                {STEPS.map(([t, d], i) => (
                  <motion.li key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...soft, delay: 0.12 * i }} className="flex gap-3 rounded-2xl bg-[var(--bubble)] p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-sm font-extrabold text-[var(--bg)]">{i + 1}</span>
                    <span>
                      <span className="block font-bold">{t}</span>
                      <span className="text-sm text-[var(--ink-2)]">{d}</span>
                    </span>
                  </motion.li>
                ))}
              </ol>
            )}
            {denied && devices.length > 0 && (
              <select
                value={pick}
                onChange={(e) => {
                  setPick(e.target.value);
                  localStorage.setItem("nn:mic", e.target.value);
                }}
                className="mt-4 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm"
              >
                <option value="">Default microphone</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Microphone"}
                  </option>
                ))}
              </select>
            )}
            {denied && (
              <Button variant="primary" className="mt-4 w-full !py-3 font-bold" onClick={() => void start()}>
                <RefreshCw size={16} /> Try again
              </Button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Grey highlight over the transcript while the on-device model loads, or why it couldn't. */
export function EnginePanel({ empty }: { empty: boolean }) {
  const { rec, asr, retryAsr } = useApp();
  if (isDesktop) return null;
  const loading = asr.state === "loading" || asr.state === "idle";
  const pct = Math.round((asr.p ?? 0) * 100);
  if (asr.state === "error")
    return (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[var(--color-dot-orange)]/40 bg-[var(--bubble)] p-4">
        <TriangleAlert className="mt-0.5 shrink-0 text-[var(--color-dot-orange)]" size={20} />
        <div className="flex-1 text-sm">
          <div className="font-semibold">The transcriber couldn't download</div>
          <p className="mt-0.5 text-[var(--ink-2)]">Your audio is still being recorded and nothing is lost. Words fill in as soon as it's ready.</p>
        </div>
        <Button variant="glass" className="!py-1.5" onClick={retryAsr}>
          <RefreshCw size={14} /> Try again
        </Button>
      </div>
    );
  if (!loading && !(empty && rec.state === "recording")) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative mb-4 overflow-hidden rounded-2xl bg-[var(--bubble)] p-4">
      <motion.div className="absolute inset-y-0 left-0 bg-[var(--fg)]/[0.07]" animate={{ width: loading ? `${Math.max(pct, 3)}%` : "100%" }} transition={{ duration: 0.4 }} />
      <div className="relative flex items-center gap-3 text-sm">
        <Mic size={18} className="text-[var(--ink-2)]" />
        <div className="flex-1">
          <div className="font-medium">{loading ? `Getting the on-device transcriber ready${pct ? ` · ${pct}%` : ""}` : "Listening. Words land a moment after each pause."}</div>
          <div className="text-[var(--mute)]">{loading ? "A one-time download. Keep talking: everything you say now is transcribed once it's ready." : "Everything stays on this device."}</div>
        </div>
      </div>
    </motion.div>
  );
}

const WHY: Record<string, string> = { started: "●", manual: "■", paused: "❚❚", resumed: "▶", mic: "⚠", offline: "⚠", online: "✓", tab: "⚠", finished: "■" };

/** Status + Resume for a recording that stopped, plus the full cutoff history. */
export function CutBanner({ noteId, live }: { noteId: string; live: boolean }) {
  const { rec, get, resume, resumeNote, update, summarize } = useApp();
  const note = get(noteId)!;
  const [open, setOpen] = useState(false);
  const cuts: CutEntry[] = getCuts(noteId);
  const mine = rec.noteId === noteId && rec.state !== "idle";
  const stopped = mine ? rec.state === "paused" : note.stage === "paused" && !isDesktop;
  const lost = mine ? !!rec.stopReason : stopped;
  if (!cuts.length && !stopped) return null;
  const last = cuts.at(-1);
  return (
    <div className={`mb-4 rounded-2xl border p-3.5 ${stopped ? "border-[var(--color-dot-orange)]/50 bg-[var(--color-dot-orange)]/10" : "border-[var(--line)] bg-[var(--bubble)]"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold tracking-wide text-white ${stopped ? (lost ? "bg-[var(--color-dot-red)]" : "bg-[var(--color-dot-orange)]") : "bg-[var(--color-dot-green)]"}`}>
          {stopped ? (lost ? <TriangleAlert size={12} /> : <Pause size={12} />) : <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
          {stopped ? (lost ? "STOPPED" : "PAUSED") : live ? "RECORDING" : "SAVED"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink-2)]">{stopped ? (rec.stopReason ?? last?.text ?? "Everything up to here is saved.") : last?.text}</span>
        {stopped && (
          <>
            <Button variant="primary" className="!px-4 !py-2 font-bold" onClick={() => void (mine ? resume() : resumeNote(noteId))}>
              <Play size={14} /> Resume
            </Button>
            {!mine && note.segments.length > 0 && (
              <Button
                variant="glass"
                className="!px-4 !py-2"
                onClick={() => {
                  update(noteId, { stage: "queued" });
                  void summarize(noteId);
                }}
              >
                Finish &amp; write notes
              </Button>
            )}
          </>
        )}
        {cuts.length > 1 && (
          <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-[var(--mute)] underline">
            {open ? "Hide log" : `Log (${cuts.length})`}
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 space-y-1.5 overflow-hidden border-t border-[var(--line)] pt-3 text-sm">
            {cuts.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-5 text-center text-[var(--mute)]">{WHY[c.reason]}</span>
                <span className="w-12 font-mono text-[var(--mute)]">{fmtClock(c.sec)}</span>
                <span className="flex-1">{c.text}</span>
                <span className="text-[var(--mute)]">{new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
