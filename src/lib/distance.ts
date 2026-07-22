// Delivery distance/time helpers. The backend does not compute delivery
// `distance`/`estimatedTime` (they come back 0), so the frontend derives them
// from the vendor's and the delivery address's coordinates — road distance via
// the /api/distance-matrix proxy, with a straight-line (Haversine) fallback.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DeliveryEstimate {
  distanceKm: number;
  minutes: number;
}

// Straight-line distance between two points, in kilometres.
export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Assumed average delivery speed (km/h) for the Haversine fallback ETA — the
// same 30 km/h the vendor pages use.
const AVG_SPEED_KMH = 30;

function haversineEstimate(origin: LatLng, dest: LatLng): DeliveryEstimate {
  const distanceKm = getDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
  return {
    distanceKm,
    minutes: Math.max(1, Math.round((distanceKm / AVG_SPEED_KMH) * 60)),
  };
}

// Resolves the delivery distance (km) and ETA (minutes) between the vendor and
// the delivery address. Prefers Google's road distance/duration; falls back to
// the straight-line estimate whenever the proxy is unavailable or returns a
// non-OK status.
export async function getDeliveryEstimate(
  origin: LatLng,
  dest: LatLng,
): Promise<DeliveryEstimate> {
  try {
    const url = `/api/distance-matrix?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${dest.lat}&destLng=${dest.lng}`;
    const res = await fetch(url);
    const data = await res.json();

    const element = data?.rows?.[0]?.elements?.[0];
    if (data?.status === "OK" && element?.status === "OK") {
      return {
        distanceKm: element.distance.value / 1000,
        minutes: Math.max(1, Math.round(element.duration.value / 60)),
      };
    }
  } catch {
    // Swallow and fall through to the Haversine estimate below.
  }
  return haversineEstimate(origin, dest);
}
