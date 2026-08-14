/**
 * Checks the self-pickup slot model — the rules, not the wire.
 *
 *   pnpm verify:model
 *
 * No token, no network, no cart. Every assertion here is about
 * `src/lib/pickupTime.ts` deciding which days and which half-hours a customer
 * may choose, which is the one piece of this feature that encodes a **backend
 * rule in frontend code**. `pnpm verify:pickup` proves the backend still obeys
 * that rule; this proves we still model it.
 *
 * The two belong together and neither replaces the other: if the server changes
 * its mind, `verify:pickup` fails; if a refactor changes ours, this one does.
 *
 * ## How it runs a .ts file
 *
 * `pickupTime.ts` imports nothing — deliberately, it is pure date arithmetic —
 * so Node's built-in type stripping (22.6+, on by default in 23) can load it
 * with no bundler, no loader hook and no test framework. That is also why the
 * picker's two derivations were moved into it: a component cannot be reached
 * from here, but `resolveActiveDay` and `isSlotOnDay` can.
 *
 * ## The timezone check spawns children
 *
 * `TZ` is read once at process start, so proving the model is host-timezone
 * independent means re-running this file under several of them. It re-invokes
 * itself with `DELIGO_TZ_DIGEST=1`, which prints a digest and exits.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = fileURLToPath(import.meta.url);

let P;
try {
  P = await import("../src/lib/pickupTime.ts");
} catch (error) {
  console.error(
    "Could not load src/lib/pickupTime.ts.\n" +
      "\n" +
      "This script relies on Node's built-in TypeScript stripping, which needs\n" +
      `Node 22.6 or newer (you have ${process.version}).\n`,
  );
  console.error(error);
  process.exit(2);
}

const {
  PICKUP_LEAD_MINUTES,
  SLOT_MINUTES,
  STORE_ADVANCE_DAYS,
  addDays,
  formatDayShort,
  formatPickupMoment,
  formatSlotRange,
  formatTimeOfDay,
  getDayOffsetFromToday,
  getMaxAdvanceDays,
  getPickupDays,
  getSlotsForDay,
  getStoreToday,
  getWeekdayName,
  hasAnySlots,
  findFirstAvailableDay,
  isSlotOnDay,
  isSlotStillValid,
  resolveActiveDay,
  slotToIso,
} = P;

// ── The timezone digest child ──────────────────────────────────────────────
// Printed instead of the suite when re-invoked. Covers days, slots and the ISO
// each one serialises to, which is everything the host clock could corrupt.
if (process.env.DELIGO_TZ_DIGEST) {
  const now = new Date("2026-08-13T12:40:00.000Z");
  const days = getPickupDays(
    { openingHours: "10:47", closingHours: "22:47", businessType: "STORE" },
    now,
  );
  console.log(
    days
      .map(
        (day) =>
          `${day.offset}:${day.date.year}-${day.date.month}-${day.date.day}` +
          `[${day.slots.map(formatTimeOfDay).join(",")}]` +
          `->${day.slots.map((time) => slotToIso({ date: day.date, time }, now)).join(",")}`,
      )
      .join("\n"),
  );
  process.exit(0);
}

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log(`        got: ${JSON.stringify(detail)}`);
  }
}

/** Thu 13 Aug 2026, 13:40 in Lisbon. Every fixture below is relative to it. */
const NOW = new Date("2026-08-13T12:40:00.000Z");
/** 23:00 Lisbon the same day — after every test vendor has closed. */
const LATE = new Date("2026-08-13T22:00:00.000Z");

const FOOD_HUNTER = {
  openingHours: "10:47",
  closingHours: "22:47",
  businessType: "STORE",
};
const RESTAURANT = {
  openingHours: "09:00",
  closingHours: "23:00",
  businessType: "RESTAURANT",
};

const at = (offset, hours, minutes) =>
  slotToIso({ date: addDays(getStoreToday(NOW), offset), time: { hours, minutes } }, NOW);

/**
 * The same fixture, anchored to the real clock instead of `NOW`.
 *
 * `formatPickupMoment` takes no clock — it asks `getDayOffsetFromToday`, which
 * defaults to `new Date()`. Feeding it an `at()` fixture therefore only tests
 * what it claims to on a day when `NOW` happens to equal the real date, and
 * silently inverts on every other one: this suite went green on 13 Aug 2026 and
 * red on the 14th for that reason alone, with nothing in the code changed.
 *
 * So the day-naming block below builds its fixtures from today, and asserts
 * properties rather than hardcoded dates wherever the answer moves with the
 * calendar.
 */
const realAt = (offset, hours, minutes) =>
  slotToIso({ date: addDays(getStoreToday(new Date()), offset), time: { hours, minutes } });

console.log("\nVerifying the self-pickup slot model (no network)\n");

// ── Which slots exist ──────────────────────────────────────────────────────
console.log("Slot generation — the live sweep, reproduced");
{
  const tomorrow = addDays(getStoreToday(NOW), 1);
  const slots = getSlotsForDay("10:47", "22:47", tomorrow, NOW).map(formatTimeOfDay);

  // The exact list the API accepted when swept 00:00-23:30. If this changes,
  // either the rule moved or we broke it — `verify:pickup` says which.
  const expected = [];
  for (let minute = 11 * 60; minute <= 22 * 60 + 30; minute += SLOT_MINUTES) {
    expected.push(
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
    );
  }

  check("10:47-22:47 yields exactly 11:00 … 22:30", String(slots) === String(expected), slots);
  check("the opening minute itself is not offered", !slots.includes("10:47"));
  check("the closing minute itself is not offered", !slots.includes("22:47"));
  check("nothing past closing", !slots.includes("23:00"));

  const onTheGrid = getSlotsForDay("09:00", "23:00", tomorrow, NOW).map(formatTimeOfDay);
  check("a store closing on the grid offers that slot", onTheGrid.at(-1) === "23:00", onTheGrid.at(-1));
  check("…and not the one after it", !onTheGrid.includes("23:30"));
  check("a store opening on the grid starts there", onTheGrid[0] === "09:00", onTheGrid[0]);
}

console.log("\nSlot generation — today, and the degenerate cases");
{
  const today = getSlotsForDay("10:47", "22:47", getStoreToday(NOW), NOW).map(formatTimeOfDay);
  check("slots that have passed are gone", !today.includes("13:30"), today.slice(0, 2));
  check(
    `the first offer honours the ${PICKUP_LEAD_MINUTES}-minute lead`,
    today[0] === "14:00",
    today[0],
  );
  check("today still ends at closing", today.at(-1) === "22:30", today.at(-1));

  check(
    "a store shut for the day yields [], not a throw",
    getSlotsForDay("10:47", "22:47", getStoreToday(LATE), LATE).length === 0,
  );
  check(
    "a past date yields []",
    getSlotsForDay("10:47", "22:47", addDays(getStoreToday(NOW), -1), NOW).length === 0,
  );
  check("malformed hours yield []", getSlotsForDay("nope", "22:47", getStoreToday(NOW), NOW).length === 0);
  check(
    "an overnight shift yields [] rather than a guess",
    getSlotsForDay("22:00", "02:00", addDays(getStoreToday(NOW), 1), NOW).length === 0,
  );
}

// ── Which days exist ───────────────────────────────────────────────────────
console.log("\nThe advance window");
{
  check(`a STORE gets today + ${STORE_ADVANCE_DAYS}`, getMaxAdvanceDays("STORE") === STORE_ADVANCE_DAYS);
  check("a RESTAURANT gets today only", getMaxAdvanceDays("RESTAURANT") === 0);
  // The conservative direction: offering a day the backend refuses strands the
  // customer; not offering one is a smaller, visible loss.
  check("an unknown business type gets today only", getMaxAdvanceDays("DARK_KITCHEN") === 0);
  check("a missing business type gets today only", getMaxAdvanceDays(null) === 0);

  check("a STORE renders 3 chips", getPickupDays(FOOD_HUNTER, NOW).length === 3);
  check("a RESTAURANT renders 1", getPickupDays(RESTAURANT, NOW).length === 1);
  check("no vendor renders none", getPickupDays(null, NOW).length === 0);
}

console.log("\nEmpty days are kept, never dropped");
{
  const days = getPickupDays(FOOD_HUNTER, LATE);
  check("a store shut for today still renders 3 chips", days.length === 3);
  check("…with today empty", days[0].slots.length === 0);
  check("…tomorrow full", days[1].slots.length === 24);
  check("…the sheet still openable", hasAnySlots(days));
  check("…and opening on tomorrow, not on a dead list", findFirstAvailableDay(days)?.offset === 1);

  const closed = getPickupDays({ ...FOOD_HUNTER, closingDays: ["Saturday"] }, NOW);
  check("a closing day empties that chip", closed[2].slots.length === 0);
  check("…and leaves the others alone", closed[1].slots.length === 24);
  check("…matching the backend's weekday spelling", getWeekdayName(closed[2].date) === "Saturday");
  check(
    "case and whitespace tolerated",
    getPickupDays({ ...FOOD_HUNTER, closingDays: ["  saturday "] }, NOW)[2].slots.length === 0,
  );
  check("absent closingDays filters nothing", getPickupDays(FOOD_HUNTER, NOW)[2].slots.length === 24);
}

// ── What the picker derives ────────────────────────────────────────────────
console.log("\nPicker derivations");
{
  const days = getPickupDays(FOOD_HUNTER, NOW);

  check("the chip asked for", resolveActiveDay(days, 2)?.offset === 2);
  check("an offset that no longer exists falls back", resolveActiveDay(days, 99)?.offset === 0);
  check("midnight rollover never yields null", resolveActiveDay(days.slice(0, 2), 2)?.offset === 0);
  check("no days at all yields null", resolveActiveDay([], 0) === null);

  const saturday = days[2];
  const draft = { date: saturday.date, time: saturday.slots[6] };
  check("a draft is selected on its own day", isSlotOnDay(draft, saturday));
  check("…and not while another chip is open", !isSlotOnDay(draft, days[1]));
  check("…but survives, so returning to it resumes", isSlotOnDay(draft, days[2]));
  check("an off-grid time is never selected", !isSlotOnDay({ date: saturday.date, time: { hours: 15, minutes: 7 } }, saturday));
  check("null draft selects nothing", !isSlotOnDay(null, saturday));

  check("a listed slot is still valid", isSlotStillValid(draft, days));
  check("a slot on an unlisted day is not", !isSlotStillValid({ date: addDays(saturday.date, 1), time: { hours: 15, minutes: 0 } }, days));
  check("a slot that has passed is not", !isSlotStillValid({ date: days[0].date, time: { hours: 11, minutes: 0 } }, days));
}

// ── Labels ─────────────────────────────────────────────────────────────────
console.log("\nLabels");
{
  check("a slot reads as a range", formatSlotRange({ hours: 15, minutes: 0 }, "22:47") === "15:00 → 15:30");
  check(
    "the last slot is clamped to closing, never promising a shut door",
    formatSlotRange({ hours: 22, minutes: 30 }, "22:47") === "22:30 → 22:47",
    formatSlotRange({ hours: 22, minutes: 30 }, "22:47"),
  );
  check("no clamp needed when the store closes on the half hour", formatSlotRange({ hours: 22, minutes: 30 }, "23:00") === "22:30 → 23:00");
  // A store closing exactly on the grid makes its last slot start at closing.
  check(
    "a slot with no window after it shows the start alone, not 23:00 → 23:00",
    formatSlotRange({ hours: 23, minutes: 0 }, "23:00") === "23:00",
    formatSlotRange({ hours: 23, minutes: 0 }, "23:00"),
  );
  check("a partial last window still shows a range", formatSlotRange({ hours: 23, minutes: 0 }, "23:15") === "23:00 → 23:15");

  check("the day chip is a date, with no day name baked in", formatDayShort({ year: 2026, month: 8, day: 15 }, "en") === "Sat 15 Aug", formatDayShort({ year: 2026, month: 8, day: 15 }, "en"));
  // pt-PT's CLDR pattern renders this as "sábado, 15/08" — too long for a chip.
  check("pt uses the compact pattern", formatDayShort({ year: 2026, month: 8, day: 15 }, "pt") === "sáb., 15 de ago.", formatDayShort({ year: 2026, month: 8, day: 15 }, "pt"));
}

console.log("\nDownstream day naming");
{
  const EN = { today: "Today", tomorrow: "Tomorrow" };
  const PT = { today: "Hoje", tomorrow: "Amanhã" };

  check("today", formatPickupMoment(realAt(0, 15, 0), "en", EN) === "Today  15:00", formatPickupMoment(realAt(0, 15, 0), "en", EN));
  check("tomorrow", formatPickupMoment(realAt(1, 15, 0), "en", EN) === "Tomorrow  15:00", formatPickupMoment(realAt(1, 15, 0), "en", EN));

  /* Beyond tomorrow the label is a real date, which moves daily — so these
     assert what the rendering has to be true of rather than what it spells on
     any one afternoon: the day number, the year, the time, and no "Today". */
  {
    const far = formatPickupMoment(realAt(2, 15, 0), "en", EN);
    const farDate = addDays(getStoreToday(new Date()), 2);
    check(
      "further out keeps the real date",
      far.includes(String(farDate.day)) &&
        far.includes(String(farDate.year)) &&
        far.endsWith("15:00") &&
        !/Today|Tomorrow/.test(far),
      far,
    );
    const past = formatPickupMoment(realAt(-5, 15, 0), "en", EN);
    const pastDate = addDays(getStoreToday(new Date()), -5);
    check(
      "a past order keeps its real date",
      past.includes(String(pastDate.day)) && past.endsWith("15:00") && !/Today|Tomorrow/.test(past),
      past,
    );
  }
  check("unparseable renders empty, never 'Invalid Date'", formatPickupMoment("19:00", "en", EN) === "");
  check("pt today", formatPickupMoment(realAt(0, 15, 0), "pt", PT) === "Hoje  15:00", formatPickupMoment(realAt(0, 15, 0), "pt", PT));
  check("no English leaks into the pt path", !/Today|Tomorrow/.test(formatPickupMoment(realAt(2, 15, 0), "pt", PT)));

  // The headline: no surface may call a future or past pickup "today".
  let lied = false;
  for (const offset of [1, 2, 3, 10, -1, -30]) {
    const rendered =
      formatPickupMoment(realAt(offset, 15, 0), "en", EN) + formatPickupMoment(realAt(offset, 15, 0), "pt", PT);
    if (/Today|Hoje/.test(rendered)) lied = true;
  }
  check("🔴 nothing but today is ever labelled Today/Hoje", !lied);
  check("…and today genuinely is", /Today/.test(formatPickupMoment(realAt(0, 15, 0), "en", EN)));

  // Calendar days, not elapsed hours — the backend's own basis.
  check("23:30 tonight is today, not tomorrow-by-elapsed-hours", getDayOffsetFromToday(at(0, 23, 30), NOW) === 0);
  check("00:30 tomorrow is tomorrow, 11 hours away", getDayOffsetFromToday(at(1, 0, 30), NOW) === 1);
}

// ── Serialisation ──────────────────────────────────────────────────────────
console.log("\nSerialisation and DST");
{
  check(
    "August 15:00 Lisbon → 14:00Z (WEST, +1)",
    slotToIso({ date: { year: 2026, month: 8, day: 15 }, time: { hours: 15, minutes: 0 } }, NOW) === "2026-08-15T14:00:00.000Z",
  );
  check(
    "November 15:00 Lisbon → 15:00Z (WET, +0)",
    slotToIso({ date: { year: 2026, month: 11, day: 15 }, time: { hours: 15, minutes: 0 } }, new Date("2026-11-15T12:00:00.000Z")) === "2026-11-15T15:00:00.000Z",
  );
  // The reachable case, and the reason `slotToIso` converts twice: booking
  // across the WEST→WET switch (last Sunday of October 2026 = the 25th).
  const beforeSwitch = new Date("2026-10-24T12:00:00.000Z");
  const across = slotToIso({ date: { year: 2026, month: 10, day: 26 }, time: { hours: 15, minutes: 0 } }, beforeSwitch);
  check("🔴 +2d across the DST switch is still 15:00 local", across === "2026-10-26T15:00:00.000Z", across);
  check("…and a single-pass conversion would have got it wrong", new Date(Date.UTC(2026, 9, 26, 15, 0) - 3600000).toISOString() !== across);
  check("+2d across the switch is 2 calendar days, not 1.96", getDayOffsetFromToday(across, beforeSwitch) === 2);
}

console.log("\nHost timezone independence");
{
  // R1, the original risk: a picker built on the browser's timezone silently
  // produces the server's tomorrow. Auckland is the sharp case — its calendar
  // date is already ahead of Lisbon's.
  const zones = ["UTC", "Asia/Dhaka", "America/New_York", "Pacific/Auckland", "Europe/Lisbon"];
  const digests = zones.map((zone) =>
    execFileSync(process.execPath, ["--no-warnings", here], {
      env: { ...process.env, TZ: zone, DELIGO_TZ_DIGEST: "1" },
      encoding: "utf8",
    }),
  );
  check(
    `identical days, slots and ISO strings from ${zones.length} host timezones`,
    digests.every((digest) => digest === digests[0]),
    zones.filter((_, index) => digests[index] !== digests[0]),
  );
}

// ── Wiring ─────────────────────────────────────────────────────────────────
// Source-level, because these are the assertions most likely to rot in a
// refactor and there is no renderer here to catch them: a catch block gets
// tidied, a formatter gets swapped back, a new surface starts printing a date.
// None of it would fail `tsc`, `eslint` or the build.
console.log("\nWiring");
{
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

  const checkout = read("src/components/cart/CheckoutPage.tsx");
  const branchStart = checkout.indexOf("const errorKey = getApiErrorKey(error);");
  const branch = branchStart < 0 ? "" : checkout.slice(branchStart, checkout.indexOf("toast.error(", branchStart));

  check("the pickup error-recovery branch is where it was", branch.length > 0);
  // If the model is right none of these can fire — which is exactly why they
  // are listed. They are the recovery path for the day a backend rule moves.
  for (const key of [
    "PICKUP_TIME_MUST_BE_IN_FUTURE",
    "PICKUP_TIME_OUTSIDE_STORE_HOURS",
    "PICKUP_TIME_MUST_BE_TODAY",
    "INVALID_PICKUP_TIME",
    "PICKUP_TIME_NOT_HALF_HOUR_SLOT",
    "PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW",
  ]) {
    check(`  ${key} reopens the picker`, branch.includes(key));
  }

  check(
    "the delivery request still omits both pickup keys rather than nulling them",
    /\.\.\.\(isSelfPickup && pickupSlot[\s\S]{0,120}: \{\}\)/.test(checkout),
  );
  check("the checkout row names day 0 through t(\"today\")", /offset === 0[\s\S]{0,40}t\("today"\)/.test(checkout));
  check("…and day 1 through t(\"tomorrow\")", /offset === 1[\s\S]{0,40}t\("tomorrow"\)/.test(checkout));

  for (const [name, path] of [
    ["payment", "src/components/payment/PaymentPage.tsx"],
    ["tracking", "src/components/orders/TrackOrder/TrackOrder.tsx"],
  ]) {
    const source = read(path);
    check(`the ${name} page names the day through formatPickupMoment`, source.includes("formatPickupMoment("));
    check(`…passing both labels from t()`, /today: t\("today"\)/.test(source) && /tomorrow: t\("tomorrow"\)/.test(source));
  }

  // Negative: if one of these grows a pickup date later it must be a deliberate
  // change, made together with the day-naming the other three surfaces use.
  for (const path of [
    "src/lib/invoice.ts",
    "src/components/orders/OrdersPage.tsx",
    "src/components/orders/OrderCard.tsx",
  ]) {
    check(`${path.split("/").pop()} still renders no pickup time`, !/pickupTime|formatPickupMoment/.test(read(path)));
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
