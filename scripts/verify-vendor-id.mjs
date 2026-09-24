/**
 * Which id addresses a vendor.
 *
 *   pnpm verify:vendor-id
 *
 * No token, no network: the helpers run directly, the rest is read off source.
 *
 * ## What this defends
 *
 * On 24 Sep 2026 the customer API swapped the id every vendor route keys on.
 * `V-PIYE3122` — the business `userId` this app had put in its URLs since the
 * beginning — now answers **400 "The provided ID is invalid."** on
 * `/vendors/customer/:id`, `/vendors/nearby/open/:id`, `/products?vendorId=`,
 * `/products/open?vendorId=` and `/product-categories/open?vendorId=`. The
 * Mongo `id` answers 200 on all five. Every payload still carries both ids,
 * which is what makes the wrong one so easy to reach for: nothing is missing,
 * nothing is `undefined`, the request just fails.
 *
 * 1. **Links carry the Mongo id.** A card, a share link and a search result all
 *    point at `/vendors/<mongo id>`; `vendorHref`/`vendorRouteId` are the one
 *    place that decides, so there is nothing to keep in sync.
 * 2. **Lookups pass the Mongo id.** Nothing interpolates a `userId` into a
 *    vendor URL or a `vendorId=` parameter again — including the order page,
 *    whose store lookup was keyed on `userId` on purpose, with a comment
 *    saying so.
 * 3. **Links shared before the change still work.** They live in other
 *    people's chats. `/vendors/V-…?product=` resolves through the dish and
 *    replaces the URL, rather than reading "Vendor not found".
 */

import { register } from "node:module";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
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

/** Every .ts/.tsx under src/, as { file, code } with comments stripped. */
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      out.push({
        file: relative(root, full),
        code: stripComments(readFileSync(full, "utf8")),
      });
    }
  };
  walk(join(root, "src"));
  return out;
}

const {
  isVendorObjectId,
  isLegacyVendorUserId,
  vendorRouteId,
  vendorHref,
} = await import(join(here, "../src/lib/vendorId.ts"));

const ALL = sources();
const vendorCard = read("src/components/vendors/VendorCard.tsx");
const restaurants = read("src/components/home/RestaurantsSection.tsx");
const checkout = read("src/components/cart/CheckoutPage.tsx");
const payment = stripComments(read("src/components/payment/PaymentPage.tsx"));
const share = stripComments(read("src/lib/share.ts"));
const destination = stripComments(read("src/hooks/queries/useProductDestination.ts"));
const search = stripComments(read("src/app/(main)/search/SearchContent.tsx"));
const track = stripComments(read("src/components/orders/TrackOrder/TrackOrder.tsx"));
const vendorPage = stripComments(read("src/components/vendors/VendorDetailsPage.tsx"));
const legacy = stripComments(read("src/hooks/queries/useLegacyVendorRedirect.ts"));

const OBJECT_ID = "6a6ad9d6f9e179566170dd64"; // Sumu's Bites, on the test API
const USER_ID = "V-PIYE3122"; // …and the id that used to address it

section("Telling the two ids apart");
{
  check(
    "a 24-character hex string is the Mongo id",
    isVendorObjectId(OBJECT_ID) && isVendorObjectId(OBJECT_ID.toUpperCase()),
  );
  check(
    "nothing else is",
    !isVendorObjectId(USER_ID) &&
      !isVendorObjectId(OBJECT_ID.slice(0, 23)) &&
      !isVendorObjectId(`${OBJECT_ID}0`) &&
      !isVendorObjectId(`${OBJECT_ID.slice(0, 23)}z`) &&
      !isVendorObjectId("") &&
      !isVendorObjectId(undefined),
    "a near-miss must not be sent to a route that answers 400 on it",
  );
  check(
    "a `V-…`/`SV-…` id is the old one",
    isLegacyVendorUserId(USER_ID) &&
      isLegacyVendorUserId("SV-ABC123") &&
      isLegacyVendorUserId("v-piye3122"),
  );
  check(
    "🔴 the Mongo id is never mistaken for the old one",
    !isLegacyVendorUserId(OBJECT_ID) &&
      !isLegacyVendorUserId("V-") &&
      !isLegacyVendorUserId("") &&
      !isLegacyVendorUserId(null),
    "a current link would be sent through the redirect and never render",
  );
}

section("🔴 The id that goes in a URL");
{
  check(
    "`id` is it",
    vendorRouteId({ id: OBJECT_ID, userId: USER_ID }) === OBJECT_ID,
  );
  check(
    "`_id` when that is all there is — the open endpoint and populated documents",
    vendorRouteId({ _id: OBJECT_ID, userId: USER_ID }) === OBJECT_ID,
  );
  check(
    "🔴 never the userId, however alone it is",
    vendorRouteId({ userId: USER_ID }) === "" &&
      vendorRouteId({}) === "" &&
      vendorRouteId(null) === "" &&
      vendorRouteId(undefined) === "",
    "every vendor route answers 400 on it — a link built from it is dead",
  );
  check(
    "a vendor with no id points at the listing, not at `/vendors/undefined`",
    vendorHref({ userId: USER_ID }) === "/vendors" && vendorHref(null) === "/vendors",
    "`/vendors/undefined` reads as 'this store is gone'",
  );
  check(
    "and one with an id points at its page",
    vendorHref({ id: OBJECT_ID }) === `/vendors/${OBJECT_ID}` &&
      vendorHref({ _id: "a b" }) === "/vendors/a%20b",
  );
}

section("🔴 Nothing addresses a vendor by userId");
{
  const linkOffenders = ALL.filter(({ code }) =>
    /\/vendors\/\$\{[^}]*\buserId\b/.test(code),
  ).map(({ file }) => file);
  check(
    "🔴 no link is built from a userId",
    linkOffenders.length === 0,
    linkOffenders.join(", "),
  );

  const paramOffenders = ALL.filter(({ code }) =>
    /\bvendorId[=:]\s*\$?\{?[^,;)}\n]*\buserId\b/.test(code),
  ).map(({ file }) => file);
  check(
    "🔴 no `vendorId=` parameter is filled from a userId",
    paramOffenders.length === 0,
    "/products, /products/open and /product-categories/open all 400 on it",
  );

  check(
    "the store route is `[vendorId]`",
    existsSync(join(root, "src/app/(main)/vendors/[vendorId]/page.tsx")) &&
      !existsSync(join(root, "src/app/(main)/vendors/[userId]")),
    "the folder name is the only documentation the route has",
  );
  check(
    "the vendor card links through the helper",
    /\bhref=\{vendorHref\(vendor\)\}/.test(vendorCard),
  );
  check(
    "so does the home page's restaurant card",
    /\bhref=\{vendorHref\(vendor\)\}/.test(restaurants),
  );
  check(
    "so do the two 'add more items' links",
    /\bhref=\{vendorHref\(vendor\)\}/.test(checkout) &&
      /\bhref=\{vendorHref\(vendor\)\}/.test(payment),
  );
}

section("🔴 The share link and the search result agree with the route");
{
  check(
    "🔴 the share link carries the route id",
    /\/vendors\/\$\{encodeURIComponent\(vendorId\)\}\?product=\$\{encodeURIComponent\(productId\)\}/.test(
      share,
    ),
    "the id in a shared link is the one thing nobody can fix afterwards",
  );
  check(
    "a search hit goes straight to its store",
    /hit\.restaurantId \|\| \(await resolve\(hit\.productId\)\)\.vendorId/.test(search),
    "`restaurantId` is the Mongo id, so the tap needs no lookup in front of it",
  );
  check(
    "…and the fallback reads the id off the product's vendor, not its userId",
    /const vendorId = vendorRouteId\(vendor\);/.test(destination) &&
      !/\bvendor\?\.userId\b/.test(destination),
  );
  check(
    "the menu card shares the route's id",
    /productShareUrl\(window\.location\.origin, vendorId, product\.productId\)/.test(
      vendorPage,
    ) && /\bvendorId=\{vendorId\}/.test(vendorPage),
  );
  check(
    "a dish is still addressed by its business productId",
    /\/products\/open\/\$\{productId\}/.test(destination) &&
      /productIdFromParam\(searchParams\.get\("product"\)\)/.test(vendorPage),
    "`/products/open/<mongo id>` 404s — this half of the link did not change",
  );
}

section("🔴 Lookups that used to key on userId");
{
  check(
    "🔴 the order page looks its store up by the route id",
    /const orderVendorId = vendorRouteId\(order\?\.vendorId\);/.test(track) &&
      /useVendor<any>\(orderVendorId,/.test(track),
    "keyed on userId this 400s, and a collecting customer loses the address",
  );
  check(
    "the payment page's vendor lookup is keyed on it too",
    /apiClient\.get\(`\/vendors\/customer\/\$\{vendorId\}`\)/.test(payment),
  );
  check(
    "…and its reward-name lookup passes the same id",
    /getVendorLookupIds\(summary\.vendorId\)\.vendorId/.test(payment),
  );
}

section("🔴 A link shared before the change still works");
{
  check(
    "the store page spots an aged link",
    /const isLegacyLink = isLegacyVendorUserId\(vendorId\);/.test(vendorPage),
  );
  check(
    "🔴 …holds the vendor request back while it resolves",
    /useVendor<Vendor>\(vendorId, \{ enabled: !isLegacyLink \}\)/.test(vendorPage),
    "the request would 400 and paint 'Vendor not found' over a link that is fine",
  );
  check(
    "🔴 …and shows the skeleton rather than that error",
    /if \(loading \|\| resolvingLegacyLink\) \{/.test(vendorPage),
    "a disabled query is not 'loading', so the error branch would win the race",
  );
  check(
    "it resolves through the dish the link points at",
    /if \(productId\) return \(await resolve\(productId\)\)\.vendorId;/.test(legacy),
    "public, cached, and the only route that works for a signed-out friend",
  );
  check(
    "🔴 the corrected URL replaces the dead one",
    /router\.replace\(`\/vendors\/\$\{resolvedId\}\$\{query\}`\)/.test(legacy) &&
      !/\brouter\.push\b/.test(legacy),
    "pushed, the back button would land on the dead URL again",
  );
  check(
    "a link that cannot be resolved is not retried into a spinner",
    /\bretry: false\b/.test(legacy),
  );
  check(
    "🔴 a signed-out visitor on a bare aged link is not sent to the login page",
    /const canResolve = legacy && \(!!productId \|\| authed\);/.test(legacy) &&
      /\benabled: canResolve,/.test(legacy) &&
      /return \{ resolving: canResolve && \(isPending \|\| !!resolvedId\) \};/.test(legacy),
    "the list needs a token, and its 401 is what the app turns into a redirect to /login",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
