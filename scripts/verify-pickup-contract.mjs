/**
 * Checks the backend assumptions the self-pickup code is built on.
 *
 *   DELIGO_ACCESS_TOKEN=<customer access token> pnpm verify:pickup
 *
 * Every assertion mirrors something the pickup flow relies on: an enum value,
 * an error key `CheckoutPage` branches on, a field the payment and tracking
 * pages read. If the backend changes one of them the app breaks quietly —
 * `deliveryAddress` reappears and a guard becomes dead code, an error key is
 * renamed and the picker stops reopening, or `pickup.code` starts arriving as a
 * number and a leading zero silently disappears from what the customer reads
 * out at the counter. None of that shows up in `tsc`, `eslint`, or the build.
 *
 * Plain Node, no dependencies, no test runner — the same shape as
 * `verify-auth-contract.mjs`.
 *
 * ## Why this one needs a token and the auth script does not
 *
 * `/checkout` runs its auth middleware *before* Zod, so an unauthenticated
 * request answers `AUTHENTICATION_REQUIRED` and never reaches the schema. There
 * is no useful anonymous tier to check — every assertion below needs a real
 * customer session, and a **non-empty cart** for the ones that price something.
 *
 * ## What it does to the account
 *
 * It creates checkout sessions. Those are priced documents, not orders:
 * nothing is charged, nothing reaches a vendor, and a session that is never
 * converted is inert. **It never creates an order** and never touches the cart.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    const file = readFileSync(join(here, "..", ".env"), "utf8");
    const match = file.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+)"?`, "m"));
    return match?.[1];
  } catch {
    return undefined;
  }
}

const BASE = readEnvValue("NEXT_PUBLIC_API_BASE_URL");
if (!BASE) {
  console.error("NEXT_PUBLIC_API_BASE_URL is not set, and no .env was found.");
  process.exit(2);
}

const TOKEN = process.env.DELIGO_ACCESS_TOKEN;
if (!TOKEN) {
  console.error(
    "DELIGO_ACCESS_TOKEN is not set.\n" +
      "\n" +
      "Unlike the auth contract, every check here needs a customer session:\n" +
      "/checkout authenticates before it validates, so an anonymous request\n" +
      "never reaches the schema this script is asserting on.\n" +
      "\n" +
      "  DELIGO_ACCESS_TOKEN=<deligo-access-token> pnpm verify:pickup\n",
  );
  process.exit(2);
}

/**
 * The timezone the backend evaluates "today" in.
 *
 * Not a guess: `2026-08-11T23:30Z` was rejected as *not in the future* (so the
 * server considered it today) while `2026-08-12T23:00Z` was rejected as *not
 * today*. Both only hold if the day boundary sits at UTC+1 in August, which is
 * Europe/Lisbon. `src/lib/pickupTime.ts` is built on this.
 */
const STORE_TIME_ZONE = "Europe/Lisbon";

let passed = 0;
let failed = 0;

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": "en",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON responses fail the assertion below on their own */
  }
  return { status: response.status, body: payload ?? {} };
}

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) {
      console.log(`        got: ${JSON.stringify(detail)}`);
    }
  }
}

function errorKeyOf(body) {
  return body?.err?.errorKey;
}

/** Zod reports every field at once, so an unrelated error means ours passed. */
function complainsAbout(body, field) {
  const sources = body.errorSources ?? [];
  return sources.some((s) => s.path === field);
}

/** Store-local wall-clock time today, as the UTC ISO string the API wants. */
function storeTimeTodayIso(hours, minutes) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const read = (type) => Number(parts.find((p) => p.type === type)?.value);

  const asIfUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    hours,
    minutes,
    0,
  );
  // Offset measured at this instant, so the result is right on both sides of a
  // DST switch rather than assuming +01:00.
  const zoned = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour") % 24,
    read("minute"),
    read("second"),
  );
  const offsetMs = zoned - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(asIfUtc - offsetMs).toISOString();
}

console.log(`\nVerifying self-pickup contract against ${BASE}\n`);

// ── Schema-level ───────────────────────────────────────────────────────────
console.log("POST /checkout — schema");
{
  // The app sends exactly "PICKUP" or omits the field. If the enum were ever
  // widened to accept lower case or a synonym, the strictness these checks rely
  // on would be gone and a typo would reach production silently.
  for (const value of ["pickup", "TAKEAWAY", "SELF_PICKUP"]) {
    const res = await post("/checkout", {
      useCart: true,
      fulfillmentType: value,
    });
    check(
      `fulfillmentType "${value}" is rejected (enum is strict)`,
      res.status === 400,
      { status: res.status, key: errorKeyOf(res.body) },
    );
  }

  // `pickupTime` is typed `string` in the app and serialised by `toPickupIso`.
  // A number would mean the schema had loosened and a Date could be sent by
  // accident, which serialises differently in every browser.
  const numeric = await post("/checkout", {
    useCart: true,
    fulfillmentType: "PICKUP",
    pickupTime: 1786500000,
  });
  check(
    "pickupTime must be a string (a number is rejected)",
    numeric.status === 400 && complainsAbout(numeric.body, "pickupTime"),
    numeric.body.errorSources,
  );

  // `handleProceedToCheckout` guards this case client-side so the customer
  // never sees the generic wrapper. If the backend started defaulting the time
  // instead of rejecting, that guard would be hiding a silently-wrong booking.
  const missing = await post("/checkout", {
    useCart: true,
    fulfillmentType: "PICKUP",
  });
  check(
    "pickupTime is required when fulfillmentType is PICKUP",
    missing.status === 400,
    { status: missing.status, sources: missing.body.errorSources },
  );
}

// ── Live: needs a non-empty cart on top of the token ───────────────────────
{
  console.log("\nPOST /checkout — live pricing");

  const cart = await fetch(`${BASE}/carts/view-cart`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "Accept-Language": "en" },
  }).then((r) => r.json());

  if (!cart?.data?.items?.length) {
    console.log(
      "  SKIP  cart is empty — the live checks need at least one item in it.",
    );
  } else {
    // ── The four error keys CheckoutPage branches on ────────────────────
    // Each one clears the chosen time and reopens the picker. A rename here
    // means that recovery stops happening and the customer is left pressing a
    // button that keeps failing the same way.
    const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const wrongDay = await post("/checkout", {
      useCart: true,
      fulfillmentType: "PICKUP",
      pickupTime: yesterday,
    });
    check(
      "errorKey PICKUP_TIME_MUST_BE_TODAY still exists",
      errorKeyOf(wrongDay.body) === "PICKUP_TIME_MUST_BE_TODAY",
      errorKeyOf(wrongDay.body),
    );

    const pastToday = await post("/checkout", {
      useCart: true,
      fulfillmentType: "PICKUP",
      pickupTime: storeTimeTodayIso(0, 1),
    });
    check(
      "errorKey PICKUP_TIME_MUST_BE_IN_FUTURE still exists",
      errorKeyOf(pastToday.body) === "PICKUP_TIME_MUST_BE_IN_FUTURE",
      errorKeyOf(pastToday.body),
    );

    // 23:55 store-local is past every plausible closing time but still today,
    // so it isolates the store-hours rule from the calendar-day rule.
    const afterHours = await post("/checkout", {
      useCart: true,
      fulfillmentType: "PICKUP",
      pickupTime: storeTimeTodayIso(23, 55),
    });
    check(
      "errorKey PICKUP_TIME_OUTSIDE_STORE_HOURS still exists",
      errorKeyOf(afterHours.body) === "PICKUP_TIME_OUTSIDE_STORE_HOURS",
      errorKeyOf(afterHours.body),
    );

    const unparseable = await post("/checkout", {
      useCart: true,
      fulfillmentType: "PICKUP",
      pickupTime: "19:00",
    });
    check(
      "errorKey INVALID_PICKUP_TIME still exists",
      errorKeyOf(unparseable.body) === "INVALID_PICKUP_TIME",
      errorKeyOf(unparseable.body),
    );

    // ── The day boundary is still Europe/Lisbon, not UTC ────────────────
    // The single most consequential fact in this feature. If the server ever
    // moved to UTC, every evening pickup would start being rejected as
    // "tomorrow" and `pickupTime.ts` would need rewriting.
    check(
      "day boundary is evaluated in Europe/Lisbon (23:55 store-local is still today)",
      errorKeyOf(afterHours.body) !== "PICKUP_TIME_MUST_BE_TODAY",
      errorKeyOf(afterHours.body),
    );

    // ── A DELIVERY checkout still looks the way the app expects ─────────
    const delivery = await post("/checkout", { useCart: true });
    const d = delivery.body?.data;
    check(
      "a delivery checkout still carries deliveryAddress",
      Boolean(d?.deliveryAddress),
      d ? Object.keys(d) : delivery.body,
    );
    check(
      "omitting fulfillmentType still defaults to DELIVERY",
      d?.fulfillmentType === "DELIVERY",
      d?.fulfillmentType,
    );

    // ── The pickup shape the payment page is built on ───────────────────
    // Find an accepted slot by walking the day; the store's hours are unknown
    // to this script, so it probes rather than assuming 07:00-22:30.
    let pickup = null;
    for (let hour = 8; hour <= 21 && !pickup; hour += 1) {
      const attempt = await post("/checkout", {
        useCart: true,
        fulfillmentType: "PICKUP",
        pickupTime: storeTimeTodayIso(hour, 0),
      });
      if (attempt.body?.success) pickup = attempt.body.data;
    }

    if (!pickup) {
      console.log(
        "  SKIP  no valid pickup slot left today (store already closed) — rerun during opening hours.",
      );
    } else {
      check(
        "a pickup checkout omits deliveryAddress entirely",
        pickup.deliveryAddress === undefined,
        pickup.deliveryAddress,
      );
      check(
        "pickup echoes pickupTime at the TOP level (the order nests it under pickup.*)",
        typeof pickup.pickupTime === "string",
        pickup.pickupTime,
      );
      check(
        "pickup zeroes the delivery charge",
        pickup.delivery?.totalDeliveryCharge === 0,
        pickup.delivery,
      );
      check(
        "grandTotal is present and numeric (rendered as-is, never recomputed)",
        typeof pickup.payoutSummary?.grandTotal === "number",
        pickup.payoutSummary,
      );
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
