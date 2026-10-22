// Supabase: sign-in, sync and AI summaries. Everything works signed out; this
// only adds the phone/laptop link and the summaries.
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { noteToRow, rowToNote, type Plan, type Remote, type Summary, type SummaryPrefs } from "@nevernote/core";

// The official Nevernote project. The anon key is public by design (row-level
// security protects the data); forks can point at their own project with env vars.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://bbvaqcsyinbeopyhrqzi.supabase.co";
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJidmFxY3N5aW5iZW9weWhycXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDUzNjksImV4cCI6MjEwODE4MTM2OX0.v-0eHe-bUWvXqSsmCbs8oqlA3EzhYJLtk0hxI2uCI3c";

export const supabase: SupabaseClient | undefined = url && key ? createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } }) : undefined;
export const cloudEnabled = !!supabase;

export const fromRow = rowToNote;

export function remoteFor(session: Session): Remote {
  const db = supabase!;
  return {
    async push(notes) {
      const { error } = await db.from("notes").upsert(notes.map((n) => noteToRow(n, session.user.id)));
      if (error) throw error;
    },
    async pull(cursor, limit) {
      let q = db.from("notes").select("*").order("server_updated_at", { ascending: true }).limit(limit);
      if (cursor) q = q.gt("server_updated_at", cursor);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      return { notes: rows.map(fromRow), cursor: rows.length ? rows[rows.length - 1].server_updated_at : cursor };
    },
  };
}

export async function fetchPlan(): Promise<Plan> {
  if (!supabase) return "free";
  const { data } = await supabase.from("profiles").select("plan, pro_until").maybeSingle();
  return data?.plan === "pro" && (!data.pro_until || Date.parse(data.pro_until) > Date.now()) ? "pro" : "free";
}

/** How this student likes notes written. Lives on the profile so every device and the overnight batch use it. */
export async function fetchSummaryPrefs(): Promise<SummaryPrefs> {
  if (!supabase) return {};
  const { data } = await supabase.from("profiles").select("settings").maybeSingle();
  return (data?.settings?.summary as SummaryPrefs | undefined) ?? {};
}

export async function saveSummaryPrefs(prefs: SummaryPrefs): Promise<void> {
  const { data: s } = await supabase!.auth.getSession();
  if (!s.session) return;
  const { data } = await supabase!.from("profiles").select("settings").maybeSingle();
  const { error } = await supabase!.from("profiles").update({ settings: { ...(data?.settings ?? {}), summary: prefs } }).eq("id", s.session.user.id);
  if (error) throw error;
}

export type SummaryResult = { route: "instant" | "sponsored" | "cached"; summary: Summary } | { route: "overnight"; message: string };

export async function requestSummary(noteId: string, sponsored = false): Promise<SummaryResult> {
  const { data, error } = await supabase!.functions.invoke("summarize", { body: { noteId, sponsored } });
  if (error) throw error;
  return data as SummaryResult;
}

export async function ask(question: string, noteIds?: string[]): Promise<{ answer?: string; error?: string }> {
  const { data, error } = await supabase!.functions.invoke("ask", { body: { question, noteIds } });
  if (error) return { error: (error as { context?: { status?: number } }).context?.status === 402 ? "pro" : String(error.message) };
  return data;
}

export function track(kind: string, meta: Record<string, unknown> = {}, device?: string): void {
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) void supabase!.from("usage_events").insert({ user_id: data.session.user.id, kind, device, meta });
  });
}

/** Pro: the student's live calendar feed, as https and webcal links. */
export async function calendarFeed(): Promise<{ https: string; webcal: string } | { error: string }> {
  const { data, error } = await supabase!.functions.invoke("calendar", { body: {} });
  if (error || !data?.token) return { error: (error as { context?: { status?: number } } | null)?.context?.status === 402 ? "pro" : "unavailable" };
  const https = `${url}/functions/v1/calendar?t=${data.token}`;
  return { https, webcal: https.replace(/^https:/, "webcal:") };
}
