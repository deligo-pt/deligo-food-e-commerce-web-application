/**
 * Where the customer is, for the endpoints that now insist on knowing.
 *
 * No React, so `pnpm verify:search` can run every rule here without a browser.
 *
 * ## Why this exists
 *
 * On 27 Sep 2026 the customer-facing product and search endpoints began
 * requiring `lat` and `lng`, and filtering their results by proximity:
 *
 * ```
 * GET /products/open            → 400 "Location coordinates are required to discover…"
 * GET /products/open/:productId → 400 same
 * GET /search                   → 400 same, signed in or not
 * ```
 *
 * Four call sites need coordinates now, and `SearchContent` had already grown
 * a fallback chain of its own. Four copies of that chain would drift, and the
 * order matters: it decides which neighbourhood's menu a customer is shown.
 *
 * ## The order, and why
 *
 * 1. **The active delivery address.** Where the food is going beats where the
 *    phone is: someone ordering from the office to their home should see what
 *    can reach home.
 * 2. **The resolved device position**, from the location store — GPS, or the
 *    `deligo_user_coords` it persisted earlier.
 * 3. **A guest's typed address.** Someone who has told us where they are,
 *    without an account.
 * 4. **Nothing.** Not an error and not a default: see `WITHOUT_COORDS`.
 *
 * ## Not everything wants coordinates
 *
 * Sending them is *wrong* in one place. `/products?vendorId=…` honours the
 * vendor filter only while coordinates are absent — with them it answers with
 * whatever is near the customer instead, and a store page fills up with other
 * restaurants' food. That call passes `WITHOUT_COORDS`, which exists so the
 * omission reads as a decision rather than an oversight.
 */

export interface Coords {
  lat: number;
  lng: number;
}

/** The `{ latitude, longitude }` shape the store and the profile use. */
export interface LatLngPair {
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Deliberately sending no coordinates.
 *
 * Reads as intent at a call site — `withCoords(params, WITHOUT_COORDS)` — where
 * a bare `null` would read as "we could not find any", which is a different
 * thing and would be a bug in the one place this is correct.
 */
export const WITHOUT_COORDS = null;

/** A finite number, because `0` is a real coordinate and `NaN` is not. */
function isCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Normalizes the `{ latitude, longitude }` shape, or `null` if either is missing. */
export function toCoords(source: LatLngPair | null | undefined): Coords | null {
  if (!source) return null;
  return isCoordinate(source.latitude) && isCoordinate(source.longitude)
    ? { lat: source.latitude, lng: source.longitude }
    : null;
}

/**
 * The first usable position out of the candidates, in the order given.
 *
 * Tolerant of half-formed entries — a stored address with a latitude and no
 * longitude is skipped rather than sent as `lat=…&lng=undefined`, which the
 * API reads as no coordinates at all.
 */
export function pickCoords(
  ...candidates: (Coords | LatLngPair | null | undefined)[]
): Coords | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const direct = candidate as Coords;
    if (isCoordinate(direct.lat) && isCoordinate(direct.lng)) {
      return { lat: direct.lat, lng: direct.lng };
    }
    const pair = toCoords(candidate as LatLngPair);
    if (pair) return pair;
  }
  return null;
}

/** Whether a request that requires coordinates can be made at all. */
export function hasCoords(coords: Coords | null | undefined): coords is Coords {
  return !!coords && isCoordinate(coords.lat) && isCoordinate(coords.lng);
}

/**
 * Query params with `lat`/`lng` attached — the only place those two names are
 * spelled, so a rename is one edit rather than five.
 *
 * Given no coordinates it returns the params untouched, which is what
 * `WITHOUT_COORDS` is for. Callers that *require* them gate on `hasCoords`
 * first; sending a request without them would only earn a 400.
 */
export function withCoords<T extends Record<string, unknown>>(
  params: T,
  coords: Coords | null | undefined,
): T & Partial<Coords> {
  return hasCoords(coords) ? { ...params, lat: coords.lat, lng: coords.lng } : { ...params };
}

/**
 * Coordinates as a cache key: rounded to ~100 m.
 *
 * GPS jitters by a few metres between reads, and the raw numbers in a React
 * Query key would make every jitter look like a new location and refetch the
 * catalogue. Three decimals is far below the distance at which the backend's
 * proximity filter changes its answer, and `null` is a key of its own so a
 * customer who gains a location does not read a cached "nothing nearby".
 */
export function coordsKey(coords: Coords | null | undefined): string {
  if (!hasCoords(coords)) return "no-coords";
  return `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
}

/**
 * A vendor's own position, for a page that is about *that vendor*.
 *
 * The guest store page cannot use the customer's coordinates:
 * `/products/open?vendorId=…` ignores the vendor filter and answers with
 * whatever is near those coordinates, so a customer in Dhaka opening a Lisbon
 * store sees Lisbon food under a Dhaka heading — or, at the wrong distance,
 * nothing at all. Centring the query on the store makes that store's own menu
 * in range by definition, which is what the page is asking for.
 */
export function vendorCoords(
  vendor: { businessLocation?: LatLngPair | null } | null | undefined,
): Coords | null {
  return toCoords(vendor?.businessLocation);
}

/**
 * Whether a failed product request means "too far", rather than "gone".
 *
 * Since proximity filtering arrived, a product that exists answers **404** to a
 * customer outside its area — the same status a deleted product answers. The
 * difference matters: one is worth changing your address for, the other is
 * not, and telling someone a dish was removed when it is simply out of range
 * sends them away for good.
 *
 * Distinguished by what was asked, not by the reply: a 404 on a request that
 * *carried* coordinates is a proximity answer, because a genuinely missing id
 * would have 404'd without them too. Imperfect — a deleted product also 404s
 * with coordinates — but it errs towards "try another address", which is the
 * recoverable reading.
 */
export function isOutOfArea(status: number | undefined, coords: Coords | null | undefined): boolean {
  return status === 404 && hasCoords(coords);
}
