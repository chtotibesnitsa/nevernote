// Keyword pass: finds deadlines, tests, events and "this will be on the test"
// moments as the transcript grows. Free, offline, instant; the AI summary
// later refines titles and catches what keywords can't.

import { findDates, toLocalISO } from "./dates.ts";
import type { Extraction, ExtractionKind, Segment } from "./types.ts";

interface Rule {
  kind: ExtractionKind;
  re: RegExp;
  /** Title to use when the sentence is too long to show as-is. */
  label?: (m: RegExpMatchArray) => string;
  /** Requires a date in the same or next sentence to count. */
  needsDate?: boolean;
}

const ASSIGNMENT =
  "(?:lab report|lab|essay|paper|homework|hw|assignment|worksheet|problem set|p-?set|project|presentation|reading|response|draft|outline|annotated bibliography|portfolio|journal|reflection|permission slip|form|application|frq|dbq|study guide|notes|chapter \\d+(?: questions)?|unit \\d+ (?:review|packet)|packet|slides)";
const EXAM = "(?:test|exam|quiz|midterm|final(?: exam)?|unit test|assessment|ap exam|practice test|mock exam|oral exam|lab practical|practical)";

export const RULES: Rule[] = [
  // "It will be on the quiz" is a study flag, not a quiz date, so it is checked first.
  { kind: "important", re: /\b(?:(?:this|that|it)(?:'s| is| will be| might be| could be)? (?:going to be )?on the (?:test|exam|quiz|final|midterm)|write (?:this|that) down|important|key (?:concept|point|idea|term)|pay attention|you need to know|know this|memorize|common mistake|trick question)\b/i },
  { kind: "deadline", re: new RegExp(`\\b(?:your |the |our |a )?(${ASSIGNMENT})\\b[^.?!]{0,80}?\\b(?:is |are |will be )?(?:due|needs to be (?:in|submitted|turned in)|has to be (?:in|submitted))\\b`, "i"), label: (m) => cap(m[1]) },
  { kind: "deadline", re: new RegExp(`\\b(?:turn in|submit|hand in|upload|email me|send me|bring)\\b[^.?!]{0,40}?\\b(?:your |the )?(${ASSIGNMENT})`, "i"), label: (m) => cap(m[1]) },
  // Bare "due" only counts when a date follows right away ("due Friday", "due by the 3rd"), not "what's due next week".
  { kind: "deadline", re: /(?<!what's |what is |anything )\b(?:due|deadline is|deadline)\s+(?:on\s+|by\s+|this\s+|next\s+|before\s+)?(?:the\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d|first|second|third|fourth|fifth|end of)/i, needsDate: true },
  { kind: "exam", re: new RegExp(`\\b(?:a |the |your |our )?((?:unit \\d+ |chapter \\d+ |pop )?${EXAM})\\b`, "i"), needsDate: true, label: (m) => cap(m[1]) },
  { kind: "event", re: /\b(field trip|office hours|review session|study session|lab session|guest speaker|assembly|conference|club meeting|tutoring|info session|career fair|deadline to (?:drop|withdraw|register))\b/i, needsDate: true, label: (m) => cap(m[1]) },
  { kind: "reminder", re: /\b(?:don't forget|do not forget|remember to|make sure (?:you|to)|you need to|you have to|you must|bring (?:your|a)|sign up|register for)\b/i },
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const NOT_AN_END = /\b(?:[ap]\.\s?m|[ap]|mr|mrs|ms|dr|prof|e\.g|i\.e|vs|st|no|ch|pg|pp|fig)$/i;

/** Splits on sentence ends, but not inside "p.m.", "Dr." or "e.g.". */
function sentences(text: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  const re = /[.?!]+(?=\s+["'(]?[A-Z0-9]|\s*$)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0] === "." && NOT_AN_END.test(text.slice(start, m.index))) continue;
    const s = text.slice(start, m.index + m[0].length);
    if (s.trim()) out.push({ text: s.trim(), index: start });
    start = m.index + m[0].length;
  }
  const rest = text.slice(start);
  if (rest.trim()) out.push({ text: rest.trim(), index: start });
  return out;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * Scans transcript segments and returns everything worth a notification or a
 * calendar entry. `ref` is when the recording happened, so "Friday" resolves
 * against the class date, not the day someone reads the note.
 */
export function extract(segments: Segment[], ref: Date): Extraction[] {
  const found: Extraction[] = [];
  const seen = new Set<string>();
  // Look at each sentence with the next one as context: "We have a test." "It's next Tuesday."
  const flat: { text: string; segmentId: string }[] = [];
  for (const s of segments) for (const sen of sentences(s.text)) flat.push({ text: sen.text, segmentId: s.id });

  flat.forEach((sen, i) => {
    const next = flat[i + 1]?.text ?? "";
    // Only borrow a date from the next sentence when it clearly continues this one.
    const context = /^(it|it's|that|that's|this|which|and|they're|both)\b/i.test(next) ? `${sen.text} ${next}` : sen.text;
    for (const rule of RULES) {
      const m = sen.text.match(rule.re);
      if (!m) continue;
      const dates = findDates(rule.needsDate ? context : sen.text, ref);
      if (rule.needsDate && dates.length === 0) continue;
      const d = dates[0];
      const title = makeTitle(rule, m, sen.text);
      const key = `${rule.kind}:${title.toLowerCase()}:${d ? toLocalISO(d.date, true) : ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        id: hash(key),
        kind: rule.kind,
        title,
        when: d ? toLocalISO(d.date, !d.hasTime) : undefined,
        allDay: d ? !d.hasTime : true,
        phrase: sen.text,
        segmentId: sen.segmentId,
        confidence: d ? 0.8 : 0.6,
        source: "keywords",
      });
      // One sentence yields one item; the first (most specific) rule wins.
      break;
    }
  });
  return found;
}

function makeTitle(rule: Rule, m: RegExpMatchArray, sentence: string): string {
  const base = rule.label?.(m);
  if (base && rule.kind === "deadline") return `${base} due`;
  if (base) return base;
  const s = sentence.replace(/^(okay|ok|alright|so|and|um|uh|also|oh)[,\s]+/i, "");
  return s.length > 90 ? `${s.slice(0, 87).trimEnd()}…` : s;
}
