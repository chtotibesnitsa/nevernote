import { ApiError } from "./util";

/**
 * Minimal Streamable-HTTP MCP client with OAuth 2.1 discovery + dynamic client
 * registration. Used server-side only — the Wispr server URL and tokens never
 * reach the browser.
 */

export interface McpTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_endpoint: string;
  client_id: string;
  client_secret?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * Filters a bag of candidate arguments down to the keys a tool actually
 * declares. Wispr's MCP server rejects the whole call when it receives an
 * argument it doesn't know (it removed `include_transcript` in favour of a
 * separate `view_transcript` tool), so shotgunning every known alias breaks
 * sync the moment they change their schema. When a tool publishes no schema we
 * pass everything through, which keeps older/looser servers working.
 */
export function pickArgs(tool: McpTool, candidates: Record<string, unknown>): Record<string, unknown> {
  const schema = tool.inputSchema as { properties?: Record<string, unknown> } | undefined;
  const allowed = Object.keys(schema?.properties ?? {});
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (value === undefined) continue;
    if (allowed.length === 0 || allowed.includes(key)) out[key] = value;
  }
  return out;
}

/** Pulls readable transcript text out of whatever shape a transcript tool returns. */
export function transcriptFrom(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((s) => {
        if (typeof s === "string") return s;
        const seg = s as Record<string, unknown>;
        const speaker = seg.speaker ?? seg.speaker_name ?? seg.name;
        const text = seg.text ?? seg.content ?? seg.transcript ?? "";
        return speaker ? `${String(speaker)}: ${String(text)}` : String(text);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    for (const key of ["transcript", "refined_transcript", "text", "content", "segments", "utterances", "data"]) {
      if (v[key] !== undefined) {
        const nested = transcriptFrom(v[key]);
        if (nested) return nested;
      }
    }
  }
  return "";
}

interface AuthServerMeta {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
}

/**
 * The Wispr Flow MCP endpoint every account uses (Settings → MCP → “All other
 * apps”). It identifies the service, not the user — access is granted only by
 * the per-user OAuth token minted after the owner approves in their browser.
 */
export const DEFAULT_WISPR_MCP_URL = "https://api.wisprflow.ai/connect/mcp";

/**
 * `offline_access` is what earns a refresh token; without it the connection
 * silently dies about an hour after authorizing and background sync stops.
 */
const REQUIRED_SCOPES = ["openid", "offline_access"];

/** Scope string to request: the required pair plus any extras the server advertises. */
export function scopeFor(meta: AuthServerMeta): string {
  const supported = meta.scopes_supported ?? [];
  const extra = ["email", "profile"].filter((s) => supported.includes(s));
  const wanted = [...REQUIRED_SCOPES, ...extra];
  return (supported.length > 0 ? wanted.filter((s) => supported.includes(s)) : wanted).join(" ") || REQUIRED_SCOPES.join(" ");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Discovers the authorization server for an MCP resource URL (RFC 9728 → RFC 8414). */
export async function discoverAuthServer(mcpUrl: string): Promise<AuthServerMeta> {
  const resource = new URL(mcpUrl);
  const origin = resource.origin;
  let authServers: string[] = [];

  const prPaths = [
    `${origin}/.well-known/oauth-protected-resource${resource.pathname === "/" ? "" : resource.pathname}`,
    `${origin}/.well-known/oauth-protected-resource`,
  ];
  for (const p of prPaths) {
    const pr = await fetchJson<{ authorization_servers?: string[] }>(p);
    if (pr?.authorization_servers?.length) {
      authServers = pr.authorization_servers;
      break;
    }
  }
  if (authServers.length === 0) {
    // Probe the MCP endpoint's WWW-Authenticate header as a hint.
    try {
      const probe = await fetch(mcpUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }) });
      const www = probe.headers.get("WWW-Authenticate") ?? "";
      const m = www.match(/resource_metadata="([^"]+)"/);
      if (m) {
        const pr = await fetchJson<{ authorization_servers?: string[] }>(m[1]);
        if (pr?.authorization_servers?.length) authServers = pr.authorization_servers;
      }
    } catch {
      /* ignore */
    }
  }
  if (authServers.length === 0) authServers = [origin];

  for (const as of authServers) {
    const asUrl = new URL(as);
    const path = asUrl.pathname.replace(/\/$/, "");
    const candidates = [
      `${asUrl.origin}/.well-known/oauth-authorization-server${path}`,
      `${asUrl.origin}/.well-known/openid-configuration${path}`,
      `${asUrl.origin}${path}/.well-known/oauth-authorization-server`,
      `${asUrl.origin}${path}/.well-known/openid-configuration`,
    ];
    for (const c of candidates) {
      const meta = await fetchJson<AuthServerMeta>(c);
      if (meta?.authorization_endpoint && meta.token_endpoint) return meta;
    }
  }
  throw new ApiError(502, "MCP_DISCOVERY", "Could not discover the OAuth authorization server for this MCP URL. Double-check the Server URL copied from Wispr Flow → Settings → MCP.");
}

export async function registerClient(meta: AuthServerMeta, redirectUri: string, clientUri?: string): Promise<{ client_id: string; client_secret?: string; scope: string }> {
  if (!meta.registration_endpoint) {
    throw new ApiError(502, "MCP_NO_REGISTRATION", "This MCP server does not support dynamic client registration, so the connection cannot be authorized automatically from the server.");
  }
  const res = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // What the owner sees on Wispr's approval screen. Without client_uri the
      // consent popup falls back to showing the raw callback hostname.
      client_name: "NeverNote",
      ...(clientUri ? { client_uri: clientUri } : {}),
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: scopeFor(meta),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { client_id?: string; client_secret?: string; error_description?: string };
  if (!res.ok || !data.client_id) {
    throw new ApiError(502, "MCP_REGISTRATION", `MCP client registration failed: ${data.error_description ?? res.status}`);
  }
  return { client_id: data.client_id, client_secret: data.client_secret, scope: scopeFor(meta) };
}

export async function exchangeMcpCode(args: { meta: AuthServerMeta; clientId: string; clientSecret?: string; code: string; verifier: string; redirectUri: string; resource: string }): Promise<McpTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
    code_verifier: args.verifier,
    resource: args.resource,
  });
  if (args.clientSecret) body.set("client_secret", args.clientSecret);
  const res = await fetch(args.meta.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new ApiError(400, "MCP_TOKEN", `Wispr authorization failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    token_endpoint: args.meta.token_endpoint,
    client_id: args.clientId,
    client_secret: args.clientSecret,
  };
}

export async function refreshMcpTokens(tokens: McpTokens, resource: string): Promise<McpTokens> {
  if (!tokens.refresh_token) {
    throw new ApiError(401, "MCP_REAUTH", "Wispr Flow did not grant a long-lived connection (no refresh token). Reconnect Wispr Flow in Settings and approve the offline access request.");
  }
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: tokens.client_id, resource });
  if (tokens.client_secret) body.set("client_secret", tokens.client_secret);
  const res = await fetch(tokens.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) throw new ApiError(401, "MCP_REAUTH", "Wispr Flow authorization expired. Reconnect Wispr Flow in Settings.");
  return { ...tokens, access_token: data.access_token, refresh_token: data.refresh_token ?? tokens.refresh_token, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000 };
}

export class McpClient {
  private sessionId: string | null = null;
  private nextId = 1;
  constructor(private readonly url: string, private readonly accessToken: string) {}

  private async rpc<T>(method: string, params?: unknown, notify = false): Promise<T> {
    const id = notify ? undefined : this.nextId++;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${this.accessToken}`,
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    const res = await fetch(this.url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method, params: params ?? {} }) });
    const sid = res.headers.get("Mcp-Session-Id");
    if (sid) this.sessionId = sid;
    if (res.status === 401) throw new ApiError(401, "MCP_REAUTH", "Wispr Flow rejected the connection token. Reconnect Wispr Flow in Settings.");
    if (res.status === 429) throw new ApiError(429, "RATE_LIMITED", "Wispr Flow is rate limiting requests. Sync will retry shortly.");
    if (res.status >= 500) throw new ApiError(502, "MCP_UPSTREAM", "Wispr Flow's MCP server returned an error. Please try again.");
    if (notify) return undefined as T;
    if (!res.ok) throw new ApiError(502, "MCP_UPSTREAM", `MCP request failed (${res.status}).`);
    const ctype = res.headers.get("Content-Type") ?? "";
    let payload: { result?: T; error?: { message?: string } } | null = null;
    if (ctype.includes("text/event-stream")) {
      const text = await res.text();
      for (const line of text.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          const obj = JSON.parse(line.slice(5).trim()) as { id?: number; result?: T; error?: { message?: string } };
          if (obj.id === id) payload = obj;
        } catch {
          /* skip */
        }
      }
    } else {
      payload = (await res.json()) as { result?: T; error?: { message?: string } };
    }
    if (!payload) throw new ApiError(502, "MCP_UPSTREAM", "Empty MCP response.");
    if (payload.error) throw new ApiError(502, "MCP_ERROR", `MCP error: ${payload.error.message ?? "unknown"}`);
    return payload.result as T;
  }

  async initialize(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "NeverNote", version: "0.1.0" },
    });
    await this.rpc("notifications/initialized", {}, true);
  }

  async listTools(): Promise<McpTool[]> {
    const res = await this.rpc<{ tools?: McpTool[] }>("tools/list");
    return res.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const res = await this.rpc<{ content?: { type: string; text?: string }[]; structuredContent?: unknown; isError?: boolean }>("tools/call", { name, arguments: args });
    if (res.isError) {
      const msg = res.content?.map((c) => c.text ?? "").join("\n") ?? "tool error";
      throw new ApiError(502, "MCP_TOOL_ERROR", `Wispr tool "${name}" failed: ${msg.slice(0, 200)}`);
    }
    if (res.structuredContent !== undefined) return res.structuredContent;
    const text = res.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n") ?? "";
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
