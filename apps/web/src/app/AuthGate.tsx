// The door into the app. Google everywhere; on the website only, a guest mode
// that keeps notes in this browser until the student signs up.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo, soft } from "../components/ui.tsx";
import { isDesktop } from "../lib/bridge.ts";
import { supabase } from "../lib/cloud.ts";
import { useApp } from "./state.tsx";

const redirectTo = () => (isDesktop ? "nevernote://auth" : `${location.origin}${import.meta.env.BASE_URL}app`);

export const signInWithGoogle = () => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });

/** Keeps a guest's notes: links Google to the same account instead of starting a new one. */
export async function upgradeGuest() {
  const { error } = await supabase!.auth.linkIdentity({ provider: "google", options: { redirectTo: redirectTo() } });
  if (error) await signInWithGoogle();
}

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthGate() {
  const [busy, setBusy] = useState<"google" | "guest" | null>(null);
  const [err, setErr] = useState("");

  // Linking Google to a guest fails if that Google account already has notes; sign straight into it instead.
  useEffect(() => {
    const p = new URLSearchParams(location.hash.slice(1) || location.search);
    if (p.get("error_code") === "identity_already_exists") void signInWithGoogle();
  }, []);

  const google = async () => {
    setBusy("google");
    const { error } = await signInWithGoogle();
    if (error) {
      setErr(error.message);
      setBusy(null);
    }
  };
  const guest = async () => {
    setBusy("guest");
    const { error } = await supabase!.auth.signInAnonymously();
    if (error) {
      setErr("Guest mode is unavailable right now. Sign in with Google instead.");
      setBusy(null);
    }
  };

  return (
    <div className="site relative grid min-h-screen place-items-center overflow-hidden px-5">
      <div className="liquid pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgb(232_151_62/0.28),transparent_62%)] blur-3xl" />
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={soft} className="glass relative w-full max-w-[420px] rounded-[32px] p-2">
        <div className="rounded-[26px] bg-[var(--card)] px-7 pb-7 pt-8 text-center">
          <Link to="/" className="inline-block">
            <Logo size={22} />
          </Link>
          <h1 className="title-serif mt-6 text-[2.4rem] leading-none">Save class for later.</h1>
          <p className="mt-3 text-[15px] text-[var(--ink-2)]">One account for your phone, laptop and the web. Free forever.</p>
          <button
            onClick={google}
            disabled={!!busy}
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-[var(--fg)] py-3.5 font-medium text-[var(--bg)] shadow-[0_14px_34px_-14px_rgb(28_25_21/0.6)] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
              <GoogleMark />
            </span>
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>
          {!isDesktop && (
            <button onClick={guest} disabled={!!busy} className="mt-3 w-full rounded-full border border-[var(--line)] py-3.5 font-medium transition hover:bg-[var(--bubble)] disabled:opacity-60">
              {busy === "guest" ? "Starting…" : "Try it as a guest"}
            </button>
          )}
          {!isDesktop && <p className="mt-3 text-xs text-[var(--mute)]">Guest notes live only in this browser until you sign up.</p>}
          <AnimatePresence>{err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-[var(--color-dot-red)]">{err}</motion.p>}</AnimatePresence>
          <p className="mt-6 text-xs text-[var(--mute)]">
            Audio never leaves your device. <Link to="/privacy" className="underline">Privacy</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/** Red bar on top of the app while a guest's notes exist only in this browser. */
export function GuestBar() {
  const { session } = useApp();
  if (!session?.user.is_anonymous) return null;
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[var(--color-dot-red)] px-4 py-2 text-center text-sm text-white">
      <span>Guest mode: all your history is lost if this browser resets.</span>
      <button onClick={() => void upgradeGuest()} className="rounded-full bg-white px-3 py-0.5 text-sm font-semibold text-[var(--color-dot-red)] transition hover:opacity-90">
        Sign up with Google to keep it, free forever
      </button>
    </div>
  );
}
