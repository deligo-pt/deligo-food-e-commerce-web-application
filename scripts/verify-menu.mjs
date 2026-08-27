/**
 * verify:menu — the vendor menu never hides a product, and never invents a price.
 *
 * Run: `pnpm verify:menu`
 *
 * ## What this exists to stop
 *
 * The Menu feature groups a vendor's catalogue by the menu card they built.
 * Two properties of the API make that dangerous in ways nothing else catches:
 *
 * 1. 🔴 **Menus do not cover the catalogue.** Measured 2026-08-27 across all
 *    seven live vendors: two have no menus at all, four menus across two more
 *    have no sections, and **17 of 22 products sit in no section**. A page that
 *    rendered menus *instead of* the flat list would show four of seven
 *    restaurants an empty menu. This is not bad seed data — menus are a new,
 *    optional vendor feature, so the sparse case is the permanent case.
 *
 *    The defence is that "All items" is not a menu: it is the flat product list,
 *    it is the default, and it cannot be removed by anything the API returns.
 *    §5 asserts the branch that renders it still exists.
 *
 * 2. 🔴 **The section payload's product is a stub.** It carries no `finalPrice`
 *    and no business `productId`. Anyone rendering from it directly must invent
 *    a price — the same mistake `productPricing.ts` documents, which once turned
 *    €0.60 off into "0.6% off". So the sections response is used as an *index
 *    over ids*, joined against the real products, and §1/§2 assert the join
 *    recovers exactly the fields the stub lacks.
 *
 * ## Sections
 *
 *   §1  the model is total — fuzzed, never throws, for shapes nobody has sent yet
 *   §2  the join loses nothing, and recovers what the stub lacks
 *   §3  order is copied from the array, never computed from `sortOrder`
 *   §4  availability is a caption — no clock, no conversion, unordered days OK
 *   §5  source guards: the page still has an All-items branch, and nothing
 *       in the feature re-prices or reorders
 *   §6  every key the feature renders has copy in both dictionaries
 *
 * The fixture in §2 is a real `GET /menus/open/:menuId/sections` response
 * (Leopold's "Lunch Menu", captured 2026-08-27) trimmed to the fields the model
 * reads, paired with that vendor's real product list. Note the same product
 * appears in both sections — that is live data, and it is why keys are
 * section-scoped.
 */

import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

let M, EN, PT;
try {
  M = await import(join(here, "../src/lib/menuModel.ts"));
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
  localizedText,
  menuItemProductId,
  menuItemKey,
  buildMenuView,
  menuViewProducts,
  buildAvailabilityView,
  WEEK_DAYS,
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
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ---------------------------------------------------------------------------
// §1 — the model is total
// ---------------------------------------------------------------------------
section("§1  the model is total");

/**
 * Shapes the live crawl produced, plus the ones that plausibly follow. The
 * empty-string `pt` is not hypothetical: real menus send it.
 */
const LOCALIZED_FUZZ = [
  { en: "A", pt: "B" },
  { en: "A" },
  { pt: "B" },
  { en: "A", pt: "" },
  { en: "A", pt: "   " },
  { en: null, pt: null },
  {},
  "bare string",
  "   ",
  "",
  null,
  undefined,
  42,
  [],
  { en: 1, pt: 2 },
];

let localizedTotal = true;
for (const value of LOCALIZED_FUZZ) {
  for (const lang of ["en", "pt"]) {
    try {
      if (typeof localizedText(value, lang) !== "string") localizedTotal = false;
    } catch {
      localizedTotal = false;
    }
  }
}
check("localizedText returns a string for every shape, and never throws", localizedTotal);
check("a requested language wins", localizedText({ en: "A", pt: "B" }, "pt") === "B");
check("a missing language falls back to the other", localizedText({ en: "A" }, "pt") === "A");
check(
  "an empty or whitespace value is a miss, not an answer",
  localizedText({ en: "A", pt: "" }, "pt") === "A" &&
    localizedText({ en: "A", pt: "  " }, "pt") === "A",
);
check(
  "a bare string passes through — so the backend localizing these later cannot break the page",
  localizedText("Kacchi", "pt") === "Kacchi",
);
check("nothing usable resolves to empty, never null", localizedText({}, "en") === "");

check("menuItemProductId reads a populated object", menuItemProductId({ productId: { _id: "abc" } }) === "abc");
check("…and a bare id string", menuItemProductId({ productId: "abc" }) === "abc");
check(
  "…and returns null for a deleted or absent reference",
  menuItemProductId({ productId: null }) === null &&
    menuItemProductId({}) === null &&
    menuItemProductId(null) === null &&
    menuItemProductId({ productId: { _id: "   " } }) === null,
);

let viewTotal = true;
for (const sections of [
  null,
  undefined,
  42,
  "x",
  {},
  [],
  [null],
  [{}],
  [{ items: null }],
  [{ items: [null, undefined, 42] }],
  [{ items: [{ productId: {} }] }],
  [{ _id: 5, name: 7, items: [{ productId: "  " }] }],
]) {
  try {
    if (!Array.isArray(buildMenuView(sections, [], "en"))) viewTotal = false;
  } catch {
    viewTotal = false;
  }
}
check("buildMenuView returns an array for every shape, and never throws", viewTotal);
check(
  "…including when the product list itself is empty or absent",
  buildMenuView([{ _id: "s", items: [{ productId: { _id: "x" } }] }], [], "en")[0].missingCount === 1,
);

// ---------------------------------------------------------------------------
// §2 — the join loses nothing, and recovers what the stub lacks
// ---------------------------------------------------------------------------
section("§2  the join loses nothing");

/** Real response, Leopold "Lunch Menu", 2026-08-27, trimmed to read fields. */
const LIVE_SECTIONS = [
  {
    _id: "6a8f1b55b28d8749c1894848",
    name: { en: "Kacchiii", pt: "Kacchiii" },
    description: { en: "every kacchi lover is welcome here", pt: "Todos os fãs de kacchi são bem-vindos aqui" },
    sortOrder: 0,
    items: [{ productId: { _id: "6a8c37e83af29d857a3c5ecc" }, sortOrder: 0 }],
  },
  {
    _id: "6a8eb15cb28d8749c18920d2",
    name: { en: "Pizzas", pt: "Pizzas" },
    description: { en: "Our signature wood-fired pizzas", pt: "As nossas pizzas assadas em forno a lenha" },
    sortOrder: 1,
    // The same product as the section above — live data, and the reason keys
    // are section-scoped rather than product-scoped.
    items: [{ productId: { _id: "6a8c37e83af29d857a3c5ecc" }, sortOrder: 1 }],
  },
];

/** That vendor's real `GET /products/open` list, trimmed the same way. */
const LIVE_PRODUCTS = [
  {
    _id: "6a8c37e83af29d857a3c5ecc",
    productId: "PROD-RIJUGM",
    name: "Chess Burger with Hot Chickens",
    pricing: { finalPrice: 19, currency: "€" },
  },
  {
    _id: "6a7b32d4b3c691ae6e46ad25",
    productId: "PROD-3Y2BI1",
    name: "Mango Slice",
    pricing: { finalPrice: 16.71, currency: "EUR" },
  },
];

const liveView = buildMenuView(LIVE_SECTIONS, LIVE_PRODUCTS, "en");

check("every section survives the join", liveView.length === LIVE_SECTIONS.length);
check(
  "every item resolves to a product",
  liveView.every((s, i) => s.products.length === LIVE_SECTIONS[i].items.length),
);
check("nothing is unaccounted for", liveView.every((s) => s.missingCount === 0));
check("section names are localized from the {en,pt} payload", liveView[0].name === "Kacchiii");
check(
  "🔴 the join recovers finalPrice — the field the section payload does NOT carry",
  liveView[0].products[0].pricing.finalPrice === 19,
);
check(
  "🔴 the join recovers the business productId — the other field it does NOT carry",
  liveView[0].products[0].productId === "PROD-RIJUGM",
);
check(
  "the resolved products are a subset of the flat list, never something it lacks",
  menuViewProducts(liveView).every((p) => LIVE_PRODUCTS.includes(p)),
);
check(
  "a section with no items is KEPT, not dropped — the vendor made it",
  buildMenuView([{ _id: "s", name: { en: "Dinner Items" }, items: [] }], LIVE_PRODUCTS, "en").length === 1,
);
check(
  "an unjoinable id is counted and dropped, never rendered blank",
  buildMenuView(
    [{ _id: "s", items: [{ productId: { _id: "ffffffffffffffffffffffff" } }] }],
    LIVE_PRODUCTS,
    "en",
  )[0].missingCount === 1,
);
check(
  "products are indexed by _id AND by the business productId",
  buildMenuView([{ _id: "s", items: [{ productId: "PROD-3Y2BI1" }] }], LIVE_PRODUCTS, "en")[0].products
    .length === 1,
);

const keys = liveView.flatMap((s) => s.products.map((p) => menuItemKey(s.id, p.productId)));
check(
  "🔴 keys are section-scoped, so one product in two sections is not a duplicate key",
  new Set(keys).size === keys.length && keys.length === 2,
  keys.join(" / "),
);

// ---------------------------------------------------------------------------
// §3 — order is copied, never computed
// ---------------------------------------------------------------------------
section("§3  order is copied from the array, not computed from sortOrder");

const shuffled = LIVE_SECTIONS.map((s, i) => ({ ...s, sortOrder: 99 - i }));
check(
  "reversing every sortOrder does not change the output order",
  buildMenuView(shuffled, LIVE_PRODUCTS, "en").map((s) => s.name).join() ===
    liveView.map((s) => s.name).join(),
);
const shuffledItems = [
  { ...LIVE_SECTIONS[0], items: LIVE_SECTIONS[0].items.map((it) => ({ ...it, sortOrder: 99 })) },
];
check(
  "…and the same holds for items inside a section",
  buildMenuView(shuffledItems, LIVE_PRODUCTS, "en")[0].products[0].productId === "PROD-RIJUGM",
);

// ---------------------------------------------------------------------------
// §4 — availability is a caption
// ---------------------------------------------------------------------------
section("§4  availability is a caption, not a gate");

let availTotal = true;
for (const value of [
  null, undefined, 42, "x", [], {},
  { daysOfWeek: null }, { daysOfWeek: "MON" }, { daysOfWeek: [1, 2] },
  { daysOfWeek: [{}] }, { startTime: null }, { startTime: 5, endTime: 6 },
]) {
  try {
    buildAvailabilityView(value, "Europe/Lisbon");
    buildAvailabilityView(value, null);
  } catch {
    availTotal = false;
  }
}
check("buildAvailabilityView never throws", availTotal);
check("absent availability renders nothing", buildAvailabilityView(undefined, "Europe/Lisbon") === null);
check(
  "present-but-empty renders nothing — no 'Available: —' placeholder",
  buildAvailabilityView({ daysOfWeek: [], startTime: "", endTime: "" }, "Europe/Lisbon") === null,
);

const days = (v) => v && v.days.join(",");
check(
  "🔴 daysOfWeek arrives UNORDERED and comes back in week order",
  // The exact array one live vendor sends. Printed positionally it reads as a
  // mistake; reordering a *set* into the order a week is read is presentation.
  days(buildAvailabilityView({ daysOfWeek: ["MON", "TUE", "WED", "SAT", "SUN", "THU"] }, "")) ===
    "MON,TUE,WED,THU,SAT,SUN",
);
check(
  "🔴 consecutive days are NOT collapsed into a range",
  // Was "MON-THU,SUN". A range is a computed summary of a set, and it makes the
  // reader work out whether Tuesday is included. Every selected day is listed.
  days(buildAvailabilityView({ daysOfWeek: ["MON", "TUE", "WED", "THU", "SUN"] }, "")) ===
    "MON,TUE,WED,THU,SUN",
);
check("gaps stay separate", days(buildAvailabilityView({ daysOfWeek: ["MON", "WED", "FRI"] }, "")) === "MON,WED,FRI");
check("duplicates collapse to one entry", days(buildAvailabilityView({ daysOfWeek: ["MON", "MON"] }, "")) === "MON");
check(
  "unrecognised codes are dropped, not printed",
  days(buildAvailabilityView({ daysOfWeek: ["MON", "FUNDAY"] }, "")) === "MON",
);
check(
  "all seven days is everyDay",
  buildAvailabilityView({ daysOfWeek: [...WEEK_DAYS] }, "").everyDay === true,
);
check(
  "an unknown day code cannot fake everyDay",
  buildAvailabilityView({ daysOfWeek: [...WEEK_DAYS.slice(0, 6), "FUNDAY"] }, "").everyDay === false,
);
check(
  "🔴 times pass through byte-for-byte — they are wall-clock at the restaurant",
  (() => {
    const v = buildAvailabilityView({ daysOfWeek: ["MON"], startTime: "10:00", endTime: "22:00" }, "Europe/Lisbon");
    return v.startTime === "10:00" && v.endTime === "22:00" && v.timezone === "Europe/Lisbon";
  })(),
);
check(
  "half a window is still information the vendor entered",
  !!buildAvailabilityView({ daysOfWeek: ["MON"] }, "") &&
    !!buildAvailabilityView({ startTime: "09:00" }, ""),
);

// ---------------------------------------------------------------------------
// §5 — source guards
// ---------------------------------------------------------------------------
section("§5  source guards");

const page = stripComments(read("src/components/vendors/VendorDetailsPage.tsx"));
const selector = stripComments(read("src/components/vendors/MenuSelector.tsx"));
const group = stripComments(read("src/components/vendors/MenuSectionGroup.tsx"));
const nav = stripComments(read("src/components/vendors/MenuSectionNav.tsx"));
const avail = stripComments(read("src/components/vendors/MenuAvailability.tsx"));
const model = stripComments(read("src/lib/menuModel.ts"));
const skeleton = stripComments(read("src/components/vendors/VendorDetailsSkeleton.tsx"));
const provider = stripComments(read("src/providers/QueryProvider.tsx"));
const feature = [selector, group, nav, avail, model];

check(
  "🔴 the All-items branch still renders the flat product list",
  /activeMenuId === null &&\s*\n?\s*filteredProducts\.length > 0/.test(page),
  "This is the guarantee that no product becomes unreachable. If this fails, read §1.2 of the plan before 'fixing' it.",
);
check(
  "🔴 the selector renders nothing when the vendor has no menus",
  /menus\.length === 0\) return null/.test(selector),
);
check("the category tabs belong to All items only", /activeMenuId === null && \(/.test(page));
check(
  "🔴 nothing in the feature computes a price",
  !feature.some((s) => /finalPrice\s*=|price\s*\*\s*\(1\s*-|\.discount\s*\//.test(s)),
);
check("🔴 nothing in the feature reorders backend data", !feature.some((s) => /\.sort\(/.test(s)));
check(
  "🔴 nothing in the availability path reads the clock",
  !/Date\.now|new Date|getHours/.test(avail) && !/Date\.now|new Date|getHours/.test(model),
);
check("…nor converts a time to another zone", !/Intl\.|toLocale/.test(avail));
check("keys are section-scoped in the group", /menuItemKey\(section\.id/.test(group));
check("the nav is remounted per menu rather than corrected in an effect", /key=\{activeMenuId\}/.test(page));
check("sections are fetched for the selected menu only", /useMenuSections<unknown>\(activeMenuId\)/.test(page));
check(
  "a menus failure cannot reach an error boundary",
  !/throwOnError/.test(provider) && /data: menus = \[\]/.test(page),
);
check("a menus failure shows no banner", !/menusError/.test(page));
check("the skeleton has no selector placeholder", !/MenuSelector/.test(skeleton));
check(
  "every dead end offers the catalogue back",
  (page.match(/handleSelectMenu\(null\)/g) ?? []).length >= 2,
);
check("the missing-product warning is development-only", /NODE_ENV === "production"\) return;/.test(page));

// ---------------------------------------------------------------------------
// §6 — copy
// ---------------------------------------------------------------------------
section("§6  every rendered key has copy in both dictionaries");

/**
 * `mon`…`sun` are looked up dynamically (`t(DAY_KEYS[code])`), so no grep for
 * `t("mon")` will ever find them. Listing them here is what covers them.
 */
const RENDERED_KEYS = [
  "allItems", "menu", "menuHasNoSections", "noItemsInSection", "noItemsFoundInCategory",
  "menuAvailable", "everyDay", "mon", "tue", "wed", "thu", "fri", "sat", "sun",
];
for (const key of RENDERED_KEYS) {
  check(
    `${key} has copy in both dictionaries`,
    typeof EN[key] === "string" && EN[key] && typeof PT[key] === "string" && PT[key],
    `en=${JSON.stringify(EN[key])} pt=${JSON.stringify(PT[key])}`,
  );
}
check(
  "the weekday abbreviations are pt-PT",
  [PT.mon, PT.tue, PT.wed, PT.thu, PT.fri, PT.sat, PT.sun].join(" ") === "Seg Ter Qua Qui Sex Sáb Dom",
  [PT.mon, PT.tue, PT.wed, PT.thu, PT.fri, PT.sat, PT.sun].join(" "),
);
check(
  "pt uses 'secções'/'secção' (pt-PT), not the Brazilian spelling",
  PT.menuHasNoSections.includes("secções") && PT.noItemsInSection.includes("secção"),
);
check(
  "the new copy is translated, not copied from English",
  ["allItems", "menuHasNoSections", "noItemsInSection", "menuAvailable", "everyDay"].every(
    (k) => EN[k] !== PT[k],
  ),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
