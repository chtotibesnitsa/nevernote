// POST { guestToken }  with the signed-in account's token.
// A guest who signs into an account they already had (Google can't be linked to
// the guest then) brings the classes recorded as a guest along: the guest's
// notes, summaries and usage move to the account, and the empty guest is removed.
import { admin, cors, json, userFrom } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user || user.guest) return json({ error: "sign in first" }, 401);
  const { guestToken } = await req.json().catch(() => ({}));
  if (typeof guestToken !== "string") return json({ error: "guestToken required" }, 400);
  const db = admin();
  const { data } = await db.auth.getUser(guestToken);
  const guest = data.user;
  // Only an anonymous guest can be claimed, and only by someone holding its session.
  if (!guest || !guest.is_anonymous) return json({ error: "not a guest session" }, 403);
  if (guest.id === user.id) return json({ moved: 0 });
  const { data: moved, error } = await db.from("notes").update({ user_id: user.id }).eq("user_id", guest.id).select("id");
  if (error) return json({ error: error.message }, 500);
  await db.from("summary_jobs").update({ user_id: user.id }).eq("user_id", guest.id);
  await db.from("usage_events").update({ user_id: user.id }).eq("user_id", guest.id);
  await db.auth.admin.deleteUser(guest.id);
  return json({ moved: moved?.length ?? 0 });
});
