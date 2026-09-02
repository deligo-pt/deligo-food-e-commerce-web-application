/**
 * verify:category — every product reaches the page, and the bar only navigates.
 *
 * Run: `pnpm verify:category`
 *
 * ## What this exists to stop
 *
 * The vendor page was rebuilt on `product.category` after the backend removed
 * the menus API (`/menus/open/:vendorId`, `/menus/open/:menuId/sections` and the
 * authenticated `/menus` all answer `404 API Not Found !!` as of 2026-08-29).
 * Two rules carry the whole feature, and neither is visible in review:
 *
 * 1. 🔴 **Nothing is hidden, and nothing wears the wrong label.** The vendor's
 *    own `/product-categories/open` list decides the headings; a product filed
 *    outside it renders under a trailing "Other" group rather than under a
 *    category its vendor does not own, and rather than not at all. Both halves
 *    matter: showing a sea-food dish under `BEVERAGES` is wrong, and dropping it
 *    is the `NO_SHOW` failure shape — no error, no count, no empty state, just
 *    an item that is not there. §2 and §4 assert the group set returns exactly
 *    the products it was given, every time.
 *
 * 2. 🔴 **The bar navigates, it does not filter.** A filter here would re-create
 *    the control it replaced. §5 asserts the nav's only outward effect is a
 *    scroll.
 *
 * A third rule is inherited: order is copied from the API, never computed. It is
 * now the order `/product-categories/open?vendorId=…` returns, because the
 * schema has no `sortOrder` to sort by. §5 asserts that endpoint is requested
 * from exactly one file.
 *
 * The scale of the mismatch, measured across all seven live vendors on
 * 2026-08-29: 22 of 34 products sit outside their own vendor's list, and three
 * vendors own no category any of their products use. Those three would render
 * an empty page without the "Other" group.
 *
 * ## Sections
 *
 *   §1  the model is total — fuzzed, never throws, for shapes nobody has sent yet
 *   §2  grouping loses no product, and copies order rather than computing it
 *   §3  DOM ids are stable, safe, and collision-free
 *   §4  nothing is dropped — every product is placed, Other catches the rest
 *   §5  source guards: the nav navigates, renders nothing when useless, derives
 *       its active pill, and nothing here re-prices, sorts, or reads a clock
 *   §6  every key the feature renders has copy in both dictionaries
 *   §6b polish — the bar clears the header, the skeleton does not jump
 *   §6c the sidebar layout and the vertical card
 *   §7  the deleted menu feature left no file, import, key or script behind
 *
 * The fixture in §2 is Leopold's real `GET /products?vendorId=…` response
 * (captured 2026-08-29, authenticated) trimmed to the fields the model reads.
 * Note that `FAST FOODS` appears at index 0 and again at index 3 — that is live
 * data, and it is why grouping cannot be implemented as a scan for runs.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

let M, EN, PT;
try {
  M = await import(join(here, "../src/lib/categoryModel.ts"));
  EN = (await import(join(here, "../src/assets/translations/en.ts"))).default;
  PT = (await import(join(here, "../src/assets/translations/pt.ts"))).default;
} catch (error) {
  console.error(
    "Could not load the source modules. This needs Node 22.6+ for TypeScript\n" +
      "type stripping (23+ has it on by default).\n",
  );
  throw error;
}

const {
  groupByVendorCategories,
  productCategoryId,
  productCategoryName,
  categoryDomId,
  UNCATEGORIZED_GROUP_ID,
} = M;

let passed = 0;
let failed = 0;
const check = (name, condition, detail) => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
};
const section = (title) => console.log(`\n${title}`);

const read = (path) => readFileSync(join(ROOT, path), "utf8");
/**
 * Code only. The comments in these files describe the rules below and quote the
 * very constructs they forbid — matching against them flags the documentation
 * rather than a defect, which is how a guard teaches people to disable it.
 */
const stripComments = (src) =>
  src
    // Line comments first. A `//` line quoting a path like `/menus/*` opens a
    // block comment for the next rule, which then swallows everything up to the
    // following `*/` — several hundred lines of real code, silently, turning
    // every source guard below into a pass. Removing line comments before block
    // comments is what stops a sentence in prose from disabling the guards.
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ---------------------------------------------------------------------------
// §1 — the model is total
// ---------------------------------------------------------------------------
section("§1  the model is total");

/**
 * Shapes the live crawl produced, plus the ones that plausibly follow. `category`
 * is populated on 29 of 29 products today — every entry below the first two is
 * a shape the backend has not sent and must not be able to throw on.
 */
const PRODUCT_FUZZ = [
  { category: { _id: "6a928c8124c3ca321535f604", name: "FAST FOODS", id: "6a928c8124c3ca321535f604" } },
  { category: { _id: "6a6acafbf9e179566170d794", name: "BEVERAGES", id: "6a6acafbf9e179566170d794" } },
  { category: { id: "onlyVirtualId", name: "FOOD" } },
  { category: { name: "NAME ONLY" } },
  { category: { _id: "   ", name: "   " } },
  { category: { _id: null, name: null } },
  { category: {} },
  { category: null },
  { category: "a bare string" },
  { category: 42 },
  { category: [] },
  {},
  null,
  undefined,
  "not an object",
  0,
];

let threw = null;
for (const product of PRODUCT_FUZZ) {
  try {
    productCategoryId(product);
    productCategoryName(product);
  } catch (error) {
    threw = `${JSON.stringify(product)} → ${error.message}`;
    break;
  }
}
check("productCategoryId/Name never throw", threw === null, threw);

check(
  "productCategoryId reads _id first, then the id virtual",
  productCategoryId(PRODUCT_FUZZ[0]) === "6a928c8124c3ca321535f604" &&
    productCategoryId(PRODUCT_FUZZ[2]) === "onlyVirtualId",
);
check(
  "a category with a name and no id still groups, keyed on the name",
  productCategoryId(PRODUCT_FUZZ[3]) === "name:name only",
  String(productCategoryId(PRODUCT_FUZZ[3])),
);
check(
  "whitespace is a miss, not a key",
  productCategoryId(PRODUCT_FUZZ[4]) === null && productCategoryName(PRODUCT_FUZZ[4]) === "",
);
check(
  "an unreadable category yields null, never undefined or a throw",
  [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].every((i) => productCategoryId(PRODUCT_FUZZ[i]) === null),
);
check(
  "productCategoryName always returns a string",
  PRODUCT_FUZZ.every((p) => typeof productCategoryName(p) === "string"),
);
check(
  "the name is returned verbatim — no casing, no trimming of inner spaces",
  productCategoryName({ category: { name: "FRUITS & VEGETABLES" } }) === "FRUITS & VEGETABLES",
);

const JUNK = [null, undefined, [], "nope", 7, PRODUCT_FUZZ, [{}], [{ _id: "  " }]];
let groupThrew = null;
outer: for (const products of JUNK) {
  for (const categories of JUNK) {
    try {
      groupByVendorCategories(products, categories, "Other");
    } catch (error) {
      groupThrew = `${JSON.stringify(products)} / ${JSON.stringify(categories)} → ${error.message}`;
      break outer;
    }
  }
}
check("groupByVendorCategories never throws, for any pair", groupThrew === null, groupThrew);
check(
  "🔴 a vendor owning no categories still shows every product, under one Other group",
  groupByVendorCategories(PRODUCT_FUZZ, null, "Other").groups.length === 1 &&
    groupByVendorCategories(PRODUCT_FUZZ, [], "Other").groups[0].id === UNCATEGORIZED_GROUP_ID,
);
check(
  "…and none of them is lost on the way there",
  groupByVendorCategories(PRODUCT_FUZZ, [], "Other").groups[0].products.length ===
    PRODUCT_FUZZ.length,
);
check(
  "…and the count matches, so the migration has a metric",
  groupByVendorCategories(PRODUCT_FUZZ, [], "Other").uncategorizedCount === PRODUCT_FUZZ.length,
);

// ---------------------------------------------------------------------------
// §2 — grouping loses no product, and copies order
// ---------------------------------------------------------------------------
section("§2  the owned category list decides everything");

const FAST_FOODS = "6a928c8124c3ca321535f604";
const BEVERAGES = "6a6acafbf9e179566170d794";
const FOOD = "6a6acb3df9e179566170d7a1";
const DINNER = "6a92e5df24c3ca3215361cc5";

/** Leopold's products, verbatim order from the live response. */
const LEOPOLD = [
  { productId: "PROD-1", category: { _id: FAST_FOODS, name: "FAST FOODS", id: FAST_FOODS } },
  { productId: "PROD-2", category: { _id: BEVERAGES, name: "BEVERAGES", id: BEVERAGES } },
  { productId: "PROD-3", category: { _id: FOOD, name: "FOOD", id: FOOD } },
  { productId: "PROD-4", category: { _id: FAST_FOODS, name: "FAST FOODS", id: FAST_FOODS } },
];
/** …and what Leopold actually owns. `BEVERAGES` and `FOOD` are not on it. */
const LEOPOLD_OWNS = [{ _id: FAST_FOODS, name: "FAST FOODS", slug: "fast-foods" }];

const leopold = groupByVendorCategories(LEOPOLD, LEOPOLD_OWNS, "Other");

check(
  "🔴 a product filed outside the vendor's own categories never shows under it",
  leopold.groups.map((g) => g.name).join(" | ") === "FAST FOODS | Other",
  leopold.groups.map((g) => g.name).join(" | "),
);
check(
  "🔴 …and it is not lost either — it lands in the trailing Other group",
  leopold.groups[1].id === UNCATEGORIZED_GROUP_ID &&
    leopold.groups[1].products.map((p) => p.productId).join(",") === "PROD-2,PROD-3",
);
check(
  "the Other group is last, whatever position its products appeared in",
  leopold.groups[leopold.groups.length - 1].id === UNCATEGORIZED_GROUP_ID,
);
check(
  "uncategorizedCount matches what landed there",
  leopold.uncategorizedCount === 2,
  String(leopold.uncategorizedCount),
);
check(
  "the products that do belong keep their own group, in input order",
  leopold.groups[0].products.map((p) => p.productId).join(",") === "PROD-1,PROD-4",
);
check(
  "🔴 every product handed in comes back in exactly one group",
  leopold.groups.reduce((n, g) => n + g.products.length, 0) === LEOPOLD.length &&
    new Set(leopold.groups.flatMap((g) => g.products.map((p) => p.productId))).size ===
      LEOPOLD.length,
);

/** Tasca: three owned categories, returned newest-first by the endpoint. */
const TASCA_OWNS = [
  { _id: DINNER, name: "DINNER MENU" },
  { _id: "6a92d8ef24c3ca3215361323", name: "DESSERT" },
  { _id: "6a92d64124c3ca321536120c", name: "FAST FOOD TESTING" },
];
const TASCA = [
  { productId: "P-DESSERT", category: { _id: "6a92d8ef24c3ca3215361323", name: "DESSERT" } },
  { productId: "P-DINNER", category: { _id: DINNER, name: "DINNER MENU" } },
  { productId: "P-FFT", category: { _id: "6a92d64124c3ca321536120c", name: "FAST FOOD TESTING" } },
];
const tasca = groupByVendorCategories(TASCA, TASCA_OWNS, "Other");

check(
  "🔴 order is the category list's, not the products'",
  tasca.groups.map((g) => g.name).join(" | ") === "DINNER MENU | DESSERT | FAST FOOD TESTING",
  tasca.groups.map((g) => g.name).join(" | "),
);
check(
  "reordering the category list reorders the page",
  groupByVendorCategories(TASCA, [...TASCA_OWNS].reverse(), "Other")
    .groups.map((g) => g.name)
    .join(" | ") === "FAST FOOD TESTING | DESSERT | DINNER MENU",
);
check(
  "reordering the products does not",
  groupByVendorCategories([...TASCA].reverse(), TASCA_OWNS, "Other")
    .groups.map((g) => g.name)
    .join(" | ") === "DINNER MENU | DESSERT | FAST FOOD TESTING",
);
check(
  "nothing sorts — the model never calls .sort()",
  !/\.sort\(/.test(stripComments(read("src/lib/categoryModel.ts"))),
);

check(
  "🔴 an owned category with no products is not rendered",
  groupByVendorCategories([], TASCA_OWNS, "Other").groups.length === 0 &&
    groupByVendorCategories(
      [{ category: { _id: DINNER, name: "DINNER MENU" } }],
      TASCA_OWNS,
      "Other",
    ).groups.length === 1,
);
check(
  "the name rendered is the category list's, not the product's stale copy",
  groupByVendorCategories(
    [{ category: { _id: DINNER, name: "OLD NAME FROM THE PRODUCT" } }],
    [{ _id: DINNER, name: "DINNER MENU" }],
    "Other",
  ).groups[0].name === "DINNER MENU",
);
check(
  "a blank category name falls back to the product's, never to an empty heading",
  groupByVendorCategories(
    [{ category: { _id: DINNER, name: "DINNER MENU" } }],
    [{ _id: DINNER, name: "   " }],
    "Other",
  ).groups[0].name === "DINNER MENU",
);
check(
  "a category with no usable id is skipped — it can match nothing and anchors nothing",
  groupByVendorCategories(TASCA, [{ name: "NO ID" }, ...TASCA_OWNS], "Other").groups.length === 3,
);
check(
  "a duplicated category id yields one group, not two",
  groupByVendorCategories(TASCA, [...TASCA_OWNS, { _id: DINNER, name: "DINNER MENU" }], "Other")
    .groups.length === 3,
);
check(
  "the same product object comes back, not a copy",
  groupByVendorCategories(TASCA, TASCA_OWNS, "Other").groups[0].products[0] === TASCA[1],
);
check(
  "no group carries a count field that could drift from its array",
  tasca.groups.every((g) => !("count" in g)),
);

// ---------------------------------------------------------------------------
// §2b — the label localizes, the grouping does not
// ---------------------------------------------------------------------------
section("§2b  a language switch re-labels; it never regroups");

/**
 * The same owned list under `Accept-Language: pt`. Names differ; every `_id` is
 * byte-identical. Captured live 2026-08-29.
 */
const LEOPOLD_OWNS_PT = [{ _id: FAST_FOODS, name: "FAST FOOD" }];
const LEOPOLD_PT = [
  { productId: "PROD-1", category: { _id: FAST_FOODS, name: "FAST FOOD" } },
  { productId: "PROD-2", category: { _id: BEVERAGES, name: "BEBIDAS" } },
  { productId: "PROD-3", category: { _id: FOOD, name: "COMIDA" } },
  { productId: "PROD-4", category: { _id: FAST_FOODS, name: "FAST FOOD" } },
];
const leopoldPt = groupByVendorCategories(LEOPOLD_PT, LEOPOLD_OWNS_PT, "Outros");

check(
  "pt yields the same groups, in the same order, with the same ids",
  leopoldPt.groups.map((g) => g.id).join("|") === leopold.groups.map((g) => g.id).join("|"),
);
check(
  "pt sends exactly the same products to Other",
  leopoldPt.uncategorizedCount === leopold.uncategorizedCount,
);
check(
  "only the labels change",
  leopoldPt.groups[0].name === "FAST FOOD" && leopold.groups[0].name === "FAST FOODS",
);
check(
  "grouping keys on the id — one id spelled two ways is still one group",
  groupByVendorCategories(
    [
      { category: { _id: FOOD, name: "FOOD" } },
      { category: { _id: FOOD, name: "COMIDA" } },
    ],
    [{ _id: FOOD, name: "FOOD" }],
    "Other",
  ).groups.length === 1,
);
check(
  "every group carries a non-empty label, whatever the input",
  [LEOPOLD, LEOPOLD_PT, TASCA, PRODUCT_FUZZ].every((input) =>
    groupByVendorCategories(input, [...TASCA_OWNS, ...LEOPOLD_OWNS], "Other").groups.every(
      (g) => typeof g.name === "string" && g.name.length > 0,
    ),
  ),
);

// ---------------------------------------------------------------------------
// §3 — DOM ids
// ---------------------------------------------------------------------------
section("§3  DOM ids are stable and safe");

check(
  "a category id becomes a valid, prefixed DOM id",
  categoryDomId(FAST_FOODS) === `category-${FAST_FOODS}`,
);
check(
  "characters that are illegal in an id are replaced, not dropped",
  categoryDomId("name:fruits & vegetables") === "category-name-fruits---vegetables",
  categoryDomId("name:fruits & vegetables"),
);
check(
  "underscores are legal and survive unchanged",
  categoryDomId("a_b-c") === "category-a_b-c",
);
check(
  "categoryDomId is total",
  ["", null, undefined, 7].every((v) => typeof categoryDomId(v) === "string"),
);
check(
  "distinct live category ids never collide as DOM ids",
  new Set([FAST_FOODS, BEVERAGES, FOOD].map(categoryDomId)).size === 3,
);

// ---------------------------------------------------------------------------
// §4 — the fallback group
// ---------------------------------------------------------------------------
section("§4  nothing is dropped — everything is placed");

const MIXED = [
  { productId: "A", category: { _id: FOOD, name: "FOOD" } },
  { productId: "B", category: null },
  { productId: "C", category: { _id: BEVERAGES, name: "BEVERAGES" } },
  { productId: "D" },
  { productId: "E", category: { _id: "  ", name: "" } },
];
const OWNS_FOOD = [{ _id: FOOD, name: "FOOD" }];
const mixed = groupByVendorCategories(MIXED, OWNS_FOOD, "Other");

check(
  "the product in an owned category gets that category's heading",
  mixed.groups[0].name === "FOOD" &&
    mixed.groups[0].products.map((p) => p.productId).join(",") === "A",
);
check(
  "🔴 every other product is placed under Other, not discarded",
  mixed.groups[1].id === UNCATEGORIZED_GROUP_ID &&
    mixed.groups[1].products.map((p) => p.productId).join(",") === "B,C,D,E",
  mixed.groups.map((g) => `${g.name}:${g.products.length}`).join(" | "),
);
check(
  "🔴 no product is lost, for any input",
  [MIXED, LEOPOLD, TASCA, PRODUCT_FUZZ].every((input) => {
    const view = groupByVendorCategories(input, OWNS_FOOD, "Other");
    return view.groups.reduce((n, g) => n + g.products.length, 0) === input.length;
  }),
);
check(
  "an unreadable category and a wrong-vendor category share the one Other group",
  mixed.groups.filter((g) => g.id === UNCATEGORIZED_GROUP_ID).length === 1,
);
check(
  "the Other group keeps input order too",
  mixed.groups[1].products.map((p) => p.productId).join(",") === "B,C,D,E",
);
check(
  "uncategorizedCount is the size of that group",
  mixed.uncategorizedCount === mixed.groups[1].products.length,
);
check(
  "no Other group is emitted when every product belongs — a migrated vendor",
  groupByVendorCategories(TASCA, TASCA_OWNS, "Other").uncategorizedCount === 0 &&
    !groupByVendorCategories(TASCA, TASCA_OWNS, "Other").groups.some(
      (g) => g.id === UNCATEGORIZED_GROUP_ID,
    ),
);
check(
  "the Other label is a parameter — the model never localizes",
  groupByVendorCategories([{ category: null }], [], "Outros").groups[0].name === "Outros",
);

// ---------------------------------------------------------------------------
// §5 — source guards
// ---------------------------------------------------------------------------
section("§5  source guards");

const nav = stripComments(read("src/components/vendors/CategoryNav.tsx"));
const sidebar = stripComments(read("src/components/vendors/CategorySidebar.tsx"));
const spy = stripComments(read("src/hooks/useCategoryScrollSpy.ts"));
const group = stripComments(read("src/components/vendors/CategoryGroup.tsx"));
const page = stripComments(read("src/components/vendors/VendorDetailsPage.tsx"));
const model = stripComments(read("src/lib/categoryModel.ts"));
// Phase 2 moved this feature's controls onto the shared button. Reading it here
// means these guards assert the geometry where it is actually decided, instead
// of re-checking a copy of it at the call site.
const button = stripComments(read("src/components/ui/button.tsx"));

check(
  "neither view renders when there is nothing to navigate between",
  /if \(groups\.length < 2\) return null;/.test(nav) &&
    /if \(groups\.length < 2\) return null;/.test(sidebar),
);
check(
  "🔴 neither view filters — both only report a selection upward",
  !/on(Change|Filter)\s*[:?]/.test(nav + sidebar) &&
    /onSelect\(group\.id\)/.test(nav) &&
    /onSelect\(group\.id\)/.test(sidebar),
);
check(
  "the only scroll in the feature is the shared hook's",
  /window\.scrollTo\(/.test(spy) &&
    !/window\.scrollTo\(/.test(nav) &&
    !/window\.scrollTo\(/.test(sidebar),
);
check(
  "🔴 one scroll-spy, two views — neither owns scroll state",
  !/useCategoryScrollSpy/.test(nav) &&
    !/useCategoryScrollSpy/.test(sidebar) &&
    (page.match(/useCategoryScrollSpy\(/g) || []).length === 1,
);
check(
  "the active id is derived during render, not stored by an effect",
  /const activeId =/.test(spy) && /groups\.some\(\(group\) => group\.id === visibleId\)/.test(spy),
);
check(
  "setVisibleId is called only from the observer and the click handler",
  (spy.match(/setVisibleId\(/g) || []).length === 2,
  `${(spy.match(/setVisibleId\(/g) || []).length} call sites`,
);
check(
  "the page scroll respects prefers-reduced-motion",
  /prefersReducedMotion\(\) \? "auto" : "smooth"/.test(spy),
);
check(
  "the pill row's own horizontal scroll respects it too",
  /prefers-reduced-motion: reduce/.test(nav) && /reduce \? "auto" : "smooth"/.test(nav),
);
check(
  "headings are targeted through categoryDomId, not a hand-built id",
  /categoryDomId/.test(spy) && !/["\'`]category-\$\{/.test(spy),
);
check(
  "both views mark the current item for assistive tech",
  /aria-current=/.test(nav) && /aria-current=/.test(sidebar) &&
    /aria-label=/.test(nav) && /aria-label=/.test(sidebar),
);
check(
  "both views have a visible focus ring, from the system rather than by hand",
  // The nav pills are `<Button>`, whose base class carries the ring; the
  // sidebar row keeps bespoke markup — its label wraps, and every button size
  // has a fixed height — so it wears the shared `focus-ring` class. Neither
  // spells a ring out for itself any more.
  /<Button/.test(nav) &&
    /focus-visible:ring/.test(button) &&
    /focus-ring/.test(sidebar) &&
    !/focus-visible:ring/.test(sidebar),
);
check(
  "the model never reads a price",
  !/finalPrice|pricing|discount|price/i.test(model),
);
check(
  "nothing in the feature sorts — order is copied from the API",
  !/\.sort\(/.test(model) && !/\.sort\(/.test(nav),
);
check(
  "nothing in the feature reads a clock or formats by locale",
  !/Date\.now|new Date\(|Intl\.|toLocale/.test(model + nav),
);
check(
  "the model is pure — no React, no fetching, no translation store",
  !/from "react"|useState|apiClient|useTranslation/.test(model),
);
check(
  "nothing unwraps { en, pt } — the API already resolved the name",
  !/\.\s*en\b|\.\s*pt\b|\["en"\]|\["pt"\]/.test(model) && !/\.\s*en\b|\.\s*pt\b/.test(nav),
);
check(
  "the nav renders the group's label directly — the fallback lives in the model",
  /\{group\.name\}/.test(nav) && !/group\.name \|\|/.test(nav),
);

const sourceFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else if (/\.tsx?$/.test(entry.name)) sourceFiles.push(path);
  }
})("src");

/**
 * Phase 8 reversed decision #1: `/product-categories/open?vendorId=…` is now the
 * authority for which categories exist, in what order, under what name — and a
 * product outside that set is not rendered. It must be called exactly once, from
 * the query layer, never from a component.
 */
// A *request*, not a mention: the page names the path in its dev warning, which
// is code and would otherwise read as a second call site.
const callers = sourceFiles.filter((path) => {
  const src = stripComments(read(path));
  return /product-categories/.test(src) && /apiClient\s*\.\s*get\(/.test(src);
});
check(
  "the owned-category endpoint is requested from exactly one file",
  callers.length === 1 && callers[0] === "src/hooks/queries/useVendors.ts",
  callers.join(", "),
);
check(
  "it is the public /open variant, with the vendorId the backend requires",
  /\/product-categories\/open\?vendorId=\$\{vendorId\}/.test(
    stripComments(read("src/hooks/queries/useVendors.ts")),
  ),
);
check(
  "it asks for more than the default page of 10 — this list gates rendering",
  /limit=100/.test(stripComments(read("src/hooks/queries/useVendors.ts"))),
);
check(
  "its cache key is language-scoped, since category names are localized",
  /productCategories: \(lang: string, vendorId: string\)/.test(
    stripComments(read("src/hooks/queries/useVendors.ts")),
  ),
);
check(
  "🔴 the catalogue waits for both requests, so it cannot flash an empty page",
  /const catalogueLoading = productsLoading \|\| categoriesLoading;/.test(page) &&
    /\{catalogueLoading && \(/.test(page),
);
check(
  "🔴 products falling to Other are reported in development, never silently",
  /\[category\] \$\{uncategorizedCount\}/.test(page) &&
    /process\.env\.NODE_ENV === "production"/.test(page),
);
check(
  "the guard actually scanned the tree",
  sourceFiles.length > 100,
  `${sourceFiles.length} source files`,
);

// ---------------------------------------------------------------------------
// §6 — copy
// ---------------------------------------------------------------------------
section("§6  copy exists in both dictionaries");

const RENDERED_KEYS = ["productCategories", "otherCategory", "noProductsFound", "item", "items"];
for (const key of RENDERED_KEYS) {
  check(
    `${key} has copy in both dictionaries`,
    typeof EN[key] === "string" && EN[key] && typeof PT[key] === "string" && PT[key],
    `en=${JSON.stringify(EN[key])} pt=${JSON.stringify(PT[key])}`,
  );
}
check(
  "the new copy is translated, not copied from English",
  EN.productCategories !== PT.productCategories,
);
check(
  "the Other heading is translated, not shared between the dictionaries",
  EN.otherCategory === "Other" && PT.otherCategory === "Outros",
  `en=${JSON.stringify(EN.otherCategory)} pt=${JSON.stringify(PT.otherCategory)}`,
);
check(
  "pt uses the European spelling for the category label",
  PT.productCategories === "Categorias de produtos",
  PT.productCategories,
);

// ---------------------------------------------------------------------------
// §6b — polish: the bar clears the header, the swap does not jump
// ---------------------------------------------------------------------------
section("§6b  polish");

const css = stripComments(read("src/app/globals.css"));

/**
 * Deligo's own storage cannot go through `/_next/image`. It passes every
 * `remotePatterns` check, but `fetchExternalImage` resolves the hostname and
 * refuses any host with a private address — and on a DNS64 network
 * `storage-test.deligo.pt` answers with the NAT64 form of its own public IP
 * (`64:ff9b::335c:c553` alongside `51.92.197.83`), which Next counts as
 * private. Every product photo and banner 400s; Cloudinary, on ordinary global
 * IPv6, does not. See `OPTIMIZER_BYPASS_HOSTS`.
 */
const hosts = stripComments(read("src/lib/imageHosts.ts"));
check(
  "Deligo's own storage bypasses the image optimizer",
  /OPTIMIZER_BYPASS_HOSTS/.test(hosts) && /"\*\*\.deligo\.pt"/.test(hosts),
);
check(
  "the bypass is checked before the allowlist, so it cannot be overridden",
  hosts.indexOf("OPTIMIZER_BYPASS_HOSTS.some") < hosts.indexOf("REMOTE_IMAGE_HOSTS.some"),
);
check(
  "the host stays in remotePatterns, so an unguarded <Image> cannot throw",
  /hostname: "\*\*\.deligo\.pt"/.test(hosts),
);
check(
  "the SSRF guard is not disabled globally to work around this",
  !/dangerouslyAllowLocalIP/.test(stripComments(read("next.config.ts"))),
);
check(
  "every <Image> that can receive a backend URL asks before optimizing",
  ["src/components/home/HeroSection.tsx", "src/components/profile/editProfileFormPage.tsx"].every(
    (path) => /unoptimized=\{!isOptimizableImageHost\(/.test(stripComments(read(path))),
  ),
);
check(
  "the hero banner uses a real object-fit utility",
  /object-cover/.test(stripComments(read("src/components/home/HeroSection.tsx"))) &&
    !/object-fit/.test(stripComments(read("src/components/home/HeroSection.tsx"))),
);

check(
  "🔴 the bar sticks below the header, at a measured offset — not at top-0",
  /style=\{\{ top: headerHeight \}\}/.test(nav) &&
    /style=\{\{ top: headerHeight \+ 24 \}\}/.test(sidebar) &&
    !/sticky top-0/.test(nav + sidebar),
);
check(
  "the header height is measured, not written down as a constant",
  /new ResizeObserver/.test(spy) && /querySelectorAll\("header"\)/.test(spy),
);
check(
  "🔴 the measurement is the border box — contentRect omits the header's padding",
  /borderBoxSize/.test(spy) &&
    /getBoundingClientRect\(\)\.height/.test(spy) &&
    !/contentRect/.test(spy),
);
check(
  "the header picked is the pinned one, with a fallback that cannot yield zero",
  /position === "sticky" \|\| position === "fixed"/.test(spy) && /\?\? headers\[0\]/.test(spy),
);
check(
  "the measurement arrives through the observer callback, not an effect body",
  (spy.match(/setHeaderHeight\(/g) || []).length === 1 &&
    /observer\.observe\(header\)/.test(spy),
);
check(
  "the bar stays under the header's z-50 and over the grid",
  /z-20/.test(nav) && !/z-(3|4|5|6|7|8|9)\d/.test(nav),
);
check(
  "the click scrolls by the measured offset rather than to the raw top",
  /measureScrollOffset\(\)/.test(spy) && !/block: "start"/.test(spy),
);
check(
  "the observer band uses the same measured offset",
  /rootMargin: `-\$\{measureScrollOffset\(\)\}px/.test(spy),
);
check(
  "the pill asks the button for its size instead of restating it",
  // Before Phase 2 this read `h-10 px-4 text-sm` at the call site. The pill now
  // takes the default size and hand-types no geometry at all.
  // `px-1` survives on the sticky <nav> wrapper, which is not a control; what
  // must be gone is the pill's own h-10 / px-4 / text-sm.
  /<Button/.test(nav) &&
    !/\bh-10\b/.test(nav) &&
    !/\bpx-[345]\b/.test(nav) &&
    !/\btext-sm\b/.test(nav),
);
check(
  "…and that default size clears the touch target on a phone",
  // 44 on mobile, settling to the 40 the scale asks for once there is a
  // pointer. This row is `lg:hidden`, so in practice it is always the 44.
  /default:\s*"h-11 gap-2 px-4 sm:h-10"/.test(button),
);

check(
  "the enter animation exists and is a no-op under prefers-reduced-motion",
  // It was `.category-enter`, defined here for this page alone. Phase 6 turned
  // the same idea into `.motion-fade` and the page asks for that instead — so
  // this now asserts the shared primitive, and that no page-local copy of it
  // has come back.
  /\.motion-fade \{/.test(css) &&
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.motion-fade \{\s*animation: none;/.test(css) &&
    !/category-enter/.test(css),
);
check(
  "reduced motion is scoped, not a blanket reset that would freeze the loaders",
  !/\*,\s*::before,\s*::after\s*\{[^}]*animation-duration/.test(css),
);
check(
  "🔴 the grouped catalogue animates the frame where the skeleton becomes content",
  // Was `/className="motion-fade"/` on the page — a spelling, not a claim, and
  // it broke the moment browser round 6 moved the arrival off the wrapper and
  // onto the cards. What it is *for* is that the catalogue does not hard-swap
  // in; where the animation lives is the design's business, not this guard's.
  //
  // So: something animates the arrival, and it is not both at once. A wrapper
  // that fades while its children stagger inside it pays for one arrival twice.
  (() => {
    const wrapperFades = /className="motion-fade"/.test(page);
    const cardsStagger = /\breveal-group\b/.test(group);
    return (wrapperFades || cardsStagger) && !(wrapperFades && cardsStagger);
  })(),
  "the catalogue must fade as a block or stagger as cards — one of the two",
);
/**
 * Rewritten in Plan.md Phase 11. Both of these pinned the literal values —
 * `mb-10 last:mb-0` and `gap-5` — which is precisely what the spacing sweep
 * moved, in *both* files, together. The pair never drifted; the guard just
 * knew one number.
 *
 * So they assert the fact they are named for instead: the skeleton's group
 * wrapper and grid are *the same string* as the real one, read out of the two
 * sources and compared to each other. That survives the next value change,
 * and it is the only thing a drift check should ever have been asserting.
 */
const groupWrapper = /className="(mb-\d+ last:mb-0)"/;
/**
 * 🔴 The grid's **geometry**, wherever it sits in the class list.
 *
 * This used to anchor to the start of the attribute, which made it a check on
 * the whole string rather than on the layout — and browser round 6 broke it by
 * adding `reveal-group`, a class with no geometry at all, to the real grid. The
 * skeleton and the content had not drifted by a single pixel; the guard just
 * could not tell a layout change from a class being prepended.
 *
 * The claim is that the skeleton is shaped like the content. So the geometry is
 * captured out of both and compared to each other, and whatever else either
 * carries is checked separately for not being layout — see below.
 */
const groupGrid = /className="(?:[^"]*\s)?(mt-\d+ grid gap-\d+ md:grid-cols-2 xl:grid-cols-3)"/;
/** Anything on the grid that is not the geometry above. */
const gridExtras = (src) => {
  const whole = /className="([^"]*\bgrid\b[^"]*xl:grid-cols-3)"/.exec(src)?.[1];
  const geometry = src.match(groupGrid)?.[1];
  if (!whole || !geometry) return null;
  return whole.replace(geometry, "").trim();
};
check(
  "🔴 the skeleton is shaped like the content — headings and grid, same classes",
  groupWrapper.test(page) &&
    /flex items-baseline justify-between gap-4/.test(page) &&
    groupGrid.test(page),
);
check(
  "the skeleton grid's geometry matches the real one exactly",
  (() => {
    const a = page.match(groupGrid);
    const b = group.match(groupGrid);
    const wa = page.match(groupWrapper);
    const wb = group.match(groupWrapper);
    return !!a && !!b && !!wa && !!wb && a[1] === b[1] && wa[1] === wb[1];
  })(),
  "the skeleton and CategoryGroup must state the same wrapper and grid geometry",
);
check(
  "…and whatever else either grid carries is not layout",
  // The half the looser regex above gives up, bought back explicitly. A second
  // spacing or sizing utility hiding in front of the geometry would shift one
  // grid and not the other, and the comparison would still pass.
  (() => {
    const LAYOUT = /(?:^|\s)(?:[pm][trblxy]?-\d|gap-\d|grid-cols-|w-\d|h-\d|space-[xy]-\d)/;
    return [page, group].every((src) => {
      const extras = gridExtras(src);
      return extras !== null && !LAYOUT.test(extras);
    });
  })(),
  `page extras: "${gridExtras(page)}" | group extras: "${gridExtras(group)}"`,
);
check(
  "the skeleton is hidden from assistive tech",
  /aria-hidden/.test(page),
);

// ---------------------------------------------------------------------------
// §6c — the sidebar layout and the vertical card
// ---------------------------------------------------------------------------
section("§6c  sidebar layout");

check(
  "the two views are exclusive — sidebar from lg, pill row below it",
  /\bhidden\b/.test(sidebar) && /\blg:block\b/.test(sidebar) && /\blg:hidden\b/.test(nav),
);
check(
  "🔴 the hidden pill row measures 0, so one scroll formula serves both widths",
  /overlayRef\?\.current\?\.offsetHeight \?\? 0/.test(spy) && /ref=\{navRef\}/.test(page),
);
check(
  "the sidebar count is the rendered array's length, not a stored number",
  /count: group\.products\.length/.test(page) && !/count:\s*\d/.test(page),
);
check(
  "the Other heading is cased like the data — uppercase in every view",
  /uppercase/.test(sidebar) && /uppercase/.test(group) && /uppercase/.test(nav),
);
check(
  "…done in CSS, so the dictionaries keep natural copy",
  EN.otherCategory === "Other" && PT.otherCategory === "Outros",
);
check(
  "the sidebar shows counts, like the reference",
  /\(\{group\.count\}\)/.test(sidebar),
);
check(
  "the grid column cannot be pushed wider than its track by a long name",
  /min-w-0 flex-1/.test(page),
);
check(
  "the card is vertical — image above the text, not beside it",
  /flex h-full flex-col/.test(page) && /aspect-4\/3 w-full/.test(page),
);
check(
  "cards in a row share a height, so their prices line up",
  /flex flex-1 flex-col p-4/.test(page),
);
check(
  "the card still renders backend money verbatim",
  /formatPrice\(finalPrice, currency\)/.test(page) &&
    /formatPrice\(originalPrice, currency\)/.test(page),
);
check(
  "the add button clears the touch target, through the icon size",
  // Was a hand-typed `size-10 … bg-pink-600`. It is now `size="icon"`, which is
  // 44 on a phone and 40 with a pointer, and paints `--primary` rather than a
  // Tailwind pink that was never the brand.
  // The remaining `bg-pink-600` in this file is the discount badge, which is a
  // label, not a control — it belongs to the Phase 4 hex sweep.
  /size="icon"/.test(page) &&
    /icon:\s*"size-11 sm:size-10"/.test(button) &&
    !/size-10 shrink-0[^"]*bg-pink-600/.test(page),
);
check(
  "the card image asks before optimizing, via SafeImage",
  /<SafeImage/.test(page) && !/<Image/.test(page),
);

// ---------------------------------------------------------------------------
// §7 — the menu feature is gone, wholly
// ---------------------------------------------------------------------------
section("§7  the menu feature left nothing behind");

/**
 * A half-deleted feature is worse than either state: dead components that still
 * compile, keys nothing renders, a hook nobody calls. Each survives review
 * because nothing points at it, and each is read as live code by the next
 * person to open the directory.
 */
const REMOVED_FILES = [
  "src/lib/menuModel.ts",
  "src/hooks/queries/useVendorMenus.ts",
  "src/components/vendors/MenuSelector.tsx",
  "src/components/vendors/MenuSectionGroup.tsx",
  "src/components/vendors/MenuAvailability.tsx",
  "src/components/vendors/MenuSectionNav.tsx",
  "scripts/verify-menu.mjs",
];
for (const path of REMOVED_FILES) {
  check(`${path} is gone`, !existsSync(join(ROOT, path)));
}

check(
  "nothing in src imports the deleted modules",
  sourceFiles.filter((path) =>
    /menuModel|useVendorMenus|MenuSelector|MenuSectionGroup|MenuAvailability|MenuSectionNav/.test(
      stripComments(read(path)),
    ),
  ).length === 0,
  sourceFiles
    .filter((path) =>
      /menuModel|useVendorMenus|MenuSelector|MenuSectionGroup|MenuAvailability|MenuSectionNav/.test(
        stripComments(read(path)),
      ),
    )
    .join(", "),
);

/**
 * Keys that existed only for the menu feature. `menu` is on this list against
 * the plan, which assumed it was used elsewhere: `t("menu")` appeared in exactly
 * one file, the deleted selector. (`aria-haspopup="menu"` in `Navbar` is an ARIA
 * value, not a lookup.)
 */
const REMOVED_KEYS = [
  "menu", "menuHasNoSections", "noItemsInSection", "menuAvailable", "everyDay",
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
];
check(
  "the menu-only copy is gone from BOTH dictionaries",
  REMOVED_KEYS.every((key) => !(key in EN) && !(key in PT)),
  REMOVED_KEYS.filter((key) => key in EN || key in PT).join(", "),
);
check(
  "the keys the category feature still renders survived the cull",
  ["item", "items", "productCategories", "otherCategory", "noProductsFound"].every(
    (key) => key in EN && key in PT,
  ),
);
check(
  "verify:menu is unwired from package.json",
  !/verify:menu/.test(read("package.json")) && /verify:category/.test(read("package.json")),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
