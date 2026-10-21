// Owner dashboard API. POST { action: "overview" | "add_cost" | "delete_cost", ... }
//
// Locked down in three layers:
//  1. The platform rejects any request without a valid signed-in JWT (verify_jwt).
//  2. This function re-checks who is calling with the auth server, and only lets in a
//     verified Google account whose email is on the allow list. Nothing the browser says
//     about itself is trusted.
//  3. The database functions and tables behind it can only be used with the service role,
//     which exists only inside this function. The apps never hold it.
import { admin, cors, json } from "../_shared/db.ts";

const ADMINS = (Deno.env.get("ADMIN_EMAILS") ?? "aleksander@lucenko.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function adminFrom(req: Request): Promise<{ id: string; email: string } | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  const u = data.user;
  if (!u?.email || !u.email_confirmed_at) return null;
  const google = u.identities?.find((i) => i.provider === "google");
  const verified = google?.identity_data?.email_verified === true || google?.identity_data?.email_verified === "true";
  if (!google || !verified) return null;
  const email = String(google.identity_data?.email ?? "").toLowerCase();
  if (email !== u.email.toLowerCase() || !ADMINS.includes(email)) return null;
  return { id: u.id, email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const who = await adminFrom(req);
  // The same answer for every kind of failure, so the endpoint reveals nothing about who is an admin.
  if (!who) return json({ error: "not authorized" }, 403);

  const body = await req.json().catch(() => ({}));
  const db = admin();
  try {
    switch (body.action) {
      case "overview": {
        const { data, error } = await db.rpc("admin_overview", { p_days: Math.min(Math.max(Number(body.days) || 30, 1), 365) });
        if (error) throw error;
        return json({ ...data, me: who.email });
      }
      case "add_cost": {
        const name = String(body.name ?? "").trim().slice(0, 80);
        const monthly = Number(body.monthly_usd);
        if (!name || !Number.isFinite(monthly) || monthly < 0 || monthly >= 1e6) return json({ error: "name and a monthly amount are required" }, 400);
        const starts = /^\d{4}-\d{2}-\d{2}$/.test(String(body.starts_on ?? "")) ? body.starts_on : undefined;
        const { error } = await db.from("app_costs").insert({ name, monthly_usd: monthly, ...(starts ? { starts_on: starts } : {}) });
        if (error) throw error;
        return json({ ok: true });
      }
      case "delete_cost": {
        const id = Number(body.id);
        if (!Number.isInteger(id)) return json({ error: "id required" }, 400);
        const { error } = await db.from("app_costs").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: "request failed" }, 500);
  }
});
