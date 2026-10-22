// Pro calendar sync.
// POST (signed in, Pro): returns the student's secret feed token, making one if needed.
// GET ?t=token: the .ics feed of every due date and test, refreshed by the calendar app.
import { icsFor } from "../../../../packages/core/src/ics.ts";
import type { Extraction } from "../../../../packages/core/src/types.ts";
import { admin, cors, json, userFrom } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = admin();

  if (req.method === "POST") {
    const user = await userFrom(req);
    if (!user || user.guest) return json({ error: "signup" }, 401);
    if (user.plan !== "pro") return json({ error: "pro" }, 402);
    const { data: p } = await db.from("profiles").select("calendar_token").eq("id", user.id).single();
    let token = p?.calendar_token as string | null;
    if (!token) {
      token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await db.from("profiles").update({ calendar_token: token }).eq("id", user.id);
    }
    return json({ token });
  }

  const token = new URL(req.url).searchParams.get("t");
  if (!token || token.length < 32) return new Response("Not found", { status: 404 });
  const { data: p } = await db.from("profiles").select("id, plan, pro_until").eq("calendar_token", token).maybeSingle();
  const pro = p?.plan === "pro" && (!p.pro_until || Date.parse(p.pro_until) > Date.now());
  // A lapsed subscription keeps a valid (empty) calendar instead of an error in the student's calendar app.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const items: (Extraction & { course?: string })[] = [];
  if (p && pro) {
    const { data: notes } = await db.from("notes").select("title, folder, extractions").eq("user_id", p.id).eq("deleted", false).gte("created_at", new Date(Date.now() - 180 * 86_400_000).toISOString());
    for (const n of notes ?? [])
      for (const e of (n.extractions ?? []) as Extraction[])
        if (e.when && e.kind !== "important" && e.when >= since) items.push({ ...e, course: n.folder ?? n.title });
  }
  return new Response(icsFor(items, undefined, "Nevernote due dates"), {
    headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=900" },
  });
});
