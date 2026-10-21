import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCopy, Compass, ExternalLink, FileUp, Mic, Radio, Settings as SettingsIcon, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-bits";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

/**
 * Operating manual for getting class recordings out of Wispr Flow Notetaker and
 * into NeverNote. Written from Wispr's own MCP documentation.
 */
export default function Guide() {
  const { me } = useMe();
  const connected = me?.connections.wispr.status === "connected";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operating manual"
        title="Getting your classes in."
        subtitle="Record with Wispr Flow Notetaker, then let NeverNote read every transcript and summary automatically."
      />

      <section className={cn("paper-card p-5 fade-up", connected ? "ring-1 ring-sage/30" : "ring-1 ring-amber/30")}>
        <div className="flex items-start gap-3">
          {connected ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sage" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber" />}
          <div className="flex-1">
            <h2 className="text-lg font-medium">{connected ? "You're connected." : "Not connected yet."}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {connected
                ? `NeverNote is pulling from ${me?.connections.wispr.host ?? "Wispr Flow"} every 10 minutes. New meetings appear once Wispr finishes its summary.`
                : "Work through Part 1 and Part 2 below. Part 3 is the manual fallback you can use today, with zero setup."}
            </p>
            {!connected && (
              <Button asChild className="mt-3 rounded-xl"><Link to="/settings">Open Settings to connect <ArrowRight className="h-4 w-4" /></Link></Button>
            )}
          </div>
        </div>
      </section>

      <Part
        number="1"
        icon={<Mic className="h-5 w-5" />}
        title="Record your classes with Notetaker"
        summary="Notetaker is the part of Wispr Flow that records a session, transcribes it live, and writes an AI summary afterwards. This is what NeverNote reads."
      >
        <Steps
          items={[
            <>Open the Wispr Flow desktop app on your Mac (or Windows, where Notetaker is in limited beta). Notetaker does not exist on iOS — phones can only view meetings that synced from a computer.</>,
            <>Click <B>Notetaker</B> in the app to open the hub. If you see a <B>Notetaker MCP</B> banner there, your account has everything NeverNote needs.</>,
            <>In <B>Settings → Notetaker</B>, turn on meeting detection so classes on your calendar are offered automatically, and set recording limits long enough for a full period.</>,
            <>Start a recording at the beginning of class. For in-person classes just start it manually — Notetaker records what your microphone hears, no meeting link required.</>,
            <>Name your speakers once (teacher vs. you). Speaker labels flow into NeverNote, and quotes read much better when the teacher is actually labelled as the teacher.</>,
            <>Let Wispr finish after class. It produces the raw transcript, a refined transcript, and a Flow Summary. NeverNote uses all three.</>,
          ]}
        />
        <Callout tone="sage" title="Name your recordings after the course">
          Put the course in the title, like <Code>AP US GOVT — Period 3</Code>. NeverNote matches recordings to courses by keyword, so a consistent title means every item lands under the right class automatically. Set those keywords under Settings → Courses.
        </Callout>
      </Part>

      <Part
        number="2"
        icon={<Radio className="h-5 w-5" />}
        title="Connect the official MCP server (the automatic path)"
        summary="Wispr publishes a read-only MCP server and NeverNote already knows its address. One button, one approval, and your entire Notetaker history backfills — then it keeps itself current every 10 minutes."
      >
        <Callout tone="sky" title="Before you start — three account checks">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Open the Notetaker page in Wispr Flow and confirm the <B>Notetaker MCP</B> banner is there. No banner means MCP isn&apos;t enabled for your account yet.</li>
            <li>Turn on <B>Dictation Cloud Storage / Private Cloud Sync</B> in Wispr settings. MCP reads from your Wispr account, not from local files.</li>
            <li>MCP is unavailable on HIPAA BAA accounts, and school/work admins can switch it off org-wide.</li>
          </ul>
        </Callout>
        <Steps
          items={[
            <>Go to <Link to="/settings" className="font-medium text-primary underline">Settings → Wispr Flow</Link> and press <B>Connect Wispr Flow</B>. There is nothing to copy or paste — NeverNote already knows Wispr&apos;s MCP address (<Code>api.wisprflow.ai/connect/mcp</Code>), the same one shown under <B>All other apps</B> in Wispr&apos;s MCP settings.</>,
            <>A Wispr window opens. Sign in with the <B>same Wispr account that holds your class recordings</B> and press approve. Wispr issues the authorization itself; no key or token ever passes through your hands.</>,
            <>The window closes and the connection flips to <B>Connected</B>, listing the tools Wispr exposed. The first sync backfills your whole history — a few minutes on a large archive — and every later sync pulls only what changed.</>,
          ]}
        />
        <Callout tone="sage" title="Why there is nothing to paste">
          Wispr&apos;s MCP URL is the same for every account — it names the service, not you. Your recordings are protected by the approval you give in that popup, which mints a private token stored only in your server-side vault. If Wispr ever changes the address, <B>Use a different MCP server URL</B> in Settings lets you enter it by hand.
        </Callout>
        <Callout tone="amber" title="If the connection fails">
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li><B>MCP connection requires server OAuth configuration</B> — Wispr&apos;s server refused automatic client registration. Nothing you can fix from here; use Part 3 meanwhile.</li>
            <li><B>Asks you to reconnect after an hour</B> — Wispr granted a short-lived token instead of offline access. Disconnect and reconnect, approving every permission it requests.</li>
            <li><B>Signed into the wrong account</B> — personal vs. school Wispr accounts hold different notes. Sign out of Wispr in your browser, then reconnect.</li>
            <li><B>Too many requests</B> — Wispr throttles bursts. NeverNote already backs off exponentially and retries on its own.</li>
            <li><B>Nothing imported but connected</B> — the meetings exist locally but haven&apos;t synced to your Wispr account yet. Cloud sync must be on.</li>
          </ul>
        </Callout>
        <Callout tone="plum" title="What NeverNote can and cannot see">
          The connection is strictly read-only, by Wispr&apos;s design. NeverNote reads Notetaker meeting transcripts, refined transcripts, summaries, notes, and calendar events. It cannot read your dictation history (that stays on your devices), and it cannot change, rename, or delete anything inside Wispr Flow. Transcripts you deleted under a retention policy are gone and unreachable.
        </Callout>
      </Part>

      <Part
        number="3"
        icon={<ClipboardCopy className="h-5 w-5" />}
        title="The manual fallback that works right now"
        summary="No MCP access, or just want one class in immediately? Paste a Markdown export. Same extraction, same evidence, same chatbot — only the fetching is manual."
      >
        <Steps
          items={[
            <>In the Wispr Flow Notetaker hub, open the meeting you want.</>,
            <>Click the <B>···</B> menu on the meeting and choose <B>Copy to Markdown</B>.</>,
            <>Open <Link to="/settings#import" className="font-medium text-primary underline">Settings → Import Wispr Markdown</Link> and paste it (or drop in a saved <Code>.md</Code> file).</>,
            <>Pick the course, or leave it on auto-detect, and press <B>Import</B>. Extraction starts immediately.</>,
          ]}
        />
        <Callout tone="sage" title="Duplicates are safe">
          NeverNote fingerprints each transcript, so importing the same meeting twice changes nothing. You can freely paste a class you already have — and re-pasting a corrected transcript refreshes the evidence without losing decisions you already made.
        </Callout>
      </Part>

      <Part
        number="4"
        icon={<Sparkles className="h-5 w-5" />}
        title="What happens to a transcript once it lands"
        summary="Every imported class runs the same pipeline, and every output points back at the exact words that caused it."
      >
        <Steps
          items={[
            <><B>Split.</B> The transcript is broken into speaker-labelled segments so a quote can be traced to a moment.</>,
            <><B>Scan.</B> A cheap, fast model reads it looking for obligations — homework, assignments, readings, quizzes, tests, exams, project milestones, presentations, forms, materials to bring, appointments.</>,
            <><B>Ground.</B> Each item must carry a verbatim quote. If the quote isn&apos;t genuinely in the transcript, the item is thrown away rather than shown to you.</>,
            <><B>Date.</B> Phrases like &ldquo;next Thursday&rdquo; are resolved against the date the class was recorded. When a date is genuinely ambiguous, the item is filed as <B>Needs clarification</B> with no date — NeverNote never guesses a deadline.</>,
            <><B>Review.</B> Items land in <Link to="/review" className="font-medium text-primary underline">Review</Link> with their quote and a confidence score. You accept, edit, or reject.</>,
            <><B>Calendar.</B> Only after you accept and approve the preview does anything get written to Google Calendar — and it&apos;s written once, with an undo.</>,
          ]}
        />
        <Callout tone="sky" title="Then just ask">
          The <Link to="/coach" className="font-medium text-primary underline">Coach</Link> chatbot reads across every transcript you&apos;ve imported plus everything on your schedule. Ask &ldquo;what&apos;s due this week&rdquo;, &ldquo;what did she say about the essay rubric&rdquo;, or &ldquo;did I miss anything from Tuesday&rdquo;. Every factual sentence comes with a citation you can click to jump to that exact line of transcript. If it isn&apos;t in your recordings, it says so instead of inventing an answer.
        </Callout>
      </Part>

      <section className="paper-card p-5 fade-up">
        <h2 className="flex items-center gap-2 text-lg font-medium"><Compass className="h-5 w-5 text-primary" /> Daily rhythm</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Rhythm step="In class" body="Start Notetaker. Put the pen down and actually listen." />
          <Rhythm step="After class" body="Nothing. Sync runs itself every 10 minutes." />
          <Rhythm step="Once a day" body="Open Review, approve what's real, and let it hit your calendar." />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl"><Link to="/settings"><SettingsIcon className="h-4 w-4" /> Connections</Link></Button>
          <Button asChild variant="outline" className="rounded-xl"><Link to="/settings#import"><FileUp className="h-4 w-4" /> Import Markdown</Link></Button>
          <Button asChild variant="ghost" className="rounded-xl">
            <a href="https://docs.wisprflow.ai/collections/8559995472-wispr_notetaker" target="_blank" rel="noreferrer noopener">Wispr&apos;s own docs <ExternalLink className="h-3.5 w-3.5" /></a>
          </Button>
        </div>
      </section>
    </div>
  );
}

function Part({ number, icon, title, summary, children }: { number: string; icon: ReactNode; title: string; summary: string; children: ReactNode }) {
  return (
    <section className="paper-card p-5 fade-up">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Part {number}</p>
          <h2 className="text-lg font-medium leading-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
      </header>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ol>
  );
}

const TONES: Record<string, string> = {
  sage: "border-sage/30 bg-sage-soft/50 text-sage",
  amber: "border-amber/30 bg-amber-soft/50 text-amber",
  sky: "border-sky/30 bg-sky-soft/50 text-sky",
  plum: "border-plum/30 bg-plum-soft/50 text-plum",
};

function Callout({ tone, title, children }: { tone: keyof typeof TONES; title: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border px-3.5 py-3", TONES[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-wider">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

function Rhythm({ step, body }: { step: string; body: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{step}</p>
      <p className="mt-1 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function B({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[12px]">{children}</code>;
}
