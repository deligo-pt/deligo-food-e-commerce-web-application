/**
 * verify:order-search — the orders-page search, asserted.
 *
 * Run: `pnpm verify:order-search`
 *
 * ## What this guards, in order of how badly it fails
 *
 * 1. 🔴 **That the search never reaches the network.** `GET /orders` applies any
 *    query parameter it does not recognise as a strict equality filter and
 *    returns `200` with an empty list — measured, see §1. So the obvious future
 *    refactor ("just pass the term to the API") does not degrade to unfiltered
 *    results; it erases the customer's order history from their own screen, with
 *    no error anywhere. §1 is the assertion that stops that, and it is the most
 *    valuable one in this file.
 *
 * 2. 🔑 **That the index is built once per orders list, not once per keystroke.**
 *    The whole performance claim of the feature. §13 measures it rather than
 *    reading the source for it.
 *
 * 3. **That a Portuguese customer can find their order.** Item names arrive
 *    localized, so the haystack is language-dependent and matching has to be
 *    accent-insensitive — `medio` must find `Médio`, `pao` must find `pão`.
 *
 * ## Fixture
 *
 * `fixtures/orders-search.json` — a real 53-order account in both languages,
 * **redacted to the five fields search reads** (`orderId`, `orderStatus`, the
 * vendor's business name, item names, addon names). Delivery addresses, contact
 * numbers, payout figures and every customer identifier were dropped rather
 * than committed. Counts below are derived from the fixture, never hardcoded,
 * so they stay honest if it is ever refreshed.
 */

import { register } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./order-search-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

let pass = 0;
let fail = 0;
const ok = (label, actual, expected) => {
  const good = Object.is(actual, expected);
  if (good) pass++;
  else fail++;
  if (!good) {
    console.log(`  FAIL ${label}\n    expected ${JSON.stringify(expected)}\n    actual   ${JSON.stringify(actual)}`);
  }
};
const section = (title) => console.log(title);

// ---------------------------------------------------------------------------
// The source-text checks run FIRST, deliberately, and before a single feature
// module is imported.
//
// They are the most important assertions in this file, and they must be the
// ones that can always run. Importing `apiClient` into the model — exactly the
// regression §1 exists to catch — drags in axios, cookies and the translation
// store, and blows up at import time with a module error that says nothing
// about what actually went wrong. Reading the files as text costs nothing and
// reports the real problem.
// ---------------------------------------------------------------------------

section("§1 🔴 the search must never reach the network");
// Measured against the live API on 2026-08-18:
//   GET /orders?limit=100&searchTerm=cod → 200, total 0
//   GET /orders?limit=100&foo=bar        → 200, total 0
// An unrecognised parameter is applied as a strict equality filter. It is not
// ignored and it does not error — it empties the list, which is indistinguishable
// from a customer who has never ordered anything. These assertions exist so that
// change cannot be made by accident.
const FEATURE_SOURCES = {
  "src/lib/orderSearch.ts": readFileSync(join(ROOT, "src/lib/orderSearch.ts"), "utf8"),
  "src/lib/text.ts": readFileSync(join(ROOT, "src/lib/text.ts"), "utf8"),
  "src/hooks/useOrderSearch.ts": readFileSync(join(ROOT, "src/hooks/useOrderSearch.ts"), "utf8"),
  "src/components/orders/OrderSearchBar.tsx": readFileSync(join(ROOT, "src/components/orders/OrderSearchBar.tsx"), "utf8"),
};
/** Code only — comments explain the rule and would otherwise trip it. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

for (const [file, raw] of Object.entries(FEATURE_SOURCES)) {
  const code = stripComments(raw);
  ok(`${file}: does not import apiClient`, /apiClient/.test(code), false);
  ok(`${file}: does not import axios`, /\bfrom\s+["']axios["']/.test(code), false);
  ok(`${file}: never mentions the /orders endpoint`, /["'`][^"'`]*\/orders/.test(code), false);
  ok(`${file}: sends no query parameters`, /\bparams\s*:/.test(code), false);
  ok(`${file}: no fetch or XHR`, /\bfetch\s*\(|XMLHttpRequest/.test(code), false);
  for (const param of ["searchTerm", "\\bsearch=", "\\bq="]) {
    ok(`${file}: no "${param.replace(/\\b/g, "")}" parameter`, new RegExp(param).test(code), false);
  }
}
// The page itself DOES talk to the API (that is how orders arrive), so the rule
// there is narrower: whatever it passes to `useOrders` must not be the term.
const pageCode = stripComments(readFileSync(join(ROOT, "src/components/orders/OrdersPage.tsx"), "utf8"));
ok("OrdersPage calls useOrders with no arguments", /useOrders<any>\(\)/.test(pageCode), true);
ok("OrdersPage passes the term to useOrderSearch, not to a request", /useOrderSearch\(orders,\s*searchTerm\)/.test(pageCode), true);
ok("OrdersPage builds no params object", /\bparams\s*:/.test(pageCode), false);
// And the fetch itself is still the plain one, unchanged by this feature.
const useOrdersCode = stripComments(readFileSync(join(ROOT, "src/hooks/queries/useOrders.ts"), "utf8"));
ok("useOrders still sends only limit", /params:\s*\{\s*limit:\s*100,?\s*\}/.test(useOrdersCode), true);

section("§2 the model is pure — no React, no browser, no I/O");
const modelCode = stripComments(FEATURE_SOURCES["src/lib/orderSearch.ts"]);
ok("no react import", /\bfrom\s+["']react["']/.test(modelCode), false);
ok("no use* hooks", /\buse[A-Z]\w*\s*\(/.test(modelCode), false);
ok("no window or document", /\b(window|document|localStorage)\b/.test(modelCode), false);
ok('no "use client" directive needed', /"use client"/.test(modelCode), false);

const { foldText } = await import(join(ROOT, "src/lib/text.ts"));
const { normalizeCuisine, cuisineMatches } = await import(join(ROOT, "src/lib/cuisine.ts"));
const {
  buildOrderHaystack,
  buildOrderSearchIndex,
  tokenizeSearchTerm,
  orderMatchesTokens,
  filterOrders,
} = await import(join(ROOT, "src/lib/orderSearch.ts"));
const { useOrderSearch } = await import(join(ROOT, "src/hooks/useOrderSearch.ts"));
const { harness } = await import("./react-memo-stub.mjs");
const en = (await import(join(ROOT, "src/assets/translations/en.ts"))).default;
const pt = (await import(join(ROOT, "src/assets/translations/pt.ts"))).default;

const fixture = JSON.parse(readFileSync(join(here, "fixtures/orders-search.json"), "utf8"));
const EN = fixture.en;
const PT = fixture.pt;

/** Search a list the way the page does: build the index once, then filter. */
const search = (orders, term) =>
  filterOrders(orders, buildOrderSearchIndex(orders), tokenizeSearchTerm(term));

const vendorOf = (o) => o.vendorId?.businessDetails?.businessName;
const fold = (s) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------------------------------------------------------------------------

section("§3 foldText — accents, using the real localized names");
ok("Médio", foldText("Polvo com azeitonas e batatas assadas - Médio "), "polvo com azeitonas e batatas assadas - medio");
ok("pão", foldText("Massa de pão"), "massa de pao");
ok("Salame", foldText("Salame de Chocolate - Grande"), "salame de chocolate - grande");
ok("ß has no decomposition and keeps it", foldText("Straße"), "straße");
ok("ł likewise", foldText("Łódź"), "łodz");

section("§4 foldText — order ids, punctuation and whitespace");
ok("as rendered on the card", foldText("#ORD-ZCPTS79UFJ"), "ord-zcpts79ufj");
ok("hyphen is load-bearing and kept", foldText("ORD-X").includes("-"), true);
ok("trailing space", foldText("Octopus - Medium "), "octopus - medium");
ok("double space collapses", foldText("Chocolate  Salami"), "chocolate salami");
ok("tab and newline collapse", foldText("ORD\t-\nX"), "ord - x");
ok("whitespace only", foldText("   "), "");

section("§5 foldText — never throws, whatever the API sends");
ok("null", foldText(null), "");
ok("undefined", foldText(undefined), "");
ok("array", foldText(["Médio"]), "medio");
ok("number", foldText(23), "23");
ok("object", typeof foldText({}), "string");

section("§6 the cuisine filter still behaves — foldText was lifted out of it");
// `normalizeCuisine` is now an alias. It folds two things the original did not
// (`#`, internal whitespace runs), which cannot change a match because
// `cuisineMatches` folds BOTH sides — so any extra normalization is symmetric.
const OLD_NORMALIZE = (value) =>
  String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const CUISINE_CORPUS = [
  "Sushi", "SUSHI", "sushi", "Portuguese Food", "portuguese-food", "Comida Portuguesa",
  "INDIAN FOOD", "Comida Indiana", "Barbecue", "Thai Food", "Kebab", "Italian Food",
  "  Médio  ", "pão", "Café", "Açaí", "", "   ", null, undefined, ["Sushi"], 42, "Straße",
];
ok(
  `agrees with the pre-refactor implementation on all ${CUISINE_CORPUS.length} inputs`,
  CUISINE_CORPUS.filter((v) => normalizeCuisine(v) !== OLD_NORMALIZE(v)).length,
  0,
);
ok("where it differs, matching only gets MORE forgiving", cuisineMatches(["#Sushi"], ["Sushi"]), true);
ok("...and likewise for stray whitespace", cuisineMatches(["Thai  Food"], ["Thai Food"]), true);
ok("empty selection means no filter", cuisineMatches(["Sushi"], []), true);
ok("accent-insensitive", cuisineMatches(["Comida Portuguesa"], ["comida portuguesa"]), true);
ok("non-match", cuisineMatches(["Sushi"], ["Kebab"]), false);
ok("absent field", cuisineMatches(undefined, ["Sushi"]), false);

section("§7 the haystack holds what the customer can see, and nothing else");
const cod = EN.find((o) => o.orderId === "ORD-ZCPTS79UFJ");
const haystack = buildOrderHaystack(cod);
ok("order id", haystack.includes("ord-zcpts79ufj"), true);
ok("restaurant name", haystack.includes("tasca do bairro"), true);
ok("item name", haystack.includes("shredded cod with crispy potatos and egg"), true);
ok("already folded", haystack, haystack.toLowerCase());
ok('never the string "undefined"', haystack.includes("undefined"), false);
const withAddon = EN.find((o) => (o.items ?? []).some((i) => (i.addons ?? []).length > 0));
ok("addon names are searchable", buildOrderHaystack(withAddon).includes("mini sause"), true);
ok("the variation is searchable via the name", search(EN, "kabab medium").length > 0, true);

section("§8 order ids — every way a customer types one");
ok("as rendered, with the #", search(EN, "#ORD-ZCPTS79UFJ").length, 1);
ok("bare", search(EN, "ORD-ZCPTS79UFJ").length, 1);
ok("lowercase", search(EN, "ord-zcpts79ufj").length, 1);
ok("suffix only", search(EN, "ZCPTS79UFJ").length, 1);
ok("space instead of the hyphen", search(EN, "ORD ZCPTS79UFJ").length, 1);
ok("and it is the right order", search(EN, "ZCPTS79UFJ")[0].orderId, "ORD-ZCPTS79UFJ");
ok("the shared prefix matches everything", search(EN, "ORD-").length, EN.length);
ok("an id that does not exist", search(EN, "ORD-NOTREAL99").length, 0);

section("§9 localized names — a pt customer typing without accents");
ok("medio finds Médio", search(PT, "medio").length, PT.filter((o) => (o.items ?? []).some((i) => fold(i.name).includes("medio"))).length);
ok("pao finds pão", search(PT, "pao").length > 0, true);
ok("typing the accent works too", search(PT, "pão").length, search(PT, "pao").length);
ok("cod finds nothing in pt", search(PT, "cod").length, 0);
ok("...but bacalhau does", search(PT, "bacalhau").length > 0, true);
ok("ids are language-independent", search(EN, "ZCPTS79UFJ").length, search(PT, "ZCPTS79UFJ").length);
ok("so are restaurant names", search(EN, "tasca").length, search(PT, "tasca").length);
ok("addon names are localized as well", search(PT, "molho").length, search(EN, "sause").length);

section("§10 restaurants");
for (const name of [...new Set(EN.map(vendorOf))]) {
  const token = fold(name).split(" ")[0];
  ok(`"${token}" finds exactly the ${name} orders`, search(EN, token).length, EN.filter((o) => vendorOf(o) === name).length);
}
ok("a partial word matches", search(EN, "hunt").length, EN.filter((o) => vendorOf(o) === "Food Hunter").length);

section("§11 matching model — substring, AND, no ranking");
ok("mid-word 'ctopus'", search(EN, "ctopus").length > 0, true);
ok("mid-word 'ocolate'", search(EN, "ocolate").length > 0, true);
const codOnly = search(EN, "cod").length;
ok("cod matches something", codOnly > 0, true);
ok("cod tasca narrows", search(EN, "cod tasca").length <= codOnly, true);
ok("cod leopold matches nothing", search(EN, "cod leopold").length, 0);
ok("token order is irrelevant", search(EN, "tasca cod").length, search(EN, "cod tasca").length);
ok("extra whitespace is irrelevant", search(EN, "  cod   tasca  ").length, search(EN, "cod tasca").length);
let widened = 0;
for (const term of ["cod", "cod tasca", "cod tasca crispy", "cod tasca crispy egg"]) {
  if (search(EN, term).length > codOnly) widened++;
}
ok("no term in a growing chain ever widened the result", widened, 0);
ok("matches keep their original order", search(EN, "ORD-").map((o) => o.orderId).join(), EN.map((o) => o.orderId).join());
ok("no false positive across field boundaries", search(EN, "bairroshredded").length, 0);

section("§12 the empty term filters nothing — and does it by reference");
const index = buildOrderSearchIndex(EN);
ok("empty string returns everything", filterOrders(EN, index, tokenizeSearchTerm("")).length, EN.length);
ok("...as the SAME array object", filterOrders(EN, index, tokenizeSearchTerm("")), EN);
ok("whitespace only", filterOrders(EN, index, tokenizeSearchTerm("   ")), EN);
ok('"#" alone folds to nothing', filterOrders(EN, index, tokenizeSearchTerm("#")), EN);
ok("orderMatchesTokens([]) is true", orderMatchesTokens("anything", []), true);
ok("a real term does not return the input array", filterOrders(EN, index, tokenizeSearchTerm("cod")) === EN, false);

section("§13 🔑 the index is built ONCE per list, not once per keystroke");
// Slot order in useOrderSearch: 0 useDeferredValue, 1 index, 2 tokens, 3 filter.
const INDEX_SLOT = 1;
const render = (orders, term) => {
  harness.beginRender();
  return useOrderSearch(orders, term);
};
const mount = (orders, term) => {
  harness.mount();
  return render(orders, term);
};
mount(EN, "");
for (const term of ["c", "co", "cod", "cod ", "cod t", "cod ta", "cod tas", "cod tasc", "cod tasca"]) {
  render(EN, term);
}
ok("nine keystrokes, one index", harness.runs(INDEX_SLOT), 1);
mount(EN, "cod");
render(EN, "cod"); // a refetch that returned identical data: same array reference
ok("structural sharing keeps the index", harness.runs(INDEX_SLOT), 1);
mount(EN, "cod");
render([...EN], "cod"); // genuinely new data
ok("a new list rebuilds it", harness.runs(INDEX_SLOT), 2);
const switched = mount(EN, "medio");
ok("en: medio matches nothing", switched.filter(EN).length, 0);
const beforeSwitch = render(EN, "medio").filter;
const afterSwitch = render(PT, "medio");
ok("a language switch rebuilds it", harness.runs(INDEX_SLOT), 2);
// EXACT count, not `> 0`: `filterOrders` fails OPEN, so a `filter` closed over a
// stale index returns ALL the orders — which any non-emptiness check accepts.
ok("pt: medio matches exactly the right orders", afterSwitch.filter(PT).length, PT.filter((o) => (o.items ?? []).some((i) => fold(i.name).includes("medio"))).length);
ok("...and a new index means a new filter", afterSwitch.filter !== beforeSwitch, true);

section("§14 isSearching, and one index serving both tabs");
ok("empty term", mount(EN, "").isSearching, false);
ok("whitespace only", mount(EN, "   ").isSearching, false);
ok('"#" alone', mount(EN, "#").isSearching, false);
ok("one character is a valid search", mount(EN, "k").isSearching, true);
ok("...and it matches", mount(EN, "k").filter(EN).length > 0, true);
const bothTabs = mount(EN, "tasca");
const tabA = EN.slice(0, 20);
const tabB = EN.slice(20);
const runsBefore = harness.runs(INDEX_SLOT);
const filteredA = bothTabs.filter(tabA);
const filteredB = bothTabs.filter(tabB);
ok("filtering two lists rebuilds nothing", harness.runs(INDEX_SLOT), runsBefore);
ok("first list narrowed correctly", filteredA.length, tabA.filter((o) => vendorOf(o) === "Tasca do Bairro").length);
ok("second list narrowed correctly", filteredB.length, tabB.filter((o) => vendorOf(o) === "Tasca do Bairro").length);
const idle = mount(EN, "");
ok("not searching returns each list by reference", idle.filter(tabA), tabA);
harness.mount();
render(EN, "cod");
const settledCount = render(EN, "cod").filter(EN).length;
harness.lagNextDeferral();
const lagging = render(EN, "cod tasca leopold");
ok("a lagging frame shows the previous results", lagging.filter(EN).length, settledCount);
ok("...with tokens that agree with them", lagging.tokens.length, 1);
ok("and the next frame settles", render(EN, "cod tasca leopold").filter(EN).length, 0);

section("§15 crash-safety — shapes the API is known to produce");
const SHAPES = {
  "unpopulated vendorId (a bare id string)": { orderId: "ORD-A", vendorId: "6a6aced8f9e179566170db79", items: [] },
  "no items key": { orderId: "ORD-B", vendorId: null },
  "a null item": { orderId: "ORD-C", items: [null] },
  "an item with no name": { orderId: "ORD-D", items: [{ addons: [] }] },
  "a null addon": { orderId: "ORD-E", items: [{ name: "X", addons: [null] }] },
  "vendor with only an owner name": { orderId: "ORD-F", vendorId: { name: { firstName: "Ana", lastName: "Silva" } } },
  "an empty object": {},
};
for (const [label, order] of Object.entries(SHAPES)) {
  let out;
  try {
    out = buildOrderHaystack(order);
  } catch (error) {
    out = `THREW ${error.message}`;
  }
  ok(`${label} — returns a string`, typeof out, "string");
  ok(`${label} — no "undefined" in it`, String(out).includes("undefined"), false);
  ok(`${label} — no "null" in it`, String(out).includes("null"), false);
}
ok("a null order", buildOrderHaystack(null), "");
ok("an undefined order", buildOrderHaystack(undefined), "");
ok("a bare-string vendorId contributes no id text", buildOrderHaystack(SHAPES["unpopulated vendorId (a bare id string)"]).includes("6a6aced8"), false);
ok("the owner-name fallback is searchable", buildOrderHaystack(SHAPES["vendor with only an owner name"]).includes("ana silva"), true);
ok("one index entry per order", buildOrderSearchIndex(EN).size, EN.length);
ok("duplicate order objects collapse", buildOrderSearchIndex([EN[0], EN[0]]).size, 1);
ok("an empty list", buildOrderSearchIndex([]).size, 0);
ok("an order missing from the index is INCLUDED, not hidden", filterOrders(EN, buildOrderSearchIndex([]), tokenizeSearchTerm("zzzz")).length, EN.length);

section("§16 translations");
const enKeys = new Set(Object.keys(en));
const ptKeys = new Set(Object.keys(pt));
ok("the two dictionaries are the same size", enKeys.size, ptKeys.size);
ok("nothing only in en", [...enKeys].filter((k) => !ptKeys.has(k)).join(","), "");
ok("nothing only in pt", [...ptKeys].filter((k) => !enKeys.has(k)).join(","), "");

// `keyParity.ts` proves the two dictionaries hold the same keys. It cannot
// prove that a key a component actually CALLS exists in either — and `t()`
// returns the key name on a miss, so that failure renders `noMatchingOrders`
// on screen rather than throwing. This is the only guard against it.
const sourceFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p) && !p.includes("assets/translations")) sourceFiles.push(p);
  }
})(join(ROOT, "src"));
const usedKeys = new Set();
for (const file of sourceFiles) {
  for (const m of readFileSync(file, "utf8").matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"\s*\)/g)) usedKeys.add(m[1]);
}
ok("the scan found keys at all", usedKeys.size > 500, true);
ok(
  `all ${usedKeys.size} literal t("…") keys resolve in both dictionaries`,
  [...usedKeys].filter((k) => !enKeys.has(k) || !ptKeys.has(k)).join(","),
  "",
);

const FEATURE_KEYS = [
  "searchOrdersLabel", "searchOrdersPlaceholder", "noMatchingOrders", "inHistory", "inOngoing",
  "noResultsFound", "noResultsHint", "clearSearch", "resultLabel", "resultsLabel", "ongoing", "history",
];
for (const key of FEATURE_KEYS) {
  ok(`${key} is present and non-empty in both`, en[key]?.trim().length > 0 && pt[key]?.trim().length > 0, true);
}
for (const key of ["searchOrdersLabel", "searchOrdersPlaceholder", "noMatchingOrders", "inHistory", "inOngoing"]) {
  ok(`${key} is actually translated, not copied`, en[key] !== pt[key], true);
}

// The pt strings follow the dictionary's own habits rather than a translator's
// one-off choices. Each of these has a precedent counted in the dictionary.
ok("pt uses 'Pesquisar', the dominant verb", /^Pesquisar /.test(pt.searchOrdersPlaceholder), true);
ok("pt says 'pedido', matching t('order')", /pedido/i.test(pt.searchOrdersPlaceholder) && pt.order === "Pedido", true);
ok("pt keeps 'ID' as ID (cf. 'ID de utilizador')", /\bID\b/.test(pt.searchOrdersPlaceholder), true);
ok("...and does not use 'nº', which only appears in a legal citation", /nº|n\.º/.test(pt.searchOrdersPlaceholder), false);
ok("pt is formal ('os seus'), like previousOrdersMessage", /os seus/i.test(pt.searchOrdersLabel), true);
ok("inHistory carries the tab's own name", pt.inHistory.includes(pt.history), true);

// The counts are joined to these fragments in JSX, because `t()` takes one
// argument and does not interpolate. Check the composition, not just the parts.
ok("en: 3 in History", `3 ${en.inHistory}`, "3 in History");
ok("en: 12 in Ongoing", `12 ${en.inOngoing}`, "12 in Ongoing");
ok("en: 1 result", `1 ${en.resultLabel}`, "1 result");
ok("en: 0 results", `0 ${en.resultsLabel}`, "0 results");
ok("pt: 3 no Histórico", `3 ${pt.inHistory}`, "3 no Histórico");
ok("pt: 12 em Curso", `12 ${pt.inOngoing}`, "12 em Curso");
ok("pt: 1 resultado", `1 ${pt.resultLabel}`, "1 resultado");
ok("pt: 0 resultados", `0 ${pt.resultsLabel}`, "0 resultados");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
