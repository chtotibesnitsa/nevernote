import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

/** The signed-in user behind a request, or null. */
export async function userFrom(req: Request): Promise<{ id: string; plan: "free" | "pro"; guest: boolean } | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = admin();
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: p } = await db.from("profiles").select("plan, pro_until").eq("id", data.user.id).single();
  const pro = p?.plan === "pro" && (!p.pro_until || Date.parse(p.pro_until) > Date.now());
  return { id: data.user.id, plan: pro ? "pro" : "free", guest: !!data.user.is_anonymous };
}
