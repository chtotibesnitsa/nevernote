import { useMutation } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, Mic, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/AppShell";
import { GoogleConnect, WisprConnect } from "@/components/ConnectButtons";
import { CourseEditor } from "@/components/CourseEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const STEPS = ["Purpose", "Sources", "Courses"];

export default function Onboarding() {
  const { me, refresh } = useMe();
  const [step, setStep] = useState<number>(0);
  const [timezone, setTimezone] = useState<string>(me?.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [school, setSchool] = useState<string>(me?.profile.school_name ?? "");

  const finish = useMutation({
    mutationFn: () => api("/profile", { method: "PUT", json: { timezone, school_name: school, onboarding_done: true } }),
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <ol className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("h-1.5 rounded-full transition-all", i <= step ? "w-8 bg-primary" : "w-4 bg-border")} aria-label={s} />
          ))}
        </ol>
      </div>

      {step === 0 && (
        <section className="paper-card p-7 fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 1 · What this is</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight">Put the pen down. We do the noting.</h1>
          <p className="mt-2 text-sm text-muted-foreground">NeverNote keeps everything said in class, so you never miss a beat.</p>
          <ul className="mt-5 space-y-4 text-sm">
            <li className="flex gap-3"><Mic className="mt-0.5 h-5 w-5 shrink-0 text-sage" /><span><strong>Import</strong> your Wispr Flow Notetaker recordings — transcripts and summaries stay in your own vault.</span></li>
            <li className="flex gap-3"><BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber" /><span><strong>Detect</strong> homework, quizzes, tests and readings — each one with the exact quote it came from.</span></li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky" /><span><strong>Approve</strong> before anything is added to Google Calendar. Nothing is guessed, nothing is silent.</span></li>
          </ul>
          <div className="mt-6 rounded-xl bg-amber-soft/60 px-4 py-3 text-sm text-ink-soft">
            <strong className="text-foreground">Recording consent.</strong> Always get permission before recording teachers and classmates. School policies and local laws can apply even when Wispr records locally.
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Timezone</label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">School (optional)</label>
              <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Lincoln High" className="mt-1" />
            </div>
          </div>
          <Button className="mt-6 h-11 w-full rounded-xl" onClick={() => setStep(1)}>Continue <ArrowRight className="h-4 w-4" /></Button>
        </section>
      )}

      {step === 1 && (
        <section className="paper-card p-7 fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 2 · Sources</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight">Connect your sources.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Both are optional right now — you can always paste a Wispr Markdown export instead.</p>
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold">Wispr Flow Notetaker</h3>
              <p className="mb-3 text-xs text-muted-foreground">Read-only official MCP connection. One button, then approve in the Wispr window — nothing to copy or paste. The full walkthrough lives under Guide once you’re in.</p>
              <WisprConnect />
            </div>
            <div className="border-t border-border/70 pt-5">
              <h3 className="text-sm font-semibold">Google Calendar</h3>
              <p className="mb-3 text-xs text-muted-foreground">Separate from sign-in. Only used when you approve an item.</p>
              <GoogleConnect />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button className="h-11 flex-1 rounded-xl" onClick={() => setStep(2)}>Continue <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="paper-card p-7 fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 3 · Courses</p>
          <h1 className="mt-2 text-3xl font-medium leading-tight">Add your classes.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Schedules help resolve phrases like “next class”. You can add more later in Settings.</p>
          <div className="mt-5"><CourseEditor /></div>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button className="h-11 flex-1 rounded-xl" onClick={() => finish.mutate()} disabled={finish.isPending}>{finish.isPending ? <Spinner /> : "Open NeverNote"}</Button>
          </div>
        </section>
      )}
    </div>
  );
}
