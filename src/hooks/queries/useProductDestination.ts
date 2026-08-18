"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthed } from "@/hooks/useAuthed";

/**
 * Where a search result actually leads.
 *
 * See `Plan.md` → "Customer Search — Implementation Plan", Phase 5.
 *
 * ## Why a lookup is needed at all
 *
 * A search hit's `restaurantId` is the vendor's Mongo `_id`, and our routes are
 * `/vendors/<userId>` — `GET /vendors/customer/<mongo _id>` returns **404**.
 * The vendor list does not expose `_id` either, so no client-side map can be
 * built. The one field on a hit that resolves anywhere is `productId`, and
 * `GET /products/:productId` returns the owning vendor's `userId`. That is the
 * hop this file performs, and it disappears the day §7 Q23/Q25 puts
 * `restaurantUserId` on the hit.
 *
 * ## It works signed-out
 *
 * `/products/open/:productId` is public and returns the same `vendorId.userId`
 * and `isStoreOpen` as the authenticated route — the same pair of endpoints
 * `ProductDetailsModal` already switches between. So a guest can search, click,
 * and land on the menu; the sign-in prompt belongs at "add to cart", where the
 * modal already raises it, not at the click.
 *
 * ## Not keyed by language
 *
 * Only two non-localized fields are read from the response, so an `en` and a
 * `pt` visitor can share one cache entry. Keyed by auth because the two
 * endpoints are genuinely different resources.
 */
export type ProductDestination = {
  productId: string;
  /** The `V-XXXXXXXX` id our `/vendors/:userId` route expects. */
  vendorUserId: string;
  /**
   * Whether the owning restaurant is currently open, or `null` when the
   * response did not say. Only an explicit `false` means closed — the same rule
   * the vendor page and the listing cards already use.
   */
  isStoreOpen: boolean | null;
};

export const productDestinationKeys = {
  all: ["product-destination"] as const,
  detail: (authed: boolean, productId: string) =>
    ["product-destination", authed, productId] as const,
};

/** Resolved destinations stay fresh for five minutes; a vendor id does not move. */
const DESTINATION_STALE_TIME = 5 * 60 * 1000;

async function fetchDestination(
  authed: boolean,
  productId: string,
  signal?: AbortSignal,
): Promise<ProductDestination> {
  const url = authed
    ? `/products/${productId}`
    : `/products/open/${productId}`;

  const res = await apiClient.get(url, { signal });
  const vendor = res.data?.data?.vendorId;
  const vendorUserId = typeof vendor?.userId === "string" ? vendor.userId : "";

  if (!vendorUserId) {
    // Without this the caller would push `/vendors/undefined` and land on a
    // 404 that looks like the product is gone rather than unresolvable.
    throw new Error(`No vendor userId for product ${productId}`);
  }

  const isStoreOpen = vendor?.businessDetails?.isStoreOpen;

  return {
    productId,
    vendorUserId,
    isStoreOpen: typeof isStoreOpen === "boolean" ? isStoreOpen : null,
  };
}

/**
 * `resolve` awaits a destination; `prefetch` warms one without awaiting.
 *
 * Both go through the same query key, so a `prefetch` fired on hover and a
 * `resolve` fired by the click a moment later share one request — `fetchQuery`
 * joins the in-flight promise rather than starting a second. That is what makes
 * the hop imperceptible in the common case, and merely quick in the worst one.
 */
export function useProductDestination() {
  const queryClient = useQueryClient();
  const authed = useAuthed();

  const options = useCallback(
    (productId: string) => ({
      queryKey: productDestinationKeys.detail(authed, productId),
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        fetchDestination(authed, productId, signal),
      staleTime: DESTINATION_STALE_TIME,
    }),
    [authed],
  );

  const resolve = useCallback(
    (productId: string) => queryClient.fetchQuery(options(productId)),
    [queryClient, options],
  );

  const prefetch = useCallback(
    (productId: string) => {
      // Fire and forget: a failed prefetch must never surface as an unhandled
      // rejection, and the click path reports the error properly anyway.
      void queryClient.prefetchQuery(options(productId));
    },
    [queryClient, options],
  );

  return { resolve, prefetch };
}
