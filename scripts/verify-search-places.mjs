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

/**
 * Text between `from` and the next `;` at the start of a line's statement.
 *
 * Rules about *how* a value is built have to be asserted against the expression
 * that builds it. Matching the file at large lets a mutation keep the tell-tale
 * text and move it somewhere it does nothing — which is exactly what
 * `coords ?? null; const unused = (storedCoords ? …)` does, and what an earlier
 * version of this file missed.
 */
function expression(text, from) {
  const start = text.indexOf(from);
  if (start === -1) return "";
  const end = text.indexOf(";", start);
  return text.slice(start, end === -1 ? text.length : end + 1);
}

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
  // Asserted against the expression itself, not the file: every rule here is
  // about the order the three sources are tried in, which only means anything
  // inside the `??`/`?:` chain that does the trying.
  const placeCoords = expression(page, "const placeCoords =");

  check(
    "the saved delivery address still wins",
    /^const placeCoords =\s*coords \?\?/.test(placeCoords.replace(/\s+/g, " ")),
    "that is where the food would actually go",
  );
  check(
    "🔴 it falls back to the browser position the navbar is showing",
    /useLocationStore\(\(s\) => s\.coords\)/.test(page) &&
      /storedCoords\.latitude/.test(placeCoords) &&
      /storedCoords\.longitude/.test(placeCoords),
    "the filters' own coords only exist after the viewer presses 'Near me', so a guest would never see a place",
  );
  check(
    "🔴 and then to the address a guest chose",
    /useLocationStore\(\(s\) => s\.guestAddress\)/.test(page) &&
      /guestAddress\.latitude/.test(placeCoords) &&
      /guestAddress\.longitude/.test(placeCoords),
    "read as coordinates — a proximity endpoint cannot be given a street name",
  );
  check(
    "with neither, it is null — which is what disables the query",
    /:\s*null\)?;$/.test(placeCoords.trimEnd()),
    "an invented fallback coordinate would answer a question the viewer never asked",
  );
  check(
    "and that null is what the hook is handed",
    /useVendorSearch<Vendor>\(placeCoords, query\)/.test(page),
  );
  check(
    "the cards measure distance from the same point the query used",
    /userCoords=\{placeCoords\}/.test(page),
    "a card counting kilometres from a different origin than the search contradicts its own list",
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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
