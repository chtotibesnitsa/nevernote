import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, spring } from "../components/ui.tsx";
import { isDesktop, GITHUB_REPO, type AsrModelId } from "../lib/bridge.ts";
import { STYLE_LIMITS, SUMMARY_STYLES, type SummaryPrefs, type SummaryStyleId } from "@nevernote/core";
import { cloudEnabled, fetchSummaryPrefs, saveSummaryPrefs, supabase } from "../lib/cloud.ts";
import { useApp, type Settings as S } from "./state.tsx";

const MODELS: { id: AsrModelId; label: string; blurb: string }[] = [
  { id: "parakeet-en", label: "Parakeet · English", blurb: "Most accurate, best in noisy rooms. 480 MB once." },
  { id: "parakeet-multi", label: "Parakeet v3 · 25 languages", blurb: "Spanish, French, German, Russian, Italian and more." },
  { id: "moonshine-base", label: "Moonshine · light", blurb: "For older computers. 250 MB." },
];

export function Settings() {
  const { settings, setSettings, session, plan, openPro, modelsReady, downloadModels, rec } = useApp();
  return (
    <div className="mx-auto w-full max-w-[1040px] px-5 pb-28 pt-4 md:px-10">
      <h1 className="text-[2rem] font-semibold tracking-tight">Settings</h1>

      <Section title="Account">
        {!cloudEnabled ? (
          <p className="text-sm text-[var(--ink-2)]">This build runs fully local. Sync and AI notes turn on when the app is connected to a Nevernote server.</p>
        ) : session ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">{session.user.email}</div>
              <div className="text-sm text-[var(--mute)]">{plan === "pro" ? "Pro" : "Free plan"} · notes sync to every device you sign in on</div>
            </div>
            <div className="flex gap-2">
              {plan !== "pro" && (
                <Button variant="primary" onClick={() => openPro("settings")}>
                  Get Pro
                </Button>
              )}
              <Button variant="ghost" onClick={() => supabase!.auth.signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <SignIn />
        )}
      </Section>

      {cloudEnabled && session && <NoteStyle />}

      <Section title="Your name">
        <input value={settings.name} onChange={(e) => setSettings({ name: e.target.value })} placeholder="What should Nevernote call you?" className="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none" />
      </Section>

      {isDesktop && (
        <Section title="Transcription engine" hint="Runs entirely on this computer. Nothing you record is uploaded to transcribe it.">
          <div className="space-y-2">
            {MODELS.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${settings.model === m.id ? "border-[var(--fg)]" : "border-[var(--line)]"}`}>
                <input type="radio" className="mt-1 accent-[var(--color-leather)]" checked={settings.model === m.id} onChange={() => setSettings({ model: m.id })} />
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="text-sm text-[var(--mute)]">{m.blurb}</span>
                </span>
              </label>
            ))}
          </div>
          {modelsReady === false && (
            <Button variant="primary" className="mt-3" onClick={() => void downloadModels()} disabled={rec.engineProgress !== undefined}>
              {rec.engineProgress !== undefined ? `Downloading… ${Math.round(rec.engineProgress * 100)}%` : "Download now"}
            </Button>
          )}
        </Section>
      )}

      <Section title="Microphone">
        <Toggle k="roomMode" label="Room mode" hint="Hears the whole room, not just you. Turn off for a one-on-one call with headphones." />
      </Section>

      <Section title="Notifications" hint="Shown the moment Nevernote hears it, during class.">
        <Toggle k="notifyDeadlines" label="Due dates" hint="“Your lab report is due Friday at 11:59”" />
        <Toggle k="notifyExams" label="Tests and quizzes" hint="“Unit 3 test next Tuesday”" />
        <Toggle k="notifyImportant" label="“This will be on the test” moments" />
        <Toggle k="proTips" label="Occasional Pro tips" hint="At most one every few days, never while you're recording." />
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2">
          {(["system", "light", "dark"] as const).map((t) => (
            <Button key={t} variant={settings.theme === t ? "primary" : "glass"} onClick={() => setSettings({ theme: t })}>
              {t[0].toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </Section>

      <p className="mt-10 text-center text-sm text-[var(--mute)]">
        Nevernote is free and open source ·{" "}
        <a className="underline" href={GITHUB_REPO} target="_blank" rel="noreferrer">
          source on GitHub
        </a>
      </p>
    </div>
  );
}

function NoteStyle() {
  const { plan, openPro, toast } = useApp();
  const [prefs, setPrefs] = useState<SummaryPrefs>({ style: "standard", rules: "", presets: [] });
  const [loaded, setLoaded] = useState(false);
  const [preset, setPreset] = useState({ folder: "", rules: "" });
  const pro = plan === "pro";
  const lim = STYLE_LIMITS[pro ? "pro" : "free"];
  useEffect(() => {
    fetchSummaryPrefs().then((p) => { setPrefs({ style: "standard", rules: "", presets: [], ...p }); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);
  const save = (next: SummaryPrefs) => {
    setPrefs(next);
    saveSummaryPrefs(next).catch(() => toast({ title: "Couldn't save your note style", body: "Check your connection." }));
  };
  const timer = useRef<number>(0);
  if (!loaded) return null;
  return (
    <Section title="How your notes are written" hint="Applies to every new summary, on every device. Notes that are already written keep their style.">
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(SUMMARY_STYLES) as SummaryStyleId[]).map((id) => (
          <button key={id} onClick={() => save({ ...prefs, style: id })} className={`rounded-2xl border p-3 text-left transition ${prefs.style === id ? "border-[var(--fg)] bg-[var(--bubble)]" : "border-[var(--line)] hover:bg-[var(--bubble)]"}`}>
            <div className="font-medium">{SUMMARY_STYLES[id].label}</div>
            <div className="text-sm text-[var(--mute)]">{SUMMARY_STYLES[id].blurb}</div>
          </button>
        ))}
      </div>
      <label className="mt-5 block text-sm font-medium" htmlFor="rules">Your own rules</label>
      <textarea
        id="rules"
        rows={3}
        maxLength={lim.rulesChars}
        value={prefs.rules ?? ""}
        onChange={(e) => {
          const next = { ...prefs, rules: e.target.value };
          setPrefs(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => save(next), 700);
        }}
        placeholder="e.g. Put every formula in its own list. Bold the vocabulary words."
        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 text-sm"
      />
      <div className="flex justify-between text-xs text-[var(--mute)]">
        <span>{(prefs.rules ?? "").length} / {lim.rulesChars}</span>
        {!pro && <button className="underline" onClick={() => openPro("summaryRules")}>Pro: longer rules, plus different rules for each class</button>}
      </div>
      {pro && (
        <div className="mt-5">
          <div className="text-sm font-medium">Rules for one class</div>
          <p className="text-sm text-[var(--mute)]">Used with the rules above when the note's class name matches.</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {(prefs.presets ?? []).map((p, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-xl bg-[var(--bubble)] px-3 py-2">
                <span><b>{p.folder}</b>: {p.rules}</span>
                <button className="text-[var(--mute)] underline" onClick={() => save({ ...prefs, presets: (prefs.presets ?? []).filter((_, j) => j !== i) })}>Remove</button>
              </li>
            ))}
          </ul>
          {(prefs.presets ?? []).length < lim.presets && (
            <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!preset.folder.trim() || !preset.rules.trim()) return; save({ ...prefs, presets: [...(prefs.presets ?? []), { folder: preset.folder.trim(), rules: preset.rules.trim() }] }); setPreset({ folder: "", rules: "" }); }}>
              <input aria-label="Class name" value={preset.folder} onChange={(e) => setPreset({ ...preset, folder: e.target.value })} placeholder="Class name, e.g. Biology" className="w-44 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
              <input aria-label="Rules for this class" value={preset.rules} maxLength={lim.rulesChars} onChange={(e) => setPreset({ ...preset, rules: e.target.value })} placeholder="Rules for this class" className="min-w-[200px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm" />
              <Button variant="primary" type="submit">Add</Button>
            </form>
          )}
        </div>
      )}
    </Section>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="mt-8">
      <h2 className="eyebrow">{title}</h2>
      {hint && <p className="mt-1 text-sm text-[var(--mute)]">{hint}</p>}
      <Card className="mt-3 p-5">{children}</Card>
    </motion.section>
  );
}

function Toggle({ k, label, hint }: { k: keyof S; label: string; hint?: string }) {
  const { settings, setSettings } = useApp();
  const on = !!settings[k];
  return (
    <button onClick={() => setSettings({ [k]: !on } as Partial<S>)} className="flex w-full items-center justify-between gap-4 py-2.5 text-left">
      <span>
        <span className="block">{label}</span>
        {hint && <span className="text-sm text-[var(--mute)]">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--color-dot-green)]" : "bg-[var(--line)]"}`}>
        <motion.span layout transition={spring} className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  );
}

export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const redirectTo = isDesktop ? "nevernote://auth" : `${location.origin}${import.meta.env.BASE_URL}app`;
  return (
    <div>
      <p className="text-sm text-[var(--ink-2)]">Sign in with the same account on your laptop and phone. Free.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="primary" onClick={() => supabase!.auth.signInWithOAuth({ provider: "apple", options: { redirectTo } })}>
           Continue with Apple
        </Button>
        <Button variant="glass" onClick={() => supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })}>
          Continue with Google
        </Button>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
          if (error) setErr(error.message);
          else setSent(true);
        }}
      >
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="or email me a link" className="flex-1 rounded-full border border-[var(--line)] bg-transparent px-4 py-2 text-sm outline-none" />
        <Button variant="glass" type="submit">
          {sent ? "Check your email" : "Send"}
        </Button>
      </form>
      {err && <p className="mt-2 text-sm text-[var(--color-dot-red)]">{err}</p>}
    </div>
  );
}
