import { BookOpen, CalendarDays, Inbox, Library, MessageCircleMore, Settings, Sun } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Today", icon: Sun, end: true },
  { to: "/review", label: "Review", icon: Inbox },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/recordings", label: "Recordings", icon: Library },
  { to: "/coach", label: "Coach", icon: MessageCircleMore },
  { to: "/guide", label: "Guide", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Guide lives in the sidebar but is dropped from the cramped mobile tab bar. */
const MOBILE_NAV = NAV.filter((item) => item.to !== "/guide");

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icon.png" alt="" className="h-8 w-8 rounded-lg shadow-sm" />
      {!compact && (
        <span className="font-display text-lg font-medium tracking-tight">
          Never<span className="text-primary">Note</span>
        </span>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user } = useAuth();
  const { me } = useMe();
  const pending = me?.counts.pending_review ?? 0;

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col md:gap-6 md:border-r md:border-border/60 md:px-4 md:py-6 lg:w-64">
        <Logo />
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-pill" data-active={undefined}>
              {({ isActive }) => (
                <span data-active={isActive} className={cn("nav-pill w-full", isActive && "bg-card text-foreground shadow-sm")}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.to === "/review" && pending > 0 && (
                    <span className="ml-auto rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber">{pending}</span>
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
          {user?.picture ? <img src={user.picture} alt="" className="h-8 w-8 rounded-full" /> : <div className="h-8 w-8 rounded-full bg-sage-soft" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name || "Student"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-8 md:py-8">
          <div className="mb-5 flex items-center justify-between md:hidden">
            <Logo />
          </div>
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/90 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.to === "/review" && pending > 0 && <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-amber" />}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
