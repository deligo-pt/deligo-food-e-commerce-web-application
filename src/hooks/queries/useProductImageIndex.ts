"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { hasCoords, vendorCoords, withCoords, type Coords } from "@/lib/customerCoords";
import { buildProductImageIndex } from "@/lib/productImage";

/**
 * One store's pictures, for products whose payload arrived without one.
 *
 * A stopgap (1 Oct 2026). The backend copies only `product.image` into search
 * hits and cart/order lines, so products still in the old `images: [url]`
 * shape reach those screens with no picture at all. Until the backend falls
 * back to `images[0]` itself, `ProductImage` asks here. Once it does, no
 * caller needs this — a payload with a picture never triggers the lookup.
 *
 * ## Cost
 *
 * - **Per store, not per product.** The key is the store id, so twenty search
 *   hits from one restaurant are one request, and every row of a cart shares
 *   it. Only stores with a missing picture are ever asked.
 * - **Cached for ten minutes**, across screens.
 *
 * ## Asked from the store's own position
 *
 * The product endpoints filter by distance; asked from the customer's
 * position, a store out of range answers with an empty menu and nothing would
 * be found. The store's own pin always covers its own menu. A search hit
 * carries that pin (`_geo`) and passes it in; otherwise — cart and order lines
 * carry no location — the store's record is read first, which the branch-name
 * lookups have usually cached already.
 */
export function useProductImageIndex(
  vendorId: string | null | undefined,
  options: { enabled: boolean; place?: Coords | null },
) {
  return useQuery({
    queryKey: ["product-image-index", vendorId ?? ""],
    queryFn: async ({ signal }) => {
      const authed = typeof window !== "undefined" && !!getAccessToken();
      let place: Coords | null = hasCoords(options.place) ? options.place : null;

      if (!place) {
        const res = await apiClient.get(
          authed ? `/vendors/customer/${vendorId}` : `/vendors/nearby/open/${vendorId}`,
          { signal },
        );
        place = vendorCoords(res.data?.data);
      }
      // `/products/open` answers 400 without a position; there is nothing
      // useful to ask then.
      if (!place && !authed) return new Map<string, string>();

      const res = await apiClient.get(
        authed ? "/products" : "/products/open",
        { params: withCoords({ vendorId, limit: 100 }, place), signal },
      );
      return buildProductImageIndex(res.data?.data ?? []);
    },
    enabled: options.enabled && !!vendorId,
    staleTime: 10 * 60_000,
    // A failed lookup costs a picture, not the screen — never retry it loudly.
    retry: false,
  });
}
