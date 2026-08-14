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

async function post(path, body, language = "en") {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": language,
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

/** `"22:47"` → minutes since midnight, or `null` if it is not an `HH:mm`. */
function parseHour(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Store-local wall-clock time, `dayOffset` days from today, as a UTC ISO string.
 *
 * The offset argument is what the multi-day work added: a `STORE` accepts today
 * plus two more days, so several assertions need to name a date other than this
 * one without leaving the store's timezone to do it.
 */
function storeTimeIso(dayOffset, hours, minutes) {
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
    read("day") + dayOffset,
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

/** The same, today. Kept because most assertions never leave the current day. */
function storeTimeTodayIso(hours, minutes) {
  return storeTimeIso(0, hours, minutes);
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
    // ── The active vendor's own terms ───────────────────────────────────
    // `view-cart` carries the store's hours and business type on every line's
    // populated `vendorId`. `src/lib/pickupTime.ts` builds the whole slot list
    // out of these three strings, and nothing in `tsc` can notice if they stop
    // arriving — so they are asserted here before anything depends on them.
    const activeLine =
      cart.data.items.find((item) => item.isActive) ?? cart.data.items[0];
    const store = activeLine?.vendorId?.businessDetails ?? {};

    check(
      "view-cart carries openingHours / closingHours / businessType per line",
      typeof store.openingHours === "string" &&
        typeof store.closingHours === "string" &&
        typeof store.businessType === "string",
      store,
    );

    const isStore = store.businessType === "STORE";
    console.log(
      `        active vendor: ${store.businessName} [${store.businessType}] ${store.openingHours}-${store.closingHours}`,
    );

    // ── The error keys CheckoutPage branches on ─────────────────────────
    // Each one clears the chosen time and reopens the picker. A rename here
    // means that recovery stops happening and the customer is left pressing a
    // button that keeps failing the same way.

    // A date past the vendor's advance window. Which rejection that earns now
    // depends on the vendor: a restaurant is today-only, a store gets two more
    // days and then hits a different key entirely.
    const beyondWindow = await post("/checkout", {
      useCart: true,
      fulfillmentType: "PICKUP",
      pickupTime: storeTimeIso(isStore ? 3 : 1, 16, 0),
    });
    check(
      isStore
        ? "errorKey PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW still exists (STORE, +3d)"
        : "errorKey PICKUP_TIME_MUST_BE_TODAY still exists (RESTAURANT, +1d)",
      errorKeyOf(beyondWindow.body) ===
        (isStore ? "PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW" : "PICKUP_TIME_MUST_BE_TODAY"),
      errorKeyOf(beyondWindow.body),
    );

    // A store may still be booked for tomorrow and the day after — the whole
    // point of the multi-day work. If this ever starts failing, the picker is
    // offering days the backend has stopped taking.
    if (isStore) {
      for (const offset of [1, 2]) {
        const ahead = await post("/checkout", {
          useCart: true,
          fulfillmentType: "PICKUP",
          pickupTime: storeTimeIso(offset, 16, 0),
        });
        check(
          `a STORE still accepts +${offset}d`,
          ahead.body?.success === true,
          errorKeyOf(ahead.body),
        );
      }
    }

    // 00:00 store-local: on the half-hour grid, so it isolates the "already
    // passed" rule rather than tripping the slot rule on the way there.
    const pastToday = await post("/checkout", {
      useCart: true,
      fulfillmentType: "PICKUP",
      pickupTime: storeTimeIso(0, 0, 0),
    });
    check(
      "errorKey PICKUP_TIME_MUST_BE_IN_FUTURE still exists",
      errorKeyOf(pastToday.body) === "PICKUP_TIME_MUST_BE_IN_FUTURE",
      errorKeyOf(pastToday.body),
    );

    // ── Half-hour slots ─────────────────────────────────────────────────
    // The rule the picker's whole shape depends on: if it relaxed, the slot
    // list would still work; if it tightened further, every slot would break.
    const offGrid = await post("/checkout", {
      useCart: true,
      fulfillmentType: "PICKUP",
      pickupTime: storeTimeIso(0, 16, 7),
    });
    check(
      "errorKey PICKUP_TIME_NOT_HALF_HOUR_SLOT still exists (16:07)",
      errorKeyOf(offGrid.body) === "PICKUP_TIME_NOT_HALF_HOUR_SLOT",
      errorKeyOf(offGrid.body),
    );

    // The boundary the slot list is built on: the opening *minute* is not on
    // the grid, so the first bookable slot is opening rounded UP. A store
    // opening at 10:47 offers 11:00 and not 10:47 — if that ever inverted, the
    // model would be hiding a bookable slot at the start of every day.
    const opensAt = parseHour(store.openingHours);
    if (opensAt !== null && opensAt % 30 !== 0) {
      const openingMinute = await post("/checkout", {
        useCart: true,
        fulfillmentType: "PICKUP",
        pickupTime: storeTimeIso(1, Math.floor(opensAt / 60), opensAt % 60),
      });
      check(
        "the opening minute itself is rejected (it is not on the grid)",
        errorKeyOf(openingMinute.body) === "PICKUP_TIME_NOT_HALF_HOUR_SLOT",
        errorKeyOf(openingMinute.body),
      );

      const roundedUp = Math.ceil(opensAt / 30) * 30;
      const firstSlot = await post("/checkout", {
        useCart: true,
        fulfillmentType: "PICKUP",
        pickupTime: storeTimeIso(1, Math.floor(roundedUp / 60), roundedUp % 60),
      });
      check(
        "…while opening rounded up to the next half hour is accepted",
        firstSlot.body?.success === true,
        errorKeyOf(firstSlot.body),
      );

      const beforeOpening = roundedUp - 30;
      const tooEarly = await post("/checkout", {
        useCart: true,
        fulfillmentType: "PICKUP",
        pickupTime: storeTimeIso(1, Math.floor(beforeOpening / 60), beforeOpening % 60),
      });
      check(
        "…and the slot before it is outside store hours",
        errorKeyOf(tooEarly.body) === "PICKUP_TIME_OUTSIDE_STORE_HOURS",
        errorKeyOf(tooEarly.body),
      );
    } else {
      console.log("  SKIP  this vendor opens on the half hour, so there is no rounding to check.");
    }

    // ── The advance window is counted in calendar days, not hours ───────
    // Worth pinning: under a rolling "72 hours" the third chip's contents would
    // depend on the time of day. A *nearer* instant on the wrong side of the
    // date boundary must be refused while a *further* one inside it is taken.
    if (isStore) {
      const lateOnLastDay = await post("/checkout", {
        useCart: true,
        fulfillmentType: "PICKUP",
        pickupTime: storeTimeIso(2, 22, 0),
      });
      const earlyBeyond = await post("/checkout", {
        useCart: true,
        fulfillmentType: "PICKUP",
        pickupTime: storeTimeIso(3, 11, 0),
      });
      check(
        "the window is calendar-day based: +2d 22:00 accepted, +3d 11:00 (nearer in hours) refused",
        lateOnLastDay.body?.success === true &&
          errorKeyOf(earlyBeyond.body) === "PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW",
        { lastDay: errorKeyOf(lateOnLastDay.body), beyond: errorKeyOf(earlyBeyond.body) },
      );
    }

    // ── Store hours, isolated from the slot rule ────────────────────────
    // The first half-hour boundary strictly after closing: on the grid, so the
    // slot rule cannot answer first, and outside hours by construction rather
    // than by assuming a closing time.
    const closesAt = parseHour(store.closingHours);
    const afterClosing = closesAt === null ? null : Math.floor(closesAt / 30) * 30 + 30;

    let afterHours = null;
    if (afterClosing === null || afterClosing >= 24 * 60) {
      console.log(
        "  SKIP  store closes too near midnight to place a slot after it, still today.",
      );
    } else {
      afterHours = await post("/checkout", {
        useCart: true,
        fulfillmentType: "PICKUP",
        pickupTime: storeTimeIso(0, Math.floor(afterClosing / 60), afterClosing % 60),
      });
      check(
        "errorKey PICKUP_TIME_OUTSIDE_STORE_HOURS still exists",
        errorKeyOf(afterHours.body) === "PICKUP_TIME_OUTSIDE_STORE_HOURS",
        errorKeyOf(afterHours.body),
      );
    }

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
    if (afterHours) {
      check(
        "day boundary is evaluated in Europe/Lisbon (a late slot is still today)",
        errorKeyOf(afterHours.body) !== "PICKUP_TIME_MUST_BE_TODAY" &&
          errorKeyOf(afterHours.body) !== "PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW",
        errorKeyOf(afterHours.body),
      );
    }

    // ── The new rejections still arrive localised ───────────────────────
    // `getApiErrorMessage` renders the server's own wording for these, so there
    // are deliberately no translation keys for them. If the backend ever stopped
    // honouring Accept-Language here, Portuguese customers would silently start
    // reading English at the last step of checkout.
    for (const [label, body] of [
      ["PICKUP_TIME_NOT_HALF_HOUR_SLOT", { useCart: true, fulfillmentType: "PICKUP", pickupTime: storeTimeIso(1, 16, 7) }],
      ["PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW", { useCart: true, fulfillmentType: "PICKUP", pickupTime: storeTimeIso(4, 16, 0) }],
    ]) {
      const en = await post("/checkout", body, "en");
      const pt = await post("/checkout", body, "pt");
      const enMessage = typeof en.body?.message === "string" ? en.body.message : "";
      const ptMessage = typeof pt.body?.message === "string" ? pt.body.message : "";

      check(
        `${label} still answers in both languages`,
        enMessage.length > 0 && ptMessage.length > 0 && enMessage !== ptMessage,
        { en: enMessage, pt: ptMessage },
      );
    }

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
