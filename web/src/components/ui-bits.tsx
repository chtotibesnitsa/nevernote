import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { courseColor, isAssessment, STATUS_LABEL, TYPE_LABEL } from "@/lib/format";
import type { Course, ObligationStatus, ObligationType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 fade-up">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-3xl font-medium md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function TypeChip({ type }: { type: ObligationType }) {
  const assessment = isAssessment(type);
  return <span className={cn("chip", assessment ? "bg-clay-soft text-clay" : "bg-sage-soft text-sage")}>{TYPE_LABEL[type]}</span>;
}

export function StatusChip({ status, dirty }: { status: ObligationStatus; dirty?: boolean }) {
  const map: Record<ObligationStatus, string> = {
    needs_review: "bg-amber-soft text-amber",
    needs_clarification: "bg-plum-soft text-plum",
    accepted: "bg-sky-soft text-sky",
    rejected: "bg-secondary text-muted-foreground",
    calendar_created: "bg-sage-soft text-sage",
    calendar_updated: "bg-sage-soft text-sage",
  };
  return (
    <span className={cn("chip", map[status])}>
      {(status === "calendar_created" || status === "calendar_updated") && <Check className="h-3 w-3" />}
      {STATUS_LABEL[status]}
      {dirty && " · update pending"}
    </span>
  );
}

export function CourseChip({ course }: { course: Course | undefined }) {
  if (!course) return <span className="chip bg-secondary text-muted-foreground">No course</span>;
  const c = courseColor(course.color);
  return (
    <span className={cn("chip", c.bg, c.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {course.short_name || course.name}
    </span>
  );
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="How sure the extraction was">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
        <span className={cn("block h-full rounded-full transition-all", pct >= 75 ? "bg-sage" : pct >= 50 ? "bg-amber" : "bg-clay")} style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}

export function Evidence({ excerpt, label = "Teacher said" }: { excerpt: string; label?: string }) {
  return (
    <blockquote className="rounded-xl border-l-[3px] border-amber bg-amber-soft/40 px-3 py-2 text-sm leading-relaxed text-ink-soft">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-amber">{label}</span>
      <span className="whitespace-pre-line">“{excerpt}”</span>
    </blockquote>
  );
}

export function ErrorNote({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-clay/30 bg-clay-soft/60 px-3 py-2.5 text-sm text-clay">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        {message}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="paper-card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">{icon}</div>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
