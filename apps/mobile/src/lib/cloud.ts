// Supabase: one account across phone and laptop, plus the AI summaries.
// Everything works signed out; this only adds sync and notes.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { noteToRow, rowToNote, type Plan, type Remote, type Summary } from "@notelater/core";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey;

export const supabase: SupabaseClient | undefined = url && key
  ? createClient(url, key, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: "pkce" } })
  : undefined;
export const cloudEnabled = !!supabase;

// Refresh tokens only while the app is in front, as Supabase recommends on mobile.
if (supabase) {
  AppState.addEventListener("change", (s) => (s === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()));
}

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
      return { notes: rows.map(rowToNote), cursor: rows.length ? rows[rows.length - 1].server_updated_at : cursor };
    },
  };
}

export async function fetchPlan(): Promise<Plan> {
  if (!supabase) return "free";
  const { data } = await supabase.from("profiles").select("plan, pro_until").maybeSingle();
  return data?.plan === "pro" && (!data.pro_until || Date.parse(data.pro_until) > Date.now()) ? "pro" : "free";
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

/** Anonymous-until-signed-in usage events for the growth dashboard (the admin_daily view). */
export function track(kind: string, meta: Record<string, unknown> = {}): void {
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) void supabase!.from("usage_events").insert({ user_id: data.session.user.id, kind, device: Platform.OS, meta });
  });
}

// ---------- sign-in ----------

/** Native Sign in with Apple, handed to Supabase as an ID token. */
export async function signInWithApple(): Promise<void> {
  const Apple = await import("expo-apple-authentication");
  const Crypto = await import("expo-crypto");
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  const cred = await Apple.signInAsync({
    requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    nonce: hashed,
  });
  if (!cred.identityToken) throw new Error("Apple didn't return a sign-in token");
  const { error } = await supabase!.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce: raw });
  if (error) throw error;
}

/** Google through the system browser sheet, back to the app via notelater://auth. */
export async function signInWithGoogle(): Promise<void> {
  const WebBrowser = await import("expo-web-browser");
  const redirectTo = "notelater://auth";
  const { data, error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw error ?? new Error("No sign-in URL");
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success") return;
  const code = new URL(res.url).searchParams.get("code");
  if (!code) throw new Error("Sign-in was cancelled");
  const x = await supabase!.auth.exchangeCodeForSession(code);
  if (x.error) throw x.error;
}

/** Email: we send a 6-digit code (easier than a link on a phone). */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase!.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

/** Deletes the account and everything in it on the server, then signs out. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase!.functions.invoke("delete-account", { body: {} });
  if (error) throw error;
  await supabase!.auth.signOut();
}
