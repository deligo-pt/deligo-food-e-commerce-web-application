"use client";

import { useCallback, useDeferredValue, useMemo } from "react";
import {
  buildOrderSearchIndex,
  filterOrders,
  tokenizeSearchTerm,
  type SearchableOrder,
} from "@/lib/orderSearch";

/**
 * Order search, wired to React.
 *
 * Deliberately *not* in `hooks/queries/` — it fetches nothing. Everything it
 * searches is already in memory, put there by `useOrders`. See the header of
 * `lib/orderSearch.ts` for why this can never become a request.
 *
 * ## The one decision that matters
 *
 * The **index is memoized on the orders array, not on the search term**. This
 * is the whole performance story: folding every item name on every keystroke is
 * the naive version, and it is the version you get by writing the obvious
 * `useMemo(() => orders.filter(...), [orders, term])`. Here the folding happens
 * once per *list*; a keystroke only re-runs `String.includes` over strings that
 * were folded long ago.
 *
 * Two things keep that memo alive longer than it looks:
 *
 * - React Query's `structuralSharing` is on by default and is not disabled in
 *   this app's `QueryProvider`, so a background refetch returning identical
 *   data hands back the **same array reference**. The 30-second ongoing-order
 *   poll and the window-focus refetch therefore do not throw the index away.
 * - Switching language *does* replace the array, and should: item and addon
 *   names come back localized, so the haystacks genuinely change. The orders
 *   query is keyed by language, so this happens by itself.
 *
 * ## Why `useDeferredValue` and not a debounce
 *
 * A debounce exists to stop *network* requests firing per keystroke. There is
 * no network here, so a timer could only add latency to something already
 * instant — every keystroke would feel 200ms slower for no benefit.
 *
 * `useDeferredValue` has the opposite shape: it costs nothing when the pass is
 * fast (which, at these list sizes, is always), and if a much larger order
 * history ever made a pass expensive, React keeps the input responsive by
 * letting the caret run ahead of the results instead of blocking on them. It is
 * the built-in answer to exactly this problem.
 *
 * Note that `tokens`, `isSearching` and `filter` are all derived from the
 * **deferred** term, never the live one. That is what keeps the UI internally
 * consistent: during a lagging frame the customer sees the previous results,
 * the previous counts and the previous empty-state — never this keystroke's
 * count above the last keystroke's list.
 */
export interface OrderSearch {
  /** The folded tokens being matched. Empty means "not searching". */
  tokens: readonly string[];
  /**
   * Whether a search is active — i.e. whether the UI should show match counts
   * and the search-specific empty states rather than its normal copy.
   */
  isSearching: boolean;
  /**
   * Narrow a list of orders to the matches, preserving their order.
   *
   * Takes the list rather than returning one, because the page has **two**
   * lists to narrow — Ongoing and History — and both must share a single
   * index. Returns the input array by reference when nothing is being searched.
   */
  filter: <T extends SearchableOrder>(orders: readonly T[]) => readonly T[];
}

export function useOrderSearch(
  orders: readonly SearchableOrder[],
  term: string,
): OrderSearch {
  const deferredTerm = useDeferredValue(term);

  // Depends on `orders` ALONE. Adding the term here is the mistake this whole
  // hook exists to prevent — it would refold every name on every keystroke.
  const index = useMemo(() => buildOrderSearchIndex(orders), [orders]);

  const tokens = useMemo(() => tokenizeSearchTerm(deferredTerm), [deferredTerm]);

  const filter = useCallback(
    <T extends SearchableOrder>(list: readonly T[]) =>
      filterOrders(list, index, tokens),
    [index, tokens],
  );

  return { tokens, isSearching: tokens.length > 0, filter };
}
