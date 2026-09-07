"use client";

import { useMemo } from "react";
import { useCart } from "@/hooks/queries/useCart";
import type { CartItem } from "@/types/cart";

/**
 * How many of each plain product the cart currently holds.
 *
 * Read once, on the page, and handed to the cards as a number — rather than
 * every card subscribing to the cart query itself. Thirty observers on one
 * query is not expensive to fetch (React Query dedupes), but it is thirty
 * components re-rendering on every cart change; a `quantity` prop re-renders
 * only the card whose number moved, which is what keeps `MenuProductCard`
 * memoized for anything worth memoizing.
 *
 * **Lines with a `variationSku` are deliberately excluded.** A product sold in
 * two sizes is two cart lines with one `productId`, and there is no single
 * number to show on a card that offers neither size. Those products keep the
 * `+` that opens the modal, so they never ask this map a question it cannot
 * answer.
 */
export function useCartQuantities(enabled: boolean): Map<string, number> {
  const { data } = useCart<{ items?: CartItem[] }>({ enabled });

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data?.items ?? []) {
      if (item.variationSku) continue;
      map.set(item.productId, item.itemSummary?.quantity ?? 0);
    }
    return map;
  }, [data]);
}
