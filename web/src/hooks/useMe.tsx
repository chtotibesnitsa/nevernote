import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

/** Shared profile/connection state. Reuses the same query key everywhere. */
export function useMe(enabled = true) {
  const qc = useQueryClient();
  const query = useQuery<Me>({ queryKey: ["me"], queryFn: () => api<Me>("/me"), staleTime: 15_000, enabled });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["me"] }), [qc]);
  return { ...query, me: query.data, refresh };
}
