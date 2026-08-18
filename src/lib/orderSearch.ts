/**
 * Order search — the model behind the search box on `/orders`.
 *
 * Pure: no React, no network, no `apiClient`. Everything here is a function of
 * its arguments, which is what makes it testable without a browser and what
 * keeps the rule below enforceable.
 *
 * ## 🔴 This search must never reach the network
 *
 * `GET /orders` has no text-search parameter, and — measured, not assumed — it
 * applies **any unrecognised query parameter as a strict equality filter**:
 *
 *   GET /orders?limit=100&searchTerm=cod   → 200, total 0
 *   GET /orders?limit=100&foo=bar          → 200, total 0
 *
 * It does not ignore the parameter and it does not error. It returns a cheerful
 * `200` with an empty list, which is indistinguishable from "this customer has
 * never ordered anything". So the obvious future refactor — "just pass the term
 * to the API" — does not degrade to unfiltered results. It erases the
 * customer's order history from their own screen, silently, in production.
 *
 * The page already holds every order in memory (`useOrders` fetches the whole
 * list and the Ongoing/History tabs are two filters over it), so there is
 * nothing to gain by asking anyway. Searching locally is both the correct
 * choice and the fast one: results land on the keystroke that produced them,
 * with no request, no spinner and no race.
 *
 * ## The match model
 *
 * Fold the query, split it on whitespace, and require **every** token to appear
 * somewhere in the order's folded haystack. Substring, not prefix; AND, not OR;
 * no ranking, no fuzz.
 *
 * - **Substring** because the customer is searching their own past orders and
 *   remembers a word from the middle — "octopus" should find "Octopus with
 *   Olive and Roasted Potatos - Large". (The backend's product search is
 *   prefix-only, so `izza` cannot find `Pizza` there. That is Meilisearch's
 *   constraint, not ours; here we own the matching.)
 * - **AND** so that typing more words *narrows*, which is what people expect
 *   when they add a word. `cod tasca` means "the cod order from Tasca". OR
 *   would widen the list on every keystroke — the opposite.
 * - **No ranking** because the list already has a meaningful order (newest
 *   first, as the API returns it). Re-sorting a customer's own history by a
 *   relevance score they cannot see or predict makes it harder to scan, not
 *   easier. Matches keep their positions.
 * - **No fuzzy matching.** At this catalogue size it buys almost nothing and
 *   introduces false positives, which are far more confusing in a list of
 *   *your own orders* than in a list of search results.
 *
 * Order-id ergonomics fall out for free once `foldText` drops `#`: the haystack
 * holds `ord-zcpts79ufj`, so `ZCPTS79UFJ`, `#ORD-ZCPTS79UFJ`, `ord-zcpts` and
 * `ORD ZCPTS79UFJ` (two tokens, both substrings) all match. No prefix
 * special-casing anywhere.
 */

import { foldText } from "./text";
import { getVendorDisplayName, type VendorNameSource } from "./vendorName";

/**
 * The slice of an order this module reads.
 *
 * Structural and almost entirely optional, on purpose. Orders are `any` at the
 * call site — there is no `Order` type in this repo — and the fields below are
 * populated inconsistently across endpoints. Declaring the minimum, and
 * declaring it as "might be missing", means this module type-checks against
 * whatever the page actually has instead of forcing a full order model into
 * existence to serve a search box.
 */
export interface SearchableAddon {
  name?: string | null;
}

export interface SearchableItem {
  name?: string | null;
  addons?: (SearchableAddon | null)[] | null;
}

export interface SearchableOrder {
  orderId?: string | null;
  /** Populated object, or the bare id string when it is not populated. */
  vendorId?: VendorNameSource | string | null;
  items?: (SearchableItem | null)[] | null;
}

/**
 * An order's searchable text, folded and flattened into one string.
 *
 * What goes in — order id, restaurant name, item names, addon names — is
 * exactly what the customer can see on the card, which is the rule that decides
 * every borderline case. Internal identifiers (`variationSku`,
 * `addons[].sku`, `productId`) are deliberately left out: the customer has
 * never seen `VAR-KAB-MED-G61` and cannot search for it, so indexing it only
 * adds noise and false positives.
 *
 * The variation needs no special handling — the API bakes it into the name
 * ("Kabab - Medium"), so variations are searchable for nothing.
 *
 * Item and addon names arrive **already localized** by `Accept-Language`, so
 * the haystack is language-dependent: the same order reads "Bread pasta" under
 * `en` and "Massa de pão" under `pt`. That is handled upstream — the orders
 * query is keyed by language, so switching languages replaces the list and the
 * caller's memo rebuilds the index with it.
 *
 * Each part is folded before joining, so the result is itself already folded.
 * Missing, `null` and non-string values contribute nothing rather than the
 * string `"undefined"` — which would otherwise be a real haystack entry that a
 * customer typing "undefined" could match.
 */
export function buildOrderHaystack(order: SearchableOrder | null): string {
  if (!order) return "";

  const parts: string[] = [order.orderId ?? "", getVendorDisplayName(order.vendorId) ?? ""];

  // `?? []` twice rather than once: an order can have no `items`, and an item
  // can have no `addons`. Both are real shapes in the live data.
  for (const item of order.items ?? []) {
    parts.push(item?.name ?? "");
    for (const addon of item?.addons ?? []) {
      parts.push(addon?.name ?? "");
    }
  }

  return parts
    .map(foldText)
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Pre-fold every order once, so filtering is a lookup rather than a rebuild.
 *
 * **This is the only decision here with real weight.** The naive version folds
 * every item name on every keystroke; this folds them once per *list*. The
 * caller memoizes on the orders array, and React Query's structural sharing
 * (on by default, and not disabled in this app's `QueryProvider`) hands back
 * the same array reference when a background refetch returns identical data —
 * so the 30-second ongoing-order poll and the window-focus refetch do not
 * throw the index away either.
 *
 * ## Keyed by the order object, not by `_id`
 *
 * A `Map` keyed on the order objects themselves. Using `_id` would mean
 * deciding what to do about orders that lack one, or share one — two failure
 * modes to handle. Object identity has neither: every order is its own key,
 * always present, always unique, no derivation step to get wrong. The map lives
 * exactly as long as the caller's memo, and the orders array outlives it, so
 * holding those references costs nothing.
 */
export function buildOrderSearchIndex(
  orders: readonly SearchableOrder[],
): Map<SearchableOrder, string> {
  const index = new Map<SearchableOrder, string>();
  for (const order of orders) {
    index.set(order, buildOrderHaystack(order));
  }
  return index;
}

/**
 * Split what the customer typed into the tokens that must all match.
 *
 * `foldText` has already collapsed every whitespace run to a single space and
 * trimmed, so splitting on `" "` is enough; the `filter` is there for the empty
 * string a fold of `""` or `"   "` produces.
 *
 * An empty result means "not searching" — see `orderMatchesTokens`.
 */
export function tokenizeSearchTerm(term: string): string[] {
  return foldText(term)
    .split(" ")
    .filter((token) => token.length > 0);
}

/**
 * Every token must appear in the haystack.
 *
 * **An empty token list matches everything**, so an empty search box filters
 * nothing. That is the single most important behaviour in this file: the
 * default state of the page is "not searching", and getting this backwards
 * would show the customer an empty order history the moment they cleared the
 * box.
 */
export function orderMatchesTokens(haystack: string, tokens: readonly string[]): boolean {
  return tokens.every((token) => haystack.includes(token));
}

/**
 * The orders matching `tokens`, in their original order.
 *
 * Two properties worth stating, because callers depend on both:
 *
 * **An empty token list returns the input array by reference** — not a copy.
 * The common case is "not searching", and returning a fresh array there would
 * invalidate every downstream memo on every render for no reason.
 *
 * **An order missing from the index is included, not excluded.** That can only
 * happen if the index was built from a different array than the one being
 * filtered — a caller bug, not a data condition. Failing *open* means the bug
 * looks like "search isn't narrowing", which is visible and harmless; failing
 * closed would look like "my orders are gone", which is neither.
 */
export function filterOrders<T extends SearchableOrder>(
  orders: readonly T[],
  index: Map<SearchableOrder, string>,
  tokens: readonly string[],
): readonly T[] {
  if (tokens.length === 0) return orders;
  return orders.filter((order) => {
    const haystack = index.get(order);
    if (haystack === undefined) return true;
    return orderMatchesTokens(haystack, tokens);
  });
}
