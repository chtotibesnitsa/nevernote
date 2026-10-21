// RFC 4648 base32 + RFC 6238 TOTP (SHA-1, 6 digits, 30s step) — compatible with
// Google Authenticator, 1Password, Authy and every other standard TOTP app.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error("Invalid base32 character in secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Generates a fresh 160-bit TOTP secret in base32 form. */
export function newTotpSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** HOTP value for an explicit counter. */
export async function hotp(secretBase32: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secretBase32) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const msg = new Uint8Array(8);
  let rest = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = rest & 0xff;
    rest = Math.floor(rest / 256);
  }
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg as unknown as ArrayBuffer));
  const offset = sig[sig.length - 1] & 0x0f;
  const bin =
    ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

export const TOTP_STEP_SECONDS = 30;

/** Current TOTP code for a secret. `atMs` is injectable for tests. */
export function totpCode(secretBase32: string, atMs: number = Date.now()): Promise<string> {
  return hotp(secretBase32, Math.floor(atMs / 1000 / TOTP_STEP_SECONDS));
}

/**
 * Verifies a user-supplied code against the secret, allowing `window` steps of
 * clock drift either side. Returns the matched counter (for replay protection)
 * or null when nothing matches.
 */
export async function verifyTotp(
  secretBase32: string,
  code: string,
  window = 2,
  atMs: number = Date.now(),
): Promise<number | null> {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  for (let drift = -window; drift <= window; drift++) {
    const candidate = await hotp(secretBase32, counter + drift);
    if (timingSafeEqual(candidate, digits)) return counter + drift;
  }
  return null;
}

/**
 * Searches a wide counter range for a code that fails normal verification, to
 * tell "wrong secret" apart from "phone clock is out of sync". Returns the drift
 * in seconds (positive = the phone is ahead of the server), or null if the code
 * belongs to a different secret entirely.
 */
export async function diagnoseTotpDrift(
  secretBase32: string,
  code: string,
  maxSteps = 40,
  atMs: number = Date.now(),
): Promise<number | null> {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
  for (let drift = -maxSteps; drift <= maxSteps; drift++) {
    const candidate = await hotp(secretBase32, counter + drift);
    if (timingSafeEqual(candidate, digits)) return drift * TOTP_STEP_SECONDS;
  }
  return null;
}

/** Length-independent constant-time-ish string compare. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** otpauth:// URI that Google Authenticator renders from a QR code. */
export function otpauthUrl(secretBase32: string, account: string, issuer = "NeverNote"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Human-friendly one-time recovery codes (e.g. "4F9K-2QXB-7M3D"). */
export function newRecoveryCodes(count = 8): string[] {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    codes.push(`${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
