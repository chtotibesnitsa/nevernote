// POST { question, noteIds?: string[] }  (Pro)
import { LIMITS } from "../../../../packages/core/src/plans.ts";
import { askMessages } from "../../../../packages/core/src/summarize.ts";
import { admin, cors, json, userFrom } from "../_shared/db.ts";
import { chat, PRO_MODEL } from "../_shared/llm.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user) return json({ error: "sign in first" }, 401);
  if (user.plan !== "pro") return json({ error: "pro", upsell: "askedQuestion" }, 402);
  const { question, noteIds } = await req.json().catch(() => ({}));
  if (typeof question !== "string" || !question.trim()) return json({ error: "question required" }, 400);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin().from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", "ask").gte("at", since.toISOString());
  if ((count ?? 0) >= LIMITS.asksPerDay) return json({ error: `You've asked ${LIMITS.asksPerDay} questions today. Ask more tomorrow.` }, 429);
  let q = admin().from("notes").select("title, created_at, segments, summary").eq("user_id", user.id).eq("deleted", false);
  q = Array.isArray(noteIds) && noteIds.length ? q.in("id", noteIds) : q.order("created_at", { ascending: false }).limit(8);
  const { data } = await q;
  const ctx = (data ?? []).map((n) => ({ title: n.title, date: new Date(n.created_at), segments: n.segments, notes: n.summary?.notes }));
  try {
    const r = await chat(askMessages(question, ctx), PRO_MODEL, false);
    await admin().from("usage_events").insert({ user_id: user.id, kind: "ask", meta: { tokens_in: r.tokensIn, tokens_out: r.tokensOut } });
    return json({ answer: r.text });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }
});
