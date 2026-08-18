/**
 * Checks the model behind `/search` — the backend's Meilisearch-powered index.
 *
 *   pnpm verify:search
 *
 * No token, no network. Every number below was measured against
 * `api-test-food.deligo.pt` on 2026-08-18 (18 items, 7 restaurants) and is
 * pinned here so a regression names itself instead of surfacing as an empty
 * grid.
 *
 * ## The three things this is really defending
 *
 * **1. Malformed numbers must never reach the wire.** `limit=abc`, `minPrice=abc`
 * and `offset=-1` each return **HTTP 500 with the raw Meilisearch error and
 * filter expression in the body**. `buildSearchParams` is the only place a
 * request is assembled, so it is the only place that can guarantee this.
 *
 * **2. A geo filter is all-or-nothing.** A partial `lat`/`lng`/`radiusInMeters`
 * triple is *silently ignored* by the server — no error, full results. A filter
 * that quietly does nothing is worse than one that is visibly absent, and it is
 * the failure a user would never report because it looks like it worked.
 *
 * **3. `sortBy` never ships bare.** The server's undocumented default is
 * `desc`, so "sort by price" with no direction leads with the €100 burger.
 *
 * ## And one rule about what must NOT exist
 *
 * The brief for this feature is that the backend decides what comes back and in
 * what order; the client asks the right question and renders the answer. The
 * final section asserts that `src/lib/search.ts` exports nothing that filters,
 * sorts, ranks or re-prices hits — the §2 rule enforced rather than merely
 * written down. The page this replaced fetched 100 products and did all four in
 * the browser, which is why its result count, its ordering and its matching all
 * disagreed with the mobile app.
 */

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

const searchModule = await import(join(here, "../src/lib/search.ts"));
const {
  buildSearchParams,
  nextSearchOffset,
  formatCuisineLabel,
  formatRestaurantLabel,
  hasLocation,
  SEARCH_PAGE_SIZE,
  MIN_SEARCH_TERM_LENGTH,
  SEARCH_DEBOUNCE_MS,
} = searchModule;

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

/** The query string `buildSearchParams` produces for an input. */
const q = (input) => buildSearchParams(input).toString();

const eq = (name, got, want) => check(name, got === want, `${got}  (wanted ${want})`);

/** A page of results, shaped like the API's `data` envelope. */
const page = (hits, offset, total) => ({
  hits: new Array(hits).fill({ id: "x" }),
  offset,
  estimatedTotalHits: total,
  limit: 20,
  query: "",
  processingTimeMs: 0,
});

function section(title) {
  console.log(`\n${title}`);
}

section("🔴 The three HTTP 500 triggers never reach the wire");
{
  // `Number("abc")` is NaN, which `String()` would happily send as "NaN".
  eq("a non-numeric limit is dropped", q({ limit: Number("abc") }), "");
  eq("a non-numeric minPrice is dropped", q({ minPrice: Number("abc") }), "");
  eq("a non-numeric maxPrice is dropped", q({ maxPrice: Number("xyz") }), "");
  eq("a negative offset is clamped, not sent", q({ offset: -1 }), "offset=0");
  eq("a very negative offset too", q({ offset: -999 }), "offset=0");
  eq("Infinity is not a number either", q({ limit: Infinity }), "");
  eq("nor is -Infinity a price", q({ minPrice: -Infinity }), "");

  // All three at once — the exact combination that 500s when sent raw.
  eq(
    "the whole malformed set collapses to a valid query",
    q({ limit: Number("abc"), offset: -1, minPrice: Number("xyz") }),
    "offset=0",
  );
}

section("🔴 The geo triple is all-or-nothing (a partial one is silently ignored)");
{
  const full = { lat: 38.766, lng: -9.1565, radiusInMeters: 1000 };
  eq("all three together are sent", q(full), "lat=38.766&lng=-9.1565&radiusInMeters=1000");

  eq("lat alone is dropped", q({ lat: 38.766 }), "");
  eq("lng alone is dropped", q({ lng: -9.1565 }), "");
  eq("radius alone is dropped", q({ radiusInMeters: 1000 }), "");
  eq("lat+lng without a radius is dropped", q({ lat: 38.766, lng: -9.1565 }), "");
  eq("lat+radius without lng is dropped", q({ lat: 38.766, radiusInMeters: 1000 }), "");
  eq("a zero radius is not a filter", q({ ...full, radiusInMeters: 0 }), "");
  eq("nor is a negative one", q({ ...full, radiusInMeters: -5 }), "");
  eq("a NaN coordinate voids the whole triple", q({ ...full, lat: Number("abc") }), "");

  // Latitude 0 / longitude 0 are real coordinates, not "missing".
  check(
    "the null island is still a place",
    q({ lat: 0, lng: 0, radiusInMeters: 1000 }) ===
      "lat=0&lng=0&radiusInMeters=1000",
    q({ lat: 0, lng: 0, radiusInMeters: 1000 }),
  );
}

section("🔴 sortBy never ships without sortOrder (the server defaults to desc)");
{
  eq("price defaults to ascending", q({ sortBy: "price" }), "sortBy=price&sortOrder=asc");
  eq("rating defaults to descending", q({ sortBy: "rating" }), "sortBy=rating&sortOrder=desc");
  eq(
    "an explicit order wins",
    q({ sortBy: "price", sortOrder: "desc" }),
    "sortBy=price&sortOrder=desc",
  );
  eq("a bare sortOrder asks for nothing and is dropped", q({ sortOrder: "asc" }), "");

  // The visible symptom, stated so it cannot quietly return: relying on the
  // server's default made "sort by price" lead with the dearest item.
  check(
    "sorting by price never omits the direction",
    q({ sortBy: "price" }).includes("sortOrder="),
  );
}

section("Empty is not the same as absent");
{
  eq("a blank searchTerm is dropped, not sent as ''", q({ searchTerm: "   " }), "");
  eq("a term is trimmed", q({ searchTerm: "  piz " }), "searchTerm=piz");
  eq("a blank cuisine is dropped", q({ cuisine: "  " }), "");
  eq("a blank restaurantId is dropped", q({ restaurantId: "" }), "");
  eq("no input at all is an empty query", q(), "");
  eq("an empty object too", q({}), "");
}

section("Booleans: false is a real filter, undefined is not");
{
  // `isAvailable=false` returns the 3 out-of-stock items — a genuine request,
  // so the test has to be against `undefined` rather than falsiness.
  eq("isAvailable=false is sent", q({ isAvailable: false }), "isAvailable=false");
  eq("isAvailable=true is sent", q({ isAvailable: true }), "isAvailable=true");
  eq("isHalal=false is sent", q({ isHalal: false }), "isHalal=false");
  eq("undefined is not a choice", q({ isAvailable: undefined }), "");
}

section("Integers, and a stable ordering");
{
  eq("a fractional limit is floored", q({ limit: 7.9 }), "limit=7");
  eq("a fractional offset is floored", q({ offset: 12.7 }), "offset=12");
  eq("limit=0 asks for nothing and is dropped", q({ limit: 0 }), "");
  eq("a fractional radius is rounded", q({ lat: 1, lng: 2, radiusInMeters: 999.6 }), "lat=1&lng=2&radiusInMeters=1000");

  // The query string doubles as the React Query cache key, so the same input
  // must always produce the same string regardless of how it was written.
  eq(
    "key order does not depend on input order",
    q({ sortBy: "price", searchTerm: "a", limit: 5 }),
    q({ limit: 5, searchTerm: "a", sortBy: "price" }),
  );
}

section("Paging terminates");
{
  eq("more to come", nextSearchOffset(page(5, 0, 18)), 5);
  eq("mid-sequence", nextSearchOffset(page(5, 5, 18)), 10);
  eq("the last full page", nextSearchOffset(page(5, 10, 18)), 15);
  eq("the short final page ends it", nextSearchOffset(page(3, 15, 18)), null);
  eq("an empty page always ends it", nextSearchOffset(page(0, 0, 18)), null);
  eq("a single page covering everything", nextSearchOffset(page(18, 0, 18)), null);

  // Counting `hits.length` rather than the requested `limit` is what makes the
  // previous case safe: a server that over-reports the total cannot loop us.
  eq("a lying total cannot cause an infinite loop", nextSearchOffset(page(0, 0, 9999)), null);

  // Walk the real catalogue: 18 items at 5 a page.
  let offset = 0;
  let pages = 0;
  let seen = 0;
  while (offset !== null && pages < 20) {
    const size = Math.min(5, 18 - offset);
    const current = page(size, offset, 18);
    seen += size;
    pages += 1;
    offset = nextSearchOffset(current);
  }
  check("18 items at 5 a page is 4 pages, then stop", pages === 4 && seen === 18, `${pages} pages, ${seen} items`);
}

section("Restaurant labels — branchName is absent, not empty");
{
  const withBranch = { restaurantName: "Sumu's Bites", branchName: "Downtown" };
  eq("a real branch is appended", formatRestaurantLabel(withBranch), "Sumu's Bites – Downtown");
  eq("an empty branch is no branch", formatRestaurantLabel({ restaurantName: "Sumu's Bites", branchName: "" }), "Sumu's Bites");
  // 10 of 18 hits omit the field entirely, which the guide documents as `""`.
  eq("an absent branch is no branch", formatRestaurantLabel({ restaurantName: "Sumu's Bites" }), "Sumu's Bites");
  eq("a whitespace branch is no branch", formatRestaurantLabel({ restaurantName: "Sumu's Bites", branchName: "   " }), "Sumu's Bites");
  eq("a missing name does not render 'undefined'", formatRestaurantLabel({ restaurantName: "", branchName: "Downtown" }), "Downtown");
  eq("neither half is an empty string, not a crash", formatRestaurantLabel({ restaurantName: "" }), "");
}

section("Cuisine labels — uppercase in, title case out");
{
  eq("English", formatCuisineLabel("INDIAN FOOD"), "Indian Food");
  eq("Portuguese", formatCuisineLabel("COMIDA INDIANA"), "Comida Indiana");
  eq("a single word", formatCuisineLabel("SUSHI"), "Sushi");
  eq("accents survive", formatCuisineLabel("COMIDA TAILANDESA"), "Comida Tailandesa");
  eq("hyphens are word boundaries", formatCuisineLabel("TEX-MEX"), "Tex-Mex");
  eq("an apostrophe is not", formatCuisineLabel("SUMU'S"), "Sumu's");
  eq("blank in, blank out", formatCuisineLabel("   "), "");

  // Already-cased input is left alone, so this becomes a no-op the day the
  // backend sends proper case (§7 Q26) rather than something to find and remove.
  eq("already cased is untouched", formatCuisineLabel("Indian Food"), "Indian Food");
  eq("idempotent", formatCuisineLabel(formatCuisineLabel("PORTUGUESE FOOD")), "Portuguese Food");

  // "Indian Food" alone cannot prove the guard exists — title-casing it a
  // second time returns the same string, so the assertion above passes whether
  // or not the module checks. These two would be *changed* by a re-case, which
  // is what makes them evidence. (Found by mutation-testing this file: deleting
  // the guard left every other cuisine assertion green.)
  eq("an acronym inside a cased string survives", formatCuisineLabel("BBQ Ribs"), "BBQ Ribs");
  eq("a lowercase particle is not capitalised", formatCuisineLabel("Comida do Norte"), "Comida do Norte");
}

section("_geo is optional, and absence is not an error");
{
  check("a real location", hasLocation({ _geo: { lat: 38.766, lng: -9.1565 } }));
  check("the null island counts", hasLocation({ _geo: { lat: 0, lng: 0 } }));
  check("no _geo at all", !hasLocation({}));
  check("an explicitly null _geo", !hasLocation({ _geo: null }));
  check("half a coordinate is not a location", !hasLocation({ _geo: { lat: 38.766 } }));
  check("a non-numeric coordinate", !hasLocation({ _geo: { lat: "38.766", lng: -9.1565 } }));
}

section("Tuning constants match what was measured");
{
  eq("page size mirrors the API default", SEARCH_PAGE_SIZE, 20);
  // "p" alone matches 15 of the 18 items indexed — noise, not a query.
  eq("the minimum term length is the guide's", MIN_SEARCH_TERM_LENGTH, 2);
  // A warm round-trip measured ~258ms; a shorter debounce puts a second request
  // in flight before the first can land.
  eq("the debounce is the guide's upper bound", SEARCH_DEBOUNCE_MS, 300);
  check("the debounce is inside the guide's 250-300ms range", SEARCH_DEBOUNCE_MS >= 250 && SEARCH_DEBOUNCE_MS <= 300);
}

section("🔴 The module exports nothing that filters, sorts, or re-prices");
{
  // The rule this whole feature is organised around, enforced rather than
  // merely documented. A helper that reorders or drops hits belongs on the
  // server; if one appears here, the plan is wrong and should change first.
  //
  // Applied to exported *functions* only. `SEARCH_PAGE_SIZE` and
  // `SEARCH_DEBOUNCE_MS` are values, not behaviour — an earlier version of this
  // check flagged both, which said more about the check than the module.
  // `search` is likewise not a forbidden prefix: this is `search.ts`, and a
  // name starting with it is expected rather than suspicious.
  const FORBIDDEN = /^(filter|sort|rank|order|match|score|price|discount|dedup|group|reduce)/i;
  const exported = Object.keys(searchModule).filter((name) => name !== "default");
  const exportedFunctions = exported.filter(
    (name) => typeof searchModule[name] === "function",
  );
  const offenders = exportedFunctions.filter((name) => FORBIDDEN.test(name));
  check(
    "no exported function is named for filtering, sorting, ranking or pricing",
    offenders.length === 0,
    offenders.join(", "),
  );

  // Everything exported is either one of those functions or a constant. A
  // mutable exported object would be shared state, which this module has no
  // business holding.
  const nonFunctions = exported.filter(
    (name) => typeof searchModule[name] !== "function",
  );
  check(
    "every non-function export is a primitive constant",
    nonFunctions.every((name) => typeof searchModule[name] !== "object"),
    nonFunctions.filter((name) => typeof searchModule[name] === "object").join(", "),
  );

  // Names are a proxy; behaviour is the real test. Every exported function is
  // handed an array of hits and must refuse to be a list transformer.
  const hits = [
    { id: "b", price: 9, name: "B" },
    { id: "a", price: 1, name: "A" },
    { id: "c", price: 5, name: "C" },
  ];
  const returnsAList = exported.filter((name) => {
    const value = searchModule[name];
    if (typeof value !== "function") return false;
    try {
      return Array.isArray(value(hits)) || Array.isArray(value(hits, {}));
    } catch {
      return false;
    }
  });
  check(
    "no exported function turns a list of hits into another list",
    returnsAList.length === 0,
    returnsAList.join(", "),
  );

  // And the prices themselves are never touched — the backend owns the money.
  check(
    "nothing exported computes a price",
    !exported.some((name) => /price|total|sum|amount/i.test(name) && typeof searchModule[name] === "function"),
    exported.filter((name) => /price|total|sum|amount/i.test(name)).join(", "),
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
