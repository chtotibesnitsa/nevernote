import { BarChart3, CircleDot, GraduationCap, Home, MessageCircleQuestion, Moon, Settings as Cog, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ProSheet, SignupSheet, Toasts } from "../components/Overlays.tsx";
import { fmtClock, Hmu, Logo, spring, StatusDot, Wave } from "../components/ui.tsx";
import { isDesktop } from "../lib/bridge.ts";
import { cloudEnabled, supabase } from "../lib/cloud.ts";
import { AuthGate, GoogleMark, GuestBar, upgradeGuest } from "./AuthGate.tsx";
import { MicOverlay } from "./RecordingUI.tsx";
import { useApp } from "./state.tsx";

const NAV = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/notes", label: "Notetaker", icon: CircleDot },
  { to: "/app/ask", label: "Ask", icon: MessageCircleQuestion },
  { to: "/app/study", label: "Study", icon: GraduationCap },
  { to: "/app/insights", label: "Insights", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Cog },
];

/** Bottom of the sidebar: guests get the free sign-up, free accounts see Pro. */
function PlanCard() {
  const { tier, openPro } = useApp();
  if (tier === "pro") return null;
  if (tier === "guest")
    return (
      <div className="panel p-4">
        <div className="text-[13.5px] font-semibold">You're a guest</div>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--mute)]">Sign up free to get AI notes, sync and insights. Your recordings come with you.</p>
        <button onClick={() => void upgradeGuest()} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] py-2.5 text-[13px] font-bold text-white">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white"><GoogleMark /></span>
          Sign up free
        </button>
      </div>
    );
  return (
    <button onClick={() => openPro("sidebar")} className="group relative overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#2a2a2d,#161618)] p-4 text-left text-white shadow-[0_0_0_1.5px_#4a4a4f,0_14px_28px_-14px_rgb(0_0_0/0.6)] transition hover:-translate-y-0.5">
      <div className="title-serif text-[17px]">
        Nevernote <span className="bg-[linear-gradient(180deg,#fff,#9a9aa0)] bg-clip-text text-transparent">Pro</span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-white/55">Ask your notes, exam packs, calendar sync and exports.</p>
      <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[12px] font-bold text-[#1d1d1f] shadow-[0_3px_0_#9a9aa0]">See Pro · from $2.50/mo</span>
    </button>
  );
}

/** On the website the app opens straight away as a guest: no sign-in screen before the first recording. */
function useGuestStart(enabled: boolean) {
  const [state, setState] = useState<"idle" | "starting" | "failed">("idle");
  useEffect(() => {
    if (!enabled || state !== "idle") return;
    if (new URLSearchParams(location.search).has("signin")) return setState("failed");
    setState("starting");
    supabase!.auth.signInAnonymously().then(({ error }) => error && setState("failed"));
  }, [enabled, state]);
  return state;
}

function LiveCard() {
  const { rec, get } = useApp();
  const nav = useNavigate();
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (rec.state !== "recording") return setLevel(0);
    let raf = 0;
    const tick = () => {
      setLevel(rec.level());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rec.state, rec]);
  const note = rec.noteId ? get(rec.noteId) : undefined;
  return (
    <AnimatePresence>
      {rec.state !== "idle" && note && (
        <motion.button
          layout
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={spring}
          onClick={() => nav(`/app/note/${note.id}`)}
          className="panel w-full !rounded-2xl p-3.5 text-left"
        >
          <div className="truncate text-[15px] font-medium">{note.title}</div>
          <div className="mt-1.5 flex items-center gap-2 text-[var(--color-dot-green)]">
            <Wave level={level} active={rec.state === "recording"} color={rec.state === "paused" ? "var(--color-dot-orange)" : undefined} />
            <span className="font-mono text-sm tabular-nums">{rec.state === "paused" ? (rec.stopReason ? "STOPPED" : "Paused") : fmtClock(rec.elapsed)}</span>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function SyncPill() {
  const { syncState, online, session } = useApp();
  const label = session?.user.is_anonymous ? "Guest · saved in this browser" : !online ? "Offline · saved on this device" : syncState === "syncing" ? "Syncing" : syncState === "error" ? "Sync paused" : session ? "Synced" : "On this device";
  const dot = !online || syncState === "error" ? "orange" : syncState === "syncing" ? "orange" : "green";
  return (
    <span className="hidden items-center gap-2 text-xs text-[var(--mute)] sm:inline-flex">
      <StatusDot dot={dot} live={syncState === "syncing"} size={7} />
      {label}
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { settings, setSettings, plan, session, authReady } = useApp();
  const loc = useLocation();
  const dark = document.documentElement.classList.contains("dark");
  const guest = useGuestStart(cloudEnabled && authReady && !session && !isDesktop);
  if (cloudEnabled && !authReady) return <div className="min-h-screen bg-[var(--bg)]" />;
  if (cloudEnabled && !session) return guest === "failed" || isDesktop ? <AuthGate /> : <div className="min-h-screen bg-[var(--bg)]" />;
  return (
    <>
    <GuestBar />
    <MicOverlay />
    <div className={`flex min-h-screen ${isDesktop ? "" : "paper-grain"}`}>
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto px-3 pb-16 pt-12 md:flex" style={{ WebkitAppRegion: "drag" } as never}>
        <div className="flex items-center gap-2 px-3 pb-6" style={{ WebkitAppRegion: "no-drag" } as never}>
          <Logo />
          {plan === "pro" && <span className="rounded-full bg-[var(--fg)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--bg)]">Pro</span>}
        </div>
        <nav className="flex flex-col gap-0.5" style={{ WebkitAppRegion: "no-drag" } as never}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="relative">
              {({ isActive }) => (
                <span className={`relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] transition-colors ${isActive ? "font-semibold text-[var(--fg)]" : "font-medium text-[var(--ink-2)] hover:text-[var(--fg)]"}`}>
                  {isActive && <motion.span layoutId="nav-pill" transition={spring} className="absolute inset-0 rounded-[14px] bg-[var(--card)] shadow-[0_0_0_1px_var(--line),0_6px_14px_-8px_rgb(0_0_0/0.25)]" />}
                  <Icon size={18} strokeWidth={isActive ? 2.4 : 2} className="relative" />
                  <span className="relative">{label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3" style={{ WebkitAppRegion: "no-drag" } as never}>
          <LiveCard />
          <PlanCard />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col md:py-3 md:pr-3">
        <main className="relative flex min-h-[calc(100dvh-1.5rem)] flex-1 flex-col bg-[var(--card)] md:rounded-[28px] md:shadow-[0_0_0_1px_var(--line),0_30px_80px_-40px_rgb(0_0_0/0.22)]">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-5 pb-2 pt-3 md:px-8" style={{ WebkitAppRegion: "drag" } as never}>
            <span className="md:hidden">
              <Logo size={20} />
            </span>
            <SyncPill />
            <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as never}>
              <button
                onClick={() => setSettings({ theme: dark ? "light" : "dark" })}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--ink-2)] hover:bg-[var(--bubble)]"
                aria-label="Toggle dark mode"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <Hmu compact={isDesktop} />
            </div>
          </header>
          {/* A slide-in only: the page is never hidden waiting on an exit animation, so a tab click always shows it. */}
          <div key={loc.pathname.split("/").slice(0, 3).join("/")} className="nn-page flex flex-1 flex-col">
            {children}
          </div>
        </main>
        {/* Phone-width tab bar */}
        <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[22px] bg-[var(--card)] py-2 shadow-[0_0_0_1px_var(--line),0_16px_32px_-16px_rgb(0_0_0/0.35)] md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 px-1.5 text-[10.5px] ${isActive ? "font-semibold text-[var(--fg)]" : "text-[var(--mute)]"}`}>
              <Icon size={19} strokeWidth={2.2} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Toasts />
      <ProSheet />
      <SignupSheet />
    </div>
    </>
  );
}
