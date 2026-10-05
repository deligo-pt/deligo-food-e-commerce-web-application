/**
 * verify:rating-prompt — feedback is asked for right after an order completes.
 *
 * Run: `pnpm verify:rating-prompt`. No token, no network: `lib/ratingPrompt.ts`
 * runs directly, and the wiring is read off source (comments stripped).
 *
 * ## What this defends (4 Oct 2026)
 *
 * Feedback could only be given from Order history, so almost nobody gave it.
 * The pop-up asks once, right after completion. Each rule below guards one
 * way back to "never asked", or one way of nagging.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const src = (...p) => join(here, "..", "src", ...p);
const code = (file) =>
  readFileSync(src(file), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const { pickRatingPromptOrder, orderCompletedAt, RATING_PROMPT_WINDOW_MS } = await import(src("lib/ratingPrompt.ts"));

let passed = 0;
let failed = 0;
const check = (name, ok, detail) => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);

const NOW = Date.parse("2026-10-04T12:00:00Z");
const ago = (h) => new Date(NOW - h * 3600_000).toISOString();
// Shaped like `GET /orders` for C-EP25QIN7, 4 Oct 2026.
const order = (id, status, hoursAgo, extra = {}) => ({
  _id: `m-${id}`,
  orderId: id,
  orderStatus: status,
  items: [{ productId: "p1", name: { en: "Faluda" } }],
  deliveryPartnerId: status === "DELIVERED" ? "rider" : null,
  ratingStatus: { isProductRated: false, isDeliveryRated: false },
  isRated: false,
  statusHistory: [
    { status: "PENDING", timestamp: ago(hoursAgo + 1) },
    { status, timestamp: ago(hoursAgo) },
  ],
  ...extra,
});
const pick = (orders, seen = []) => pickRatingPromptOrder(orders, { now: NOW, seen: new Set(seen) })?.orderId ?? null;

section("🔴 Which order is asked about");
check("🔴 a delivered, unrated order from an hour ago", pick([order("A", "DELIVERED", 1)]) === "A");
check("🔴 a collected self-pickup order counts too", pick([order("B", "PICKED_UP_BY_CUSTOMER", 1)]) === "B");
check(
  "the newest completion wins",
  pick([order("OLD", "DELIVERED", 20), order("NEW", "DELIVERED", 2), order("MID", "DELIVERED", 10)]) === "NEW",
);
check(
  "completion time comes from statusHistory (deliveredAt is never filled)",
  orderCompletedAt(order("A", "DELIVERED", 3)) === NOW - 3 * 3600_000,
);

section("🔴 Never nag");
for (const status of ["CANCELED", "REJECTED", "NO_SHOW", "PENDING", "ON_THE_WAY", "READY_FOR_PICKUP"]) {
  check(`never for ${status}`, pick([order("X", status, 1)]) === null);
}
check(
  "the order's current status decides, not an old completion in its history",
  pick([
    order("X", "CANCELED", 1, {
      statusHistory: [
        { status: "DELIVERED", timestamp: ago(2) },
        { status: "CANCELED", timestamp: ago(1) },
      ],
    }),
  ]) === null,
);
check("🔴 never twice for the same order", pick([order("A", "DELIVERED", 1)], ["A"]) === null);
check("never for a fully rated order", pick([order("A", "DELIVERED", 1, { isRated: true })]) === null);
check(
  "a half-rated order is still asked (rider left)",
  pick([order("A", "DELIVERED", 1, { ratingStatus: { isProductRated: true, isDeliveryRated: false } })]) === "A",
);
check(
  "a pickup order whose products are rated is done (no rider to rate)",
  pick([order("B", "PICKED_UP_BY_CUSTOMER", 1, { ratingStatus: { isProductRated: true, isDeliveryRated: false } })]) === null,
);
check("🔴 not after the 48h window", pick([order("A", "DELIVERED", 49)]) === null && RATING_PROMPT_WINDOW_MS === 48 * 3600_000);
check("not without a completion time", pick([order("A", "DELIVERED", 1, { statusHistory: [] })]) === null);
check(
  "total over junk input",
  [null, undefined, [], [null, {}, { orderId: "x" }, 3]].every((input) => pick(input) === null),
);

section("🔴 Wiring");
const layout = code("app/(main)/layout.tsx");
check("🔴 the prompt is mounted in the main layout", /<OrderRatingPromptLazy \/>/.test(layout));
const prompt = code("components/orders/OrderRatingPrompt.tsx");
check("only for signed-in customers", /useRatingPromptOrders<RatingPromptOrder>\(\{ enabled: authed \}\)/.test(prompt));
check(
  "never over checkout or payment, nor over the location prompt",
  /const blocked = pathname\.startsWith\("\/cart"\) \|\| locationPromptOpen;/.test(prompt) &&
    /useLocationStore\(\(state\) => state\.showPromptModal\)/.test(prompt) &&
    /if \(!authed \|\| open \|\| blocked \|\|/.test(prompt),
);
check("🔴 marked seen as it opens, so it asks once", /markRatingPromptSeen\(candidate\.orderId\);\s*askedThisVisit\.current = true;\s*setOpen\(candidate\);/.test(prompt));
check(
  "🔴 one prompt per visit: none right after the first closes",
  /if \(!authed \|\| open \|\| blocked \|\| askedThisVisit\.current\) return;/.test(prompt),
);
check("it opens the shared dialog in prompt mode", /<OrderRatingDialog\s+key=\{open\._id\}\s+order=\{open as any\}\s+prompt/.test(prompt));
const dialog = code("components/orders/OrderRatingDialog.tsx");
check("prompt mode says why and offers Not now", /t\("ratePromptSubtitle"\)/.test(dialog) && /prompt \? t\("notNow"\) : t\("cancel"\)/.test(dialog));
const orders = code("hooks/queries/useOrders.ts");
check(
  "🔴 the prompt's orders carry statusHistory and refresh while one is ongoing",
  /fields: `\$\{ORDERS_LIST_FIELDS\},statusHistory`/.test(orders) &&
    /ratingPrompt: \(lang: string\) => \["orders", "rating-prompt", lang\]/.test(orders),
);
const track = code("components/orders/TrackOrder/TrackOrder.tsx");
check(
  "🔴 tracking page refreshes it the moment its order completes",
  /!isInitial &&\s*isCompletedStatus\(orderData\?\.orderStatus\) &&\s*!isCompletedStatus\(lastStatusRef\.current\)\s*\) \{\s*void invalidateOrders\(\);/.test(track),
);
for (const lang of ["en", "pt"]) {
  const dict = readFileSync(src(`assets/translations/${lang}.ts`), "utf8");
  check(`${lang}: ratePromptSubtitle exists`, /ratePromptSubtitle: "/.test(dict));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
