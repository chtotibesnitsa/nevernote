import { ensureFreshAccessToken, SESSION_TOKEN_KEY, userFromToken } from "@/lib/tokens";

export const BACKEND_URL = (import.meta.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Codes that mean "the second factor must be satisfied again". */
export const MFA_CODES = ["MFA_REQUIRED", "MFA_SETUP_REQUIRED"] as const;

export function isMfaError(err: unknown): boolean {
  return err instanceof ApiClientError && (MFA_CODES as readonly string[]).includes(err.code);
}

export function isOwnerBlockedError(err: unknown): boolean {
  return err instanceof ApiClientError && err.code === "NOT_OWNER";
}

/** True when the Google identity itself is gone/expired, not the 2FA session. */
export function isIdentityExpiredError(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 401 && err.code === "UNAUTHORIZED";
}

function baseHeaders(init: RequestInit, token: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const session = localStorage.getItem(SESSION_TOKEN_KEY);
  if (session) headers["X-NeverNote-Session"] = session;
  return headers;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Once a browser has aborted a cross-origin POST we stay on the GET tunnel for the session. */
let preferTunnel = false;

async function send(path: string, init: RequestInit & { json?: unknown }, token: string | null): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = baseHeaders(init, token);
  const jsonBody = init.json !== undefined ? JSON.stringify(init.json) : undefined;
  const url = `${BACKEND_URL}/api${path}`;

  const tunnel = (): Promise<Response> => {
    const u = new URL(url);
    u.searchParams.set("__m", method);
    if (jsonBody !== undefined) u.searchParams.set("__b", toBase64Url(jsonBody));
    return fetch(u.toString(), { method: "GET", headers, cache: "no-store" });
  };

  if (method === "GET") return fetch(url, { ...init, method, headers, cache: "no-store" });
  if (preferTunnel) return tunnel();

  try {
    if (jsonBody !== undefined) headers["Content-Type"] = "application/json";
    return await fetch(url, { ...init, method, headers, body: jsonBody ?? init.body });
  } catch (err) {
    // The request never left the browser (preflight/extension/proxy abort).
    // Resend the identical call through the GET tunnel before giving up.
    console.warn("[api] direct", method, path, "aborted by browser, retrying via tunnel:", err instanceof Error ? err.message : err);
    delete headers["Content-Type"];
    const res = await tunnel();
    preferTunnel = true;
    return res;
  }
}

export interface ProbeResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function probe(name: string, run: () => Promise<Response>): Promise<ProbeResult> {
  try {
    const r = await run();
    const text = await r.text().catch(() => "");
    return { name, ok: r.ok, detail: `${r.status} ${text.slice(0, 120)}` };
  } catch (err) {
    return { name, ok: false, detail: `threw: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}` };
  }
}

/**
 * Runs a matrix of small requests so a failure can be pinned to one hop:
 * plain GET, authenticated GET, authenticated POST, tunnelled POST, and an
 * unauthenticated POST that still reaches the vault transport.
 */
export async function runTransportDiagnostics(): Promise<ProbeResult[]> {
  const token = await ensureFreshAccessToken();
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const b = BACKEND_URL;
  return [
    await probe("GET /ping (no auth)", () => fetch(`${b}/ping`, { cache: "no-store" })),
    await probe("GET /api/whoami (auth)", () => fetch(`${b}/api/whoami`, { headers: auth, cache: "no-store" })),
    await probe("POST /api/whoami (auth)", () => fetch(`${b}/api/whoami`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: "{}" })),
    await probe("GET tunnel /api/whoami?__m=POST (auth)", () => fetch(`${b}/api/whoami?__m=POST&__b=${toBase64Url("{}")}`, { headers: auth, cache: "no-store" })),
    await probe("POST /diag/echo (no auth)", () => fetch(`${b}/diag/echo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })),
    { name: "token", ok: Boolean(token), detail: token ? `present, ${token.length} chars, exp ${userFromToken(token) ? "valid" : "EXPIRED/invalid"}` : "none in storage" },
  ];
}

export class TransportError extends ApiClientError {
  probes: ProbeResult[];
  constructor(code: string, message: string, probes: ProbeResult[]) {
    super(0, code, message);
    this.probes = probes;
  }
}

/** Distinguishes "server is down" from "this browser blocked the call" and attaches the probe matrix. */
async function networkError(cause: unknown): Promise<ApiClientError> {
  const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  const probes = await runTransportDiagnostics();
  const reachable = probes[0]?.ok ?? false;
  console.error("[api] network failure", detail, probes);
  if (reachable) {
    return new TransportError("BLOCKED", `The request never got a reply from the server (${detail}). Diagnostics below show which hop failed.`, probes);
  }
  return new TransportError("NETWORK", `Can't reach the NeverNote server (${detail}). Check your connection and try again.`, probes);
}

/**
 * Authenticated JSON request to the NeverNote backend. Refreshes the Google
 * identity token before sending (and once more on a 401), then attaches the
 * two-factor session token; the vault requires both.
 */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  if (!BACKEND_URL) {
    throw new ApiClientError(0, "NO_BACKEND_URL", "NeverNote isn't configured with a server address. Rebuild the app so the backend URL is set.");
  }

  const token = await ensureFreshAccessToken();
  let res: Response;
  try {
    res = await send(path, init, token);
  } catch (err) {
    throw await networkError(err);
  }

  // An expired identity looks identical to "not signed in". Force a refresh
  // (drop the cached token first) and retry once before reporting it.
  if (res.status === 401 && localStorage.getItem("rork:refresh_token")) {
    localStorage.removeItem("rork:access_token");
    const retried = await ensureFreshAccessToken();
    if (retried && retried !== token) {
      try {
        res = await send(path, init, retried);
      } catch (err) {
        throw await networkError(err);
      }
    }
  }

  if (res.status === 204) return {} as T;
  const text = await res.text();
  let data: { error?: string; code?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string; code?: string };
    } catch {
      throw new ApiClientError(res.status, "BAD_GATEWAY", `The server returned an unexpected reply (${res.status}). Try again in a moment.`);
    }
  }
  if (!res.ok) {
    throw new ApiClientError(res.status, data.code ?? "ERROR", data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/** Opens an OAuth popup and resolves when the backend callback page posts back. */
export function openOAuthPopup(authUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const popup = window.open(authUrl, "_blank", "width=520,height=700");
    if (!popup) {
      resolve(false);
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "nevernote_oauth" && event.data?.type !== "recall_guard_oauth") return;
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
      resolve(Boolean(event.data.ok));
    };
    window.addEventListener("message", onMessage);
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        window.removeEventListener("message", onMessage);
        resolve(true);
      }
    }, 600);
  });
}
