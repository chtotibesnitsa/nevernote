// Two small things that stop the app looking stuck: a full-screen "opening" state
// for the first seconds, and a white pill with a green liquid fill that says what
// the voice transcriber is doing until it can be used.
import { AnimatePresence, motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { isDesktop } from "../lib/bridge.ts";
import { useApp } from "../app/state.tsx";
import { Logo } from "./ui.tsx";

/** Shown while the account and settings open, in place of a blank page. */
export function AppLoading({ label = "Opening your classes" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)]">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5">
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}>
          <Logo size={44} />
        </motion.div>
        <div className="h-[6px] w-[132px] overflow-hidden rounded-full bg-[var(--line)]">
          <div className="nn-load h-full w-1/2 rounded-full bg-[#34c759]" />
        </div>
        <div className="text-[13.5px] text-[var(--mute)]">{label}</div>
      </motion.div>
    </div>
  );
}

/** Friendly text for whatever the transcriber is doing, or null when there's nothing to say. */
function useStatus(): { text: string; sub: string; p?: number; retry?: () => void; done?: boolean } | null {
  const { asr, retryAsr, rec, modelsReady } = useApp();
  const [wasLoading, setWasLoading] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const loading = isDesktop ? rec.engineProgress !== undefined : asr.state === "loading" || asr.state === "idle";
  useEffect(() => {
    if (loading) return setWasLoading(true);
    if (!wasLoading) return;
    setWasLoading(false);
    setShowDone(true);
    const t = setTimeout(() => setShowDone(false), 2200);
    return () => clearTimeout(t);
  }, [loading, wasLoading]);
  if (isDesktop) {
    if (rec.engineProgress !== undefined) return { text: "Setting up your voice transcriber", sub: "One time only. You can look around meanwhile.", p: rec.engineProgress };
    if (modelsReady === false) return null;
  } else if (asr.state === "error") {
    return { text: "Transcriber is taking a break", sub: "Recording still works. We'll fill in words once it's back.", retry: retryAsr };
  } else if (loading) {
    return { text: "Getting your voice transcriber ready", sub: "One time, in your browser. Stays private.", p: asr.p };
  }
  return showDone ? { text: "Transcriber ready", sub: "Hit record whenever you like.", done: true } : null;
}

export function StatusPill() {
  const s = useStatus();
  const pct = s?.done ? 100 : Math.round((s?.p ?? 0) * 100);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[60] flex justify-center px-4 md:bottom-6">
      <AnimatePresence>
        {s && (
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="pointer-events-auto relative w-full max-w-[400px] overflow-hidden rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_18px_40px_-14px_rgb(0_0_0/0.35)]"
            role="status"
          >
            {/* the green liquid: fills from the left, with a slow wave on its edge */}
            <motion.div className="nn-liquid absolute inset-y-0 left-0" initial={false} animate={{ width: s.retry ? "0%" : s.p === undefined && !s.done ? "100%" : `${Math.max(pct, 8)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
            <div className="relative flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold leading-tight text-[#1d1d1f]">{s.text}</div>
                <div className="truncate text-[12px] leading-tight text-[#3c3c43]/70">{s.sub}</div>
              </div>
              {s.p !== undefined && !s.done && <div className="text-[13px] font-bold tabular-nums text-[#1d1d1f]">{pct}%</div>}
              {s.retry && (
                <button onClick={s.retry} className="press flex items-center gap-1.5 rounded-full bg-[#1d1d1f] px-3 py-1.5 text-[12px] font-bold text-white">
                  <RefreshCw size={12} /> Retry
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
