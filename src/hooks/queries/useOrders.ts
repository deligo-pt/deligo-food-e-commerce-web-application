"use client";

import { useCallback } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/apiClient";
import { useStore } from "@/stores/translationStore";
import { getOrderBucket } from "@/lib/orderStatus";
import { useCartCache } from "@/hooks/queries/useCart";
import { activateReorderedOrder } from "@/lib/cartActivation";
import type { CartItem } from "@/types/cart";

/**
 * Where the fetch below starts, and where it gives up.
 *
 * 100 is what this always asked for and covers essentially every account in one
 * request — so the common case makes exactly one call, as it always did. The
 * ceiling exists so a data bug on the API side cannot turn one page view into
 * an unbounded download.
 */
const ORDERS_FIRST_PAGE = 100;
const ORDERS_MAX = 1000;

/**
 * Every order the customer has, not the first hundred.
 *
 * `GET /orders` has `limit` and nothing else this app has been able to confirm.
 * `page` is not known to be supported, and an **unrecognised query parameter on
 * this endpoint is applied as a strict equality filter** — it returns `200`
 * with an empty list rather than erring (measured; see the header of
 * `lib/orderSearch.ts`). So paginating with a guessed parameter name would not
 * degrade to "the first page again". It would empty the customer's order
 * history, silently, in production. Only `limit` is used here for that reason.
 *
 * Hence the shape: ask for a limit, and if the answer fills it exactly there
 * may be more, so ask again for twice as many. Each response supersedes the
 * last rather than being appended to, so no de-duplication and no ordering
 * question. Every exit returns the longest list seen:
 *
 *  - fewer rows than asked for  → that is all of them;
 *  - the same count as before   → the server has its own cap, take it and stop;
 *  - a request fails            → keep what the previous one returned.
 *
 * The last two are why this can only ever match or beat the single fixed
 * request it replaces: a server-side cap, a rejected large `limit`, or a
 * network failure on the second call all land back on exactly the hundred
 * orders the page used to show. Aborts are rethrown, never swallowed — React
 * Query must see a cancellation as a cancellation, not as a short list.
 */
async function fetchAllOrders<T>(
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
): Promise<T[]> {
  let limit = ORDERS_FIRST_PAGE;
  let longest: T[] = [];

  for (;;) {
    let batch: T[];
    try {
      const res = await apiClient.get("/orders", {
        params: { ...params, limit },
        signal,
      });
      batch = (res.data?.data ?? []) as T[];
    } catch (error) {
      if (longest.length === 0 || axios.isCancel(error)) throw error;
      return longest;
    }

    // No growth: either the server capped the limit or that is genuinely
    // everything. Either way there is nothing further to ask for.
    if (batch.length <= longest.length) return longest.length ? longest : batch;

    longest = batch;
    if (batch.length < limit || limit >= ORDERS_MAX) return longest;
    limit = Math.min(limit * 2, ORDERS_MAX);
  }
}

export const orderKeys = {
  all: ["orders"] as const,
  // Order item names are server-localized, so the list is keyed by language —
  // switching language refetches while React Query keeps the old list on
  // screen (replacing the manual `langVersion` silent-refetch machinery).
  list: (lang: string) => ["orders", "list", lang] as const,
  // Separate from `list` on purpose: the projected response below is NOT a
  // full order list, and must never be served to the orders page from cache.
  // Not language-keyed either — the projection contains no localized field.
  statusIndex: ["orders", "status-index"] as const,
  ratings: ["ratings", "all"] as const,
};

export function useOrders<T = unknown>(options?: { enabled?: boolean }) {
  const lang = useStore((s) => s.lang);
  return useQuery({
    queryKey: orderKeys.list(lang),
    queryFn: ({ signal }) => fetchAllOrders<T>({}, signal),
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
      // The same question the Ongoing tab asks, so the page cannot show a card
      // in Ongoing that nothing is refreshing — which is what happened while
      // this read a status *allowlist* and the tab read a bucket.
      return list?.some((order) => getOrderBucket(order?.orderStatus) === "ongoing")
        ? 30_000
        : false;
    },
    // Keep the current list visible during a language-switch refetch.
    placeholderData: keepPreviousData,
  });
}

/** The slice of an order a notification row needs. */
export interface OrderStatusEntry {
  orderId: string;
  orderStatus?: string | null;
  statusHistory?:
    | ({ status?: string | null; timestamp?: string | null } | null)[]
    | null;
  /**
   * Delivery or self-pickup, which decides the row's icon — see
   * `lib/notificationIcon`. Optional and nullable because it is: orders placed
   * before self-pickup existed have no such field, and `isPickupOrder` reads
   * that absence as a delivery.
   */
  fulfillmentType?: string | null;
}

/**
 * Orders indexed by `orderId`, carrying only status, status history and
 * fulfilment type.
 *
 * Exists for the notifications page, which has two questions a notification
 * cannot answer about itself. Which status it announced — `data.status` is
 * present on 4 of 13 (see `resolveNotificationStatus`). And whether its order
 * is delivered or collected, which decides the row's icon and which `data`
 * never carries at all (see `lib/notificationIcon`).
 *
 * ## Two things keep this cheap
 *
 * `?fields=` — an undocumented but live projection on `GET /orders` — takes the
 * response from **123 KB to 29 KB** by dropping items, pricing, payout and
 * delivery blocks that a header has no use for. Should the parameter ever stop
 * working the result is a fatter payload, not a broken feature: the fields we
 * read are a subset of the full order either way.
 *
 * And the caller passes `enabled: false` whenever the page it is drawing needs
 * no lookup, so a page of nothing but promos and cart-expiry warnings makes
 * **zero** requests. That gate used to be narrower — status-only — and could
 * not stay that way: the icon question applies to every order notification,
 * including the ones that do declare their own status.
 *
 * Returns a `Map` rather than an array: a page of ten notifications is then ten
 * O(1) reads instead of ten linear scans of every order the customer has.
 */
export function useOrderStatusIndex(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: orderKeys.statusIndex,
    queryFn: async ({ signal }) => {
      // Same whole-history fetch as the orders page. A notification about the
      // customer's hundred-and-first order is exactly as likely to be on screen
      // as one about their first, and a miss here silently costs that row its
      // status and its icon.
      const list = await fetchAllOrders<OrderStatusEntry>(
        { fields: "orderId,orderStatus,statusHistory,fulfillmentType" },
        signal,
      );
      return new Map(
        list
          .filter((order) => order?.orderId)
          .map((order) => [order.orderId, order] as const),
      );
    },
    enabled: options?.enabled ?? true,
    // A settled order's history never changes, and a live one's is only needed
    // here to caption a notification that has already been written — so this
    // tolerates being a minute stale in a way the orders page itself does not.
    staleTime: 60_000,
  });
}

/**
 * Refresh the notification header's order lookup.
 *
 * Called by whoever refreshes the notification **list**, because the two must
 * move together. Without this the index was fetched once when the page decided
 * it needed one and then never again: the list kept polling and picking up new
 * notifications, while the lookup behind their headers stayed frozen at
 * whatever it read on mount.
 *
 * That went wrong two ways, and both looked to the customer like the page
 * needing a reload. A notification for an order the index had never seen
 * resolved to nothing, so its header lost its status entirely; and a
 * notification for an order the index *had* seen resolved against a history
 * with the new entry missing, so its header showed the previous status.
 *
 * Invalidating rather than refetching keeps it honest about cost: React Query
 * leaves a disabled query alone, so a page whose notifications all declare
 * their own status still issues nothing — which is the same condition that
 * stopped the index being fetched in the first place.
 *
 * Memoized so it is safe in the dependency array of the caller's fetch
 * callback; an unstable identity there would re-arm the mount effect on every
 * render.
 */
export function useInvalidateOrderStatusIndex() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: orderKeys.statusIndex }),
    [queryClient],
  );
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
