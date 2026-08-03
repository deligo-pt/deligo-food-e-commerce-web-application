"use client";

import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/apiClient";
import { useStore } from "@/stores/translationStore";
import { isOngoingStatus } from "@/lib/orderStatus";
import { useCartCache } from "@/hooks/queries/useCart";
import { activateReorderedOrder } from "@/lib/cartActivation";
import type { CartItem } from "@/types/cart";

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
    // The global 60s staleTime is tuned for catalog and profile data, which does
    // not change on its own. Orders do — a vendor accepts, a rider picks up, and
    // a cancellation can land from the tracking page, the mobile app or another
    // tab. Serving that from a minute-old cache is what left a cancelled order
    // sitting in Ongoing with a working Cancel button. Zero still paints from
    // cache instantly; it just always revalidates behind it.
    staleTime: 0,
    // Same reason: the customer alt-tabs to check something and comes back to a
    // list that moved on without them. Off globally, on for this one query.
    refetchOnWindowFocus: true,
    // While anything is still in flight, keep the list moving without the
    // customer reloading. Returns false once everything has settled, so a
    // history-only page makes no requests, and React Query's default of not
    // refetching in the background keeps a hidden tab silent either way.
    refetchInterval: (query) => {
      const list = query.state.data as
        | ({ orderStatus?: string | null } | null)[]
        | undefined;
      return list?.some((order) => isOngoingStatus(order?.orderStatus))
        ? 30_000
        : false;
    },
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
    // Read the cart as it stands first: the store the re-order revives is found
    // by diffing it against the response, and afterwards it is made the cart's
    // active order. A 404 is an empty cart, not a failed read.
    let before: CartItem[] | null = null;
    try {
      const current = await apiClient.get("/carts/view-cart");
      before = (current.data?.data?.items ?? []) as CartItem[];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        before = [];
      }
    }

    const res = await apiClient.post(`/orders/reorder/${orderId}`);
    const cart = res.data?.data ?? null;
    await activateReorderedOrder(before, cart?.items ?? null);
    // The response *is* the new cart — seed the cache with it so /cart paints
    // immediately, then revalidate. Its `isActive` flags predate the activation
    // above; the invalidation on the next line is what settles them.
    if (cart) setCart(cart);
    await invalidate();
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
