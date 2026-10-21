import { CalendarCheck2, Lock, Quote } from "lucide-react";

import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ErrorNote, Spinner } from "@/components/ui-bits";
import { PromiseTicker, WordFlip } from "@/components/WordFlip";
import { useAuth } from "@/hooks/useAuth";

const MISS_WORDS = ["a beat.", "a task.", "a deadline.", "a due date.", "a reading.", "a test.", "a word of it."];
const TICKER = [
  "Never take notes again",
  "Never miss a deadline",
  "We listen, you live",
  "Never miss a task",
  "Every quote, every source",
  "Never miss a beat",
];

/** Google mark, drawn inline so the button needs no external asset. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.2-3.2-.5-4.7H24v9.1h12.6c-.5 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.5-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function SignIn() {
  const { signIn, isSigningIn, error, clearError } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md fade-up">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="paper-card overflow-hidden p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Stop writing it down</p>
          <h1 className="mt-2 text-3xl font-medium leading-[1.15]">
            You&apos;ll never miss{" "}
            <WordFlip words={MISS_WORDS} wordClassName="font-display font-semibold word-accent" />
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            NeverNote listens to your classes through Wispr Flow, keeps every transcript, and pulls out the homework,
            quizzes and due dates by itself. Put the pen down — we handle the noting.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm">
            <li className="flex items-center gap-2.5"><Quote className="h-4 w-4 shrink-0 text-amber" /> Every item quotes the exact moment it came from</li>
            <li className="flex items-center gap-2.5"><CalendarCheck2 className="h-4 w-4 shrink-0 text-sage" /> Nothing hits your calendar until you approve it</li>
            <li className="flex items-center gap-2.5"><Lock className="h-4 w-4 shrink-0 text-sky" /> Private instance · one owner · authenticator required</li>
          </ul>
          {error && <div className="mt-5"><ErrorNote message={error} action={<button className="underline" onClick={clearError}>Dismiss</button>} /></div>}
          <div className="mt-6">
            <Button size="lg" className="h-12 w-full rounded-xl bg-card text-base text-foreground shadow-sm ring-1 ring-border hover:bg-secondary" onClick={() => void signIn()} disabled={isSigningIn}>
              {isSigningIn ? <Spinner /> : <GoogleMark />} Continue with Google
            </Button>
          </div>
          <div className="-mx-7 mt-6 border-t border-border/70 pt-4">
            <PromiseTicker items={TICKER} />
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          This is a private, single-owner instance. Only the owner&apos;s Google account is accepted, and every sign-in
          also needs a code from their authenticator app.
        </p>
      </div>
    </div>
  );
}
