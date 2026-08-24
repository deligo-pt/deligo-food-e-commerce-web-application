/**
 * verify:orders-page — every order the backend sends is on screen somewhere.
 *
 * Run: `pnpm verify:orders-page`
 *
 * ## The bug this exists to stop happening a third time
 *
 * `/orders` has two tabs, and it used to build them from two independent
 * allowlists of statuses. An order whose status was in neither list was
 * fetched, held in memory, counted by nothing and rendered nowhere. There was
 * no error, no empty-state, no clue: the customer searched their own order id
 * and the page answered "no results found", which looks exactly like an order
 * that does not exist.
 *
 * It has now happened twice. First to every completed self-pickup order
 * (`PICKED_UP_BY_CUSTOMER` — not ongoing, not `DELIVERED`, not terminated), and
 * then to every `NO_SHOW`. Both times the fix was to add one status to one set,
 * and both times that left the next status to be added just as invisible.
 *
 * So the assertions below are not about `NO_SHOW`. They are about the shape
 * that made `NO_SHOW` possible:
 *
 * 1. 🔴 **§1 — the split is total.** Not "handles the statuses we know", but
 *    "returns a bucket for every string, including ones nobody has written
 *    yet". Asserted with a fuzz over invented statuses, not a fixture list.
 * 2. 🔴 **§2 — the card never invents an ending.** Its status mapper is total
 *    too, and its fallback is `unknown` — drawn plainly with the backend's own
 *    word — never `cancelled`, which is what the old ternary's `:` branch told
 *    the customer about any status it had not been taught.
 * 3. **§3 — the page still asks the two functions rather than filtering
 *    inline.** The source-text half: a future edit that reintroduces a second
 *    allowlist fails here.
 * 4. **§4 — the fetch is not capped at a fixed hundred**, and still sends no
 *    search term (which `verify:order-search` §1 owns in full).
 * 5. **§5 — every face the card can wear has copy in both dictionaries.**
 */

import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

let S, C, L;
try {
  S = await import(join(here, "../src/lib/orderStatus.ts"));
  C = await import(join(here, "../src/lib/orderCardStatus.ts"));
  L = await import(join(here, "../src/lib/orderStatusLabel.ts"));
} catch (error) {
  console.error(
    "Could not load the source modules. This needs Node 22.6+ for TypeScript\n" +
      "type stripping (23+ has it on by default).\n",
  );
  throw error;
}

const { getOrderBucket, isOngoingStatus, isCompletedStatus, isTerminatedStatus, isNotCollectedStatus } = S;
const { getOrderCardStatus, isFinishedCardStatus } = C;
const { STATUS_LABEL_KEYS, getOrderStatusLabel } = L;

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
/** Code only — the comments here describe the rules and would trip them. */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** Every status this build has copy for, plus the API's one-L spelling. */
const KNOWN_STATUSES = [...Object.keys(STATUS_LABEL_KEYS), "CANCELED"];

/**
 * Statuses no build has ever seen. The point of the fuzz: the guarantee has to
 * hold for the status the backend adds next, which by definition is not in any
 * list in this repo.
 */
const UNKNOWN_STATUSES = [
  "PACKED",
  "AWAITING_COURIER",
  "RETURNED_TO_VENDOR",
  "REFUND_REQUESTED",
  "SOME_STATUS_INVENTED_IN_2027",
  "",
  "   ",
  "pending_lowercase_typo",
  "🍕",
];

const ALL_INPUTS = [
  ...KNOWN_STATUSES,
  ...KNOWN_STATUSES.map((s) => s.toLowerCase()),
  ...UNKNOWN_STATUSES,
  null,
  undefined,
];

section("§1 🔴 the Ongoing/History split is total — no order can fall out of both");

check(
  "getOrderBucket returns a bucket for every input, known or not",
  ALL_INPUTS.every((status) => ["ongoing", "history"].includes(getOrderBucket(status))),
  "an input returning undefined is an order rendered in neither tab",
);

// The property the page depends on, stated as the page uses it: partitioning a
// list by this function loses nothing and duplicates nothing.
const ongoing = ALL_INPUTS.filter((s) => getOrderBucket(s) === "ongoing");
const history = ALL_INPUTS.filter((s) => getOrderBucket(s) === "history");
check(
  "partitioning a list by it conserves every element",
  ongoing.length + history.length === ALL_INPUTS.length,
);

check(
  "a NO_SHOW order is in History — the regression this file is named for",
  getOrderBucket("NO_SHOW") === "history",
);

check(
  "a collected self-pickup order is in History — the same bug, one status earlier",
  getOrderBucket("PICKED_UP_BY_CUSTOMER") === "history",
);

check(
  "every live status is in Ongoing",
  ["PENDING", "ACCEPTED", "ASSIGNED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "ON_THE_WAY"]
    .every((status) => getOrderBucket(status) === "ongoing"),
);

check(
  "every ending is in History, in both spellings of cancellation",
  ["DELIVERED", "PICKED_UP_BY_CUSTOMER", "REJECTED", "CANCELLED", "CANCELED", "NO_SHOW"]
    .every((status) => getOrderBucket(status) === "history"),
);

check(
  "an unrecognised status goes to Ongoing, whose card leads with Track Order",
  UNKNOWN_STATUSES.every((status) => getOrderBucket(status) === "ongoing"),
  "History would claim the order is finished and offer to re-order it",
);

section("§2 🔴 the card never dresses one status up as another");

check(
  "getOrderCardStatus is total",
  ALL_INPUTS.every((status) => typeof getOrderCardStatus(status) === "string"),
);

check(
  "an unrecognised status is `unknown` — never `cancelled`",
  UNKNOWN_STATUSES.every((status) => getOrderCardStatus(status) === "unknown"),
  "the old ternary ended in `: \"cancelled\"`, telling the customer their order was called off",
);

check(
  "NO_SHOW has a face of its own, not a borrowed one",
  getOrderCardStatus("NO_SHOW") === "notCollected",
);

check(
  "a collected self-pickup order shares the delivered face",
  getOrderCardStatus("PICKED_UP_BY_CUSTOMER") === "delivered" &&
    getOrderCardStatus("DELIVERED") === "delivered",
);

check(
  "PICKED_UP — a rider collecting — is not an ending",
  getOrderCardStatus("PICKED_UP") === "accepted",
  "conflating it with PICKED_UP_BY_CUSTOMER once filed a live order under History",
);

check(
  "rejected and cancelled stay apart",
  getOrderCardStatus("REJECTED") === "rejected" &&
    getOrderCardStatus("CANCELLED") === "cancelled" &&
    getOrderCardStatus("CANCELED") === "cancelled",
);

check(
  "an `unknown` order is not offered a re-order — nothing says it is finished",
  !isFinishedCardStatus("unknown") &&
    ["delivered", "rejected", "cancelled", "notCollected"].every(isFinishedCardStatus),
);

// The two mappers have to agree, or a card lands in History wearing a live face.
check(
  "every face the card calls finished lands in History, and vice versa",
  ALL_INPUTS.every(
    (status) =>
      isFinishedCardStatus(getOrderCardStatus(status)) ===
      (getOrderBucket(status) === "history"),
  ),
  "a mismatch is a Delivered chip on the Ongoing tab, or an ending nobody can re-order",
);

check(
  "the label for an unrecognised status is the backend's own word, humanized",
  getOrderStatusLabel("AWAITING_COURIER", (k) => k) === "Awaiting Courier",
);

section("§3 the page asks those functions — it does not filter inline");

const page = stripComments(read("src/components/orders/OrdersPage.tsx"));

check(
  "OrdersPage buckets through getOrderBucket",
  /getOrderBucket\(order\.orderStatus\)/.test(page),
);

check(
  "…and derives the card face through getOrderCardStatus, on BOTH tabs",
  (page.match(/getOrderCardStatus\(order\.orderStatus\)/g) ?? []).length === 2,
);

check(
  "🔴 the two independent status filters are gone",
  !/isCompletedStatus\(|isTerminatedStatus\(|isOngoingStatus\(/.test(page),
  "one allowlist per tab is the shape that made orders vanish; partition once instead",
);

check(
  "no ternary invents an ending for an unmatched status",
  !/\?\s*"delivered"\s*:/.test(page) && !/:\s*"cancelled"/.test(page),
);

check(
  "the chip and the line under the progress bar come from one string",
  /statusLabel=\{statusLabel\}/.test(page) && /progressText=\{statusLabel\}/.test(page),
);

const card = stripComments(read("src/components/orders/OrderCard.tsx"));

check(
  "OrderCard has a branch for every face it can be given",
  ["notCollected", "unknown"].every((face) => new RegExp(`status === "${face}"`).test(card)),
);

check(
  "…and takes its unknown-status wording from the caller, inventing none",
  /statusLabel \|\| t\("pending"\)/.test(card),
);

check(
  "re-order is offered on finished orders through the shared rule",
  /isFinishedCardStatus\(status\)/.test(card) && /\{isFinished && \(/.test(card),
);

section("§4 the list is not capped at a fixed hundred");

const hook = stripComments(read("src/hooks/queries/useOrders.ts"));

check(
  "the fetch escalates its limit instead of asking once for 100",
  /fetchAllOrders/.test(hook) && !/limit:\s*100\b/.test(hook),
);

check(
  "both /orders queries go through it — one definition, two call sites",
  (hook.match(/fetchAllOrders</g) ?? []).length === 3,
);

check(
  "🔴 it never guesses a pagination parameter name",
  !/\bpage:|\boffset:|\bskip:|\bcursor:/.test(hook),
  "an unrecognised param on /orders is applied as an equality filter and empties the list",
);

check(
  "an abort is rethrown, never turned into a short list",
  /axios\.isCancel\(error\)\) throw error/.test(hook),
);

check(
  "the poll asks the same question the Ongoing tab does",
  /getOrderBucket\(order\?\.orderStatus\) === "ongoing"/.test(hook),
);

section("§5 every face has copy, in both languages");

const dictionaries = {
  en: read("src/assets/translations/en.ts"),
  pt: read("src/assets/translations/pt.ts"),
};

// `unknown` is the exception, and deliberately: it has no copy because it must
// print what the backend said instead.
const FACES_WITH_COPY = ["pending", "accepted", "delivered", "rejected", "cancelled", "notCollected"];

for (const [lang, source] of Object.entries(dictionaries)) {
  check(
    `${lang} has every card face`,
    FACES_WITH_COPY.every((key) => new RegExp(`^\\s*${key}:`, "m").test(source)),
  );
  check(
    `${lang} names the pickup ending "collected", not "delivered"`,
    /^\s*orderCollected:/m.test(source),
  );
}

// A status with a label key but no dictionary entry renders as the key itself.
for (const [lang, source] of Object.entries(dictionaries)) {
  const missing = Object.values(STATUS_LABEL_KEYS).filter(
    (key) => !new RegExp(`^\\s*${key}:`, "m").test(source),
  );
  check(`${lang} has copy for every status label key`, missing.length === 0, missing.join(", "));
}

// Sanity: the predicates the rest of the app still asks by name.
check(
  "NO_SHOW is not a refund case",
  isNotCollectedStatus("NO_SHOW") && !isTerminatedStatus("NO_SHOW") && !isCompletedStatus("NO_SHOW") &&
    !isOngoingStatus("NO_SHOW"),
  "folding it into the terminated pair would promise a refund that is not coming",
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
