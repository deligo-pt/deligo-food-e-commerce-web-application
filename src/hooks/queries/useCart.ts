"use client";

import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import axios from "axios";
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
      try {
        const res = await apiClient.get("/carts/view-cart", { signal });
        return (res.data?.data ?? null) as T;
      } catch (error) {
        // A cart that no longer exists server-side is an empty cart, not a
        // failure. The backend 404s ("Your cart could not be found.") once the
        // cart document is gone — emptied elsewhere, consumed by an order, or
        // deleted by an admin — and letting that reject would replace the
        // "your cart is empty" state with a full-page error panel.
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null as T;
        }
        throw error;
      }
    },
    enabled: options?.enabled ?? true,
    // The cart is the one query where a stale read has consequences: it decides
    // what the customer is about to pay for, and it can be changed from outside
    // this app entirely (the mobile app, another tab, a vendor removing a
    // product). So it opts out of the global 60s cache and re-reads the server
    // on every mount, focus and reconnect. Catalog/profile data keeps the
    // shared defaults in QueryProvider.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Keep the current cart visible during a refetch — including the
    // language-switch one — so re-reading the server never blanks the page.
    placeholderData: keepPreviousData,
  });
}

/**
 * Cache helpers for the cart: `setCart` writes an optimistic update straight
 * into the query cache (instant UI), `invalidate` triggers a refetch.
 *
 * Prefer `invalidate` after a mutation. `setCart` also resets the entry's
 * `dataUpdatedAt`, so a hand-built cart is treated as freshly fetched — that is
 * how a locally-recomputed cart used to outlive the server's own.
 */
export function useCartCache() {
  const queryClient = useQueryClient();
  const lang = useStore((s) => s.lang);
  return {
    setCart: <T>(data: T) =>
      queryClient.setQueryData(cartKeys.view(lang), data),
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: cartKeys.all }),
    // Drop the cached cart entirely — for logout, where invalidating isn't
    // enough: the entry would survive (unfetched, because the query is now
    // disabled) and the next account to sign in would see the previous one's
    // basket until its own fetch landed.
    clear: () => queryClient.removeQueries({ queryKey: cartKeys.all }),
  };
}
