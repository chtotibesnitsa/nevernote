// RevenueCat webhook: App Store and web (Stripe) purchases flip the profile to Pro
// and keep the subscription details Settings shows (plan, renewal or end date).
import { admin, json } from "../_shared/db.ts";

// Events after which the student has Pro until expiration_at_ms.
const ACTIVE = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "REFUND_REVERSED"];

Deno.serve(async (req) => {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) return json({ error: "forbidden" }, 403);
  const { event } = await req.json();
  const userId: string | undefined = event?.app_user_id;
  if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) return json({ ok: true, skipped: "anonymous" });
  const type: string = event.type;
  const active = ACTIVE.includes(type);
  const ended = type === "EXPIRATION";
  const cancelled = type === "CANCELLATION"; // still Pro until the period ends, it just won't renew
  const billing = type === "BILLING_ISSUE"; // payment failed; access continues during the grace period
  if (!active && !ended && !cancelled && !billing) return json({ ok: true });

  const db = admin();
  const at = Number(event.event_timestamp_ms) || Date.now();
  const { data: prev } = await db.from("subscriptions").select("last_event_ms, started_at").eq("user_id", userId).maybeSingle();
  if (prev && at < prev.last_event_ms) return json({ ok: true, skipped: "old event" }); // retries and out-of-order delivery

  const until = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  const row: Record<string, unknown> = { user_id: userId, last_event_ms: at, updated_at: new Date().toISOString() };
  if (active) {
    Object.assign(row, {
      product: event.product_id ?? null,
      store: event.store ? String(event.store).toLowerCase() : null,
      period_type: event.period_type ? String(event.period_type).toLowerCase() : null,
      // "Started" is the first purchase, not each renewal.
      started_at: type === "INITIAL_PURCHASE" || !prev?.started_at ? (event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : null) : prev.started_at,
      expires_at: until,
      will_renew: true,
      billing_issue: false,
    });
    await db.from("profiles").update({ plan: "pro", pro_until: until }).eq("id", userId);
  } else if (cancelled) {
    row.will_renew = false;
  } else if (billing) {
    row.billing_issue = true;
  } else {
    Object.assign(row, { will_renew: false, billing_issue: false, expires_at: until });
    await db.from("profiles").update({ plan: "free", pro_until: null }).eq("id", userId);
  }
  await db.from("subscriptions").upsert(row);
  await db.from("usage_events").insert({ user_id: userId, kind: active ? "upgrade" : ended ? "downgrade" : "billing", meta: { type, product: event.product_id } });
  return json({ ok: true });
});
