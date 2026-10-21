// POST { noteId, sponsored?: boolean }
// Free: 3 instant summaries a day. After that the note is written overnight,
// or instantly if the student just watched a short sponsor card.
import { summaryRoute } from "../../../../packages/core/src/plans.ts";
import { admin, cors, json, userFrom } from "../_shared/db.ts";
import { summariseNote } from "../_shared/run.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user) return json({ error: "sign in to summarise" }, 401);
  const { noteId, sponsored } = await req.json().catch(() => ({}));
  if (typeof noteId !== "string") return json({ error: "noteId required" }, 400);

  const db = admin();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("summary_jobs").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("route", "instant").gte("created_at", since.toISOString());
  let route: "instant" | "sponsored" | "overnight" = summaryRoute(user.plan, count ?? 0) === "instant" ? "instant" : sponsored ? "sponsored" : "overnight";

  const { data: job } = await db.from("summary_jobs").insert({ user_id: user.id, note_id: noteId, route, status: route === "overnight" ? "queued" : "running" }).select("id").single();
  if (route === "overnight") {
    await db.from("notes").update({ stage: "queued" }).eq("id", noteId).eq("user_id", user.id);
    return json({ route, message: "Your notes will be written tonight. Upgrade to Pro or watch a short sponsor card to get them now." });
  }
  try {
    const summary = await summariseNote(noteId, user.id, user.plan, job?.id);
    return json({ route, summary });
  } catch (e) {
    await db.from("summary_jobs").update({ status: "failed", error: String(e) }).eq("id", job?.id);
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }
});
