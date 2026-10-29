// Getting notes out of NoteLater: Markdown (Notion, Obsidian), a Word file that
// Google Docs opens as a doc, a print-ready PDF, and flashcards for Anki and Quizlet.
import type { Note, Summary } from "@notelater/core";
import { marked } from "marked";
import { download } from "./ics.ts";

const clock = (sec: number) => {
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

const speakerName = (n: Note, id?: string) => (id ? (n.speakers.find((s) => s.id === id)?.name ?? id) : "");

/** The whole note as Markdown: notes, dated updates, study guide, key terms, due dates and the transcript. */
export function noteMarkdown(n: Note): string {
  const out = [`# ${n.title}`, "", `${new Date(n.createdAt).toLocaleString()}${n.folder ? ` · ${n.folder}` : ""}`, ""];
  const s = n.summary;
  const due = n.extractions.filter((e) => e.kind !== "important");
  if (due.length) {
    out.push("## Due dates and tests", "");
    for (const e of due) out.push(`- **${e.title}**${e.when ? ` (${new Date(e.when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })})` : ""}`);
    out.push("");
  }
  if (s) {
    out.push(s.notes.replace(/^# .*\n/, ""), "");
    for (const [i, u] of (s.updates ?? []).entries()) out.push(`## Update ${i + 1} · ${new Date(u.at).toLocaleString()}`, "", u.notes, "");
    const qa = studyGuide(s);
    if (qa.length) {
      out.push("## Study guide", "");
      for (const q of qa) out.push(`- **${q.question}** ${q.answer}`);
      out.push("");
    }
    const terms = keyTerms(s);
    if (terms.length) {
      out.push("## Key terms", "");
      for (const t of terms) out.push(`- **${t.term}**: ${t.definition}`);
      out.push("");
    }
  }
  if (n.segments.length) {
    out.push("## Transcript", "");
    let prev: string | undefined;
    for (const seg of n.segments) {
      const who = seg.speaker !== prev ? speakerName(n, seg.speaker) : "";
      prev = seg.speaker;
      out.push(`${who ? `**${who}** ` : ""}\`${clock(seg.start)}\` ${seg.text}`, "");
    }
  }
  return out.join("\n");
}

export const studyGuide = (s: Summary) => [...s.studyGuide, ...(s.updates ?? []).flatMap((u) => u.studyGuide)];
export const keyTerms = (s: Summary) => [...s.keyTerms, ...(s.updates ?? []).flatMap((u) => u.keyTerms)];

/** Study guide and key terms as tab-separated front/back pairs: Anki and Quizlet both import this as is. */
export function flashcardsTsv(cards: { front: string; back: string }[]): string {
  const clean = (t: string) => t.replace(/[\t\n]+/g, " ").trim();
  return cards.map((c) => `${clean(c.front)}\t${clean(c.back)}`).join("\n");
}

export function cardsOf(s: Summary) {
  return [...studyGuide(s).map((q) => ({ front: q.question, back: q.answer })), ...keyTerms(s).map((t) => ({ front: t.term, back: t.definition }))];
}

const PAGE_CSS = `body{font:15px/1.6 -apple-system,"Inter",system-ui,sans-serif;color:#1d1d1f;max-width:720px;margin:40px auto;padding:0 24px}
h1{font-size:30px;letter-spacing:-.02em;margin:0 0 4px}h2{font-size:20px;margin:28px 0 8px}h3{font-size:16px}
p.meta{color:#86868b;margin:0 0 24px}code{color:#86868b;font-size:12px}li{margin:3px 0}`;

function html(md: string, title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>${PAGE_CSS}</style></head><body>${marked.parse(md, { async: false }) as string}</body></html>`;
}

/** A .doc that Word opens and Google Docs converts to a Google Doc on upload. */
export function saveDoc(title: string, md: string) {
  download(`${title}.doc`, html(md, title), "application/msword");
}

/** Opens a clean page and the print dialog, where "Save as PDF" makes the file. */
export function savePdf(title: string, md: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html(md, title));
  w.document.close();
  setTimeout(() => w.print(), 300);
  return true;
}

export function saveMarkdown(title: string, md: string) {
  download(`${title}.md`, md, "text/markdown");
}

export const exportDoc = (n: Note) => saveDoc(n.title, noteMarkdown(n));
export const exportPdf = (n: Note) => savePdf(n.title, noteMarkdown(n));
export const exportMarkdown = (n: Note) => saveMarkdown(n.title, noteMarkdown(n));

export function exportFlashcards(name: string, cards: { front: string; back: string }[]) {
  download(`${name} flashcards.txt`, flashcardsTsv(cards), "text/tab-separated-values");
}

/**
 * An exam pack: every lecture in a unit folded into one review guide. Built
 * from the notes NoteLater already wrote, so it's instant and works offline.
 */
export function examPack(name: string, notes: Note[]) {
  const sorted = [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const withNotes = sorted.filter((n) => n.summary);
  const terms = new Map<string, string>();
  const questions: { question: string; answer: string; from: string }[] = [];
  for (const n of withNotes) {
    for (const t of keyTerms(n.summary!)) if (!terms.has(t.term.toLowerCase())) terms.set(t.term.toLowerCase(), `**${t.term}**: ${t.definition}`);
    for (const q of studyGuide(n.summary!)) questions.push({ ...q, from: n.title });
  }
  const due = sorted.flatMap((n) => n.extractions.filter((e) => e.kind === "deadline" || e.kind === "exam").map((e) => ({ e, n })));
  const bullets = (md: string) =>
    md
      .split("\n")
      .filter((l) => /^\s*[-*] /.test(l))
      .slice(0, 5)
      .map((l) => l.trim());
  const out = [`# ${name}: exam pack`, "", `${sorted.length} lecture${sorted.length === 1 ? "" : "s"} · ${terms.size} key terms · ${questions.length} practice questions`, ""];
  if (due.length) {
    out.push("## Due dates and tests", "");
    for (const { e, n } of due) out.push(`- **${e.title}**${e.when ? ` · ${new Date(e.when).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}` : ""} (from ${n.title})`);
    out.push("");
  }
  out.push("## Lecture by lecture", "");
  for (const n of sorted) {
    out.push(`### ${n.title} · ${new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, "");
    const b = n.summary ? bullets(n.summary.notes) : [];
    out.push(...(b.length ? b : ["- Notes not written yet; the transcript is in NoteLater."]), "");
  }
  if (terms.size) out.push("## Key terms", "", ...[...terms.values()].map((t) => `- ${t}`), "");
  if (questions.length) {
    out.push("## Practice questions", "");
    questions.forEach((q, i) => out.push(`${i + 1}. ${q.question}`));
    out.push("", "## Answers", "");
    questions.forEach((q, i) => out.push(`${i + 1}. ${q.answer} *(${q.from})*`));
    out.push("");
  }
  return { md: out.join("\n"), lectures: sorted.length, written: withNotes.length, terms: terms.size, questions: questions.length, cards: withNotes.flatMap((n) => cardsOf(n.summary!)) };
}
