import { pipelineDots, stageInfo, type Dot, type Stage } from "@nevernote/core";
import { motion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X_PROFILE } from "../lib/bridge.ts";

export const spring = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 } as const;
export const soft = { type: "spring", stiffness: 200, damping: 28 } as const;

const DOT: Record<Dot, string> = { red: "var(--color-dot-red)", orange: "var(--color-dot-orange)", green: "var(--color-dot-green)" };

export function StatusDot({ dot, live, size = 8 }: { dot: Dot; live?: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {live && <span className="absolute inset-0 rounded-full" style={{ background: DOT[dot], animation: "pulse-dot 1.6s var(--ease-liquid) infinite" }} />}
      <motion.span layout className="relative rounded-full" style={{ width: size, height: size, background: DOT[dot] }} animate={{ backgroundColor: DOT[dot] }} />
    </span>
  );
}

/** Heard → transcribed → summarised, as three dots. */
export function StageDots({ stage, withLabel, guest }: { stage: Stage; withLabel?: boolean; guest?: boolean }) {
  const dots = pipelineDots(stage);
  const info = stageInfo(stage, guest);
  return (
    <span className="inline-flex items-center gap-2" title={info.label}>
      <span className="inline-flex items-center gap-1">
        {dots.map((d, i) => (
          <StatusDot key={i} dot={d} size={6} live={info.live && d !== "green" && (i === 0 || dots[i - 1] === "green")} />
        ))}
      </span>
      {withLabel && <span className="text-xs text-[var(--mute)]">{info.label}</span>}
    </span>
  );
}

export function Wave({ level, bars = 9, color = "var(--color-dot-green)", active = true }: { level: number; bars?: number; color?: string; active?: boolean }) {
  return (
    <span className="inline-flex h-5 items-center gap-[2px]" aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const center = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const h = active ? 0.25 + Math.min(1, level * 1.4) * (0.35 + center * 0.65) : 0.2;
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full"
            style={{ background: color, height: 20 }}
            animate={{ scaleY: h }}
            transition={{ type: "spring", stiffness: 500, damping: 18, delay: i * 0.012 }}
          />
        );
      })}
    </span>
  );
}

type Variant = "primary" | "glass" | "ghost" | "danger";
export function Button({ variant = "glass", className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  const v: Record<Variant, string> = {
    primary: "press bg-[linear-gradient(180deg,#3a3a3c,#1d1d1f)] text-white dark:bg-[linear-gradient(180deg,#ffffff,#e5e5ea)] dark:text-[#1d1d1f]",
    glass: "press-light bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--bubble)]",
    ghost: "text-[var(--ink-2)] hover:bg-[var(--bubble)]",
    danger: "press bg-[var(--color-dot-red)] text-white",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[background,opacity,transform,box-shadow] disabled:opacity-50 ${v[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A small lock badge for features the current plan doesn't include yet. */
export function LockBadge({ step }: { step: "signup" | "pro" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-wide ${step === "pro" ? "bg-[var(--fg)] text-[var(--bg)]" : "bg-[var(--bubble)] text-[var(--ink-2)] shadow-[inset_0_0_0_1px_var(--line)]"}`}>
      {step === "pro" ? "Pro" : "Free account"}
    </span>
  );
}

export function Chip({ children, dashed, onClick }: { children: ReactNode; dashed?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium text-[var(--ink-2)] transition hover:bg-[var(--bubble)] ${dashed ? "border-dashed" : ""} border-[var(--line)]`}
    >
      {children}
    </button>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="15" fill="currentColor" />
        <path d="M19 44V20h4l14 17V20h5v24h-4L24 27v17z" fill="var(--bg)" />
        <circle cx="48" cy="45" r="4" fill="var(--color-clay)" />
      </svg>
      <span className="title-serif text-[1.35rem] leading-none">Nevernote</span>
    </span>
  );
}

/** The personal touch, top right everywhere. */
export function Hmu({ compact }: { compact?: boolean }) {
  return (
    <a
      href={X_PROFILE}
      target="_blank"
      rel="noreferrer"
      className="group glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs text-[var(--ink-2)] transition hover:text-[var(--fg)]"
    >
      <img src={`${import.meta.env.BASE_URL}aleks.jpg`} alt="Aleks" className="h-6 w-6 rounded-full bg-[var(--line)] object-cover" />
      <span>{compact ? "hmu" : "hmu, I made this"}</span>
      <span className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
    </a>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
