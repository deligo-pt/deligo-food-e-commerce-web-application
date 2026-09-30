/**
 * Where the customer is, and which calls are told.
 *
 *   pnpm verify:customer-coords
 *
 * No token, no network: the module runs directly, the call sites are read off
 * source.
 *
 * ## What this defends
 *
 * On 27 Sep 2026 the customer product and search endpoints began requiring
 * `lat`/`lng` and filtering by proximity. Every failure mode this introduced is
 * quiet:
 *
 * 1. **A call that forgets them** answers `400 "Location coordinates are
 *    required to discover…"`, or — on the authed single-product route — a bare
 *    **404** for a product that exists.
 * 2. **A call that sends them where it must not** is worse, because it
 *    succeeds: `/products?vendorId=…` honours the vendor filter only while
 *    coordinates are absent, and `/product-categories/open?vendorId=…` returns
 *    3 categories without them and **0** with them. A store page then fills
 *    with other restaurants' food, or empties, and nothing looks broken.
 * 3. **A cached answer crossing a boundary.** The same product resolves here
 *    and 404s there, so a key without the position serves one neighbourhood's
 *    menu to another.
 * 4. **A 404 read as "deleted"** when it means "too far" — the recoverable
 *    case reported as the final one.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(here, "..", file), "utf8");
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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
const section = (title) => console.log(`\n${title}`);

const { ownedBy, productVendorId } = await import(join(here, "../src/lib/vendorId.ts"));

const {
  pickCoords,
  toCoords,
  hasCoords,
  withCoords,
  coordsKey,
  vendorCoords,
  isOutOfArea,
  menuCoords,
  WITHOUT_COORDS,
} = await import(join(here, "../src/lib/customerCoords.ts"));

const module_ = stripComments(read("src/lib/customerCoords.ts"));
const hook = stripComments(read("src/hooks/useCustomerCoords.ts"));
const page = stripComments(read("src/app/(main)/search/SearchContent.tsx"));
const vendors = stripComments(read("src/hooks/queries/useVendors.ts"));
const destination = stripComments(read("src/hooks/queries/useProductDestination.ts"));
const modal = stripComments(read("src/components/vendors/ProductDetailsModal.tsx"));
const payment = stripComments(read("src/components/payment/PaymentPage.tsx"));

const J = JSON.stringify;

section("🔴 The order the sources are tried in");
{
  check(
    "🔴 the delivery address wins",
    J(pickCoords({ lat: 1, lng: 2 }, { latitude: 3, longitude: 4 }, { latitude: 5, longitude: 6 })) ===
      J({ lat: 1, lng: 2 }),
    "that is where the food would actually go",
  );
  check(
    "then the device position, then a guest's typed address",
    J(pickCoords(null, { latitude: 3, longitude: 4 }, { latitude: 5, longitude: 6 })) === J({ lat: 3, lng: 4 }) &&
      J(pickCoords(null, null, { latitude: 5, longitude: 6 })) === J({ lat: 5, lng: 6 }),
  );
  check(
    "🔴 and the hook reads exactly those three, in that order",
    /useActiveAddressCoords\(\)/.test(hook) &&
      /useLocationStore\(\(s\) => s\.coords\)/.test(hook) &&
      /useLocationStore\(\(s\) => s\.guestAddress\)/.test(hook) &&
      /pickCoords\(addressCoords, storedCoords, guestAddress\)/.test(hook),
  );
  check(
    "nothing at all is null — never an invented default",
    pickCoords(null, undefined, null) === null,
    "a fallback coordinate answers a question the customer never asked",
  );
}

section("🔴 Half-formed positions are not sent");
{
  check(
    "🔴 a source with one half is skipped, not sent as lng=undefined",
    J(pickCoords({ latitude: 3 }, { latitude: 5, longitude: 6 })) === J({ lat: 5, lng: 6 }),
    "the API reads a partial pair as no position at all",
  );
  check(
    "🔴 zero is a real coordinate",
    J(pickCoords({ latitude: 0, longitude: 0 })) === J({ lat: 0, lng: 0 }) && hasCoords({ lat: 0, lng: 0 }),
    "the null island is a place; falsiness is the wrong test",
  );
  check(
    "NaN is not",
    pickCoords({ latitude: NaN, longitude: 2 }) === null && !hasCoords({ lat: NaN, lng: 1 }),
  );
  check(
    "toCoords tolerates null and partial shapes",
    toCoords(null) === null && toCoords({ latitude: 1 }) === null &&
      J(toCoords({ latitude: 1, longitude: 2 })) === J({ lat: 1, lng: 2 }),
  );
}

section("🔴 Attaching them, and deliberately not");
{
  const params = { limit: 5 };
  check(
    "withCoords attaches both and copies rather than mutates",
    J(withCoords(params, { lat: 1, lng: 2 })) === J({ limit: 5, lat: 1, lng: 2 }) && !("lat" in params),
  );
  check(
    "🔴 WITHOUT_COORDS leaves the params untouched",
    J(withCoords({ vendorId: "x" }, WITHOUT_COORDS)) === J({ vendorId: "x" }),
    "a signed-in menu with no known position relies on it",
  );
  check(
    "a vendor's own position comes off its businessLocation",
    J(vendorCoords({ businessLocation: { latitude: 23.817252, longitude: 90.421308 } })) ===
      J({ lat: 23.817252, lng: 90.421308 }) &&
      vendorCoords(null) === null &&
      vendorCoords({ businessLocation: {} }) === null,
  );
}

section("🔴 Where a store page asks for its menu from");
{
  const me = { lat: 23.8172892, lng: 90.420495 };
  const store = { lat: 38.76742, lng: -9.09682 };
  check(
    "🔴 the customer's position wins, signed in or not",
    J(menuCoords(true, me, store)) === J({ coords: me, fromCustomer: true }) &&
      J(menuCoords(false, me, store)) === J({ coords: me, fromCustomer: true }),
    "decided 30 Sep 2026: the menu lists what can reach the customer",
  );
  check(
    "🔴 signed in with no position asks with none",
    J(menuCoords(true, null, store)) === J({ coords: WITHOUT_COORDS, fromCustomer: false }),
    "/products?vendorId= answers with the whole menu then; the store's pin would not add anything",
  );
  check(
    "🔴 a guest with no position falls back to the store's own",
    J(menuCoords(false, null, store)) === J({ coords: store, fromCustomer: false }) &&
      J(menuCoords(false, null, null)) === J({ coords: null, fromCustomer: false }),
    "/products/open 400s without coordinates, and a blank store page explains nothing",
  );
  check(
    "a half-formed position is not the customer's",
    menuCoords(false, { lat: 1, lng: NaN }, store).fromCustomer === false,
  );
}

section("🔴 The cache cannot serve one neighbourhood's answer to another");
{
  check(
    "🔴 the key rounds to ~100m, so GPS jitter does not refetch the catalogue",
    coordsKey({ lat: 38.72234567, lng: -9.13934567 }) === coordsKey({ lat: 38.7223, lng: -9.1393 }),
  );
  check(
    "…and 'no position' is a key of its own",
    coordsKey(null) === "no-coords" && coordsKey({ lat: 1, lng: 2 }) !== "no-coords",
    "a customer who gains a location must not read a cached 'nothing nearby'",
  );
  check(
    "🔴 the product destination keys on it",
    /coordsKey\(coords\)\] as const/.test(destination) &&
      /productDestinationKeys\.detail\(authed, productId, coords\)/.test(destination),
  );
  check(
    "🔴 and so does the vendor menu — in the key array, not just the signature",
    /vendorKeys\.products\(lang, authed, vendorId \?\? "", coordsKey\(place\)\)/.test(vendors) &&
      /\["vendors", "products", lang, authed, vendorId, place\]/.test(vendors),
    "passing it to the key builder means nothing if the builder drops it",
  );
}

section("🔴 Which call is told what");
{
  check(
    "search sends the position, and does not fire without one",
    /lat: searchCoords\?\.lat/.test(page) &&
      /enabled: hasCriteria && !!searchCoords/.test(page),
  );
  check(
    "the product destination sends it on both routes",
    /withCoords\(\{\}, coords\)/.test(destination),
  );
  check(
    "the dish modal sends it, and re-asks when it changes",
    /const askFrom = hasCoords\(coords\) \? coords : hasCoords\(storeCoords\) \? storeCoords : null;/.test(modal) &&
      /const params = withCoords\(\s*\{\},\s*askLat !== undefined && askLng !== undefined \? \{ lat: askLat, lng: askLng \} : null,\s*\);/.test(modal) &&
      /\[isOpen, productId, coords, askLat, askLng, t\]/.test(modal),
    "the customer's position first; the store's own only when theirs is unknown",
  );
  check(
    "🔴 the payment page's reward lookup sends the VENDOR's position",
    /vendorCoords\(vendor\)/.test(payment),
    "the customer's would filter a store's own menu down to what is near them",
  );
  check(
    "🔴 the menu call sends the position it was given, on both branches",
    /const params = withCoords\(\{\}, place\);/.test(vendors) && !/WITHOUT_COORDS/.test(vendors),
    "re-measured 30 Sep 2026: the vendor filter holds with the customer's coordinates",
  );
  check(
    "🔴 the category list is asked without one",
    !/product-categories\/open[^`"]*lat=/.test(vendors),
    "3 categories without them, 0 with them — and that list decides what renders",
  );
}

section("🔴 A 404 that means distance");
{
  check(
    "🔴 out of area only when coordinates were actually sent",
    isOutOfArea(404, { lat: 1, lng: 2 }) === true &&
      isOutOfArea(404, null) === false &&
      isOutOfArea(500, { lat: 1, lng: 2 }) === false,
    "a genuinely missing id 404s with or without them",
  );
  check(
    "both screens use it rather than reporting a missing product",
    /isOutOfArea\(status, coords\)/.test(modal) && /isOutOfArea\(status, searchCoords\)/.test(page),
  );
}

section("\ud83d\udd34 A store page shows only that store's food");
{
  const TASCA = "6a6aced8f9e179566170db79";
  const OTHER = "6a7b26e8b3c691ae6e46a406";
  const menu = [
    { name: "Mutton Kachi", vendorId: TASCA },
    { name: "BBQ Pizza", vendorId: OTHER },
    { name: "Bread pasta", vendorId: { _id: OTHER } },
    { name: "Petis", vendorId: { id: TASCA } },
    { name: "Unattributed" },
  ];

  check(
    "\ud83d\udd34 another restaurant's dish is dropped, however the id is shaped",
    J(ownedBy(menu, TASCA).map((p) => p.name)) ===
      J(["Mutton Kachi", "Petis", "Unattributed"]),
    "/products/open?vendorId= answered with 30 products from five vendors on 27 Sep 2026",
  );
  check(
    "a populated vendorId reads the same as a bare one",
    productVendorId({ vendorId: TASCA }) === TASCA &&
      productVendorId({ vendorId: { _id: TASCA } }) === TASCA &&
      productVendorId({ vendorId: null }) === "" &&
      productVendorId(undefined) === "",
  );
  check(
    "\ud83d\udd34 a product that does not say whose it is is kept",
    ownedBy([{ name: "x" }], TASCA).length === 1,
    "a route that omits vendorId because it already filtered would empty the page",
  );
  check(
    "no vendor to check against leaves the list alone, and never mutates it",
    ownedBy(menu, "").length === menu.length && ownedBy(menu, null) !== menu,
  );

  const hook = vendors.slice(
    vendors.indexOf("export function useVendorProducts"),
    vendors.indexOf("export function useVendorProductCategories"),
  );
  check(
    "\ud83d\udd34 both branches end in that filter — signed in and guest alike",
    (hook.match(/return ownedBy\(\(res\.data\?\.data \?\? \[\]\) as T\[\], vendorId\);/g) || []).length === 2,
    "the signed-in branch is the one we could not test against a token",
  );
  check(
    "\ud83d\udd34 and neither returns the response unfiltered",
    !/return \(res\.data\?\.data \?\? \[\]\) as T\[\];/.test(hook),
  );
  check(
    "the count call still counts everything",
    /const total = countRes\.data\?\.meta\?\.total/.test(hook) &&
      !/ownedBy\(\(countRes/.test(hook),
    "a total narrowed to this vendor would page past its own products",
  );
}

section("The module stays pure");
{
  check(
    "no React, no fetching, no store",
    !/from "react"|useState|useMemo|apiClient|useStore/.test(module_),
    "it is asserted directly here; a hook could not be",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
