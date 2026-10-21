// Privacy policy and support: the two pages the App Store asks for.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Hmu, Logo } from "../components/ui.tsx";
import { GITHUB_REPO } from "../lib/bridge.ts";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="paper-grain min-h-screen">
      <header className="mx-auto flex max-w-[760px] items-center justify-between px-5 py-5">
        <Link to="/">
          <Logo size={20} />
        </Link>
        <Hmu />
      </header>
      <main className="prose-nn mx-auto max-w-[760px] px-5 pb-20 pt-6">
        <h1 className="title-serif text-[2.4rem]">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <Page title="Privacy">
      <p>Last updated October 21, 2026.</p>
      <h2>The short version</h2>
      <ul>
        <li>Your recordings are turned into text on your own phone or computer. Audio is never uploaded to transcribe it.</li>
        <li>Without an account, nothing leaves your device.</li>
        <li>With an account, your notes sync to your own private space so your devices match. Nobody else can read them.</li>
        <li>We don't sell data, show third-party tracking, or train models on your classes.</li>
      </ul>
      <h2>What we store if you sign in</h2>
      <ul>
        <li>Your email address (or the private relay address from Sign in with Apple).</li>
        <li>Your notes: titles, transcripts, speaker names you choose, due dates, summaries and your typed thoughts.</li>
        <li>Basic usage events, such as "a recording finished, 47 minutes". These never include audio or transcript text, and they help us see whether Nevernote is working for people.</li>
        <li>Your plan (Free or Pro). Payments are handled by Apple; we never see card details.</li>
      </ul>
      <h2>AI notes</h2>
      <p>
        When you ask for notes on a class, the transcript text (never audio) is sent to a language model provider to write the summary, study guide and key terms. We only route it to
        providers that don't train on the text sent to them. The result is saved to your account.
      </p>
      <h2>Microphone, notifications, calendar</h2>
      <p>
        The microphone is used only while you're recording, and iOS shows the recording indicator the whole time. Notifications are used for due dates and tests heard in class. Calendar access is used only
        when you add a due date to your calendar.
      </p>
      <h2>Deleting your data</h2>
      <p>
        Delete any note in the app, and it's deleted everywhere it synced. To delete your whole account and everything synced to it, tap Settings › Delete account in the app.
      </p>
      <h2>Children</h2>
      <p>Nevernote is meant for students 13 and older. Recording a class can require the teacher's permission; please follow your school's rules.</p>
      <h2>Open source</h2>
      <p>
        Every line of Nevernote is public, so you can check all of this yourself: <a href={GITHUB_REPO}>{GITHUB_REPO.replace("https://", "")}</a>.
      </p>
    </Page>
  );
}

export function Support() {
  return (
    <Page title="Support">
      <p>Something not working, or an idea? The fastest way to reach us is a GitHub issue. The maker reads every one.</p>
      <ul>
        <li>
          <a href={`${GITHUB_REPO}/issues/new`}>Open an issue on GitHub</a>
        </li>
        <li>
          Or message <a href="https://github.com/chtotibesnitsa">@chtotibesnitsa</a>
        </li>
      </ul>
      <h2>Common questions</h2>
      <h3>Does it work without internet?</h3>
      <p>Yes. Recording, transcripts, speaker labels and due-date alerts all work offline. AI notes are written when you're back online.</p>
      <h3>Will it keep recording if I lock my phone?</h3>
      <p>Yes. Lock the screen or switch apps; the red indicator shows it's still listening. Stop it from the note or the bar above the tabs.</p>
      <h3>The first recording took a while to start.</h3>
      <p>The first time, Nevernote downloads its on-device models (about 530 MB). After that it starts instantly, even in airplane mode.</p>
      <h3>How do I cancel Pro?</h3>
      <p>In iPhone Settings › your name › Subscriptions › Nevernote.</p>
    </Page>
  );
}
