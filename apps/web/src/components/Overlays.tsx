import { PRICING, PRO_PITCH } from "@nevernote/core";
import { Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "../app/state.tsx";
import { desktop } from "../lib/bridge.ts";
import { track } from "../lib/cloud.ts";
import { Button, soft, spring } from "./ui.tsx";

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed right-4 top-14 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            transition={spring}
            className="glass-solid pointer-events-auto rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.body && <div className="mt-0.5 text-[13px] leading-snug text-[var(--ink-2)]">{t.body}</div>}
                {t.action && (
                  <button
                    onClick={() => {
                      t.action!.run();
                      dismissToast(t.id);
                    }}
                    className="mt-2 text-[13px] font-semibold text-[var(--color-leather)] dark:text-[var(--color-clay)]"
                  >
                    {t.action.label} →
                  </button>
                )}
              </div>
              <button onClick={() => dismissToast(t.id)} className="text-[var(--mute)] hover:text-[var(--fg)]" aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const CHECKOUT = import.meta.env.VITE_PRO_CHECKOUT_URL as string | undefined;

export function ProSheet() {
  const { proOpen, closePro, plan } = useApp();
  const buy = (period: "monthly" | "yearly") => {
    track("checkout_clicked", { period, from: proOpen });
    const url = CHECKOUT ? `${CHECKOUT}?period=${period}` : "https://nevernote.app/pro";
    if (desktop) void desktop.openExternal(url);
    else window.open(url, "_blank");
  };
  return (
    <AnimatePresence>
      {proOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={closePro} />
          <motion.div
            initial={{ y: 60, scale: 0.94, opacity: 0, borderRadius: 48 }}
            animate={{ y: 0, scale: 1, opacity: 1, borderRadius: 28 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={soft}
            className="glass-solid relative w-full max-w-[520px] overflow-hidden p-7"
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgb(200_121_74/0.35),transparent_65%)] blur-2xl" />
            <button onClick={closePro} className="absolute right-5 top-5 text-[var(--mute)] hover:text-[var(--fg)]" aria-label="Close">
              <X size={18} />
            </button>
            <div className="eyebrow">Nevernote Pro</div>
            <h2 className="title-serif mt-2 text-[2.1rem] leading-[1.05]">
              Your notes, <em>working for you.</em>
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-2)]">Recording, transcripts, speaker labels, AI notes and study guides stay free forever. Pro is for the extras.</p>
            <ul className="mt-5 space-y-3">
              {PRO_PITCH.map((p, i) => (
                <motion.li key={p.feature} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.05 + i * 0.04 }} className="flex gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)]">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>
                    <span className="text-sm font-semibold">{p.title}</span>
                    <span className="block text-[13px] leading-snug text-[var(--ink-2)]">{p.body}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
            {plan === "pro" ? (
              <div className="mt-6 rounded-2xl bg-[var(--bubble)] p-4 text-sm">You're on Pro. Thank you for keeping Nevernote free for everyone else.</div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button variant="glass" className="!rounded-2xl !py-3" onClick={() => buy("monthly")}>
                  {PRICING.monthly.label}
                </Button>
                <Button variant="primary" className="!rounded-2xl !py-3" onClick={() => buy("yearly")}>
                  {PRICING.yearly.label}
                  <span className="rounded-full bg-[var(--color-clay)] px-1.5 py-0.5 text-[10px] font-bold text-white">{PRICING.yearly.note}</span>
                </Button>
              </div>
            )}
            <p className="mt-3 text-center text-[11px] text-[var(--mute)]">Cancel anytime. Pro pays for the free summaries everyone else gets.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
