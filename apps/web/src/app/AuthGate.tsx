// The door into the app. Google everywhere; on the website only, a guest mode
// that keeps notes in this browser until the student signs up.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Logo, soft } from "../components/ui.tsx";
import { desktop, isDesktop } from "../lib/bridge.ts";
import { desktopRedirect } from "../lib/handoff.ts";
import { bootUrl, rememberGuest, supabase } from "../lib/cloud.ts";
import { useApp } from "./state.tsx";

const redirectTo = () => (isDesktop ? desktopRedirect : `${location.origin}${import.meta.env.BASE_URL}app`);

/** On the desktop app Google opens in the student's browser, which hands the sign-in back (see handoff.ts). */
export async function signInWithGoogle() {
  if (!isDesktop) return supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  const r = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo(), skipBrowserRedirect: true, queryParams: { prompt: "select_account" } } });
  if (r.data?.url) await desktop!.openExternal(r.data.url);
  return r;
}

/**
 * One Google button for signing up and signing in. A new Google account is
 * linked to the guest, so it keeps its classes. A Google account that already
 * has NoteLater can't be linked; Google signs into it instead, and the guest's
 * classes are claimed onto it once back (see claimGuest).
 */
export async function upgradeGuest() {
  await rememberGuest();
  const { error } = await supabase!.auth.linkIdentity({ provider: "google", options: { redirectTo: redirectTo() } });
  if (error) await signInWithGoogle();
}

/** True when Google came back saying this account already exists: sign straight into it. */
export function existingAccountReturn(): boolean {
  const u = new URL(bootUrl || location.href);
  const p = new URLSearchParams(u.hash.slice(1));
  return (u.searchParams.get("error_code") ?? p.get("error_code")) === "identity_already_exists";
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
    if (existingAccountReturn()) void signInWithGoogle();
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
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={soft} className="relative w-full max-w-[440px] rounded-[32px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_40px_80px_-40px_rgb(0_0_0/0.35)]">
        <div className="px-7 pb-7 pt-9 text-center">
          <Link to="/" className="inline-block">
            <Logo size={22} />
          </Link>
          <h1 className="title-serif mt-7 text-[2.6rem] leading-none">Save class for later.</h1>
          <p className="mt-3 text-[15px] text-[var(--ink-2)]">One account for your phone, laptop and the web. Free forever.</p>
          <button
            onClick={google}
            disabled={!!busy}
            className="press mt-7 flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] py-4 text-[16px] font-bold text-white disabled:opacity-60"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
              <GoogleMark />
            </span>
            {busy === "google" ? (isDesktop ? "Finish in your browser…" : "Opening Google…") : "Continue with Google"}
          </button>
          {isDesktop && busy === "google" && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-[13px] text-[var(--ink-2)]">
              Pick your Google account in the browser tab that opened, then come back here.{" "}
              <button onClick={() => setBusy(null)} className="font-semibold underline underline-offset-2">
                Try again
              </button>
            </motion.p>
          )}
          {!isDesktop && (
            <button onClick={guest} disabled={!!busy} className="press-light mt-3 w-full rounded-full bg-white py-4 text-[16px] font-semibold transition hover:bg-[var(--bubble)] disabled:opacity-60">
              {busy === "guest" ? "Starting…" : "Try it now as a guest"}
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

/** A slim bar on top of the app while a guest's notes exist only in this browser. */
export function GuestBar() {
  const { session } = useApp();
  if (!session?.user.is_anonymous) return null;
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-[#1d1d1f] px-4 py-2 text-center text-[13px] text-white/80">
      <span>You're trying NoteLater as a guest. Sign up to keep your notes and unlock AI notes, sync and insights.</span>
      <button onClick={() => void upgradeGuest()} className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[12.5px] font-bold text-[#1d1d1f] shadow-[0_2px_0_#9a9aa0] transition active:translate-y-[2px] active:shadow-none">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white"><GoogleMark /></span>
        Sign up free
      </button>
    </div>
  );
}
