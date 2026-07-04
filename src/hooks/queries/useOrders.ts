"use client";

import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useStore } from "@/stores/translationStore";

export const orderKeys = {
  all: ["orders"] as const,
  // Order item names are server-localized, so the list is keyed by language —
  // switching language refetches while React Query keeps the old list on
  // screen (replacing the manual `langVersion` silent-refetch machinery).
  list: (lang: string) => ["orders", "list", lang] as const,
  ratings: ["ratings", "all"] as const,
};

export function useOrders<T = unknown>(options?: { enabled?: boolean }) {
  const lang = useStore((s) => s.lang);
  return useQuery({
    queryKey: orderKeys.list(lang),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/orders", {
        params: { limit: 100 },
        signal,
      });
      return (res.data?.data ?? []) as T[];
    },
    enabled: options?.enabled ?? true,
    // Keep the current list visible during a language-switch refetch.
    placeholderData: keepPreviousData,
  });
}

export function useRatings<T = unknown>(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: orderKeys.ratings,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/ratings/get-all-ratings", { signal });
      return (res.data?.data ?? []) as T[];
    },
    enabled: options?.enabled ?? true,
  });
}

/** Invalidate orders + ratings (e.g. after submitting a rating). */
export function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orderKeys.all }),
      queryClient.invalidateQueries({ queryKey: orderKeys.ratings }),
    ]);
}
