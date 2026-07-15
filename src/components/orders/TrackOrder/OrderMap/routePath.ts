import type { LatLng } from "./types";

/**
 * A polyline with precomputed cumulative distances, giving cheap interpolation
 * along the route (for moving the rider) and nearest-point projection (for
 * snapping live GPS onto the route). Distances use an equirectangular
 * approximation in metres — accurate enough over a single delivery leg.
 */
export interface RoutePath {
  points: LatLng[];
  total: number;
  /** Point at a 0..1 fraction of the route length. */
  pointAtFraction: (f: number) => LatLng;
  /** Route points from the start up to `f`, plus the exact point at `f`. */
  pointsUpToFraction: (f: number) => LatLng[];
  /** Nearest fraction (and projected point) on the route to `p`. */
  snap: (p: LatLng) => { fraction: number; point: LatLng };
}

const DEG = Math.PI / 180;
const R = 6371000;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function segMeters(a: LatLng, b: LatLng): number {
  const x = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * DEG);
  const y = b.lat - a.lat;
  return Math.sqrt(x * x + y * y) * DEG * R;
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Along-segment parameter (0..1) of p's projection onto segment a→b. */
function projectParam(p: LatLng, a: LatLng, b: LatLng): number {
  const lat0 = a.lat * DEG;
  const bx = (b.lng - a.lng) * Math.cos(lat0);
  const by = b.lat - a.lat;
  const px = (p.lng - a.lng) * Math.cos(lat0);
  const py = p.lat - a.lat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return 0;
  return clamp((px * bx + py * by) / len2, 0, 1);
}

export function buildRoutePath(points: LatLng[]): RoutePath | null {
  if (!points || points.length < 2) return null;

  const cumulative: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] + segMeters(points[i - 1], points[i]);
  }
  const total = cumulative[cumulative.length - 1];

  const pointAtDistance = (d: number): LatLng => {
    if (d <= 0 || total === 0) return points[0];
    if (d >= total) return points[points.length - 1];
    let i = 0;
    while (i < points.length - 1 && cumulative[i + 1] < d) i++;
    const segLen = cumulative[i + 1] - cumulative[i] || 1;
    return lerp(points[i], points[i + 1], (d - cumulative[i]) / segLen);
  };

  const pointAtFraction = (f: number): LatLng =>
    pointAtDistance(clamp(f, 0, 1) * total);

  const pointsUpToFraction = (f: number): LatLng[] => {
    const d = clamp(f, 0, 1) * total;
    const out: LatLng[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      if (cumulative[i] < d) out.push(points[i]);
      else break;
    }
    out.push(pointAtDistance(d));
    return out;
  };

  const snap = (p: LatLng): { fraction: number; point: LatLng } => {
    let best = { fraction: 0, point: points[0], d2: Infinity };
    for (let i = 0; i < points.length - 1; i++) {
      const t = projectParam(p, points[i], points[i + 1]);
      const proj = lerp(points[i], points[i + 1], t);
      const dx = (p.lng - proj.lng) * Math.cos(p.lat * DEG);
      const dy = p.lat - proj.lat;
      const d2 = dx * dx + dy * dy;
      if (d2 < best.d2) {
        const segLen = cumulative[i + 1] - cumulative[i];
        const distAlong = cumulative[i] + segLen * t;
        best = { fraction: total > 0 ? distAlong / total : 0, point: proj, d2 };
      }
    }
    return { fraction: best.fraction, point: best.point };
  };

  return { points, total, pointAtFraction, pointsUpToFraction, snap };
}
