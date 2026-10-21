// Any OpenAI-compatible endpoint works. Defaults to OpenRouter with the
// cheapest model that writes reliable JSON notes; swap with env vars.
import type { ChatMessage } from "../../../../packages/core/src/summarize.ts";

export const MODEL = Deno.env.get("LLM_MODEL") ?? "google/gemini-2.5-flash-lite";
export const PRO_MODEL = Deno.env.get("LLM_PRO_MODEL") ?? MODEL;
const BASE = (Deno.env.get("LLM_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");

export async function chat(messages: ChatMessage[], model = MODEL, json = true): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const key = Deno.env.get("LLM_API_KEY");
  if (!key) throw new Error("LLM_API_KEY is not set");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Nevernote" },
      body: JSON.stringify({ model, messages, temperature: 0.2, ...(json ? { response_format: { type: "json_object" } } : {}) }),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.ok) {
      const j = await res.json();
      return { text: j.choices?.[0]?.message?.content ?? "", tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
    }
    if (attempt >= 2 || (res.status < 500 && res.status !== 429)) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
}
