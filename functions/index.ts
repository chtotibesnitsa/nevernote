// NeverNote backend — vanilla Cloudflare Worker entrypoint.
// All per-user data lives in the UserVault Durable Object (one instance per user).
// OAuth secrets and MCP URLs never leave the server.
//
// This is a single-tenant deployment: the edge rejects every identity that is not
// the owner's Google account, before any Durable Object is even addressed.

import { CHEAP_MODEL } from "./_lib/ai";
import { isAllowedEmail, maskEmail } from "./_lib/auth-gate";
import type { Env } from "./_lib/types";
import { CORS, json, preflight } from "./_lib/util";

export { UserVault } from "./user-vault";

async function toVault(env: Env, userId: string, request: Request, path: string): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = path;
  // Materialise the body instead of forwarding the platform's stream: a
  // re-wrapped, already-proxied stream can fail inside the DO transport.
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;
  const headers = new Headers(request.headers);
  headers.set("X-Rork-DO-Class", "UserVault");
  headers.set("X-Rork-DO-Id", userId);
  headers.delete("content-length");
  const wrapped = new Request(url.toString(), { method: request.method, headers, body });
  return env.DO.fetch(wrapped);
}

async function withCors(p: Promise<Response>): Promise<Response> {
  const res = await p;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const started = Date.now();
    try {
      const res = await handle(request, env, url, path);
      console.log(`${request.method} ${path} -> ${res.status} ${Date.now() - started}ms user=${request.headers.get("X-Rork-User-Id") ? "yes" : "no"}`);
      return res;
    } catch (err) {
      // A bare exception here would surface in browsers as a CORS-less 500,
      // which fetch() reports only as "Failed to fetch". Always answer with
      // JSON + CORS so the real reason reaches the screen.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${request.method} ${path} EDGE_ERROR ${message}`, err instanceof Error ? err.stack : "");
      return json({ error: `The server hit an internal error handling this request: ${message}`, code: "EDGE_ERROR" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function handle(request: Request, env: Env, url: URL, path: string): Promise<Response> {
    if (request.method === "OPTIONS") return preflight(request);
    if (path === "/ping") return json({ ok: true, now: new Date().toISOString() });
    // Non-secret AI reachability probe: booleans + a live 3-token model ping.
    // Never returns the key itself, only whether a binding exists and what the
    // upstream said, so a broken AI path can be diagnosed without guessing.
    if (path === "/diag/ai") return json(await aiDiagnostics(env));
    // Authenticated reachability probe: tells the client whether its bearer
    // token is being honoured, without touching any vault.
    if (path === "/api/whoami") {
      const probe = unwrapTunnel(request, url);
      if (probe instanceof Response) return probe;
      const id = request.headers.get("X-Rork-User-Id");
      const em = request.headers.get("X-Rork-User-Email");
      const hasAuth = Boolean(request.headers.get("Authorization"));
      return json({ ok: true, signed_in: Boolean(id), bearer_sent: hasAuth, owner: isAllowedEmail(env, em), email: em ? maskEmail(em) : null, method: probe.method, tunnelled: probe !== request });
    }

    // Unauthenticated transport probe: proves a POST body survives edge -> Durable Object (direct and tunnelled).
    if (path === "/diag/echo") {
      const fwd = unwrapTunnel(request, url);
      if (fwd instanceof Response) return fwd;
      if (fwd.method === "POST") return withCors(toVault(env, "diag-probe", fwd, "/diag/echo"));
    }

    // OAuth callbacks arrive without a bearer token; the signed state carries the user id.
    if (path === "/google/oauth/callback" || path === "/wispr/oauth/callback") {
      const state = url.searchParams.get("state") ?? "";
      const userId = state.split(".")[0];
      if (!userId || !/^[\w-]{4,80}$/.test(userId)) return new Response("Invalid state", { status: 400 });
      const target = path === "/google/oauth/callback" ? "/google/callback" : "/wispr/callback";
      return toVault(env, userId, request, target);
    }

    if (!path.startsWith("/api/")) return json({ error: "Not found", code: "NOT_FOUND" }, 404);

    // The platform only stamps these headers after verifying the Rork Auth JWT,
    // so they cannot be forged by a client.
    const userId = request.headers.get("X-Rork-User-Id");
    if (!userId) {
      return json({ error: "Please sign in to continue.", code: "UNAUTHORIZED" }, 401);
    }

    const email = request.headers.get("X-Rork-User-Email");
    if (!isAllowedEmail(env, email)) {
      console.warn("blocked non-owner sign-in", email ? maskEmail(email) : "no-email");
      return json(
        {
          error: "This NeverNote instance is private and only opens for its owner's Google account. Your sign-in was not accepted and no vault was created.",
          code: "NOT_OWNER",
          signed_in_as: email ? maskEmail(email) : null,
        },
        403,
      );
    }

    // Transport fallback: some browser environments abort cross-origin POSTs
    // (extensions, corporate proxies, sandboxed previews). The client may then
    // resend the same call as a GET carrying the intended method and body, which
    // we rebuild here. Identity was already verified above, so nothing in the
    // security model changes — only the wire shape.
    const forwarded = unwrapTunnel(request, url);
    if (forwarded instanceof Response) return forwarded;

    return withCors(toVault(env, userId, forwarded, path.slice("/api".length) || "/"));
}

async function aiDiagnostics(env: Env): Promise<Record<string, unknown>> {
  const key = env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY ?? env.RORK_TOOLKIT_SECRET_KEY;
  const url = (env.EXPO_PUBLIC_TOOLKIT_URL ?? env.TOOLKIT_URL ?? "https://toolkit.rork.com").replace(/\/$/, "");
  const base: Record<string, unknown> = {
    has_expo_key: Boolean(env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY),
    has_alias_key: Boolean(env.RORK_TOOLKIT_SECRET_KEY),
    key_length: key ? key.length : 0,
    toolkit_url: url,
    model: CHEAP_MODEL,
  };
  if (!key) return { ...base, ping: "skipped: no key bound in the Worker" };
  try {
    const res = await fetch(`${url}/v2/vercel/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: CHEAP_MODEL, messages: [{ role: "user", content: "ping" }], max_tokens: 3 }),
    });
    const text = await res.text();
    return { ...base, ping: { status: res.status, ok: res.ok, body: text.slice(0, 300) } };
  } catch (err) {
    return { ...base, ping: { error: err instanceof Error ? err.message : String(err) } };
  }
}

function unwrapTunnel(request: Request, url: URL): Request | Response {
  const tunnelMethod = url.searchParams.get("__m");
  if (!(request.method === "GET" && tunnelMethod && /^(POST|PUT|PATCH|DELETE)$/.test(tunnelMethod))) return request;
  const encoded = url.searchParams.get("__b");
  let body: string | undefined;
  if (encoded) {
    try {
      body = decodeURIComponent(escape(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))));
    } catch {
      return json({ error: "Malformed request body.", code: "BAD_REQUEST" }, 400);
    }
  }
  const clean = new URL(url.toString());
  clean.searchParams.delete("__m");
  clean.searchParams.delete("__b");
  const headers = new Headers(request.headers);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request(clean.toString(), { method: tunnelMethod, headers, body });
}
