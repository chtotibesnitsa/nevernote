import { PRICING, PRO_PITCH } from "@nevernote/core";
import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { GoogleMark, upgradeGuest } from "../app/AuthGate.tsx";
import { useApp } from "../app/state.tsx";
import { desktop } from "../lib/bridge.ts";
import { track } from "../lib/cloud.ts";
import { soft, spring } from "./ui.tsx";

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
            className="panel pointer-events-auto !rounded-2xl p-4"
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
                    className="press-light mt-2.5 rounded-full bg-[var(--card)] px-3 py-1 text-[12.5px] font-semibold text-[var(--fg)]"
                  >
                    {t.action.label}
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

/**
 * RevenueCat Web Purchase Link (Stripe underneath). The student's account id is
 * appended, so RevenueCat's webhook can flip that exact profile to Pro, the same
 * way App Store purchases do.
 */
const CHECKOUT = ((import.meta.env.VITE_RC_PURCHASE_LINK ?? import.meta.env.VITE_PRO_CHECKOUT_URL) as string | undefined)?.replace(/\/$/, "");

/** Why the sheet opened, said back to the student in one line. */
const WHY: Record<string, string> = {
  ask: "Ask anything across every class you've recorded.",
  calendar: "Every due date goes into your calendar on its own.",
  examPack: "Turn a whole unit of lectures into one review guide.",
  export: "Send your notes to Google Docs, Notion or a PDF.",
  flashcards: "Take your flashcards to Anki and Quizlet.",
  summaryRules: "Different note rules for every class.",
  unlimited: "Unlimited instant AI notes, every update, no waiting for tomorrow.",
  batchQueued: "Notes the second class ends, every time.",
  practiceTest: "Practice tests written from your own classes, as many as you want.",
  studyPlan: "A day-by-day study plan up to your next test.",
};

function Sheet({ open, onClose, dark, children }: { open: boolean; onClose: () => void; dark?: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/35" onClick={onClose} />
          <motion.div
            initial={{ y: 50, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.97, opacity: 0 }}
            transition={soft}
            className={`relative max-h-[92dvh] w-full max-w-[540px] overflow-y-auto rounded-[30px] p-7 ${dark ? "bg-[linear-gradient(180deg,#252527,#151517)] text-white shadow-[0_0_0_1.5px_#55555a,0_40px_80px_-30px_rgb(0_0_0/0.7)]" : "bg-[var(--card)] shadow-[0_0_0_1px_var(--line),0_40px_80px_-30px_rgb(0_0_0/0.45)]"}`}
          >
            <button onClick={onClose} className={`absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full ${dark ? "bg-white/10 text-white/70 hover:text-white" : "bg-[var(--bubble)] text-[var(--mute)] hover:text-[var(--fg)]"}`} aria-label="Close">
              <X size={16} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ProSheet() {
  const { proOpen, closePro, plan, session, tier, openSignup, refreshPlan, toast } = useApp();
  const [yearly, setYearly] = useState(true);
  const buy = (period: "monthly" | "yearly") => {
    track("checkout_clicked", { period, from: proOpen });
    // Pro belongs to an account, so a guest signs up first (their classes come along).
    if (tier === "guest" || !session) {
      closePro();
      openSignup("pro");
      return;
    }
    if (!CHECKOUT) {
      toast({ title: "Checkout isn't switched on yet", body: "Pro goes on sale very soon. Everything free keeps working in the meantime." });
      return;
    }
    const url = `${CHECKOUT}/${encodeURIComponent(session.user.id)}?email=${encodeURIComponent(session.user.email ?? "")}`;
    if (desktop) void desktop.openExternal(url);
    else window.open(url, "_blank");
    // Watch for the purchase landing (the webhook flips the profile within seconds).
    let tries = 0;
    const poll = setInterval(async () => {
      if (++tries > 120 || (await refreshPlan())) {
        clearInterval(poll);
        if (tries <= 120) {
          closePro();
          toast({ title: "Welcome to Nevernote Pro", body: "Instant notes, Ask, exam packs, exports and calendar sync are all on." });
        }
      }
    }, 5000);
  };
  const perMonth = yearly ? (PRICING.yearly.price / 12).toFixed(2) : PRICING.monthly.price.toFixed(2);
  const save = Math.round((1 - PRICING.yearly.price / (PRICING.monthly.price * 12)) * 100);
  return (
    <Sheet open={!!proOpen} onClose={closePro} dark>
      <h2 className="title-serif text-[2.2rem] leading-none">
        Nevernote <span className="bg-[linear-gradient(180deg,#ffffff,#9a9aa0)] bg-clip-text text-transparent">Pro</span>
      </h2>
      <p className="mt-2 text-[14.5px] text-white/65">{(proOpen && WHY[proOpen]) || "Your notes, working for you."} Everything free stays free.</p>
      <div className="mt-5 flex items-end gap-3">
        <span className="title-serif text-[3.2rem] leading-none tabular-nums">${perMonth}</span>
        <span className="pb-1.5 text-[13px] leading-tight text-white/55">
          per month
          <br />
          {yearly ? `$${PRICING.yearly.price} a year` : "billed monthly"}
        </span>
        <div className="ml-auto flex rounded-full bg-white/[0.08] p-1 ring-1 ring-white/10">
          {([false, true] as const).map((y) => (
            <button key={String(y)} onClick={() => setYearly(y)} className={`relative z-10 rounded-full px-3 py-1 text-[12.5px] font-semibold ${yearly === y ? "text-[#1d1d1f]" : "text-white/70"}`}>
              {yearly === y && <motion.span layoutId="nn-sheet-bill" transition={spring} className="absolute inset-0 -z-10 rounded-full bg-white" />}
              {y ? `Yearly −${save}%` : "Monthly"}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {PRO_PITCH.map((p, i) => (
          <motion.li key={p.feature} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 + i * 0.04 }} className="rounded-[16px] bg-white/[0.06] p-3.5 ring-1 ring-white/[0.08]">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-white text-[#1d1d1f]">
                <Check size={10} strokeWidth={3.4} />
              </span>
              {p.title}
            </span>
            <span className="mt-1 block text-[12.5px] leading-snug text-white/55">{p.body}</span>
          </motion.li>
        ))}
      </ul>
      {plan === "pro" ? (
        <div className="mt-6 rounded-2xl bg-white/[0.08] p-4 text-sm">You're on Pro. Thank you for keeping Nevernote free for everyone else.</div>
      ) : (
        <button onClick={() => buy(yearly ? "yearly" : "monthly")} className="mt-6 w-full rounded-full bg-white py-3.5 text-[15.5px] font-bold text-[#1d1d1f] shadow-[0_4px_0_#9a9aa0,0_20px_36px_-14px_rgb(0_0_0/0.8)] transition active:translate-y-[3px] active:shadow-[0_1px_0_#9a9aa0]">
          Get Pro {yearly ? "yearly" : "monthly"}
        </button>
      )}
      <p className="mt-3 text-center text-[11.5px] text-white/45">Cancel anytime. Pro pays for the free notes everyone else gets.</p>
    </Sheet>
  );
}

const SIGNUP_WHY: Record<string, string> = {
  pro: "Pro lives on your account, so it works on every device. Sign up free first; what you recorded comes with you.",
  summary: "Your transcript is saved. Sign up free and Nevernote writes the notes, study guide and key terms.",
  studyGuide: "Study guides come with a free account.",
  insights: "See your streak, hours and every due date you've caught.",
  calendarFile: "Add due dates to your calendar with a free account.",
  sync: "Keep your notes on your phone, laptop and the web.",
};

/** For guests: what a free account adds, and one Google button. */
export function SignupSheet() {
  const { signupOpen, closeSignup } = useApp();
  return (
    <Sheet open={!!signupOpen} onClose={closeSignup}>
      <h2 className="title-serif text-[2rem] leading-[1.05]">
        Keep everything. <span className="text-[var(--mute)]">Free forever.</span>
      </h2>
      <p className="mt-2 text-[14.5px] text-[var(--ink-2)]">{(signupOpen && SIGNUP_WHY[signupOpen]) || "You're using Nevernote as a guest. A free account unlocks the rest, and keeps what you've recorded."}</p>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {[
          ["AI notes and study guides", "5 instant AI notes a day"],
          ["Sync on every device", "Phone, laptop and the web"],
          ["Insights and streaks", "Hours, words, every due date"],
          ["Calendar files", "Any due date into Google or Apple Calendar"],
        ].map(([t, b]) => (
          <li key={t} className="rounded-[16px] bg-[var(--bubble)] p-3.5">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold">
              <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[var(--bg)]">
                <Check size={10} strokeWidth={3.4} />
              </span>
              {t}
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--mute)]">{b}</div>
          </li>
        ))}
      </ul>
      <button
        onClick={() => void upgradeGuest()}
        className="press mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] py-3.5 text-[15.5px] font-bold text-white"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
          <GoogleMark />
        </span>
        Continue with Google
      </button>
      <p className="mt-3 text-center text-[11.5px] text-[var(--mute)]">New here or already have an account, it's the same button. What you recorded as a guest, transcript and notes, moves into your account.</p>
    </Sheet>
  );
}
