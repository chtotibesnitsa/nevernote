// Offline date and time finder for spoken English. Runs on every device with
// no network, so "your lab report is due Friday" becomes a real date the
// moment the teacher says it.

import { digitize } from "./numwords";

export interface DateHit {
  phrase: string;
  index: number;
  date: Date;
  hasTime: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};
const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const COUNT: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, couple: 2, few: 3 };

const MONTH_RE = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\\.?";
const WEEKDAY_RE = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday)";
const TIME_RE = "(?:,?\\s*(?:at|by|before|until|@)?\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)|,?\\s*(?:at|by)\\s+(noon|midnight))";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Applies "11:59 p.m." / "noon" to a day. Returns whether a time was set. */
function applyTime(d: Date, h?: string, m?: string, ampm?: string, word?: string): boolean {
  if (word) {
    if (word.toLowerCase() === "noon") d.setHours(12, 0, 0, 0);
    else d.setHours(23, 59, 0, 0);
    return true;
  }
  if (!h || !ampm) return false;
  let hour = Number(h) % 12;
  if (/p/i.test(ampm)) hour += 12;
  d.setHours(hour, m ? Number(m) : 0, 0, 0);
  return true;
}

/**
 * A month/day with no year means the next time that date comes around,
 * unless it was only a few days ago ("it was due October 2nd" said on the 5th).
 */
function resolveMonthDay(ref: Date, month: number, day: number): Date {
  const today = startOfDay(ref);
  let d = new Date(ref.getFullYear(), month, day);
  if (d.getTime() < today.getTime() - 14 * 86400_000) d = new Date(ref.getFullYear() + 1, month, day);
  return d;
}

/**
 * "Friday" is the coming Friday (a week out if said on a Friday).
 * "this Friday" is this week's, today included.
 * "next Friday" is the Friday of next calendar week (weeks run Monday to Sunday),
 * which is how teachers use it: "test next Tuesday" said on a Tuesday is a week away.
 */
function resolveWeekday(ref: Date, wd: number, modifier?: "next" | "this"): Date {
  const today = startOfDay(ref);
  if (modifier === "next") {
    const mondayNext = addDays(today, ((8 - today.getDay()) % 7) || 7);
    return addDays(mondayNext, (wd + 6) % 7);
  }
  let delta = (wd - today.getDay() + 7) % 7;
  if (delta === 0 && modifier !== "this") delta = 7;
  return addDays(today, delta);
}

export function findDates(input: string, ref: Date = new Date()): DateHit[] {
  const text = digitize(input);
  const hits: DateHit[] = [];
  const taken: [number, number][] = [];
  const push = (index: number, phrase: string, date: Date, hasTime: boolean) => {
    if (taken.some(([a, b]) => index < b && index + phrase.length > a)) return;
    taken.push([index, index + phrase.length]);
    hits.push({ phrase: phrase.trim(), index, date, hasTime });
  };

  const rules: [RegExp, (m: RegExpExecArray) => { date: Date; hasTime: boolean } | null][] = [
    // Friday, October 24th (at 11:59 p.m.)
    [new RegExp(`\\b(?:${WEEKDAY_RE},?\\s+)?(?:the\\s+)?${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?${TIME_RE}?`, "gi"),
      (m) => {
        const day = Number(m[3]);
        if (day < 1 || day > 31) return null;
        const d = m[4] ? new Date(Number(m[4]), MONTHS[m[2].toLowerCase()], day) : resolveMonthDay(ref, MONTHS[m[2].toLowerCase()], day);
        return { date: d, hasTime: applyTime(d, m[5], m[6], m[7], m[8]) };
      }],
    // the 24th of October
    [new RegExp(`\\bthe\\s+(\\d{1,2})(?:st|nd|rd|th)\\s+of\\s+${MONTH_RE}${TIME_RE}?`, "gi"),
      (m) => {
        const d = resolveMonthDay(ref, MONTHS[m[2].toLowerCase()], Number(m[1]));
        return { date: d, hasTime: applyTime(d, m[3], m[4], m[5], m[6]) };
      }],
    // 10/24 or 10/24/2026 (US order)
    [new RegExp(`\\b(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?\\b${TIME_RE}?`, "g"),
      (m) => {
        const mo = Number(m[1]) - 1, day = Number(m[2]);
        if (mo < 0 || mo > 11 || day < 1 || day > 31) return null;
        const yr = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
        const d = yr ? new Date(yr, mo, day) : resolveMonthDay(ref, mo, day);
        return { date: d, hasTime: applyTime(d, m[4], m[5], m[6], m[7]) };
      }],
    // next Tuesday / this Friday / Friday (at 3 p.m.)
    [new RegExp(`\\b(?:(next|this|coming|on|by|before|until)\\s+)?${WEEKDAY_RE}(?:\\s+(morning|afternoon|night|evening))?${TIME_RE}?`, "gi"),
      (m) => {
        const mod = m[1]?.toLowerCase() === "next" ? "next" : m[1]?.toLowerCase() === "this" ? "this" : undefined;
        const d = resolveWeekday(ref, WEEKDAYS[m[2].toLowerCase()], mod);
        return { date: d, hasTime: applyTime(d, m[4], m[5], m[6], m[7]) };
      }],
    // today / tonight / tomorrow
    [new RegExp(`\\b(today|tonight|tomorrow|the day after tomorrow)\\b${TIME_RE}?`, "gi"),
      (m) => {
        const w = m[1].toLowerCase();
        const d = addDays(startOfDay(ref), w === "tomorrow" ? 1 : w.startsWith("the day after") ? 2 : 0);
        let hasTime = applyTime(d, m[2], m[3], m[4], m[5]);
        if (!hasTime && w === "tonight") {
          d.setHours(23, 59, 0, 0);
          hasTime = true;
        }
        return { date: d, hasTime };
      }],
    // in two weeks / in 3 days / a week from today
    [/\b(?:in|within)\s+(?:a\s+)?(\d+|a|an|one|two|three|four|five|six|seven|couple(?:\s+of)?|few)\s+(day|week|month)s?\b/gi,
      (m) => {
        const n = /^\d+$/.test(m[1]) ? Number(m[1]) : COUNT[m[1].split(/\s/)[0].toLowerCase()] ?? 1;
        const unit = m[2].toLowerCase();
        const d = startOfDay(ref);
        if (unit === "day") d.setDate(d.getDate() + n);
        else if (unit === "week") d.setDate(d.getDate() + 7 * n);
        else d.setMonth(d.getMonth() + n);
        return { date: d, hasTime: false };
      }],
    // next week / end of the week / end of the month
    [/\b(next week|end of (?:the|this) week|end of (?:the|this) month|next month)\b/gi,
      (m) => {
        const w = m[1].toLowerCase();
        const today = startOfDay(ref);
        if (w === "next week") return { date: addDays(today, 7 - today.getDay() + 1), hasTime: false };
        if (w === "next month") return { date: new Date(today.getFullYear(), today.getMonth() + 1, 1), hasTime: false };
        if (w.includes("week")) return { date: addDays(today, (5 - today.getDay() + 7) % 7), hasTime: false };
        return { date: new Date(today.getFullYear(), today.getMonth() + 1, 0), hasTime: false };
      }],
  ];

  for (const [re, make] of rules) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const r = make(m);
      if (r && !Number.isNaN(r.date.getTime())) push(m.index, m[0], r.date, r.hasTime);
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/** Local ISO string without converting to UTC, so "Friday 11:59 p.m." stays Friday. */
export function toLocalISO(d: Date, allDay: boolean): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return allDay ? day : `${day}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}
