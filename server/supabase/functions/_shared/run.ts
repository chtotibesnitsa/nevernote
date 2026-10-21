// Summarises one note end to end: chunk, call the model, merge, save.
import { chunkSegments, mergeExtractions, mergeMessages, parseSummary, summaryMessages } from "../../../../packages/core/src/summarize.ts";
import type { Note, Summary } from "../../../../packages/core/src/types.ts";
import { LIMITS } from "../../../../packages/core/src/plans.ts";
import { cleanPrefs, styleInstructions } from "../../../../packages/core/src/styles.ts";
import { admin } from "./db.ts";
import { chat, MODEL, PRO_MODEL } from "./llm.ts";

export async function summariseNote(noteId: string, userId: string, plan: "free" | "pro", jobId?: number): Promise<Summary> {
  const db = admin();
  const { data: row, error } = await db.from("notes").select("*").eq("id", noteId).eq("user_id", userId).eq("deleted", false).single();
  if (error || !row) throw new Error("note not found");
  const segments = row.segments as Note["segments"];
  if (!segments.length) throw new Error("note has no transcript yet");
  const model = plan === "pro" ? PRO_MODEL : MODEL;
  const recorded = new Date(row.created_at);
  // Cap the words sent so one runaway all-day recording can't cost dollars.
  let words = 0;
  const capped = segments.filter((s) => (words += s.text.split(/\s+/).length) <= LIMITS.maxSummaryWords);
  const chunks = chunkSegments(capped);
  // The student's note style and rules live on their profile, so overnight batches use them too.
  const { data: prof } = await db.from("profiles").select("settings").eq("id", userId).single();
  const prefs = cleanPrefs(prof?.settings?.summary, plan);
  const style = styleInstructions(prefs, row.folder ?? undefined);
  let tin = 0, tout = 0, cost = 0;
  const parts: Summary[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const r = await chat(summaryMessages(chunks[i], recorded, { course: row.folder ?? undefined, thoughts: row.thoughts, part: chunks.length > 1 ? [i + 1, chunks.length] : undefined, style }), model);
    tin += r.tokensIn; tout += r.tokensOut; cost += r.cost;
    parts.push(parseSummary(r.text, model, segments));
  }
  let summary = parts[0];
  if (parts.length > 1) {
    const r = await chat(mergeMessages(parts), model);
    tin += r.tokensIn; tout += r.tokensOut; cost += r.cost;
    summary = parseSummary(r.text, model, segments);
  }
  const extractions = mergeExtractions(row.extractions as Note["extractions"], summary.extractions);
  const title = /^(untitled|new note|recording)/i.test(row.title) ? summary.title : row.title;
  await db.from("notes").update({ summary, extractions, title, stage: "ready", updated_at: new Date().toISOString() }).eq("id", noteId);
  if (jobId) await db.from("summary_jobs").update({ status: "done", tokens_in: tin, tokens_out: tout, finished_at: new Date().toISOString() }).eq("id", jobId);
  await db.from("usage_events").insert({ user_id: userId, kind: "summary", meta: { model, tokens_in: tin, tokens_out: tout, cost_usd: cost, words, style: prefs.style, custom_rules: !!(prefs.rules || prefs.presets?.length), chunks: chunks.length } });
  return summary;
}
