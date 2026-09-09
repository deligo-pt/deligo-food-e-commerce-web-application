/**
 * verify:rating — the payload the server will accept, and the gate that offers it.
 *
 * Run: `pnpm verify:rating`
 *
 * ## Why this exists
 *
 * The rating API was rewritten under a live app. The payload it now enforces
 * shares three of its keys with the one this app used to send and rejects the
 * rest, and `POST /ratings/create-rating` is **strict**: a single unrecognised
 * key fails the whole request. What made that dangerous rather than merely
 * broken is that ratings are **immutable and have no delete endpoint** — a
 * wrong body that the server happens to accept cannot be taken back, and a
 * partial submission strands the customer behind a duplicate they can never
 * clear.
 *
 * ## The shape of the assertions, and why they are not greps
 *
 * A guard that searches for the *absence* of `ratingType`, `subRatings`,
 * `sentiment`, `reviewerId` … only catches the spellings somebody thought of.
 * That is this project's oldest lesson, and it cost eight phases the last time
 * it was learned (`bg-[#f9186b]` was swept; `bg-pink-600` was not).
 *
 * So §1 and §2 **execute the shipped code**. `lib/ratingPayload.ts` and
 * `lib/ratingStatus.ts` import nothing but types, precisely so this script can
 * load them and check what they actually produce against an allowlist. An
 * unknown key nobody has invented yet fails §1 the same as `subRatings` does.
 *
 * §3 onwards are source rules, for the things that cannot be executed: how many
 * call sites post to the endpoint, and where the gate gets its answer from.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SRC = join(ROOT, "src");

let passed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(detail ? `${name}\n        → ${detail}` : name);
    console.log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);

function filesUnder(dir, exts = [".ts", ".tsx"]) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".next")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}
const rel = (f) => relative(ROOT, f);

/**
 * Source with its comments removed.
 *
 * The same stripper `verify:orders-page` and `verify:category` already use, and
 * for the same reason — but this guard is where its absence bit hardest.
 * Every rule in §3 and §4 forbids a construct, and the modules that removed
 * those constructs each carry a comment *naming* the thing they removed:
 * `lib/ratings.ts` records that it no longer matches "already rated",
 * `useOrders.ts` records that it no longer reads `/ratings/get-all-ratings`,
 * and `types/rating.ts` records why `isVendorRated` is not declared. All three
 * were reported as violations on the first run. Flagging the documentation of
 * a fix as the defect is how a guard teaches people to delete the comment, or
 * to delete the guard.
 *
 * Line comments go first: a `//` line quoting a path like `/ratings/*` opens a
 * block comment for the next rule, which then swallows real code up to the
 * following `*​/`.
 */
const stripComments = (src) =>
  src
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const read = (f) => (existsSync(f) ? stripComments(readFileSync(f, "utf8")) : "");
/** Untouched source — for the dictionaries, which are data, not logic. */
const readRaw = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");

const { buildRatingPayload, hasAnythingToSubmit } = await import(
  join(SRC, "lib", "ratingPayload.ts")
);
const { getRatingStatus, hasUnratedParts } = await import(
  join(SRC, "lib", "ratingStatus.ts")
);

// ─────────────────────────────────────────────────────────────────────────────
section("§1 🔴 the body carries the three documented keys and nothing else");

/** Everything `POST /ratings/create-rating` accepts. Anything else fails the
 *  whole request — confirmed live: the server names each offender by path. */
const BODY_KEYS = ["orderId", "productRatings", "deliveryRating"];
const PRODUCT_KEYS = ["productId", "rating", "review", "tags"];
const DELIVERY_KEYS = ["rating", "review", "tags"];

/** A caller that has picked up every field the old payload carried, plus the
 *  read-only ones the server sets itself. None may survive into the body. */
const CONTAMINATED = {
  orderId: "order-1",
  productRatings: [
    {
      productId: "p1",
      rating: 5,
      review: "  Hot and fresh.  ",
      ratingType: "PRODUCT",
      subRatings: { foodQuality: 5, packaging: 5 },
      sentiment: "POSITIVE",
      targetId: "x",
      targetModel: "Product",
      _id: "should-not-travel",
    },
  ],
  deliveryRating: {
    rating: 4,
    review: "",
    ratingType: "DELIVERY_PARTNER",
    subRatings: { deliverySpeed: 4, riderBehavior: 4 },
    reviewerId: "c1",
    reviewerModel: "Customer",
    deliveryPartnerId: "rider-1",
  },
  ratingType: "PRODUCT",
  rating: 5,
  review: "top-level review",
  productId: "top-level-product",
  subRatings: { foodQuality: 5 },
};

const built = buildRatingPayload(CONTAMINATED);
const strayTop = Object.keys(built).filter((k) => !BODY_KEYS.includes(k));
check(
  `no key outside {${BODY_KEYS.join(", ")}} reaches the body`,
  strayTop.length === 0,
  `these would fail the whole request: ${strayTop.join(", ")}`,
);

const strayProduct = Object.keys(built.productRatings?.[0] ?? {}).filter(
  (k) => !PRODUCT_KEYS.includes(k),
);
check(
  `no key outside {${PRODUCT_KEYS.join(", ")}} reaches a product entry`,
  strayProduct.length === 0,
  `stray: ${strayProduct.join(", ")}`,
);

const strayDelivery = Object.keys(built.deliveryRating ?? {}).filter(
  (k) => !DELIVERY_KEYS.includes(k),
);
check(
  `no key outside {${DELIVERY_KEYS.join(", ")}} reaches the delivery entry`,
  strayDelivery.length === 0,
  `stray: ${strayDelivery.join(", ")} — a rider id here is the one the doc warns about`,
);

check(
  "every product entry carries a productId",
  (built.productRatings ?? []).every((p) => typeof p.productId === "string" && p.productId),
  "one score for a whole order is what the old payload sent, and the endpoint has no field for it",
);

check(
  "a blank review is omitted, not sent as an empty string",
  !("review" in (built.deliveryRating ?? {})) &&
    built.productRatings?.[0]?.review === "Hot and fresh.",
  "the server defaults it; an empty string is a value nobody typed",
);

check(
  "an empty productRatings is dropped rather than sent",
  !("productRatings" in buildRatingPayload({ orderId: "o", productRatings: [], deliveryRating: { rating: 3 } })),
  "`[]` is not 'no products submitted' — it fails the *provide at least one* rule, naming a field the customer never saw",
);

check(
  "an unscored entry never reaches the body",
  buildRatingPayload({
    orderId: "o",
    productRatings: [{ productId: "p1", rating: 0 }],
    deliveryRating: { rating: 0 },
  }).productRatings === undefined,
  "a zero is 'not answered', and the server's 1–5 bound would reject the request as a validation error",
);

check(
  "a body with nothing scored is refused before the request",
  !hasAnythingToSubmit(buildRatingPayload({ orderId: "o" })) &&
    hasAnythingToSubmit(buildRatingPayload({ orderId: "o", deliveryRating: { rating: 1 } })),
  "a round trip to be told the customer scored nothing produces an error nobody can act on",
);

// ─────────────────────────────────────────────────────────────────────────────
section("§2 🔴 the gate offers exactly what is left to rate");

const order = (over = {}) => ({
  _id: "id",
  orderId: "ORD-1",
  items: [{ productId: "p1", name: "Dish" }],
  deliveryPartnerId: { _id: "rider" },
  ...over,
});

check(
  "a half-rated order is still rateable",
  hasUnratedParts(
    order({ ratingStatus: { isProductRated: true, isDeliveryRated: false }, isRated: false }),
  ),
  "this is the live bug: the old gate read any one rating as finished, so an order whose products were rated but whose rider was not sat behind a disabled button with no way to finish it",
);

check(
  // Two orders, because two independent mechanisms answer this and only one of
  // them is exercised by an order that carries both. The second has no
  // top-level `isRated` — an order from before that field existed — so the two
  // status flags are the whole answer, and a rule that stopped reading them
  // would strand it as permanently rateable.
  "a fully rated order is not, whether or not it carries isRated",
  !hasUnratedParts(
    order({ ratingStatus: { isProductRated: true, isDeliveryRated: true }, isRated: true }),
  ) &&
    !hasUnratedParts(
      order({
        ratingStatus: { isProductRated: true, isDeliveryRated: true },
        isRated: undefined,
      }),
    ),
);

check(
  "a self-pickup order has no outstanding rider",
  !hasUnratedParts(
    order({
      deliveryPartnerId: null,
      ratingStatus: { isProductRated: true, isDeliveryRated: false },
    }),
  ) &&
    hasUnratedParts(order({ deliveryPartnerId: null })),
  "there is no rider on a collected order; leaving `isDeliveryRated` false forever would strand every one of them as permanently unrated",
);

check(
  "an order predating the rating system reads as unrated, not as rated",
  hasUnratedParts(order({ ratingStatus: undefined, isRated: undefined })) &&
    getRatingStatus(order({ ratingStatus: undefined })).isProductRated === false,
  "an absent `ratingStatus` must not be read as `false` in one place and 'unknown' in another",
);

check(
  "the top-level isRated is what settles it, not a nested one",
  !hasUnratedParts(order({ isRated: true })) &&
    hasUnratedParts(order({ ratingStatus: { isProductRated: false, isDeliveryRated: false } })),
  "`isRated` is top-level; reading `ratingStatus.isRated` would be `undefined` forever and would read as never rated",
);

// ─────────────────────────────────────────────────────────────────────────────
section("§3 one call site, and it goes through the builder");

const sources = filesUnder(SRC);
const posters = sources.filter((f) => /["'`]\/ratings\/create-rating["'`]/.test(read(f)));
check(
  `exactly one module posts to /ratings/create-rating (${posters.map(rel).join(", ") || "none"})`,
  posters.length === 1,
  "two call sites is two payloads, and only one of them gets fixed next time",
);

const ratingsModule = read(join(SRC, "lib", "ratings.ts"));
check(
  "that module builds its body with buildRatingPayload",
  /buildRatingPayload\(/.test(ratingsModule),
  "constructing it inline puts the body back out of reach of §1, which is the only assertion here that can catch a key nobody thought of",
);

check(
  "it does not classify the failure itself",
  !/already rated|includes\(/i.test(ratingsModule),
  "the previous implementation matched 'already rated' against the server's English prose, which never fired for a customer reading Portuguese. `errorSources` is structured; `getApiErrorMessage` already reads it",
);

// ─────────────────────────────────────────────────────────────────────────────
section("§4 nothing derives the gate from a ratings list, and isVendorRated is unread");

const components = filesUnder(join(SRC, "components")).concat(
  filesUnder(join(SRC, "hooks")),
);
const listReaders = components.filter((f) => /get-all-ratings/.test(read(f)));
check(
  "no component or hook reads /ratings/get-all-ratings",
  listReaders.length === 0,
  `deriving "has this been rated?" from the customer's ratings treated any one rating as finished. The answer is on the order.\n        ${listReaders.map(rel).join("\n        ")}`,
);

const ordersPage = read(join(SRC, "components", "orders", "OrdersPage.tsx"));
const gateCalls = (ordersPage.match(/hasUnratedParts\(/g) ?? []).length;
check(
  `both gates ask hasUnratedParts — the card and the deep link (${gateCalls} call sites)`,
  gateCalls >= 2 && /getRatingStatus\(/.test(ordersPage),
  "the button and the modal have to agree on what is left to rate. Two answers is how a notification opens a modal for an order whose card has already gone quiet — or refuses to open one the card is still offering",
);

const vendorReaders = sources.filter((f) => /isVendorRated/.test(read(f)));
check(
  "isVendorRated is read nowhere",
  vendorReaders.length === 0,
  `the doc says it no longer exists and the deployment still sends it. Reading a field in that state is a bet on which of the two is ahead.\n        ${vendorReaders.map(rel).join("\n        ")}`,
);

// ─────────────────────────────────────────────────────────────────────────────
section("§5 every string the modal renders exists in both languages");

const en = readRaw(join(SRC, "assets", "translations", "en.ts"));
const pt = readRaw(join(SRC, "assets", "translations", "pt.ts"));
const REQUIRED = [
  "rateStars",
  "reviewPlaceholder",
  "productReviewLabel",
  "deliveryReviewLabel",
  "rateEveryItem",
  "productsAlreadyRated",
  "deliveryAlreadyRated",
  "failedToSubmitRating",
  "provideAtLeastOneRating",
  "ratingsSubmitted",
];
const missing = REQUIRED.filter(
  (k) => !new RegExp(`^\\s*${k}:`, "m").test(en) || !new RegExp(`^\\s*${k}:`, "m").test(pt),
);
check(
  `the modal's copy exists in en and pt (${REQUIRED.length} keys)`,
  missing.length === 0,
  `missing from one or both: ${missing.join(", ")}`,
);

// Placeholders are substituted by the caller — `t()` takes a key and nothing
// else — so a translation that drops one renders the literal `{count}`.
const SLOTS = { rateStars: "{count}", productReviewLabel: "{product}" };
const brokenSlots = Object.entries(SLOTS).filter(([key, slot]) => {
  const line = (d) => new RegExp(`^\\s*${key}:.*$`, "m").exec(d)?.[0] ?? "";
  return !line(en).includes(slot) || !line(pt).includes(slot);
});
check(
  "every message with a placeholder keeps it in both languages",
  brokenSlots.length === 0,
  `the customer reads the literal token: ${brokenSlots.map(([k]) => k).join(", ")}`,
);

const RETIRED = ["foodQuality", "packaging", "deliverySpeed", "riderBehavior"];
const survivors = RETIRED.filter(
  (k) => new RegExp(`^\\s*${k}:`, "m").test(en) || new RegExp(`^\\s*${k}:`, "m").test(pt),
);
check(
  "the sub-rating copy is retired from both dictionaries",
  survivors.length === 0,
  `the API has no field for these and the modal no longer asks: ${survivors.join(", ")}`,
);

// ─────────────────────────────────────────────────────────────────────────────
console.log("");
if (failures.length) {
  console.error(`${passed} passed, ${failures.length} failed\n`);
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}\n`));
  process.exit(1);
}
console.log(`${passed} passed, 0 failed\n`);
