/**
 * Vendors in order of distance from the customer — for the home page's
 * "Near You", which lists every vendor, nearest first (2 Oct 2026).
 *
 * No React, so `pnpm verify:home-vendors` can check it directly.
 *
 * ## Why the app sorts, not the API
 *
 * `/vendors/nearby/open` returns every vendor but in no distance order —
 * measured from a Lisbon address: 8915 km, 0.5 km, 9151 km, … — and ignores
 * `sortBy=distance`. Its pages are therefore not "the next nearest", so the
 * page fetches the whole list (`useVendorsNearbyAll`) and sorts here.
 */

export interface Point {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometres. */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Located = { businessLocation?: { latitude?: number | null; longitude?: number | null } | null };

const isCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Kilometres from `from` to the vendor, or `null` when the vendor has no pin. */
export function vendorDistanceKm(vendor: Located, from: Point): number | null {
  const lat = vendor.businessLocation?.latitude;
  const lng = vendor.businessLocation?.longitude;
  if (!isCoordinate(lat) || !isCoordinate(lng)) return null;
  return getDistanceKm(from.lat, from.lng, lat, lng);
}

/**
 * Nearest first. A vendor without a pin goes after every vendor with one —
 * it cannot be placed, and it must not be dropped. Ties, and the whole list
 * when the customer's position is unknown, keep the API's order.
 * Returns a new array; the input is not touched.
 */
export function sortVendorsByDistance<V extends Located>(
  vendors: readonly V[],
  from: Point | null | undefined,
): V[] {
  if (!from || !isCoordinate(from.lat) || !isCoordinate(from.lng)) return [...vendors];
  return vendors
    .map((vendor, index) => ({ vendor, index, km: vendorDistanceKm(vendor, from) }))
    .sort((a, b) => {
      if (a.km === null && b.km === null) return a.index - b.index;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km || a.index - b.index;
    })
    .map((entry) => entry.vendor);
}

/** How many vendors "Near You" shows at first, and adds per "Load more". */
export const HOME_VENDORS_PAGE_SIZE = 12;
