// Single source of truth for the Rork identity tokens. Kept in its own module so
// both the auth provider and the API client can refresh them without a circular
// import between hooks/useAuth and lib/api.

const AUTH_URL = import.meta.env.EXPO_PUBLIC_RORK_AUTH_URL as string;
const APP_KEY = import.meta.env.EXPO_PUBLIC_RORK_APP_KEY as string;

export const ACCESS_TOKEN_KEY = "rork:access_token";
export const REFRESH_TOKEN_KEY = "rork:refresh_token";
export const CODE_VERIFIER_KEY = "rork:pkce_verifier";
export const SESSION_TOKEN_KEY = "nevernote:session";

export interface TokenUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/** Decodes a Rork access token, returning null when malformed or expired. */
export function userFromToken(token: string): TokenUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      exp?: number;
    };
    // 30s of slack so a token that dies mid-flight is refreshed instead of sent.
    if (payload.exp && payload.exp * 1000 < Date.now() + 30_000) return null;
    return { id: payload.sub ?? "", email: payload.email ?? "", name: payload.name, picture: payload.picture };
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(CODE_VERIFIER_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

let inFlight: Promise<string | null> | null = null;

/**
 * Returns a usable access token, silently exchanging the refresh token when the
 * current one has expired. Concurrent callers share one refresh round-trip.
 */
export function ensureFreshAccessToken(): Promise<string | null> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && userFromToken(token)) return Promise.resolve(token);
  if (inFlight) return inFlight;

  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return Promise.resolve(null);

  inFlight = (async () => {
    try {
      const res = await fetch(`${AUTH_URL}/oauth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_key: APP_KEY, refresh_token: refresh }),
      });
      if (!res.ok) {
        // A rejected refresh token is terminal — force a clean sign-in.
        if (res.status >= 400 && res.status < 500) clearTokens();
        return null;
      }
      const { access_token } = (await res.json()) as { access_token?: string };
      if (!access_token) return null;
      localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
      return access_token;
    } catch {
      // Offline: keep the refresh token so a retry can still succeed later.
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
