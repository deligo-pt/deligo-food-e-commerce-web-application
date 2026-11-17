"use client";

import { useMemo } from "react";
import { useCart } from "@/hooks/queries/useCart";
import type { CartItem } from "@/types/cart";

/**
 * How many of each product the cart currently holds — every line of it added
 * up.
 *
 * Read once, on the page, and handed to the cards as a number — rather than
 * every card subscribing to the cart query itself. Thirty observers on one
 * query is not expensive to fetch (React Query dedupes), but it is thirty
 * components re-rendering on every cart change; a `quantity` prop re-renders
 * only the card whose number moved, which is what keeps `MenuProductCard`
 * memoized for anything worth memoizing.
 *
 * **One product can be several lines.** A dish in two sizes is one line per
 * `variationSku`, and the same burger with and without cheese can be two
 * lines too. Each used to be skipped or to overwrite the last, so a product
 * with options showed nothing on its card (17 Nov 2026). Now the card gets the
 * total:
 *
 * - a plain product has exactly one line, so the total *is* that line — what
 *   its `−  n  +` stepper sets;
 * - a product with options keeps the `+` that opens the modal and shows the
 *   total as a badge on its photo, since no single line could be stepped.
 */
export function useCartQuantities(enabled: boolean): Map<string, number> {
  const { data } = useCart<{ items?: CartItem[] }>({ enabled });

  return useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data?.items ?? []) {
      const quantity = item.itemSummary?.quantity ?? 0;
      if (quantity <= 0) continue;
      map.set(item.productId, (map.get(item.productId) ?? 0) + quantity);
    }
    return map;
  }, [data]);
}
