import { BarChart3, CircleDot, Home, Moon, Settings as Cog, Sparkles, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ProSheet, Toasts } from "../components/Overlays.tsx";
import { fmtClock, Hmu, Logo, spring, StatusDot, Wave } from "../components/ui.tsx";
import { isDesktop } from "../lib/bridge.ts";
import { cloudEnabled } from "../lib/cloud.ts";
import { AuthGate, GuestBar } from "./AuthGate.tsx";
import { MicOverlay } from "./RecordingUI.tsx";
import { useApp } from "./state.tsx";

const NAV = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/notes", label: "Notetaker", icon: CircleDot },
  { to: "/app/insights", label: "Insights", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Cog },
];

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
          className="glass w-full rounded-2xl p-3.5 text-left"
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
  const label = !online ? "Offline · saved on this device" : syncState === "syncing" ? "Syncing" : syncState === "error" ? "Sync paused" : session ? "Synced" : "On this device";
  const dot = !online || syncState === "error" ? "orange" : syncState === "syncing" ? "orange" : "green";
  return (
    <span className="hidden items-center gap-2 text-xs text-[var(--mute)] sm:inline-flex">
      <StatusDot dot={dot} live={syncState === "syncing"} size={7} />
      {label}
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { settings, setSettings, openPro, plan, session, authReady } = useApp();
  const loc = useLocation();
  const dark = document.documentElement.classList.contains("dark");
  if (cloudEnabled && !authReady) return <div className="min-h-screen bg-[var(--bg)]" />;
  if (cloudEnabled && !session) return <AuthGate />;
  return (
    <>
    <GuestBar />
    <MicOverlay />
    <div className={`flex min-h-screen ${isDesktop ? "" : "paper-grain"}`}>
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto px-3 pb-16 pt-12 md:flex" style={{ WebkitAppRegion: "drag" } as never}>
        <div className="flex items-center gap-2 px-3 pb-6" style={{ WebkitAppRegion: "no-drag" } as never}>
          <Logo />
          {plan === "pro" && <span className="rounded-md bg-[var(--color-clay)]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-leather)] dark:text-[var(--color-clay)]">Pro</span>}
        </div>
        <nav className="flex flex-col gap-0.5" style={{ WebkitAppRegion: "no-drag" } as never}>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="relative">
              {({ isActive }) => (
                <span className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${isActive ? "text-[var(--fg)]" : "text-[var(--ink-2)] hover:text-[var(--fg)]"}`}>
                  {isActive && <motion.span layoutId="nav-pill" transition={spring} className="glass absolute inset-0 rounded-xl" />}
                  <Icon size={18} className="relative" />
                  <span className="relative">{label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3" style={{ WebkitAppRegion: "no-drag" } as never}>
          <LiveCard />
          {plan !== "pro" && (
            <button onClick={() => openPro("sidebar")} className="flex items-center gap-3 rounded-xl bg-[var(--color-clay)]/15 px-3 py-2.5 text-[15px] font-bold text-[var(--fg)] transition hover:bg-[var(--color-clay)]/25">
              <Sparkles size={18} /> Get Pro
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col md:py-3 md:pr-3">
        <main className="relative flex min-h-[calc(100dvh-1.5rem)] flex-1 flex-col bg-[var(--card)] md:rounded-[26px] md:border md:border-[var(--line)] md:shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_30px_80px_-40px_rgb(60_40_20/0.25)]">
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
        <nav className="glass-strong fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl py-2 md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 text-[11px] ${isActive ? "text-[var(--fg)]" : "text-[var(--mute)]"}`}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Toasts />
      <ProSheet />
    </div>
    </>
  );
}
