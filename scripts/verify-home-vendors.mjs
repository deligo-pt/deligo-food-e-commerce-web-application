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
  check(
    "🔴 delivery times are estimated for visible cards only",
    /visibleVendors\.forEach\(\(vendor\) => \{\s*const hasTime/.test(section) &&
      !/filteredVendors\.forEach/.test(section),
    "each estimate is a maps request; the list now holds every vendor",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
