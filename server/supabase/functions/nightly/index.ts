// Works through the overnight queue a small batch at a time, so each call stays
// well inside the Edge Function time limit. pg_cron calls it every few minutes
// overnight (see server/README.md).
import { admin, json } from "../_shared/db.ts";
import { summariseNote } from "../_shared/run.ts";

Deno.serve(async (req) => {
  // pg_cron sends a random secret kept in Vault (migration nightly_schedule).
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const db = admin();
  const { data: ok } = await db.rpc("nightly_secret_ok", { token });
  if (!ok) return json({ error: "forbidden" }, 403);
  const { data: jobs } = await db.from("summary_jobs").select("id, user_id, note_id").eq("status", "queued").order("created_at").limit(12);
  let done = 0, failed = 0;
  await Promise.all((jobs ?? []).map(async (j) => {
    await db.from("summary_jobs").update({ status: "running" }).eq("id", j.id);
    try {
      await summariseNote(j.note_id, j.user_id, "free", j.id);
      done++;
    } catch (e) {
      failed++;
      await db.from("summary_jobs").update({ status: "failed", error: String(e) }).eq("id", j.id);
    }
  }));
  return json({ done, failed });
});
