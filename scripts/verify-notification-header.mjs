/**
 * Checks how a notification row is derived — the rules, not the wire.
 *
 *   pnpm verify:notifications
 *
 * No token, no network. Every assertion is about `src/lib/notificationHeader.ts`
 * and `src/lib/orderStatusLabel.ts` turning a stored notification into
 * `Order #ORD-XXXX — Accepted`, plus `src/lib/notificationIcon.ts` choosing the
 * glyph beside it and `src/lib/notificationAction.ts` choosing the one button
 * below it.
 *
 * ## Why this script has to exist
 *
 * Most order notifications do **not** carry the status they announce — 4 of 13
 * on the account this was built against. The rest are recovered by matching the
 * notification's `createdAt` to the nearest entry in the order's
 * `statusHistory`, which is a **frontend model of a backend coincidence**:
 * nothing in the API contract promises the two records are written together.
 * `tsc` cannot see that assumption, `eslint` cannot see it, and the build will
 * happily ship it broken.
 *
 * So the fixtures below are **real payloads**, captured live on 2026-08-15 from
 * the test account — 14 notifications and the 8 orders they point at, trimmed
 * to the fields these functions read and otherwise unedited. Invented fixtures
 * would only prove the code agrees with itself.
 *
 * The tightest real pair is `PREPARING` → `READY_FOR_PICKUP`, **1.4 seconds
 * apart** on `ORD-AS7S6RGSQ9`. It is the reason the matching rule is
 * nearest-absolute rather than a grace window, and §"the 1.4s pair" below is
 * the assertion that would fail if anyone changed that.
 *
 * ## How it runs a .ts file
 *
 * Node's built-in type stripping (22.6+, on by default in 23) loads the modules
 * with no bundler and no test framework — the same mechanism as `verify:model`.
 * One addition: both modules `import` a third (`orderStatus.ts`) without a file
 * extension, which Node's resolver will not find on its own, so
 * `ts-resolve-hook.mjs` is registered to retry those as `.ts`.
 */

import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

let H, L, I, A;
try {
  H = await import(join(here, "../src/lib/notificationHeader.ts"));
  L = await import(join(here, "../src/lib/orderStatusLabel.ts"));
  I = await import(join(here, "../src/lib/notificationIcon.ts"));
  A = await import(join(here, "../src/lib/notificationAction.ts"));
} catch (error) {
  console.error(
    "Could not load the source modules. This needs Node 22.6+ for TypeScript\n" +
      "type stripping (23+ has it on by default).\n",
  );
  throw error;
}

const {
  getNotificationOrderId,
  isCartExpiryNotification,
  resolveNotificationStatus,
  CART_EXPIRY_SUBTYPE,
} = H;
const { getOrderStatusLabel, humanizeStatus, STATUS_LABEL_KEYS } = L;
const { getNotificationIconKind } = I;
const { getNotificationAction } = A;

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

function section(title) {
  console.log(`\n${title}`);
}

/**
 * Stand-in for the app's `t()`. Returns the key itself, so an assertion about
 * *which* copy is chosen does not also depend on what that copy currently says
 * — the dictionaries are free to be reworded without breaking this file.
 */
const t = (key) => key;

// ---------------------------------------------------------------------------
// Captured 2026-08-15 from the live test API. Do not hand-edit: re-capture.
// ---------------------------------------------------------------------------

const NOTIFICATIONS = [
  {
    "title": "Order Accepted",
    "createdAt": "2026-08-14T13:01:12.072Z",
    "data": {
      "orderId": "ORD-340NJOFDYI"
    }
  },
  {
    "title": "Cart Expiring Soon",
    "createdAt": "2026-08-14T02:40:00.213Z",
    "data": {
      "type": "CART_ITEM_EXPIRY_WARNING"
    }
  },
  {
    "title": "Order Accepted",
    "createdAt": "2026-08-13T15:20:06.695Z",
    "data": {
      "orderId": "ORD-NVJ5LX21FR"
    }
  },
  {
    "title": "Order Rejected",
    "createdAt": "2026-08-12T08:19:25.192Z",
    "data": {
      "orderId": "ORD-7Q3GHFKPST"
    }
  },
  {
    "title": "Order Rejected",
    "createdAt": "2026-08-12T06:11:17.379Z",
    "data": {
      "orderId": "ORD-E1DT3IFGIU"
    }
  },
  {
    "title": "Order Canceled — Not Collected",
    "createdAt": "2026-08-12T06:09:55.738Z",
    "data": {
      "orderId": "ORD-AS7S6RGSQ9"
    }
  },
  {
    "title": "Order is ready for pickup",
    "createdAt": "2026-08-12T06:09:46.743Z",
    "data": {
      "orderId": "ORD-AS7S6RGSQ9",
      "status": "READY_FOR_PICKUP"
    }
  },
  {
    "title": "Order is being prepared",
    "createdAt": "2026-08-12T06:09:45.296Z",
    "data": {
      "orderId": "ORD-AS7S6RGSQ9",
      "status": "PREPARING"
    }
  },
  {
    "title": "Order Accepted",
    "createdAt": "2026-08-12T06:09:28.011Z",
    "data": {
      "orderId": "ORD-AS7S6RGSQ9"
    }
  },
  {
    "title": "Order is ready for pickup",
    "createdAt": "2026-08-12T05:28:48.477Z",
    "data": {
      "orderId": "ORD-4TN7D8381H",
      "status": "READY_FOR_PICKUP"
    }
  },
  {
    "title": "Order is being prepared",
    "createdAt": "2026-08-12T05:28:43.696Z",
    "data": {
      "orderId": "ORD-4TN7D8381H",
      "status": "PREPARING"
    }
  },
  {
    "title": "Order Accepted",
    "createdAt": "2026-08-12T05:28:32.150Z",
    "data": {
      "orderId": "ORD-4TN7D8381H"
    }
  },
  {
    "title": "Order Accepted",
    "createdAt": "2026-08-02T17:50:24.992Z",
    "data": {
      "orderId": "ORD-URF67QFR9F"
    }
  },
  {
    "title": "Order Accepted",
    "createdAt": "2026-08-01T08:43:21.973Z",
    "data": {
      "orderId": "ORD-IT1J6U0A83"
    }
  }
];

const ORDERS = [
  {
    "orderId": "ORD-340NJOFDYI",
    "orderStatus": "CANCELED",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-14T13:00:21.240Z"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2026-08-14T13:01:11.989Z"
      },
      {
        "status": "CANCELED",
        "timestamp": "2026-08-15T13:21:58.684Z"
      }
    ]
  },
  {
    "orderId": "ORD-NVJ5LX21FR",
    "orderStatus": "CANCELED",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-13T15:09:34.872Z"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2026-08-13T15:20:06.368Z"
      },
      {
        "status": "CANCELED",
        "timestamp": "2026-08-13T15:20:48.270Z"
      }
    ]
  },
  {
    "orderId": "ORD-7Q3GHFKPST",
    "orderStatus": "REJECTED",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-12T08:19:05.191Z"
      },
      {
        "status": "REJECTED",
        "timestamp": "2026-08-12T08:19:25.112Z"
      }
    ]
  },
  {
    "orderId": "ORD-E1DT3IFGIU",
    "orderStatus": "REJECTED",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-12T06:11:00.989Z"
      },
      {
        "status": "REJECTED",
        "timestamp": "2026-08-12T06:11:17.291Z"
      }
    ]
  },
  {
    "orderId": "ORD-AS7S6RGSQ9",
    "orderStatus": "NO_SHOW",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-12T06:08:59.782Z"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2026-08-12T06:09:27.931Z"
      },
      {
        "status": "PREPARING",
        "timestamp": "2026-08-12T06:09:45.216Z"
      },
      {
        "status": "READY_FOR_PICKUP",
        "timestamp": "2026-08-12T06:09:46.664Z"
      },
      {
        "status": "NO_SHOW",
        "timestamp": "2026-08-12T06:09:55.657Z"
      }
    ]
  },
  {
    "orderId": "ORD-4TN7D8381H",
    "orderStatus": "PICKED_UP_BY_CUSTOMER",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-12T05:19:22.846Z"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2026-08-12T05:28:32.041Z"
      },
      {
        "status": "PREPARING",
        "timestamp": "2026-08-12T05:28:43.614Z"
      },
      {
        "status": "READY_FOR_PICKUP",
        "timestamp": "2026-08-12T05:28:48.399Z"
      },
      {
        "status": "PICKED_UP_BY_CUSTOMER",
        "timestamp": "2026-08-12T05:38:47.069Z"
      }
    ]
  },
  {
    "orderId": "ORD-URF67QFR9F",
    "orderStatus": "CANCELED",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-02T17:48:25.797Z"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2026-08-02T17:50:24.662Z"
      },
      {
        "status": "CANCELED",
        "timestamp": "2026-08-02T17:50:47.934Z"
      }
    ]
  },
  {
    "orderId": "ORD-IT1J6U0A83",
    "orderStatus": "CANCELED",
    "statusHistory": [
      {
        "status": "PENDING",
        "timestamp": "2026-08-01T08:43:04.472Z"
      },
      {
        "status": "ACCEPTED",
        "timestamp": "2026-08-01T08:43:21.892Z"
      },
      {
        "status": "CANCELED",
        "timestamp": "2026-08-02T09:56:58.330Z"
      }
    ]
  }
];

const orderIndex = new Map(ORDERS.map((order) => [order.orderId, order]));

const lookup = (notification) =>
  orderIndex.get(getNotificationOrderId(notification) ?? "");

/** What each captured notification's own title says it is about. */
const EXPECTED_STATUS = {
  "Order Accepted": "ACCEPTED",
  "Order Rejected": "REJECTED",
  "Order is being prepared": "PREPARING",
  "Order is ready for pickup": "READY_FOR_PICKUP",
  "Order Canceled — Not Collected": "NO_SHOW",
};

section("Every real notification resolves to the status its title describes");
{
  // The titles are English-only strings this code deliberately never parses —
  // which is exactly what makes them a usable independent oracle here.
  let checked = 0;
  const wrong = [];
  for (const notification of NOTIFICATIONS) {
    const expected = EXPECTED_STATUS[notification.title];
    if (!expected) continue;
    checked++;
    const actual = resolveNotificationStatus(notification, lookup(notification));
    if (actual !== expected) {
      wrong.push(`${notification.title} → ${actual} (want ${expected})`);
    }
  }
  check("all 13 order notifications matched", wrong.length === 0, wrong.join("; "));
  check("and there were 13 of them to match", checked === 13, checked);
}

section("The 1.4s pair — nearest-absolute, not a grace window");
{
  // ORD-AS7S6RGSQ9 went PREPARING → READY_FOR_PICKUP in 1.447 seconds. A rule
  // like "the last entry at or before createdAt, within 5s" resolves BOTH of
  // its notifications to READY_FOR_PICKUP. This is that regression.
  const pair = NOTIFICATIONS.filter(
    (n) => n.data?.orderId === "ORD-AS7S6RGSQ9" && n.data?.status,
  );
  const resolved = pair.map((n) => resolveNotificationStatus(n, lookup(n)));
  check("the two notifications resolve to two different statuses",
    new Set(resolved).size === 2, resolved.join(" / "));
  check("and each matches what it declared",
    pair.every((n, i) => resolved[i] === n.data.status), resolved.join(" / "));
}

section("data.status outranks the history");
{
  const declared = NOTIFICATIONS.filter((n) => n.data?.status);
  check("4 of the captured notifications declare a status", declared.length === 4,
    declared.length);
  check("every declared status is returned verbatim",
    declared.every((n) => resolveNotificationStatus(n, lookup(n)) === n.data.status));

  // With no order to consult at all, the declared value must still come back —
  // this is the branch that costs no network and survives the backend fix.
  check("a declared status needs no order",
    resolveNotificationStatus({ createdAt: "2026-01-01T00:00:00Z",
      data: { orderId: "ORD-X", status: "PREPARING" } }, null) === "PREPARING");

  // ...and it must win even when the history says otherwise, or the priority
  // order in the doc comment is a lie.
  check("a declared status beats a contradicting history",
    resolveNotificationStatus(
      { createdAt: "2026-08-12T06:09:45.296Z",
        data: { orderId: "ORD-AS7S6RGSQ9", status: "PREPARING" } },
      orderIndex.get("ORD-AS7S6RGSQ9")) === "PREPARING");
}

section("The cart-expiry notification");
{
  const cart = NOTIFICATIONS.find((n) => n.title === "Cart Expiring Soon");
  check("is present in the capture", Boolean(cart));
  check("carries no order id", getNotificationOrderId(cart) === null);
  check("is detected by subtype", isCartExpiryNotification(cart));
  check("subtype constant matches the wire", cart.data.type === CART_EXPIRY_SUBTYPE);

  // Detection must not fall back to reading the title — that string is stored
  // pre-rendered in English and is not a contract.
  check("detection ignores the title",
    isCartExpiryNotification({ title: "Cart Expiring Soon", data: {} }) === false);

  // 🔴 No order notification may be mistaken for it, or an order card grows a
  // View Cart button.
  check("no order notification is mistaken for it",
    NOTIFICATIONS.filter(isCartExpiryNotification).length === 1);
}

section("Fallbacks");
{
  // An order with no usable history: the current status is better than nothing.
  check("falls back to the order's current status",
    resolveNotificationStatus(
      { createdAt: "2026-08-12T06:09:45.296Z", data: { orderId: "ORD-X" } },
      { orderStatus: "DELIVERED", statusHistory: [] }) === "DELIVERED");

  // Nothing to go on at all → null, so the header renders "Order #XXX" rather
  // than "Order #XXX — " with a dangling separator.
  check("returns null with no status anywhere",
    resolveNotificationStatus({ createdAt: "2026-08-12T06:09:45.296Z",
      data: { orderId: "ORD-X" } }, null) === null);

  // Outside the 60s window the entry is not a report of that change.
  check("a far-away history entry is refused, not stretched to fit",
    resolveNotificationStatus(
      { createdAt: "2026-08-12T09:00:00.000Z", data: { orderId: "ORD-X" } },
      { orderStatus: "PENDING",
        statusHistory: [{ status: "PREPARING", timestamp: "2026-08-12T06:00:00.000Z" }],
      }) === "PENDING");

  check("a malformed timestamp is skipped, not crashed on",
    resolveNotificationStatus(
      { createdAt: "2026-08-12T06:09:45.296Z", data: { orderId: "ORD-X" } },
      { orderStatus: "PENDING",
        statusHistory: [{ status: "PREPARING", timestamp: "not a date" }],
      }) === "PENDING");

  check("a missing notification is not a crash",
    resolveNotificationStatus(null, null) === null &&
    getNotificationOrderId(null) === null &&
    isCartExpiryNotification(null) === false);
}

section("Labels");
{
  // The API spells cancellation with one L; every label lookup must fold it.
  check("CANCELED folds onto the CANCELLED key",
    getOrderStatusLabel("CANCELED", t) === "cancelled");
  check("NO_SHOW is named for the order, not the customer",
    getOrderStatusLabel("NO_SHOW", t) === "notCollected");
  check("ASSIGNED reads as accepted",
    getOrderStatusLabel("ASSIGNED", t) === "accepted");

  // Short forms. `orderAccepted` is the timeline's copy ("Order Accepted") and
  // would render "Order #X — Order Accepted" in a header.
  check("ACCEPTED uses the short key, not the timeline's",
    getOrderStatusLabel("ACCEPTED", t) === "accepted");
  check("PENDING uses the short key",
    getOrderStatusLabel("PENDING", t) === "pending");

  check("no status gives no label",
    getOrderStatusLabel(null, t) === null &&
    getOrderStatusLabel("", t) === null);

  // A status this build has never heard of is presented, not dropped and not
  // crashed on — the same guarantee the tracking timeline relies on.
  check("an unknown status is humanized",
    getOrderStatusLabel("SOME_NEW_STATUS", t) === "Some New Status");
  check("humanizeStatus is exported for the timeline to share",
    typeof humanizeStatus === "function" &&
    humanizeStatus("NO_SHOW") === "No Show");

  // Every status the captured orders actually reached must have real copy —
  // no customer should meet the humanize fallback on a known status.
  const reached = new Set();
  for (const order of ORDERS) {
    reached.add(order.orderStatus === "CANCELED" ? "CANCELLED" : order.orderStatus);
    for (const entry of order.statusHistory) {
      reached.add(entry.status === "CANCELED" ? "CANCELLED" : entry.status);
    }
  }
  const uncovered = [...reached].filter((s) => !STATUS_LABEL_KEYS[s]);
  check(`all ${reached.size} statuses seen on real orders have copy`,
    uncovered.length === 0, uncovered.join(", "));
}

section("End to end — the header line for every captured notification");
{
  const rendered = NOTIFICATIONS.map((notification) => {
    const orderId = getNotificationOrderId(notification);
    if (!orderId) return notification.title;
    const label = getOrderStatusLabel(
      resolveNotificationStatus(notification, lookup(notification)), t);
    return `Order #${orderId}${label ? ` — ${label}` : ""}`;
  });

  check("every order notification names its order",
    rendered.filter((line) => line.startsWith("Order #")).length === 13);
  check("every one of those also names a status",
    rendered.filter((line) => line.startsWith("Order #") && line.includes(" — "))
      .length === 13);
  check("the cart-expiry line keeps its own title",
    rendered.includes("Cart Expiring Soon"));
  check("no line is left with a dangling separator",
    rendered.every((line) => !line.endsWith(" — ")));

  console.log("");
  for (const line of rendered) console.log(`        ${line}`);
}

// ---------------------------------------------------------------------------
// The row icon. Captured 2026-08-20 from the same account: the three self-pickup
// orders it has notifications for, and the notifications pointing at them.
// Every one of these drew a bike before `lib/notificationIcon` existed.
// ---------------------------------------------------------------------------

const PICKUP_ORDERS = [
  { orderId: "ORD-9HZ2HAGDZH", fulfillmentType: "PICKUP", orderStatus: "PICKED_UP_BY_CUSTOMER" },
  { orderId: "ORD-O9KAVBL1T5", fulfillmentType: "PICKUP", orderStatus: "PICKED_UP_BY_CUSTOMER" },
  { orderId: "ORD-B23CST4CQR", fulfillmentType: "PICKUP", orderStatus: "PICKED_UP_BY_CUSTOMER" },
];

const PICKUP_NOTIFICATIONS = [
  { title: "Order is ready for pickup", type: "ORDER", data: { orderId: "ORD-9HZ2HAGDZH", status: "READY_FOR_PICKUP" } },
  { title: "Order is being prepared", type: "ORDER", data: { orderId: "ORD-9HZ2HAGDZH", status: "PREPARING" } },
  { title: "Order Accepted", type: "ORDER", data: { orderId: "ORD-9HZ2HAGDZH" } },
  { title: "Order is ready for pickup", type: "ORDER", data: { orderId: "ORD-O9KAVBL1T5", status: "READY_FOR_PICKUP" } },
  { title: "Order is being prepared", type: "ORDER", data: { orderId: "ORD-O9KAVBL1T5", status: "PREPARING" } },
  { title: "Order Accepted", type: "ORDER", data: { orderId: "ORD-O9KAVBL1T5" } },
  { title: "Order is ready for pickup", type: "ORDER", data: { orderId: "ORD-B23CST4CQR", status: "READY_FOR_PICKUP" } },
  { title: "Order is being prepared", type: "ORDER", data: { orderId: "ORD-B23CST4CQR", status: "PREPARING" } },
];

/** A real delivery order and a real legacy one, same account. */
const DELIVERY_ORDER = { orderId: "ORD-IWPZM3QLAX", fulfillmentType: "DELIVERY" };
const LEGACY_ORDER = { orderId: "ORD-340NJOFDYI" };

section("The row icon — a bike only when somebody rides");
{
  const pickupIndex = new Map(PICKUP_ORDERS.map((o) => [o.orderId, o]));

  check("every captured self-pickup notification gets the storefront",
    PICKUP_NOTIFICATIONS.every((n) =>
      getNotificationIconKind(n.type, pickupIndex.get(n.data.orderId)) === "pickup"),
    PICKUP_NOTIFICATIONS.map((n) =>
      getNotificationIconKind(n.type, pickupIndex.get(n.data.orderId))).join(","));

  check("all eight of them, not just the ones announcing READY_FOR_PICKUP",
    PICKUP_NOTIFICATIONS.length === 8);

  check("a delivery order keeps the bike",
    getNotificationIconKind("ORDER", DELIVERY_ORDER) === "delivery");

  check("an order from before fulfillmentType existed keeps the bike",
    getNotificationIconKind("ORDER", LEGACY_ORDER) === "delivery");

  check("fulfillmentType: null keeps the bike",
    getNotificationIconKind("ORDER", { fulfillmentType: null }) === "delivery");

  // The index is fetched separately and arrives after the first paint, so this
  // is the state every order row is in for a moment on every load.
  check("an unresolved order keeps the bike rather than guessing pickup",
    getNotificationIconKind("ORDER", undefined) === "delivery" &&
      getNotificationIconKind("ORDER", null) === "delivery");

  check("the fulfilment split applies only to ORDER",
    getNotificationIconKind("PROMO", PICKUP_ORDERS[0]) === "promo" &&
      getNotificationIconKind("SECURITY", PICKUP_ORDERS[0]) === "security" &&
      getNotificationIconKind("DELIVERED", PICKUP_ORDERS[0]) === "delivered");

  check("OTHER — the cart-expiry type — falls to the generic bell",
    getNotificationIconKind("OTHER", undefined) === "generic");

  check("a type the backend has not invented yet falls to the generic bell",
    getNotificationIconKind("REFUND_ISSUED", undefined) === "generic" &&
      getNotificationIconKind(undefined, undefined) === "generic" &&
      getNotificationIconKind(null, undefined) === "generic");

  check("PICKUP is tested for by name, not as 'anything that isn't DELIVERY'",
    getNotificationIconKind("ORDER", { fulfillmentType: "SCHEDULED" }) === "delivery");

  check("the kind is never blank",
    ["ORDER", "PROMO", "SECURITY", "DELIVERED", "OTHER", "", null, undefined]
      .every((type) => typeof getNotificationIconKind(type, undefined) === "string" &&
        getNotificationIconKind(type, undefined).length > 0));
}

section("The row action — Rate Order once the order is finished");
{
  const track = (n, o) => getNotificationAction(n, o);
  const orderNote = (orderId, status) => ({
    type: "ORDER",
    data: status ? { orderId, status } : { orderId },
  });

  check("a delivered order offers the rating",
    track(orderNote("ORD-IWPZM3QLAX"), { orderStatus: "DELIVERED" }).kind === "rate");

  check("and labels it with the rateOrder key, not copy",
    track(orderNote("ORD-IWPZM3QLAX"), { orderStatus: "DELIVERED" }).labelKey === "rateOrder");

  // The rating modal lives on /orders; which order to open it for travels in
  // stores/orderRatingStore, because /orders is statically rendered.
  check("the rating button goes to /orders, not to a deep link",
    track(orderNote("ORD-IWPZM3QLAX"), { orderStatus: "DELIVERED" }).href === "/orders");

  check("a collected self-pickup order offers it too",
    track(orderNote("ORD-9HZ2HAGDZH"), { orderStatus: "PICKED_UP_BY_CUSTOMER" }).kind === "rate",
    "PICKED_UP_BY_CUSTOMER is a completed order, not a cancelled one");

  check("a live order still offers tracking",
    ["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "ON_THE_WAY", "PICKED_UP"]
      .every((orderStatus) => track(orderNote("ORD-X"), { orderStatus }).kind === "track"));

  check("PICKED_UP — a rider collecting — is not PICKED_UP_BY_CUSTOMER",
    track(orderNote("ORD-X"), { orderStatus: "PICKED_UP" }).kind === "track");

  check("a rejected or cancelled order offers tracking, never a rating",
    ["REJECTED", "CANCELED", "NO_SHOW"]
      .every((orderStatus) => track(orderNote("ORD-X"), { orderStatus }).kind === "track"));

  check("the tracking link carries the order id",
    track(orderNote("ORD-IWPZM3QLAX"), { orderStatus: "ACCEPTED" }).href ===
      "/orders/track-order/ORD-IWPZM3QLAX");

  // The status announced by an early notification is not the order's status
  // now — an "Order Accepted" row for an order since delivered can be rated.
  check("the order's current status wins over the status the notification announced",
    track(orderNote("ORD-X", "ACCEPTED"), { orderStatus: "DELIVERED" }).kind === "rate");

  check("an order missing from the index falls back to the announced status",
    track(orderNote("ORD-X", "DELIVERED"), undefined).kind === "rate" &&
      track(orderNote("ORD-X", "PREPARING"), undefined).kind === "track");

  check("an unknown order with nothing announced offers tracking",
    track(orderNote("ORD-X"), undefined).kind === "track");

  check("the cart-expiry warning keeps its own action",
    (() => {
      const a = track({ type: "OTHER", data: { type: CART_EXPIRY_SUBTYPE } }, undefined);
      return a.kind === "cart" && a.href === "/cart" && a.labelKey === "viewCart";
    })());

  check("a notification with no order and no cart gets no button",
    track({ type: "PROMO", data: {} }, undefined).kind === "none" &&
      track(null, undefined).kind === "none" &&
      track({ type: "ORDER", data: { orderId: "   " } }, undefined).kind === "none");

  // Keyed on the order id, so the DELIVERED type gets a working button if the
  // backend ever sends one — the branch it used to hit did nothing at all.
  check("any type that names an order gets the action",
    track({ type: "DELIVERED", data: { orderId: "ORD-X" } }, { orderStatus: "DELIVERED" })
      .kind === "rate");

  check("every kind that renders has both an href and a label",
    [
      track(orderNote("ORD-X"), { orderStatus: "DELIVERED" }),
      track(orderNote("ORD-X"), { orderStatus: "ACCEPTED" }),
      track({ type: "OTHER", data: { type: CART_EXPIRY_SUBTYPE } }, undefined),
    ].every((a) => a.href.length > 0 && a.labelKey.length > 0));
}

section("The wiring the rule depends on");
{
  // 🔴 The icon rule is only as good as the data reaching it, and both of these
  // fail *silently* — drop the projected field or narrow the gate back and
  // every self-pickup row quietly returns to drawing a bike with nothing red
  // anywhere. Source text, because neither is reachable from a pure function.
  const read = (path) => readFileSync(join(here, path), "utf8");
  const useOrders = read("../src/hooks/queries/useOrders.ts");
  const page = read("../src/components/notifications/NotificationsPage.tsx");

  check("the order index still projects fulfillmentType",
    /fields:\s*"[^"]*\bfulfillmentType\b[^"]*"/.test(useOrders));

  check("the notifications page asks for the order index on any order notification",
    /needsOrderLookup[\s\S]{0,400}?Boolean\(getNotificationOrderId\(notification\)\)/.test(page) &&
      !/needsOrderLookup[\s\S]{0,400}?!notification\.data\?\.status/.test(page),
    "the gate must not be narrowed back to notifications missing data.status");

  check("the page picks its icon through getNotificationIconKind",
    /ICON_BY_KIND\[getNotificationIconKind\(/.test(page));

  check("the page picks its action through getNotificationAction",
    /getNotificationAction\(notification, order\)/.test(page) &&
      /action\.kind !== "none"/.test(page));

  check("the dead DELIVERED branch with its two handler-less buttons is gone",
    !/notification\.type === "DELIVERED"/.test(page));

  check("the rating request is handed to the store on click",
    /requestOrderRating\(orderId\)/.test(page));

  const ordersPage = read("../src/components/orders/OrdersPage.tsx");
  check("the orders page consumes the pending rating request",
    /pendingRatingOrderId/.test(ordersPage) && /clearOrderRatingRequest\(\)/.test(ordersPage));

  check("and waits for both lists before acting on it",
    /if \(loading \|\| ratingsLoading\) return;/.test(ordersPage),
    "acting early would reopen the modal for an already-rated order");

  check("every kind the rule can return has a glyph",
    ["delivery", "pickup", "promo", "security", "delivered", "generic"]
      .every((kind) => new RegExp(`\\n\\s*${kind}:\\s*\\w+,`).test(page)));

  check("pickup draws the storefront the rest of the app uses",
    /\n\s*pickup:\s*Store,/.test(page) && /\n\s*delivery:\s*Bike,/.test(page));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
