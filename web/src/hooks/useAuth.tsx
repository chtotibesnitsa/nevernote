import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import createContextHook from "@nkzw/create-context-hook";

import {
  ACCESS_TOKEN_KEY,
  CODE_VERIFIER_KEY,
  REFRESH_TOKEN_KEY,
  SESSION_TOKEN_KEY,
  clearTokens,
  ensureFreshAccessToken,
  userFromToken,
  type TokenUser,
} from "@/lib/tokens";

const AUTH_URL = import.meta.env.EXPO_PUBLIC_RORK_AUTH_URL as string;
const APP_KEY = import.meta.env.EXPO_PUBLIC_RORK_APP_KEY as string;

export { ACCESS_TOKEN_KEY, SESSION_TOKEN_KEY };
export type AuthUser = TokenUser;

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem(SESSION_TOKEN_KEY));
  const messageListenerRef = useRef<((event: MessageEvent) => void) | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /** Drops the second-factor session but keeps the Google identity. */
  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setSessionToken(null);
  }, []);

  const saveSession = useCallback((token: string) => {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    setSessionToken(token);
  }, []);

  const signOut = useCallback(() => {
    clearTokens();
    setSessionToken(null);
    setUser(null);
  }, []);

  /** Shared refresh path, so the API client and the UI can never disagree. */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const token = await ensureFreshAccessToken();
    if (!token) {
      // Refresh is gone: surface a signed-out UI instead of looping on 401s.
      if (!localStorage.getItem(REFRESH_TOKEN_KEY)) setUser(null);
      return null;
    }
    const decoded = userFromToken(token);
    if (decoded) setUser((prev) => (prev?.id === decoded.id && prev.email === decoded.email ? prev : decoded));
    return token;
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        const decoded = accessToken ? userFromToken(accessToken) : null;
        if (decoded) {
          setUser(decoded);
          return;
        }
        // Token missing or expired — try the refresh token before showing sign-in.
        await getAccessToken();
      } finally {
        setIsLoading(false);
      }
    };
    void check();
  }, [getAccessToken]);

  useEffect(() => {
    return () => {
      if (messageListenerRef.current) {
        window.removeEventListener("message", messageListenerRef.current);
        messageListenerRef.current = null;
      }
    };
  }, []);

  const exchangeCode = useCallback(async (code: string) => {
    const verifier = localStorage.getItem(CODE_VERIFIER_KEY);
    if (!verifier) {
      setError("Missing security verifier — start the sign-in again.");
      return;
    }
    localStorage.removeItem(CODE_VERIFIER_KEY);
    const response = await fetch(`${AUTH_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_key: APP_KEY, code, code_verifier: verifier }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || `Sign in failed (${response.status})`);
      return;
    }
    const { access_token, refresh_token, user: userData } = await response.json();
    localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    setUser(userData ?? userFromToken(access_token));
  }, []);

  /** Google is the only identity provider on this private instance. */
  const signIn = useCallback(async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      localStorage.setItem(CODE_VERIFIER_KEY, verifier);
      const isPreview = window.parent !== window;
      const body: Record<string, unknown> = { app_key: APP_KEY, provider: "google", code_challenge: challenge, target: "web", env: isPreview ? "preview" : "production" };
      if (isPreview) body.app_path = "web";
      const response = await fetch(`${AUTH_URL}/oauth/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        localStorage.removeItem(CODE_VERIFIER_KEY);
        const errorBody = await response.json().catch(() => ({}));
        setError(errorBody.error || `Sign in failed (${response.status})`);
        return;
      }
      const { auth_url } = await response.json();
      if (isPreview) {
        const popup = window.open(auth_url, "_blank", "width=500,height=650");
        if (!popup) {
          setError("Popup blocked — please allow popups for this site.");
          localStorage.removeItem(CODE_VERIFIER_KEY);
          return;
        }
        await new Promise<void>((resolve) => {
          const onMessage = async (event: MessageEvent) => {
            if (event.data?.type !== "rork_auth_callback") return;
            window.removeEventListener("message", onMessage);
            messageListenerRef.current = null;
            clearInterval(pollTimer);
            if (event.data.code) await exchangeCode(event.data.code);
            resolve();
          };
          messageListenerRef.current = onMessage;
          window.addEventListener("message", onMessage);
          const pollTimer = setInterval(() => {
            if (popup.closed) {
              clearInterval(pollTimer);
              window.removeEventListener("message", onMessage);
              messageListenerRef.current = null;
              localStorage.removeItem(CODE_VERIFIER_KEY);
              resolve();
            }
          }, 500);
        });
      } else {
        window.location.href = auth_url;
      }
    } catch (err) {
      console.error("Sign in failed:", err);
      setError(err instanceof Error ? err.message : "Sign in failed");
      localStorage.removeItem(CODE_VERIFIER_KEY);
    } finally {
      setIsSigningIn(false);
    }
  }, [exchangeCode]);

  return useMemo(
    () => ({ user, isLoading, isSigningIn, error, sessionToken, signIn, signOut, clearError, clearSession, saveSession, exchangeCode, getAccessToken }),
    [user, isLoading, isSigningIn, error, sessionToken, signIn, signOut, clearError, clearSession, saveSession, exchangeCode, getAccessToken],
  );
});

export function AuthGateProvider({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
