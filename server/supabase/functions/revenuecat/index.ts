// RevenueCat webhook: App Store / Stripe purchases flip the profile to Pro.
import { admin, json } from "../_shared/db.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) return json({ error: "forbidden" }, 403);
  const { event } = await req.json();
  const userId: string | undefined = event?.app_user_id;
  if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) return json({ ok: true, skipped: "anonymous" });
  const active = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE"].includes(event.type);
  const ended = event.type === "EXPIRATION";
  if (!active && !ended) return json({ ok: true });
  const until = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  await admin().from("profiles").update({ plan: active ? "pro" : "free", pro_until: active ? until : null }).eq("id", userId);
  await admin().from("usage_events").insert({ user_id: userId, kind: active ? "upgrade" : "downgrade", meta: { type: event.type, product: event.product_id } });
  return json({ ok: true });
});
