"use client";

import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useStore } from "@/stores/translationStore";
import { useCartCache } from "@/hooks/queries/useCart";
import { useCartStore } from "@/stores/cartStore";

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

/**
 * Re-order: replay a past order's items back into the cart.
 *
 * The backend does the whole job in one call — product lookup, current
 * pricing, stock/vendor rules and the single-active-cart logic — and returns
 * the updated cart, so there's nothing to replay client-side. Two things to
 * know: it re-prices at *today's* rates (an expired promo won't come back),
 * and it SETs quantities rather than adding to them, so calling it twice is a
 * no-op rather than a doubling.
 *
 * NOTE: only deployed on the test API so far; production 404s on this route.
 */
export function useReorder() {
  const { setCart, invalidate } = useCartCache();
  return async (orderId: string) => {
    const res = await apiClient.post(`/orders/reorder/${orderId}`);
    const cart = res.data?.data ?? null;
    // The response *is* the new cart — seed the cache with it so /cart paints
    // immediately, then revalidate.
    if (cart) setCart(cart);
    await Promise.all([invalidate(), useCartStore.getState().fetchCart()]);
    return cart;
  };
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
