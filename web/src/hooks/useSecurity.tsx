import { useQuery } from "@tanstack/react-query";

import { api, isOwnerBlockedError } from "@/lib/api";

export interface AuthStatus {
  email: string | null;
  mfa_enrolled: boolean;
  enrolled_at: string | null;
  session_valid: boolean;
  active_sessions: number;
  recovery_codes_left: number;
  locked_until: string | null;
}

/**
 * Reads the vault's two-factor state. Deliberately unauthenticated by session:
 * the backend answers this route before a session exists so the UI knows whether
 * to show first-time setup or the normal code prompt.
 */
export function useAuthStatus(enabled: boolean) {
  const query = useQuery<AuthStatus>({
    queryKey: ["auth-status"],
    queryFn: () => api<AuthStatus>("/auth/status"),
    enabled,
    // Never retry a rejected identity — the answer will not change.
    retry: (count, error) => !isOwnerBlockedError(error) && count < 1,
    staleTime: 10_000,
  });
  return { status: query.data, isLoading: query.isLoading, isError: query.isError, error: query.error, refresh: query.refetch };
}
