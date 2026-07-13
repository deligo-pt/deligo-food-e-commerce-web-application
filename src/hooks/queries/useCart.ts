"use client";

import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useStore } from "@/stores/translationStore";

export const cartKeys = {
  all: ["cart"] as const,
  // Cart product names are server-localized → keyed by language.
  view: (lang: string) => ["cart", "view", lang] as const,
};

/** The current user's cart (`/carts/view-cart`). */
export function useCart<T = unknown>(options?: { enabled?: boolean }) {
  const lang = useStore((s) => s.lang);
  return useQuery({
    queryKey: cartKeys.view(lang),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/carts/view-cart", { signal });
      return (res.data?.data ?? null) as T;
    },
    enabled: options?.enabled ?? true,
    // Keep the current cart visible during a language-switch refetch.
    placeholderData: keepPreviousData,
  });
}

/**
 * Cache helpers for the cart: `setCart` writes an optimistic update straight
 * into the query cache (instant UI), `invalidate` triggers a refetch.
 */
export function useCartCache() {
  const queryClient = useQueryClient();
  const lang = useStore((s) => s.lang);
  return {
    setCart: <T>(data: T) =>
      queryClient.setQueryData(cartKeys.view(lang), data),
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  };
}
