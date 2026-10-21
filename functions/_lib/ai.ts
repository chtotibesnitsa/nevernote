import type { Env } from "./types";
import { ApiError, extractJson, withBackoff } from "./util";

// Model IDs verified live against the gateway catalog. Reasoning-heavy models
// were rejected: they spend the whole token budget on hidden reasoning and
// return empty content, which is what silently broke extraction before.
/** Cheapest reliable hosted model for classification / extraction / chat. */
export const CHEAP_MODEL = "google/gemini-2.5-flash-lite";
/** Stronger model reserved for ambiguous date resolution and conflicting evidence. */
export const STRONG_MODEL = "openai/gpt-4.1-mini";

/** Hard ceiling per model call: a hung upstream must never stall a whole sync. */
const REQUEST_TIMEOUT_MS = 45_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Public Rork Toolkit host, used when the env var isn't bound in the Worker. */
const DEFAULT_TOOLKIT_URL = "https://toolkit.rork.com";

/**
 * Resolves the toolkit endpoint. The `EXPO_PUBLIC_*` names are not always bound
 * in the Worker runtime, so we accept the server-side aliases too and fall back
 * to the public toolkit host for the URL (which is not a secret). Only the
 * secret key is truly required.
 */
function toolkitConfig(env: Env): { url: string; key: string } {
  const url = (env.EXPO_PUBLIC_TOOLKIT_URL ?? env.TOOLKIT_URL ?? DEFAULT_TOOLKIT_URL).replace(/\/$/, "");
  const key = env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY ?? env.RORK_TOOLKIT_SECRET_KEY;
  if (!key) {
    throw new ApiError(
      503,
      "AI_UNAVAILABLE",
      "The AI key isn't bound on the server yet, so transcripts can't be read by the model. The deterministic keyword scan still runs and flags deadlines.",
    );
  }
  return { url, key };
}

/** True when model calls can be attempted at all. */
export function aiConfigured(env: Env): boolean {
  return Boolean(env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY ?? env.RORK_TOOLKIT_SECRET_KEY);
}

/** Calls chat completions through the Rork Toolkit proxy with backoff + idempotency. */
export async function chatCompletion(
  env: Env,
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; idempotencyKey?: string; responseFormat?: "json_object" } = {},
): Promise<string> {
  const { url, key } = toolkitConfig(env);
  const idempotencyKey = opts.idempotencyKey ?? crypto.randomUUID();
  // Two attempts, not three: each retry burns a Worker subrequest, and a long
  // sync that exhausts the subrequest budget fails every remaining meeting.
  return withBackoff(async () => {
    const res = await fetch(`${url}/v2/vercel/v1/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.1,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}),
      }),
    });
    if (res.status === 401) throw new ApiError(503, "AI_AUTH", "AI features are currently unavailable (authorization).");
    if (res.status === 402) throw new ApiError(503, "AI_BALANCE", "AI features are temporarily unavailable. Please try again later.");
    if (res.status === 429) throw new ApiError(429, "RATE_LIMITED", "The AI service is busy. Please wait a moment and try again.");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("ai upstream error", res.status, body.slice(0, 300));
      throw new ApiError(502, "AI_UPSTREAM", "The AI service returned an error. Please try again.");
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string | { text?: string }[] }; finish_reason?: string }[] };
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c) => c.text ?? "").join("") : "";
    if (text.trim()) return text;
    // Empty content with finish_reason "length" means the budget was consumed
    // before any visible text was produced. Surface it as retryable.
    throw new ApiError(502, "AI_EMPTY", `The AI service returned an empty reply (finish_reason: ${choice?.finish_reason ?? "unknown"}).`);
  }, 2);
}

/** Chat completion that must return JSON; parses defensively. */
export async function chatJson<T>(env: Env, model: string, messages: ChatMessage[], maxTokens = 3000): Promise<T> {
  const text = await chatCompletion(env, model, messages, { maxTokens, temperature: 0, responseFormat: "json_object" });
  const parsed = extractJson<T>(text);
  if (!parsed) {
    console.warn("ai returned non-json", text.slice(0, 200));
    throw new ApiError(502, "AI_BAD_JSON", "The AI reply could not be understood. Please try again.");
  }
  return parsed;
}
