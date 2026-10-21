export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-NeverNote-Session, X-NeverNote-Client",
  "Access-Control-Expose-Headers": "X-NeverNote-Trace",
  "Access-Control-Max-Age": "600",
};

/**
 * Preflight answer that mirrors whatever headers the browser asked for. Dev
 * tooling injected into preview iframes sometimes adds tracing headers to
 * fetch; a fixed allowlist would make the browser abort the request as a
 * "network error" before it ever reached us.
 */
export function preflight(request: Request): Response {
  const requested = request.headers.get("Access-Control-Request-Headers");
  const headers: Record<string, string> = { ...CORS };
  if (requested) headers["Access-Control-Allow-Headers"] = requested;
  return new Response(null, { status: 204, headers });
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
  });
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ error: err.message, code: err.code }, err.status);
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("unhandled", message, err instanceof Error ? err.stack : "");
  return json({ error: "Something went wrong on the server. Please try again.", code: "INTERNAL" }, 500);
}

export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(size = 32): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(48);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(hash)) };
}

/** Normalize text for fuzzy excerpt matching: lowercase, collapse whitespace, strip smart punctuation. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries a function with exponential backoff on retryable errors (429 / 5xx / network). */
export async function withBackoff<T>(fn: () => Promise<T>, attempts = 3, baseMs = 600): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ApiError ? err.status === 429 || err.status >= 500 : true;
      if (!retryable || i === attempts - 1) throw err;
      const retryAfter = err instanceof ApiError && err.code === "RATE_LIMITED" ? 2000 : 0;
      await sleep(Math.max(retryAfter, baseMs * 2 ** i + Math.random() * 200));
    }
  }
  throw lastErr;
}

/** Constant-time comparison for equal-length hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Extracts the first JSON object/array from a model reply that may contain prose or fences. */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const direct = safeJsonParse<T>(candidate.trim());
  if (direct) return direct;
  const start = Math.min(
    ...[candidate.indexOf("{"), candidate.indexOf("[")].filter((i) => i >= 0),
  );
  if (!Number.isFinite(start)) return null;
  const endObj = candidate.lastIndexOf("}");
  const endArr = candidate.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (end <= start) return null;
  return safeJsonParse<T>(candidate.slice(start, end + 1));
}
