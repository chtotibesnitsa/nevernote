// Runs the overnight queue. Schedule with pg_cron (see server/README.md).
import { admin, json } from "../_shared/db.ts";
import { summariseNote } from "../_shared/run.ts";

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) return json({ error: "forbidden" }, 403);
  const db = admin();
  const { data: jobs } = await db.from("summary_jobs").select("id, user_id, note_id").eq("status", "queued").order("created_at").limit(200);
  let done = 0, failed = 0;
  for (const j of jobs ?? []) {
    await db.from("summary_jobs").update({ status: "running" }).eq("id", j.id);
    try {
      await summariseNote(j.note_id, j.user_id, "free", j.id);
      done++;
    } catch (e) {
      failed++;
      await db.from("summary_jobs").update({ status: "failed", error: String(e) }).eq("id", j.id);
    }
  }
  return json({ done, failed });
});
