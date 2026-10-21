// POST {} : deletes the signed-in user and, by cascade, every note, event and
// job of theirs. Required by the App Store for apps with sign-up.
import { admin, cors, json, userFrom } from "../_shared/db.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user) return json({ error: "sign in first" }, 401);
  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
