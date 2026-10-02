/**
 * The places row on `/search` — the stores and restaurants, not the dishes.
 *
 *   pnpm verify:search-places
 *
 * No token, no network. The behaviour pinned below was measured live on
 * 20 Sep 2026 against `api-test-food.deligo.pt`:
 *
 *   GET /vendors/nearby/open?latitude=…&longitude=…&limit=20
 *     • with no `businessType` it returns **restaurants and stores together**
 *       (5 vendors near the test coordinates: 4 restaurants, 1 store)
 *     • `&searchTerm=tasca` narrows it to 1 — "Tasca do Bairro"
 *     • `&searchTerm=zzz` returns 0
 *
 * ## Why this needs a guard of its own
 *
 * The search index behind the results grid is `food_items`. It holds dishes and
 * **no vendor documents at all**, so no amount of work on `useSearch` can make
 * it answer "which restaurant is called Tasca?" — searching the name returned
 * nine of that restaurant's dishes and never the restaurant. The places row is
 * a second source answering the other half of the question, and everything that
 * can quietly break it is a property of how the two are wired together:
 *
 *   1. it is a **proximity** endpoint, so with no coordinates the row must be
 *      absent rather than empty;
 *   2. the term must reach the *wire*, not just the cache key — a places list
 *      that ignores what was typed looks like a working "nearby" row;
 *   3. the empty state belongs to both lists — showing "no results" above four
 *      matching restaurants is the failure this section's `&&` prevents.
 *
 * And the standing rule the rest of `/search` is built on holds here too: the
 * backend decides which vendors match and in what order. Nothing in this page
 * may filter, sort or rank them.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(here, "..", file), "utf8");

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

const hooks = read("src/hooks/queries/useVendors.ts");
const page = read("src/app/(main)/search/SearchContent.tsx");
const en = read("src/assets/translations/en.ts");
const pt = read("src/assets/translations/pt.ts");


/** The body of `useVendorSearch`, so a rule cannot be satisfied by a sibling hook. */
const searchHook = (() => {
  const start = hooks.indexOf("export function useVendorSearch");
  check("`useVendorSearch` exists", start !== -1, "src/hooks/queries/useVendors.ts");
  if (start === -1) return "";
  const next = hooks.indexOf("\nexport function ", start + 1);
  return hooks.slice(start, next === -1 ? hooks.length : next);
})();

section("🔴 Places come from the vendor endpoint, with the term on the wire");
{
  check(
    "the call goes to `/vendors/nearby/open`",
    /apiClient\.get\("\/vendors\/nearby\/open"/.test(searchHook),
    "the dish index holds no vendor documents — this is the only endpoint that matches a business name",
  );
  check(
    "🔴 the typed term is sent as `searchTerm`",
    /params: \{[\s\S]{0,200}searchTerm: trimmed/.test(searchHook),
    "without it the row is a plain 'nearby' list that happens to look like a result",
  );
  check(
    "the coordinates go with it",
    /latitude: coords!\.lat/.test(searchHook) && /longitude: coords!\.lng/.test(searchHook),
  );
  check(
    "the term is trimmed once, and the same value is keyed and sent",
    /const trimmed = term\.trim\(\)/.test(searchHook) &&
      /vendorKeys\.search\([\s\S]{0,140}trimmed,/.test(searchHook),
    "a key built from the raw term caches ' tasca' apart from 'tasca'",
  );
  check(
    "the response envelope is unwrapped, not rendered raw",
    /res\.data\?\.data \?\? \[\]/.test(searchHook),
  );
}

section("🔴 No coordinates, no row (and no request)");
{
  check(
    "🔴 the query is disabled without coordinates",
    /enabled:[^\n]*!!coords/.test(searchHook),
    "`/vendors/nearby/open` is a proximity endpoint first; without a point it has nothing to answer",
  );
  check(
    "🔴 and disabled without a term",
    /enabled:[^\n]*trimmed\.length > 0/.test(searchHook),
    "an empty term would list every nearby vendor under a 'results for' heading",
  );
  check(
    "the cache key carries the coordinates",
    /search: \(lang: string, lat: number \| null, lng: number \| null, term: string\)/.test(hooks),
    "moving the pin must not serve the previous neighbourhood's vendors",
  );
}

section("The row finds a location instead of demanding one");
{
  // The page used to build this chain inline, and every rule below was written
  // against that expression. Since 27 Sep 2026 the order lives in
  // `lib/customerCoords.ts`, because `/search` and the product endpoints need
  // the same position and three private copies would drift. The rules now
  // assert that the page *uses* the shared chain rather than re-deriving it.
  const coordsModule = read("src/lib/customerCoords.ts");
  const coordsHook = read("src/hooks/useCustomerCoords.ts");

  check(
    "🔴 the page takes the shared chain rather than assembling its own",
    /const sharedCoords = useCustomerCoords\(\);/.test(page) &&
      !/useLocationStore\(\(s\) => s\.guestAddress\)/.test(page),
    "three copies of this order would answer the same question differently",
  );
  check(
    "the browser position the viewer just asked for comes first",
    /const searchCoords = pickCoords\(browserCoords, sharedCoords\);/.test(page),
    "someone who pressed 'Near me' means here, not their saved address",
  );
  check(
    "🔴 the saved delivery address still wins inside that chain",
    /useActiveAddressCoords\(\)/.test(coordsHook) &&
      /pickCoords\(addressCoords, storedCoords, guestAddress\)/.test(coordsHook),
    "that is where the food would actually go",
  );
  check(
    "🔴 then the device position, then a guest's typed address",
    /useLocationStore\(\(s\) => s\.coords\)/.test(coordsHook) &&
      /useLocationStore\(\(s\) => s\.guestAddress\)/.test(coordsHook),
    "the filters' own coords only exist after 'Near me', so a guest would never see a place",
  );
  check(
    "with none of them it is null — which is what disables the query",
    /return null;/.test(coordsModule) &&
      /enabled: hasCriteria && !!searchCoords/.test(page),
    "an invented fallback coordinate would answer a question the viewer never asked",
  );
  check(
    "and that null is what the hook is handed",
    /useVendorSearch<Vendor>\(searchCoords, query\)/.test(page),
  );
  check(
    "the cards measure distance from the same point the query used",
    /userCoords=\{searchCoords\}/.test(page),
    "a card counting kilometres from a different origin than the search contradicts its own list",
  );
}

section("🔴 No location is a different state from no results");
{
  const coordsModule = read("src/lib/customerCoords.ts");
  const modal = read("src/components/vendors/ProductDetailsModal.tsx");
  const en = read("src/assets/translations/en.ts");
  const pt = read("src/assets/translations/pt.ts");

  check(
    "🔴 a customer with no position is told why, not shown 'no results'",
    /const needsLocation = hasCriteria && !searchCoords && !locationResolving;/.test(page) &&
      /\{needsLocation \? \(/.test(page) &&
      /t\("searchNeedsLocationTitle"\)/.test(page),
    "nothing was searched — calling that 'no results' blames the catalogue",
  );
  check(
    "…and offered the control that fixes it",
    /onClick=\{requestLocation\}/.test(page) && /t\("useMyLocation"\)/.test(page),
  );
  check(
    "a blocked browser gets its own sentence",
    /locationDenied && \(/.test(page) && /t\("searchLocationDeniedHint"\)/.test(page),
    "'allow location' is useless advice to someone who already refused",
  );
  check(
    "🔴 a distant 404 is not reported as a missing product",
    /export function isOutOfArea\(/.test(coordsModule) &&
      /isOutOfArea\(status, coords\)/.test(modal) &&
      /isOutOfArea\(status, searchCoords\)/.test(page),
    "the same status means 'deleted' and 'too far'; only one is worth changing your address for",
  );
  check(
    "…and it only reads that way when coordinates were actually sent",
    /status === 404 && hasCoords\(coords\)/.test(coordsModule),
    "a genuinely missing id 404s with or without them",
  );
  check(
    "every new line exists in both dictionaries",
    ["searchNeedsLocationTitle", "searchNeedsLocationHint", "searchLocationDeniedHint",
     "productOutOfAreaTitle", "productOutOfAreaHint"].every(
      (key) => new RegExp(`^\\s*${key}:`, "m").test(en) && new RegExp(`^\\s*${key}:`, "m").test(pt),
    ),
  );
}

section("🔴 Two sections, and one empty state between them");
{
  const placesHeading = page.indexOf('t("placesSectionTitle")');
  const dishesHeading = page.indexOf('t("dishesSectionTitle")');
  const grid = page.indexOf("<ResultsGrid>\n            {hits.map");

  check("the places heading is rendered", placesHeading !== -1);
  check("the dishes heading is rendered", dishesHeading !== -1);
  check(
    "🔴 places are rendered above the dish grid",
    placesHeading !== -1 && grid !== -1 && placesHeading < grid,
    "someone typing a restaurant's name wants the restaurant, not page two of its menu",
  );
  check(
    "the row is absent when there is nothing in it",
    /\{places\.length > 0 && \(\s*<section/.test(page),
    "an empty headed section reads as a broken feature",
  );
  check(
    "🔴 'no results' needs *both* lists to be empty",
    /hits\.length === 0 && places\.length === 0 \?/.test(page),
    "otherwise a name-only match printed 'No results found' directly above four matching restaurants",
  );
  check(
    "a dish-less page still shows its places",
    /: hits\.length === 0 \? null :/.test(page),
    "the branch has to fall through to nothing rather than to the empty state",
  );
  check(
    "the dishes heading appears only when there is something to tell dishes apart from",
    /\{places\.length > 0 && \(\s*<h2[^>]*>\s*\{t\("dishesSectionTitle"\)\}/.test(page),
    "a lone 'Dishes' label over the only grid on the page is noise",
  );
  check(
    "both titles exist in both languages",
    /placesSectionTitle:/.test(en) &&
      /placesSectionTitle:/.test(pt) &&
      /dishesSectionTitle:/.test(en) &&
      /dishesSectionTitle:/.test(pt),
  );
}

section("🔴 The backend still decides which places match, and in what order");
{
  // The rule the whole search page is organised around (see verify:search),
  // extended to the second list. A `.sort()` or `.filter()` here would put the
  // page back in the ranking business it was rewritten to get out of.
  check(
    "the places list is not re-sorted in the browser",
    !/places[\s\S]{0,80}\.sort\(/.test(page),
  );
  check(
    "nor re-filtered",
    !/places[\s\S]{0,80}\.filter\(/.test(page),
  );
  check(
    "nor sliced down to a client-chosen count",
    !/places\.slice\(/.test(page),
    "the request already carries a `limit`; trimming the answer again hides vendors the API chose to return",
  );
  check(
    "the page states that the index cannot answer this",
    /no vendor documents/.test(page),
    "the next person to 'simplify' this into one query needs to know why it is two",
  );
}

section("The guard is wired in");
{
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  check(
    "`verify:search-places` is a script someone can run",
    typeof scripts["verify:search-places"] === "string",
    "a guard nothing calls passes forever",
  );
}

console.log("\n🔴 One simple loader for every search wait (2 Oct 2026)");
{
  check(
    "🔴 a new term or filter shows the loader, not the previous results",
    /isFetching && !isFetchingNextPage && \(isPending \|\| isPlaceholderData\)/.test(page),
    "keepPreviousData left the old results up with nothing to say a search was running",
  );
  check(
    "🔴 a disabled query (no position) cannot spin forever",
    /\(!!searchCoords && isFetching/.test(page),
    "in React Query 5 a disabled query with no data is 'pending' for ever",
  );
  check(
    "the position settling shows the loader, not 'set your location'",
    /const searching =\s*locationResolving \|\|/.test(page) &&
      /!searchCoords && \(permissionStatus === "loading" \|\| \(authed && profileLoading\)\)/.test(page),
  );
  check(
    "it is a spinner — no skeleton grid left",
    /<LoaderCircle className="h-8 w-8 animate-spin text-primary"/.test(page) && !/animate-pulse rounded-2xl/.test(page),
  );
  const navbar = read("src/components/shared/Navbar.tsx");
  check(
    "🔴 the header search box spins while a search is out (both inputs)",
    /useIsFetching\(\{\s*queryKey: searchKeys\.all/.test(navbar) &&
      (navbar.match(/\{searchRunning \? \(/g) || []).length === 2,
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
