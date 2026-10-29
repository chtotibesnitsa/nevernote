// POST { action: "manage" | "restore" } with the signed-in student's token.
//  manage:  the link where this student can cancel or change their subscription.
//  restore: asks RevenueCat what the student owns and fixes their plan if the webhook missed it.
// Needs the Supabase secret REVENUECAT_API_KEY (a RevenueCat secret API key).
import { admin, cors, json, userFrom } from "../_shared/db.ts";

const MANAGE: Record<string, string> = {
  app_store: "https://apps.apple.com/account/subscriptions",
  mac_app_store: "https://apps.apple.com/account/subscriptions",
  play_store: "https://play.google.com/store/account/subscriptions",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const user = await userFrom(req);
  if (!user || user.guest) return json({ error: "sign in first" }, 401);
  const { action } = await req.json().catch(() => ({}));
  const key = Deno.env.get("REVENUECAT_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });
  if (!r.ok) return json({ error: "unavailable" }, 502);
  const sub = (await r.json()).subscriber ?? {};

  if (action === "restore") {
    const owned = Object.values(sub.entitlements ?? {}) as { expires_date: string | null }[];
    const live = owned.filter((e) => !e.expires_date || Date.parse(e.expires_date) > Date.now());
    if (!live.length) return json({ pro: false });
    const until = live.some((e) => !e.expires_date) ? null : new Date(Math.max(...live.map((e) => Date.parse(e.expires_date!)))).toISOString();
    await admin().from("profiles").update({ plan: "pro", pro_until: until }).eq("id", user.id);
    return json({ pro: true });
  }

  const subs = Object.values(sub.subscriptions ?? {}) as { store?: string; expires_date?: string }[];
  const current = subs.sort((a, b) => Date.parse(b.expires_date ?? "") - Date.parse(a.expires_date ?? ""))[0];
  const url = (current?.store && MANAGE[current.store]) || sub.management_url || null;
  return url ? json({ url }) : json({ error: "no_subscription" }, 404);
});
