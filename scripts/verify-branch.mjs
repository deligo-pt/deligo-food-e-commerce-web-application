/**
 * Branches (sub-vendors, `SV-…`) on the customer site.
 *
 *   pnpm verify:branch            the checks
 *   pnpm verify:branch --mutate   prove each check catches its breakage
 *
 * No token, no network.
 *
 * ## The bug this locks shut
 *
 * Branches appear in the customer vendor lists beside their parent, usually
 * under the same `businessName` — the Dhaka home page showed three cards all
 * reading "Tasca do Bairro". A branch is called by its own `branchName`
 * (exactly as stored, decided 30 Sep 2026) on every surface — cards, store
 * page, cart, checkout, payment, orders — a main store keeps its business name,
 * and a branch whose name is unknown carries a "Branch" tag.
 *
 * Every failure here is silent: a card that loses its branch name still
 * renders, and looks exactly like its neighbour; a branch addressed by its
 * `SV-…` userId is not refused by `/products`, it just drops the filter and
 * answers with other stores' food.
 *
 * ## `--mutate`
 *
 * A check that cannot fail is decoration. `--mutate` replays each known
 * breakage against an in-memory copy of the source — nothing on disk is
 * touched — and asserts that the check written for it now FAILS. A breakage
 * that every check survives fails the run. The pure module (`vendorName.ts`,
 * which imports nothing) is mutated by importing an edited copy from a temp
 * directory.
 *
 * The fixtures are the live values measured on 30 Sep 2026.
 */

import { register } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const src = (...parts) => join(here, "..", "src", ...parts);
const readDisk = (file) => readFileSync(file, "utf8");
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const realNames = await import(src("lib/vendorName.ts"));
const { vendorRouteId, vendorHref } = await import(src("lib/vendorId.ts"));
const en = await import(src("assets/translations/en.ts"));
const pt = await import(src("assets/translations/pt.ts"));
const EN = en.default ?? en;
const PT = pt.default ?? pt;

const J = JSON.stringify;

// As the list endpoints send them: no `role`, no `branchName`.
const TASCA_MAIN = { userId: "V-IN0AMES9", businessDetails: { businessName: "Tasca do Bairro" } };
const BASHUNDHARA_ROW = {
  userId: "SV-BJQPVEMB",
  businessDetails: { businessName: "Tasca do Bairro" },
};
// As `/vendors/customer/:id` sends them.
const BASHUNDHARA_RECORD = {
  userId: "SV-BJQPVEMB",
  businessDetails: {
    businessName: "Tasca do Bairro",
    branchName: "Tasca do Bairro Bashundhara",
  },
};
const MAIN_RECORD = {
  userId: "V-IN0AMES9",
  businessDetails: { businessName: "Tasca do Bairro", branchName: "" },
};

/**
 * Every check, against whatever `read` and `names` it is handed — the real
 * files and module normally, a mutated copy under `--mutate`. Returns each
 * check's name and result; prints only when asked.
 */
function runChecks({ read, names, print }) {
  const { isBranchVendor, getBranchName, getVendorCardTitle, getVendorDisplayName } = names;
  const code = (file) => stripComments(read(src(file)));
  const results = [];

  const check = (name, condition, detail) => {
    results.push({ name, ok: !!condition });
    if (!print) return;
    console.log(
      condition
        ? `  PASS  ${name}`
        : `  FAIL  ${name}${detail === undefined ? "" : `  → ${detail}`}`,
    );
  };
  const section = (title) => print && console.log(`\n${title}`);

  section("Which vendors are branches");
  {
    check("an SV- userId is a branch", isBranchVendor(BASHUNDHARA_ROW) === true);
    check("a V- userId is a main store", isBranchVendor(TASCA_MAIN) === false);
    check(
      "role decides when the payload carries it",
      isBranchVendor({ role: "SUB_VENDOR", userId: "V-X" }) === true &&
        isBranchVendor({ role: "VENDOR", userId: "SV-X" }) === false,
    );
    check(
      "🔴 a record that says neither is a main store",
      isBranchVendor({}) === false && isBranchVendor(null) === false,
      "a main store called a branch fires a lookup and can grow a tag",
    );
  }

  section("🔴 What a card is titled");
  {
    check(
      "a main store keeps its business name — even with branchName \"\"",
      J(getVendorCardTitle(TASCA_MAIN)) === J({ title: "Tasca do Bairro", branchTag: false }) &&
        J(getVendorCardTitle(MAIN_RECORD)) === J({ title: "Tasca do Bairro", branchTag: false }),
    );
    check(
      "🔴 a branch shows the complete branchName, exactly as stored",
      getVendorCardTitle(BASHUNDHARA_RECORD).title === "Tasca do Bairro Bashundhara" &&
        getVendorCardTitle({
          userId: "SV-Q",
          businessDetails: { businessName: "Apex", branchName: "Lisboa" },
        }).title === "Lisboa",
      "decided 30 Sep 2026: no joining with the brand, no trimming",
    );
    check(
      "🔴 a list row without branchName takes the fetched one",
      J(getVendorCardTitle(BASHUNDHARA_ROW, "Tasca do Bairro Bashundhara")) ===
        J({ title: "Tasca do Bairro Bashundhara", branchTag: false }),
      "the lists omit branchName as of 30 Sep 2026",
    );
    check(
      "the row's own branchName wins over a fetched one",
      getVendorCardTitle(BASHUNDHARA_RECORD, "stale").title === "Tasca do Bairro Bashundhara",
    );
    check(
      "🔴 a branch with no known name keeps the brand AND the tag",
      J(getVendorCardTitle(BASHUNDHARA_ROW)) === J({ title: "Tasca do Bairro", branchTag: true }) &&
        J(getVendorCardTitle(BASHUNDHARA_ROW, "   ")) ===
          J({ title: "Tasca do Bairro", branchTag: true }),
      "without the tag it reads exactly like its parent's card",
    );
    check(
      "a blank branchName is no name, never a blank label",
      getBranchName({ businessDetails: { branchName: "  " } }) === null &&
        getBranchName(null) === null,
    );
    check(
      "🔴 the three Tasca cards no longer read the same",
      new Set([
        getVendorCardTitle(TASCA_MAIN).title,
        getVendorCardTitle(BASHUNDHARA_ROW, "Tasca do Bairro Bashundhara").title,
        getVendorCardTitle(
          { userId: "SV-A0V2NRD9", businessDetails: { businessName: "Tasca do Bairro" } },
          "Tasca do Bairro Gulshan",
        ).title,
      ]).size === 3,
    );
  }

  section("The tag reads in both languages");
  {
    check(
      "en and pt both carry branchTag",
      !!EN.branchTag && !!PT.branchTag && EN.branchTag !== PT.branchTag,
    );
  }

  section("🔴 Every vendor card is titled through the hook");
  {
    const hook = code("hooks/useVendorCardTitle.ts");
    check(
      "🔴 only a branch without a name — or a row that cannot say — looks itself up",
      /const kindUnknown = !vendor\?\.userId && !vendor\?\.role;/.test(hook) &&
        /!!routeId && !getBranchName\(vendor\) && \(kindUnknown \|\| isBranchVendor\(vendor\)\)/.test(hook) &&
        /useVendor<[^>]+>\(routeId, \{\s*enabled: needsLookup,/.test(hook),
      "a main store must cost nothing, and the lookups must stop once the lists send branchName",
    );
    check(
      "a record from another vendor is never read",
      /vendorRouteId\(data\) === routeId/.test(hook),
      "useVendor keeps the previous answer on screen while a new key loads",
    );

    for (const [label, file] of [
      ["the /vendors grid and search places (VendorCard)", "components/vendors/VendorCard.tsx"],
      ["the home \"Near You\" cards (RestaurantsSection)", "components/home/RestaurantsSection.tsx"],
    ]) {
      const card = code(file);
      check(
        `🔴 ${label}`,
        /const cardTitle = useVendorCardTitle\(vendor\);/.test(card) &&
          /\{cardTitle\.title\}/.test(card) &&
          /alt=\{cardTitle\.title\}/.test(card) &&
          /cardTitle\.branchTag &&/.test(card) &&
          !/vendor\.businessDetails\??\.businessName/.test(card),
        "a card reading businessName directly shows every branch as its parent",
      );
    }
  }

  section("🔴 A branch is addressed by its object id, never its SV- userId");
  {
    check(
      "🔴 the route id is the object id — a userId alone gives none",
      vendorRouteId({ id: "6ab556c55d063aa0323b9f72", userId: "SV-BJQPVEMB" }) ===
        "6ab556c55d063aa0323b9f72" &&
        vendorRouteId({ _id: "6ab556c55d063aa0323b9f72" }) === "6ab556c55d063aa0323b9f72" &&
        vendorRouteId({ userId: "SV-BJQPVEMB" }) === "" &&
        vendorHref({ userId: "SV-BJQPVEMB" }) === "/vendors",
      "measured 29 Sep 2026: /products/open?vendorId=SV-… drops the filter and answers with 46 other dishes",
    );
    for (const [label, file] of [
      ["VendorCard", "components/vendors/VendorCard.tsx"],
      ["RestaurantsSection", "components/home/RestaurantsSection.tsx"],
    ]) {
      const card = code(file);
      check(
        `🔴 ${label} links by vendorHref, never a userId`,
        /href=\{vendorHref\(vendor\)\}/.test(card) && !/href=\{[^}]*userId/.test(card),
      );
    }
    const hook = code("hooks/useVendorCardTitle.ts");
    check(
      "🔴 the name lookup is keyed on the route id",
      /const routeId = vendorRouteId\(vendor\);/.test(hook) &&
        !/useVendor<[^>]+>\((?!routeId)/.test(hook),
      "`/vendors/customer/SV-…` answers 400; a lookup by userId would tag every branch forever",
    );
    const touched = [
      "hooks/queries/useVendors.ts",
      "hooks/useVendorCardTitle.ts",
      "components/vendors/VendorDetailsPage.tsx",
      "components/vendors/ProductDetailsModal.tsx",
      "components/vendors/VendorCard.tsx",
      "components/home/RestaurantsSection.tsx",
      "components/cart/CartStoreCard.tsx",
      "components/cart/CartPage.tsx",
      "components/cart/CheckoutPage.tsx",
      "components/payment/PaymentPage.tsx",
      "components/orders/OrderCard.tsx",
      "components/orders/TrackOrder/TrackOrder.tsx",
    ];
    const offenders = touched.filter((file) =>
      /(\/vendors\/[^`"]*|vendorId=)\$\{[^}]*userId[^}]*\}/.test(code(file)),
    );
    check(
      "🔴 no vendor or product request is built from a userId",
      offenders.length === 0,
      `found in: ${offenders.join(", ")}`,
    );
  }

  section("🔴 The store page and \"More info\" call it the same thing");
  {
    const page = code("components/vendors/VendorDetailsPage.tsx");
    const modal = code("components/vendors/VendorDetailsModal.tsx");
    check(
      "🔴 the store page titles, alts and shares through the rule",
      /const storeTitle = getVendorCardTitle\(vendor\);/.test(page) &&
        /\{storeTitle\.title\}\s*<\/h1>/.test(page) &&
        /alt=\{storeTitle\.title\}/.test(page) &&
        /const storeName = storeTitle\.title \|\| undefined;/.test(page) &&
        /storeTitle\.branchTag &&/.test(page) &&
        !/vendor\.businessDetails\.businessName/.test(page),
      "a hero reading businessName calls every branch by its parent's name",
    );
    check(
      "🔴 \"More info\" titles, pins and shares through the rule",
      /const storeTitle = getVendorCardTitle\(vendorData\)\.title;/.test(modal) &&
        (modal.match(/\{storeTitle \|\| t\("vendor"\)\}/g) || []).length === 2 &&
        /const shareTitle = storeTitle \? `\$\{storeTitle\} – DeliGo`/.test(modal),
    );
    check(
      "🔴 …but the legal-entity row stays the business name",
      /t\("legalEntityName"\)[\s\S]{0,300}vendorData\?\.businessDetails\?\.businessName/.test(modal) &&
        (modal.match(/businessDetails\?\.businessName/g) || []).length === 1,
      "a branch's legal entity is the business — \"Tasca do Bairro Bashundhara\" is not a company",
    );
  }

  section("🔴 Every dish the menu lists can open");
  {
    const page = code("components/vendors/VendorDetailsPage.tsx");
    const modal = code("components/vendors/ProductDetailsModal.tsx");
    check(
      "🔴 the store page hands the modal its own position",
      /<ProductDetailsModal[\s\S]{0,200}storeCoords=\{vendorCoords\(vendor\)\}/.test(page),
      "measured 30 Sep 2026: a guest with no location saw 19 of 19 branch dishes fail with a 400",
    );
    check(
      "🔴 …used only when the customer has none",
      /const askFrom = hasCoords\(coords\) \? coords : hasCoords\(storeCoords\) \? storeCoords : null;/.test(modal),
      "asking from the store while the customer HAS a position would hide \"not available in your area\"",
    );
    check(
      "🔴 out of area is still judged on the customer's position",
      /isOutOfArea\(status, coords\)/.test(modal) && !/isOutOfArea\(status, askFrom\)/.test(modal),
      "a 404 from the store's own pin means the dish is gone, not far",
    );
  }

  section("🔴 Cart, checkout, payment and orders name the branch too");
  {
    check(
      "🔴 getVendorDisplayName prefers a branch's own name when the payload has it",
      getVendorDisplayName(BASHUNDHARA_RECORD) === "Tasca do Bairro Bashundhara" &&
        getVendorDisplayName(MAIN_RECORD) === "Tasca do Bairro" &&
        getVendorDisplayName(BASHUNDHARA_ROW) === "Tasca do Bairro",
      "order search and every pure caller go through it",
    );
    check(
      "a main store's owner-name fallback is unchanged",
      getVendorDisplayName({ name: { firstName: "Samin", lastName: "Israk" } }) === "Samin Israk" &&
        getVendorDisplayName("6a6aced8f9e179566170db79") === null,
    );

    const hook = code("hooks/useVendorCardTitle.ts");
    check(
      "🔴 the store's own record decides once it arrives",
      /return getVendorCardTitle\(record \?\? vendor\);/.test(hook),
      "the cart's vendor ref has no userId: only the record can say it is a branch",
    );

    const cartCard = code("components/cart/CartStoreCard.tsx");
    const cartPage = code("components/cart/CartPage.tsx");
    check(
      "🔴 each cart group is named through the hook",
      /const storeTitle = useVendorCardTitle\(vendor \?\? \{ id: vendorId \}\);/.test(cartCard) &&
        /const businessName = storeTitle\.title \|\| fallbackName;/.test(cartCard) &&
        /storeTitle\.branchTag &&/.test(cartCard) &&
        /vendor=\{store\.vendorRef\}/.test(cartPage),
      "two branches of one brand in the cart were two groups with the same heading",
    );

    const checkout = code("components/cart/CheckoutPage.tsx");
    check(
      "🔴 checkout names the branch",
      /const storeTitle = useVendorCardTitle\(/.test(checkout) &&
        /storeTitle\.title \|\| cartVendor\?\.businessName/.test(checkout),
    );

    const payment = code("components/payment/PaymentPage.tsx");
    check(
      "🔴 payment names the branch",
      /const storeTitle = useVendorCardTitle\(vendor\);/.test(payment) &&
        /\{storeTitle\.title\}/.test(payment) &&
        !/vendor\?\.businessDetails\.businessName\}/.test(payment),
    );

    const orderCard = code("components/orders/OrderCard.tsx");
    const ordersPage = code("components/orders/OrdersPage.tsx");
    check(
      "🔴 every order card is named through the hook, invoice included",
      /const storeTitle = useVendorCardTitle\(vendor\);/.test(orderCard) &&
        /const restaurant = storeTitle\.title \|\| fallbackRestaurant;/.test(orderCard) &&
        /downloadInvoice\(orderId, t, restaurant\)/.test(orderCard) &&
        (ordersPage.match(/vendor=\{typeof order\.vendorId === "object" \? order\.vendorId : null\}/g) || [])
          .length === 2,
      "both the active and the past list render OrderCard",
    );

    const track = code("components/orders/TrackOrder/TrackOrder.tsx");
    const hookAt = track.indexOf("const storeTitle = useVendorCardTitle(");
    const firstReturn = track.indexOf("if (loading) {");
    check(
      "🔴 track-order names the branch — and calls the hook before its early returns",
      hookAt > -1 &&
        firstReturn > -1 &&
        hookAt < firstReturn &&
        /const vendorName = storeTitle\.title \|\| getVendorDisplayName\(order\.vendorId\);/.test(track),
      "a hook after `if (loading) return` breaks React's hook order",
    );

    const invoice = code("lib/invoice.ts");
    check(
      "the invoice takes the name the screen already worked out",
      /storeName\?: string,/.test(invoice) &&
        /\[storeName \|\| order\.vendorId\?\.businessDetails\?\.businessName\]/.test(invoice),
      "/orders/:id does not send branchName",
    );
  }

  return results;
}

/**
 * The breakages `--mutate` replays. Each names the file it edits, the edit, and
 * the check that must fail because of it. `edit` is a find/replace pair, or a
 * function for a move that a single replace cannot express.
 */
const MUTATIONS = [
  // The pure naming rules.
  {
    file: "lib/vendorName.ts",
    what: "SV- no longer read as a branch",
    edit: ["return /^SV-/i.test(", "return /^XV-/i.test("],
    expect: "an SV- userId is a branch",
  },
  {
    file: "lib/vendorName.ts",
    what: "a record that says nothing is called a branch",
    edit: ['if (vendor?.role === "VENDOR") return false;', 'if (vendor?.role === "VENDOR") return false;\n  if (!vendor?.userId) return true;'],
    expect: "🔴 a record that says neither is a main store",
  },
  {
    file: "lib/vendorName.ts",
    what: "branch name joined onto the brand",
    edit: ["? { title: branchName, branchTag: false }", "? { title: `${businessName} – ${branchName}`, branchTag: false }"],
    expect: "🔴 a branch shows the complete branchName, exactly as stored",
  },
  {
    file: "lib/vendorName.ts",
    what: "the Branch tag dropped",
    edit: [": { title: businessName, branchTag: true };", ": { title: businessName, branchTag: false };"],
    expect: "🔴 a branch with no known name keeps the brand AND the tag",
  },
  {
    file: "lib/vendorName.ts",
    what: "getVendorDisplayName ignores branchName",
    edit: ["if (branchName) return branchName;", "if (branchName && false) return branchName;"],
    expect: "🔴 getVendorDisplayName prefers a branch's own name when the payload has it",
  },
  // The hook.
  {
    file: "hooks/useVendorCardTitle.ts",
    what: "every row looks itself up, main stores included",
    edit: ["(kindUnknown || isBranchVendor(vendor))", "true"],
    expect: "🔴 only a branch without a name — or a row that cannot say — looks itself up",
  },
  {
    file: "hooks/useVendorCardTitle.ts",
    what: "another vendor's placeholder record trusted",
    edit: ["vendorRouteId(data) === routeId", "true"],
    expect: "a record from another vendor is never read",
  },
  {
    file: "hooks/useVendorCardTitle.ts",
    what: "the fetched record ignored",
    edit: ["return getVendorCardTitle(record ?? vendor);", "return getVendorCardTitle(vendor);"],
    expect: "🔴 the store's own record decides once it arrives",
  },
  {
    file: "hooks/useVendorCardTitle.ts",
    what: "the lookup keyed on the SV- userId",
    edit: ["useVendor<BranchNameSource & VendorIdentifiers>(routeId, {", 'useVendor<BranchNameSource & VendorIdentifiers>(vendor?.userId ?? "", {'],
    expect: "🔴 the name lookup is keyed on the route id",
  },
  // Cards.
  {
    file: "components/vendors/VendorCard.tsx",
    what: "the grid card reads businessName again",
    edit: ["            {cardTitle.title}\n", "            {vendor.businessDetails.businessName}\n"],
    expect: "🔴 the /vendors grid and search places (VendorCard)",
  },
  {
    file: "components/home/RestaurantsSection.tsx",
    what: "the home card loses its tag",
    edit: ["{cardTitle.branchTag && (", "{false && ("],
    expect: "🔴 the home \"Near You\" cards (RestaurantsSection)",
  },
  {
    file: "components/vendors/VendorCard.tsx",
    what: "the card links by userId",
    edit: ["href={vendorHref(vendor)}", "href={`/vendors/${vendor.userId}`}"],
    expect: "🔴 VendorCard links by vendorHref, never a userId",
  },
  {
    file: "hooks/queries/useVendors.ts",
    what: "a menu request built from a userId",
    edit: ["/products?vendorId=${vendorId}&limit=100", "/products?vendorId=${vendor.userId}&limit=100"],
    expect: "🔴 no vendor or product request is built from a userId",
  },
  // Store page and "More info".
  {
    file: "components/vendors/VendorDetailsPage.tsx",
    what: "the hero reads businessName again",
    edit: ["{storeTitle.title}\n                    </h1>", "{vendor.businessDetails.businessName}\n                    </h1>"],
    expect: "🔴 the store page titles, alts and shares through the rule",
  },
  {
    file: "components/vendors/VendorDetailsModal.tsx",
    what: "\"More info\" title reads businessName again",
    edit: ["{storeTitle || t(\"vendor\")}\n              </h1>", "{vendorData?.businessDetails?.businessName || t(\"vendor\")}\n              </h1>"],
    expect: "🔴 \"More info\" titles, pins and shares through the rule",
  },
  {
    file: "components/vendors/VendorDetailsModal.tsx",
    what: "the legal-entity row shows the branch name",
    edit: ["{vendorData?.businessDetails?.businessName ||\n                      t(\"notProvided\")}", "{storeTitle ||\n                      t(\"notProvided\")}"],
    expect: "🔴 …but the legal-entity row stays the business name",
  },
  // Opening a dish.
  {
    file: "components/vendors/VendorDetailsPage.tsx",
    what: "the modal no longer gets the store's position",
    edit: ["            storeCoords={vendorCoords(vendor)}\n", ""],
    expect: "🔴 the store page hands the modal its own position",
  },
  {
    file: "components/vendors/ProductDetailsModal.tsx",
    what: "the store's position preferred over the customer's",
    edit: ["hasCoords(coords) ? coords : hasCoords(storeCoords) ? storeCoords : null", "hasCoords(storeCoords) ? storeCoords : hasCoords(coords) ? coords : null"],
    expect: "🔴 …used only when the customer has none",
  },
  {
    file: "components/vendors/ProductDetailsModal.tsx",
    what: "out of area judged on the store's position",
    edit: ["isOutOfArea(status, coords)", "isOutOfArea(status, askFrom)"],
    expect: "🔴 out of area is still judged on the customer's position",
  },
  // Cart, checkout, payment, orders.
  {
    file: "components/cart/CartStoreCard.tsx",
    what: "the cart group ignores the hook",
    edit: ["const businessName = storeTitle.title || fallbackName;", "const businessName = fallbackName;"],
    expect: "🔴 each cart group is named through the hook",
  },
  {
    file: "components/cart/CartPage.tsx",
    what: "the cart page stops passing the store",
    edit: ["              vendor={store.vendorRef}\n", ""],
    expect: "🔴 each cart group is named through the hook",
  },
  {
    file: "components/cart/CheckoutPage.tsx",
    what: "checkout names the brand",
    edit: ["storeTitle.title || cartVendor?.businessName", "cartVendor?.businessName"],
    expect: "🔴 checkout names the branch",
  },
  {
    file: "components/payment/PaymentPage.tsx",
    what: "payment names the brand",
    edit: ["{storeTitle.title}\n", "{vendor?.businessDetails.businessName}\n"],
    expect: "🔴 payment names the branch",
  },
  {
    file: "components/orders/OrderCard.tsx",
    what: "the invoice gets no name",
    edit: ["downloadInvoice(orderId, t, restaurant)", "downloadInvoice(orderId, t)"],
    expect: "🔴 every order card is named through the hook, invoice included",
  },
  {
    file: "components/orders/OrdersPage.tsx",
    what: "one order list stops passing the store",
    edit: ['vendor={typeof order.vendorId === "object" ? order.vendorId : null}', ""],
    expect: "🔴 every order card is named through the hook, invoice included",
  },
  {
    file: "components/orders/TrackOrder/TrackOrder.tsx",
    what: "track-order's hook moved below the early returns",
    edit: (source) => {
      const start = source.indexOf("  const storeTitle = useVendorCardTitle(");
      const end = source.indexOf(");", start) + 3;
      const hookCall = source.slice(start, end);
      const without = source.slice(0, start) + source.slice(end);
      const at = without.indexOf("  const vendorName = ");
      return without.slice(0, at) + hookCall + without.slice(at);
    },
    expect: "🔴 track-order names the branch — and calls the hook before its early returns",
  },
  {
    file: "lib/invoice.ts",
    what: "the invoice ignores the name it is given",
    edit: ["[storeName || order.vendorId?.businessDetails?.businessName]", "[order.vendorId?.businessDetails?.businessName]"],
    expect: "the invoice takes the name the screen already worked out",
  },
];

function applyEdit(source, edit, label) {
  if (typeof edit === "function") return edit(source);
  const [find, replace] = edit;
  if (!source.includes(find)) {
    throw new Error(`mutation "${label}": the text it edits is gone — update MUTATIONS`);
  }
  return source.replace(find, replace);
}

async function mutate() {
  const baseline = runChecks({ read: readDisk, names: realNames, print: false });
  const failing = baseline.filter((r) => !r.ok);
  if (failing.length) {
    console.log(`The checks must pass before mutating. Failing:\n  ${failing.map((r) => r.name).join("\n  ")}`);
    process.exit(1);
  }
  const names = new Set(baseline.map((r) => r.name));
  const tmp = mkdtempSync(join(tmpdir(), "verify-branch-"));
  let caught = 0;
  let missed = 0;

  try {
    for (const [i, m] of MUTATIONS.entries()) {
      if (!names.has(m.expect)) {
        throw new Error(`mutation "${m.what}" expects a check that does not exist: ${m.expect}`);
      }
      const path = src(m.file);
      const mutated = applyEdit(readDisk(path), m.edit, m.what);
      if (mutated === readDisk(path)) throw new Error(`mutation "${m.what}" changed nothing`);

      let mutatedNames = realNames;
      if (m.file === "lib/vendorName.ts") {
        const copy = join(tmp, `vendorName.${i}.ts`);
        writeFileSync(copy, mutated);
        mutatedNames = await import(pathToFileURL(copy).href);
      }
      const read = (file) => (file === path ? mutated : readDisk(file));
      const result = runChecks({ read, names: mutatedNames, print: false }).find(
        (r) => r.name === m.expect,
      );

      if (result && !result.ok) {
        caught++;
        console.log(`  CAUGHT  ${m.what}`);
      } else {
        missed++;
        console.log(`  MISSED  ${m.what}  → "${m.expect}" still passes`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`\n${caught} caught, ${missed} missed\n`);
  process.exit(missed === 0 ? 0 : 1);
}

if (process.argv.includes("--mutate")) {
  await mutate();
} else {
  const results = runChecks({ read: readDisk, names: realNames, print: true });
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}
