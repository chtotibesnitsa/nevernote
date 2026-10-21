import type { ObligationStatus, ObligationType } from "./types";

export const TYPE_LABEL: Record<ObligationType, string> = {
  homework: "Homework",
  assignment: "Assignment",
  reading: "Reading",
  quiz: "Quiz",
  test: "Test",
  exam: "Exam",
  project_milestone: "Project milestone",
  presentation: "Presentation",
  form: "Form",
  material: "Bring",
  appointment: "Appointment",
};

export const STATUS_LABEL: Record<ObligationStatus, string> = {
  needs_review: "Needs review",
  accepted: "Accepted",
  rejected: "Rejected",
  calendar_created: "On calendar",
  calendar_updated: "On calendar",
  needs_clarification: "Needs a date",
};

export const COURSE_COLORS: { key: string; label: string; bg: string; text: string; dot: string }[] = [
  { key: "sage", label: "Sage", bg: "bg-sage-soft", text: "text-sage", dot: "bg-sage" },
  { key: "clay", label: "Clay", bg: "bg-clay-soft", text: "text-clay", dot: "bg-clay" },
  { key: "amber", label: "Amber", bg: "bg-amber-soft", text: "text-amber", dot: "bg-amber" },
  { key: "plum", label: "Plum", bg: "bg-plum-soft", text: "text-plum", dot: "bg-plum" },
  { key: "sky", label: "Sky", bg: "bg-sky-soft", text: "text-sky", dot: "bg-sky" },
  { key: "moss", label: "Moss", bg: "bg-moss-soft", text: "text-moss", dot: "bg-moss" },
];

export function courseColor(key: string | undefined) {
  return COURSE_COLORS.find((c) => c.key === key) ?? COURSE_COLORS[0];
}

export function isAssessment(type: ObligationType): boolean {
  return type === "quiz" || type === "test" || type === "exam";
}

export function fmtDate(iso: string | null | undefined, tz?: string, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "No date yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No date yet";
  return d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", ...opts });
}

export function fmtDateTime(iso: string | null | undefined, allDay: boolean, tz?: string): string {
  if (!iso) return "No date yet";
  const d = new Date(iso);
  if (allDay) return d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
  return d.toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeDue(iso: string | null): { label: string; tone: "overdue" | "soon" | "later" | "none" } {
  if (!iso) return { label: "date unclear", tone: "none" };
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / (24 * 3600 * 1000));
  if (diff < -12 * 3600 * 1000) return { label: days === -1 ? "yesterday" : `${Math.abs(days)} days ago`, tone: "overdue" };
  if (days <= 0) return { label: "today", tone: "soon" };
  if (days === 1) return { label: "tomorrow", tone: "soon" };
  if (days <= 3) return { label: `in ${days} days`, tone: "soon" };
  if (days <= 14) return { label: `in ${days} days`, tone: "later" };
  return { label: `in ${Math.round(days / 7)} weeks`, tone: "later" };
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function toLocalInputValue(iso: string | null, allDay: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return allDay ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function offsetLabel(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
