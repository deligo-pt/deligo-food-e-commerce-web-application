/**
 * The pure model behind `GET /search` — the backend's Meilisearch-powered
 * customer search. See `Plan.md` → "Customer Search — Implementation Plan".
 *
 * No React, no network, no `apiClient`. Everything here is a function of its
 * arguments, which is what lets `pnpm verify:search` assert it offline with no
 * token.
 *
 * ## What is deliberately NOT here
 *
 * Nothing filters, sorts, or re-prices hits. The brief for this feature is that
 * the backend decides what comes back and in what order; the client asks the
 * right question and renders the answer. Filters are query parameters, order is
 * `?sortBy=`, the result count is `estimatedTotalHits`, and `price` is rendered
 * as sent. If a caller ever needs a helper that reorders or drops hits, the plan
 * is wrong and it is the plan that should change.
 *
 * The shapes below were observed live on 2026-08-18 against
 * `api-test-food.deligo.pt` (18 items, 7 restaurants), not inferred from
 * `Customer_Search.md` — the two disagree in three places, and where they do,
 * this file follows the API. Those three are called out at `SearchHit`.
 */

/** The two sort fields the API accepts. */
export type SearchSortBy = "price" | "rating";

export type SearchSortOrder = "asc" | "desc";

/** Present only when the restaurant has a location on file. */
export type SearchGeo = {
  lat: number;
  lng: number;
};

/**
 * One search result — a food item, never a restaurant. The index is
 * `food_items` only; there are no restaurant documents to match against.
 *
 * Three fields disagree with `Customer_Search.md`, all verified:
 *
 * - `branchName` is **absent** on 10 of 18 hits, not `""` as documented. Hence
 *   optional — `formatRestaurantLabel` treats missing and empty alike.
 * - `cuisine` arrives **uppercase** (`"INDIAN FOOD"`, `"COMIDA INDIANA"` under
 *   `pt`), not `"Sushi"`. `formatCuisineLabel` is the fix, and §7 Q26 asks the
 *   backend to make it unnecessary.
 * - `currency` mirrors whatever the vendor typed, so it is `"EUR"` on some
 *   records and `"€"` on others. `currencySymbol()` in `./currency` already
 *   handles both — an unknown code falls through to itself.
 *
 * `thumbnail` and `_geo` can both be absent; that is documented and true.
 */
export interface SearchHit {
  /** Meilisearch's own id — the product's Mongo `_id`. Use as the list key. */
  id: string;
  /**
   * The `PROD-XXXXXX` id, and the only one that resolves anywhere:
   * `GET /products/:productId` accepts it, `GET /products/:id` 404s.
   */
  productId: string;
  /** Already localized per `Accept-Language`. Never re-translate client-side. */
  name: string;
  description: string;
  /** Localized display names, **not** the slugs `?cuisine=` expects. */
  cuisine: string[];
  restaurantName: string;
  /** Absent for single-location restaurants. See `formatRestaurantLabel`. */
  branchName?: string;
  /**
   * The vendor's Mongo `_id` — **not** the `V-XXXXXXXX` userId our routes use,
   * and `GET /vendors/customer/:id` 404s on it. Good for `?restaurantId=`,
   * useless for navigation; resolve a destination via `productId` instead.
   */
  restaurantId: string;
  /** Direct price, or the cheapest variation. Render as sent. */
  price: number;
  rating: number;
  /** Restaurant-level halal certification, not a property of this dish. */
  isHalal: boolean;
  /** Product stock only. It does **not** mean the restaurant is open. */
  isAvailable: boolean;
  thumbnail: string | null;
  currency: string;
  _geo?: SearchGeo;
}

/** The `data` envelope of a `GET /search` response. */
export interface SearchResponse {
  hits: SearchHit[];
  /** Echo of `searchTerm`. */
  query: string;
  /** Meilisearch's own time — observed 0–1ms. The wait is the network. */
  processingTimeMs: number;
  limit: number;
  offset: number;
  /** The real total. `hits.length` is only the current page. */
  estimatedTotalHits: number;
}

/**
 * Everything `GET /search` accepts. All optional — a bare call returns the
 * whole index in default relevance order.
 *
 * `cuisine` is a single **slug** (`"indian-food"`), from
 * `GET /categories/cuisine/open`. It is not a display name and it is not a
 * list: `sushi,kebab`, a repeated `cuisine=`, and `cuisine[]=` all return zero
 * hits with no error. See §7 Q24.
 */
export interface SearchParams {
  searchTerm?: string;
  limit?: number;
  offset?: number;
  cuisine?: string;
  isHalal?: boolean;
  /** Product stock. Not applied at all unless explicitly passed. */
  isAvailable?: boolean;
  restaurantId?: string;
  minPrice?: number;
  maxPrice?: number;
  lat?: number;
  lng?: number;
  radiusInMeters?: number;
  sortBy?: SearchSortBy;
  sortOrder?: SearchSortOrder;
}

/** The API's own default page size, mirrored so paging math has one source. */
export const SEARCH_PAGE_SIZE = 20;

/** Shortest query worth sending — below this, results are noise. */
export const MIN_SEARCH_TERM_LENGTH = 2;

/**
 * How long typing must pause before a search is issued.
 *
 * `Customer_Search.md` recommends 250–300ms. The upper end is chosen because a
 * warm round-trip to the API measured ~258ms: a shorter debounce would put a
 * second request in flight before the first had a chance to land, spending the
 * 100-per-60s budget to display something that is about to be replaced.
 */
export const SEARCH_DEBOUNCE_MS = 300;

/** A finite number, and not the `NaN` that `Number("abc")` hands back. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A non-empty string once trimmed, or `null`. */
function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The default direction for a sort field, used whenever `sortOrder` is omitted.
 *
 * The server's own default is **descending** for both, which is undocumented
 * and actively wrong for price — "sort by price" with no direction returning
 * the €100 burger first is not what anyone means. So `sortBy` is never sent
 * without an explicit `sortOrder`, and these are the defaults applied.
 */
const DEFAULT_SORT_ORDER: Record<SearchSortBy, SearchSortOrder> = {
  price: "asc",
  rating: "desc",
};

/**
 * Assembles a `GET /search` query string. The single place a search request is
 * built, and the boundary that keeps malformed input off the wire.
 *
 * The API answers **HTTP 500 with the raw Meilisearch error in the body** for
 * `limit=abc`, `minPrice=abc` and `offset=-1` — so anything that fails
 * `Number.isFinite` is dropped rather than stringified, and a negative offset is
 * clamped to 0. Empty strings are dropped too: `searchTerm=` is a different
 * query from omitting it.
 *
 * `lat`/`lng`/`radiusInMeters` are sent **only as a complete triple**. A partial
 * one is silently ignored by the server, and a filter that quietly does nothing
 * is worse than one that is visibly absent.
 *
 * Parameters are appended in a fixed order so the same input always produces the
 * same string — which is what makes the result usable in a cache key.
 */
export function buildSearchParams(input: SearchParams = {}): URLSearchParams {
  const params = new URLSearchParams();

  const searchTerm = cleanString(input.searchTerm);
  if (searchTerm) params.set("searchTerm", searchTerm);

  const cuisine = cleanString(input.cuisine);
  if (cuisine) params.set("cuisine", cuisine);

  const restaurantId = cleanString(input.restaurantId);
  if (restaurantId) params.set("restaurantId", restaurantId);

  // Booleans are only meaningful when explicitly chosen. `isAvailable: false`
  // is a real filter (it returns the 3 out-of-stock items), so the test is
  // against `undefined`, not falsiness.
  if (typeof input.isHalal === "boolean") {
    params.set("isHalal", String(input.isHalal));
  }
  if (typeof input.isAvailable === "boolean") {
    params.set("isAvailable", String(input.isAvailable));
  }

  if (isFiniteNumber(input.minPrice)) {
    params.set("minPrice", String(input.minPrice));
  }
  if (isFiniteNumber(input.maxPrice)) {
    params.set("maxPrice", String(input.maxPrice));
  }

  // All three or none.
  if (
    isFiniteNumber(input.lat) &&
    isFiniteNumber(input.lng) &&
    isFiniteNumber(input.radiusInMeters) &&
    input.radiusInMeters > 0
  ) {
    params.set("lat", String(input.lat));
    params.set("lng", String(input.lng));
    params.set("radiusInMeters", String(Math.round(input.radiusInMeters)));
  }

  if (input.sortBy) {
    params.set("sortBy", input.sortBy);
    params.set("sortOrder", input.sortOrder ?? DEFAULT_SORT_ORDER[input.sortBy]);
  }
  // A `sortOrder` with no `sortBy` is ignored by the server; dropping it keeps
  // the query string honest about what it actually asks for.

  // Integers only — a fractional limit is another way to reach the 500.
  if (isFiniteNumber(input.limit) && input.limit >= 1) {
    params.set("limit", String(Math.floor(input.limit)));
  }
  if (isFiniteNumber(input.offset)) {
    params.set("offset", String(Math.max(0, Math.floor(input.offset))));
  }

  return params;
}

/**
 * The `offset` of the next page, or `null` when the current page is the last.
 *
 * Measured against `hits.length` rather than the requested `limit`: on the final
 * page the server returns fewer rows than asked for, and counting what actually
 * arrived is what guarantees this terminates. An empty page always ends the
 * sequence, even if `estimatedTotalHits` disagrees.
 */
export function nextSearchOffset(response: SearchResponse): number | null {
  if (response.hits.length === 0) return null;
  const consumed = response.offset + response.hits.length;
  return consumed < response.estimatedTotalHits ? consumed : null;
}

// Word starts, for title-casing: the beginning of the string, or the character
// after a separator. An apostrophe is deliberately not a separator, so
// "SUMU'S" becomes "Sumu's" rather than "Sumu'S".
const WORD_START = /(^|[\s\-–—/&(,.])([^\s\-–—/&(,.])/g;

/**
 * A cuisine name as it should appear on screen: `"INDIAN FOOD"` → `"Indian
 * Food"`, `"COMIDA INDIANA"` → `"Comida Indiana"`.
 *
 * The API returns these uppercase, which shouts on a card. Purely cosmetic —
 * never feed the result back into `?cuisine=`, which wants the slug.
 *
 * Input that already contains a lowercase letter is returned untouched, so this
 * becomes a no-op the day the backend sends proper case (§7 Q26) rather than
 * something that has to be found and removed.
 *
 * Casing is not locale-aware on purpose. Every divergence between
 * `toLowerCase` and `toLocaleLowerCase` is in Turkish/Azeri and Lithuanian,
 * none of which we serve, and the locale-aware form would mangle "INDIAN" into
 * "ındian" on a device set to Turkish. Portuguese accents behave identically
 * under both.
 *
 * Known limit: a genuine acronym would be flattened ("BBQ" → "Bbq"). No cuisine
 * in the catalogue is one — the barbecue entry is spelled "BARBECUE".
 */
export function formatCuisineLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  // Any lowercase letter at all means someone has already cased this.
  if (trimmed.toUpperCase() !== trimmed) return trimmed;

  return trimmed
    .toLowerCase()
    .replace(WORD_START, (_match, separator: string, first: string) =>
      separator + first.toUpperCase(),
    );
}

/**
 * How a result names its restaurant: `"Sumu's Bites – Downtown"` when there is a
 * branch, plain `"Sumu's Bites"` when there is not.
 *
 * `branchName` is absent on most hits and `""` on the rest — both mean "single
 * location, no suffix", so both are handled the same way. Some restaurants share
 * a `restaurantName` across branches, which is the whole reason the suffix
 * exists.
 */
export function formatRestaurantLabel(
  hit: Pick<SearchHit, "restaurantName" | "branchName">,
): string {
  const name = cleanString(hit.restaurantName);
  const branch = cleanString(hit.branchName);

  if (!name) return branch ?? "";
  return branch ? `${name} – ${branch}` : name;
}

/**
 * Whether a hit can be placed on a map or measured against a user's position.
 *
 * A missing `_geo` is "location unknown", not an error — restaurants without a
 * location set are indexed without it. Callers should treat `false` as "do not
 * claim to know where this is", never as a reason to hide the result.
 */
export function hasLocation(
  hit: Pick<SearchHit, "_geo">,
): hit is Pick<SearchHit, "_geo"> & { _geo: SearchGeo } {
  return isFiniteNumber(hit._geo?.lat) && isFiniteNumber(hit._geo?.lng);
}
