// POST { question, noteIds?: string[], tool?: AskTool, history?: {q,a}[], live?: { title, segments } }  (Pro)
// `live` is the class open on the device, sent as it is right now, so questions
// during a recording see the last few seconds rather than the last sync.
import { LIMITS } from "../../../../packages/core/src/plans.ts";
import { askMessages, type AskTool } from "../../../../packages/core/src/summarize.ts";
import { admin, cors, json, userFrom } from "../_shared/db.ts";
import { chat, PRO_MODEL } from "../_shared/llm.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user) return json({ error: "sign in first" }, 401);
  if (user.guest) return json({ error: "signup" }, 403);
  if (user.plan !== "pro") return json({ error: "pro", upsell: "askedQuestion" }, 402);
  const { question, noteIds, tool, history, live } = await req.json().catch(() => ({}));
  if (typeof question !== "string" || !question.trim()) return json({ error: "question required" }, 400);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin().from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", "ask").gte("at", since.toISOString());
  if ((count ?? 0) >= LIMITS.asksPerDay) return json({ error: `You've asked ${LIMITS.asksPerDay} questions today. Ask more tomorrow.` }, 429);
  let q = admin().from("notes").select("title, created_at, segments, summary").eq("user_id", user.id).eq("deleted", false);
  q = Array.isArray(noteIds) && noteIds.length ? q.in("id", noteIds) : q.order("created_at", { ascending: false }).limit(8);
  const { data } = await q;
  let ctx = (data ?? []).map((n) => ({ title: n.title, date: new Date(n.created_at), segments: n.segments, notes: n.summary?.notes }));
  const liveSegs = Array.isArray(live?.segments)
    ? (live.segments as { text?: unknown; speaker?: unknown; start?: unknown; end?: unknown }[])
        .filter((g) => typeof g?.text === "string")
        .slice(-600)
        .map((g, i) => ({ id: String(i), text: String(g.text).slice(0, 2000), speaker: typeof g.speaker === "string" ? g.speaker : undefined, start: Number(g.start) || 0, end: Number(g.end) || 0 }))
    : null;
  if (liveSegs?.length) ctx = [{ title: typeof live.title === "string" ? live.title.slice(0, 120) : "This class", date: new Date(), segments: liveSegs, notes: ctx[0]?.notes }];
  try {
    const tools: AskTool[] = ["answer", "quiz", "explain", "plan", "recap"];
    const past = Array.isArray(history) ? history.filter((t) => typeof t?.q === "string" && typeof t?.a === "string") : [];
    const r = await chat(askMessages(question.slice(0, 2000), ctx, { tool: tools.includes(tool) ? tool : "answer", history: past }), PRO_MODEL, false);
    await admin().from("usage_events").insert({ user_id: user.id, kind: "ask", meta: { tool: tools.includes(tool) ? tool : "answer", tokens_in: r.tokensIn, tokens_out: r.tokensOut, cost_usd: r.cost } });
    return json({ answer: r.text });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }
});
