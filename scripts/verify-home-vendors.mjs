/**
 * The home page's "Near You": every vendor, nearest first, twelve at a time.
 *
 *   pnpm verify:home-vendors
 *
 * No token, no network.
 *
 * ## What this defends (2 Oct 2026)
 *
 * The section showed the API's first ten vendors — its default page size —
 * in the API's order, which is not distance (from Lisbon: 8915 km, 0.5 km,
 * 9151 km, …), with a "View all" link for the rest. Each rule below guards a
 * way back to that.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const src = (...parts) => join(here, "..", "src", ...parts);
const code = (file) =>
  readFileSync(src(file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const { sortVendorsByDistance, vendorDistanceKm, HOME_VENDORS_PAGE_SIZE } = await import(
  src("lib/vendorDistance.ts")
);

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail === undefined ? "" : `  → ${detail}`}`);
  }
}
const J = JSON.stringify;

// A customer in Lisbon; vendors as the API returns them (not in distance order).
const LISBON = { lat: 38.7222524, lng: -9.1393366 };
const at = (id, latitude, longitude) => ({ id, businessLocation: { latitude, longitude } });
const API_ORDER = [
  at("dhaka", 23.8172, 90.4213), //  ~8900 km
  at("baixa", 38.7212, -9.1446), //  ~0.5 km
  at("nopin", null, null),
  at("sydney", -33.8712, 150.9772), // ~18000 km
  at("belem", 38.6979, -9.2066), //  ~6 km
];

console.log("\n🔴 Nearest first");
{
  const sorted = sortVendorsByDistance(API_ORDER, LISBON).map((v) => v.id);
  check(
    "🔴 sorted by distance from the customer",
    J(sorted.slice(0, 4)) === J(["baixa", "belem", "dhaka", "sydney"]),
    `got ${J(sorted)}`,
  );
  check("a vendor without a pin goes last, never dropped", sorted.at(-1) === "nopin" && sorted.length === 5);
  check(
    "no customer position keeps the API's order",
    J(sortVendorsByDistance(API_ORDER, null).map((v) => v.id)) === J(API_ORDER.map((v) => v.id)),
  );
  check("the input is not reordered in place", API_ORDER[0].id === "dhaka");
  check(
    "distance is in kilometres",
    Math.round(vendorDistanceKm(API_ORDER[1], LISBON) * 10) / 10 < 1 && vendorDistanceKm(API_ORDER[2], LISBON) === null,
  );
  check("twelve per step — fills a 3- and a 2-column grid", HOME_VENDORS_PAGE_SIZE === 12);
}

console.log("\n🔴 The section shows them all, with Load more");
{
  const hook = code("hooks/queries/useVendors.ts");
  check(
    "🔴 every page is read, 100 at a time",
    /export function useVendorsNearbyAll/.test(hook) &&
      /limit: 100/.test(hook) &&
      /for \(let page = 2; page <= totalPage; page\+\+\)/.test(hook),
    "the API's default page is ten — the old cap",
  );

  const section = code("components/home/RestaurantsSection.tsx");
  check(
    "🔴 the section reads the whole list and sorts it",
    /useVendorsNearbyAll<Vendor>\(resolvedCoords/.test(section) &&
      /sortVendorsByDistance\(nearbyVendors \?\? \[\], resolvedCoords\)/.test(section) &&
      !/useVendorsNearby</.test(section),
  );
  check(
    "🔴 \"View all\" is gone",
    !/href="\/vendors"/.test(section) && !/t\("viewAll"\)/.test(section),
  );
  check(
    "🔴 Load more pages through the list, and hides at the end",
    /filteredVendors\.slice\(0, visibleCount\)/.test(section) &&
      /\{hasMoreVendors && \(/.test(section) &&
      /onClick=\{loadMoreVendors\}/.test(section) &&
      /t\("loadMore"\)/.test(section),
  );
  check(
    "a new position or filter starts from the top again",
    /shown\.key === listKey \? shown\.count : HOME_VENDORS_PAGE_SIZE/.test(section),
  );
  // 22 Oct 2026: the delivery time is the backend's `estimatedDeliveryTime`,
  // sent with the list, instead of a Google distance request per card (up to
  // 100 for this section) with "Under 10 min" whenever one failed.
  check(
    "🔴 the cards show the backend's estimate and ask Google for nothing",
    /deliveryEstimateText\(vendor\.estimatedDeliveryTime, t\)/.test(section) &&
      !/distance-matrix/.test(section) &&
      !/under10Min|Under 10 min/.test(section),
    "a maps request per card, and a made-up time when it failed",
  );
  check(
    "no estimate, no badge",
    /\{!isClosed && displayTime && \(/.test(section),
  );
}

{
  const { deliveryEstimateText, formatMinutes } = await import(src("lib/deliveryEstimate.ts"));
  const en = await import(src("assets/translations/en.ts"));
  const pt = await import(src("assets/translations/pt.ts"));
  const dict = (mod) => mod.default ?? mod.en ?? mod.pt ?? Object.values(mod)[0];
  const t = (key) => dict(en)[key] ?? key;
  const tPt = (key) => dict(pt)[key] ?? key;
  // 26 Oct 2026: long estimates read in hours, days, weeks — same numbers.
  const cases = [
    [[45, 55], "45–55 min"],
    [[50, 70], "50 min – 1h 10m"],
    [[165, 175], "2h 45m – 2h 55m"],
    [[180, 190], "3h – 3h 10m"],
    [[120, 120], "2h"],
    [[1500, 1560], "1–2 days"],
    [[1440, 1440], "1 day"],
    [[2880, 2880], "2 days"],
    [[10080, 20000], "1–2 weeks"],
  ];
  for (const [[min, max], want] of cases) {
    const got = deliveryEstimateText({ minMinutes: min, maxMinutes: max }, t);
    check(`${min}–${max} min reads "${want}"`, got === want, got);
  }
  check("PT: hours and days", deliveryEstimateText({ minMinutes: 165, maxMinutes: 175 }, tPt) === "2h 45min – 2h 55min" && deliveryEstimateText({ minMinutes: 1500, maxMinutes: 1560 }, tPt) === "1–2 dias", deliveryEstimateText({ minMinutes: 165, maxMinutes: 175 }, tPt));
  check("one duration: 13 min, 1h 5m", formatMinutes(13, t) === "13 min" && formatMinutes(65, t) === "1h 5m");
  check(
    "the estimate reads as a range, or one number when both ends agree",
    deliveryEstimateText({ minMinutes: 30, maxMinutes: 40 }, t) === "30–40 min" &&
      deliveryEstimateText({ minMinutes: 25, maxMinutes: 25 }, t) === "25 min",
  );
  check(
    "🔴 no estimate, or a broken one, is null, never a guess",
    deliveryEstimateText(null, t) === null &&
      deliveryEstimateText(undefined, t) === null &&
      deliveryEstimateText({ minMinutes: 40, maxMinutes: 30 }, t) === null &&
      deliveryEstimateText({ minMinutes: "x", maxMinutes: 30 }, t) === null &&
      deliveryEstimateText({ minMinutes: -5, maxMinutes: 10 }, t) === null,
  );
  const card = code("components/vendors/VendorCard.tsx");
  check(
    "🔴 the vendors page and search cards follow the same rule",
    /deliveryEstimateText\(vendor\.estimatedDeliveryTime, t\)/.test(card) &&
      !/distance-matrix/.test(card) &&
      !/Under 10 min/.test(card) &&
      /\{!isClosed && displayTime && \(/.test(card),
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
