// Single-tenant access control: only the owner's Google account may use this
// deployment, and it must clear a TOTP challenge before any data route opens.

import { sha256, timingSafeEqualHex } from "./util";

/**
 * Hard allowlist. This private deployment serves exactly one person; anyone
 * else who completes Google sign-in is rejected at the edge with 403.
 * `ALLOWED_EMAILS` (comma separated) can extend it without a code change.
 */
const OWNER_EMAIL = "aleksander@lucenko.com";

export function allowedEmails(env: { ALLOWED_EMAILS?: string }): string[] {
  const extra = (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([OWNER_EMAIL, ...extra]));
}

export function isAllowedEmail(env: { ALLOWED_EMAILS?: string }, email: string | null): boolean {
  if (!email) return false;
  return allowedEmails(env).includes(email.trim().toLowerCase());
}

/** Masks an email for safe display on the blocked screen: a•••r@lucenko.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 1);
  const tail = local.length > 1 ? local.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(1, local.length - 2))}${tail}@${domain}`;
}

export interface MfaState {
  secret: string;
  enrolled_at: string;
  /** Highest accepted TOTP counter — blocks replay of an already-used code. */
  last_counter: number;
  recovery_hashes: string[];
  recovery_used: number;
}

export interface PendingMfa {
  secret: string;
  created_at: number;
}

export interface SessionRecord {
  created_at: string;
  last_seen_at: string;
  expires_at: number;
  label: string;
}

export interface AttemptState {
  count: number;
  first_at: number;
  locked_until: number;
}

/** Sessions survive browser restarts for 45 days of continuous use. */
export const SESSION_TTL_MS = 45 * 24 * 60 * 60 * 1000;
/** A half-finished enrollment expires quickly so a stale QR can't be reused. */
export const PENDING_MFA_TTL_MS = 15 * 60 * 1000;
export const MAX_SESSIONS = 8;
export const MAX_MFA_ATTEMPTS = 8;
export const MFA_LOCK_MS = 15 * 60 * 1000;

export async function hashToken(token: string): Promise<string> {
  return sha256(`nevernote:session:${token}`);
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return sha256(`nevernote:recovery:${code}`);
}

export function matchesHash(hashes: string[], candidate: string): number {
  for (let i = 0; i < hashes.length; i++) {
    if (timingSafeEqualHex(hashes[i], candidate)) return i;
  }
  return -1;
}
