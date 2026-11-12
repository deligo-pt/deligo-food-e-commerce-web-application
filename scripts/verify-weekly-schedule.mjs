/**
 * Checks the weekly-schedule display helpers — no token, no network.
 *
 *   pnpm verify:schedule
 *
 * `src/lib/weeklySchedule.ts` imports nothing, so Node's type stripping loads
 * it directly (same pattern as verify-pickup-model). Times are built in
 * Europe/Lisbon, so the result must not depend on the host's time zone.
 */
import assert from "node:assert/strict";

const S = await import("../src/lib/weeklySchedule.ts");
const TZ = "Europe/Lisbon";
let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

// 12 Nov 2026 is a Thursday; Lisbon is UTC+0 in November.
const at = (iso) => Date.parse(iso);

const split = [
  { day: "Monday", periods: [{ open: "12:00", close: "16:00" }, { open: "19:00", close: "23:00" }] },
  { day: "Tuesday", periods: [{ open: "12:00", close: "16:00" }, { open: "19:00", close: "23:00" }] },
  { day: "Wednesday", periods: [{ open: "12:00", close: "16:00" }, { open: "19:00", close: "23:00" }] },
  { day: "Thursday", periods: [{ open: "12:00", close: "16:00" }, { open: "19:00", close: "23:00" }] },
  { day: "Friday", periods: [] },
  { day: "Saturday", periods: [{ open: "18:00", close: "02:00" }] },
  { day: "Sunday", periods: [{ open: "10:00", close: "24:00" }] },
];

console.log("weeklySchedule.ts");

check("hasSchedule needs a non-empty array", () => {
  assert.equal(S.hasSchedule({ weeklySchedule: split }), true);
  assert.equal(S.hasSchedule({ weeklySchedule: [] }), false);
  assert.equal(S.hasSchedule({}), false);
  assert.equal(S.hasSchedule(null), false);
});

check("normalizeWeek: 7 days Monday first, missing day closed, bad slot dropped", () => {
  const w = S.normalizeWeek([
    { day: "Sunday", periods: [{ open: "10:00", close: "12:00" }] },
    { day: "Monday", periods: [{ open: "9:00", close: "12:00" }, { open: "13:00", close: "17:00" }] },
  ]);
  assert.deepEqual(w.map((d) => d.day), S.WEEK);
  assert.deepEqual(w[0].periods, [{ open: "13:00", close: "17:00" }]);
  assert.deepEqual(w[1].periods, []);
  assert.deepEqual(w[6].periods, [{ open: "10:00", close: "12:00" }]);
});

check("legacyToClock reads 12 h (narrow space) and 24 h", () => {
  assert.equal(S.legacyToClock("7:00 AM"), "07:00");
  assert.equal(S.legacyToClock("12:30 PM"), "12:30");
  assert.equal(S.legacyToClock("12:00 am"), "00:00");
  assert.equal(S.legacyToClock("11:15 PM"), "23:15");
  assert.equal(S.legacyToClock("19:25"), "19:25");
  assert.equal(S.legacyToClock("25:00"), null);
  assert.equal(S.legacyToClock(""), null);
  assert.equal(S.legacyToClock(undefined), null);
});

check("fromLegacy: mixed closingDays, no hours → null, equal → 24 h", () => {
  const w = S.fromLegacy({ openingHours: "9:00 AM", closingHours: "22:00", closingDays: ["Sunday", "thu_short"] });
  assert.deepEqual(w[0].periods, [{ open: "09:00", close: "22:00" }]);
  assert.deepEqual(w[3].periods, []);
  assert.deepEqual(w[6].periods, []);
  assert.equal(S.fromLegacy({}), null);
  assert.equal(S.fromLegacy({ openingHours: "abc", closingHours: "22:00" }), null);
  assert.deepEqual(S.fromLegacy({ openingHours: "08:00", closingHours: "08:00" })[0].periods, [
    { open: "00:00", close: "24:00" },
  ]);
  assert.deepEqual(S.fromLegacy({ openingHours: "18:00", closingHours: "00:00" })[0].periods, [
    { open: "18:00", close: "24:00" },
  ]);
});

check("weekFrom prefers the schedule over the legacy summary", () => {
  const w = S.weekFrom({ weeklySchedule: split, openingHours: "12:00", closingHours: "23:00", closingDays: [] });
  assert.equal(w[0].periods.length, 2);
  assert.deepEqual(S.weekFrom({ weeklySchedule: [], openingHours: "12:00", closingHours: "23:00" })[0].periods, [
    { open: "12:00", close: "23:00" },
  ]);
  assert.equal(S.weekFrom(undefined), null);
});

check("groupDays + formatPeriods", () => {
  const g = S.groupDays(split);
  assert.deepEqual(
    g.map((x) => [x.from, x.to, S.formatPeriods(x.periods, "Closed")]),
    [
      ["Monday", "Thursday", "12:00–16:00, 19:00–23:00"],
      ["Friday", "Friday", "Closed"],
      ["Saturday", "Saturday", "18:00–02:00"],
      ["Sunday", "Sunday", "10:00–24:00"],
    ],
  );
});

check("weekdayName in EN and PT", () => {
  assert.equal(S.weekdayName("Monday", "en-GB"), "Monday");
  assert.equal(S.weekdayName("Thursday", "en-GB", "short"), "Thu");
  assert.match(S.weekdayName("Monday", "pt-PT"), /^segunda/);
});

check("todaySchedule uses the store's day, not the host's", () => {
  // 23:30 UTC Thursday = 23:30 Lisbon (Thu); in Dhaka it would already be Friday.
  assert.equal(S.todaySchedule(split, at("2026-11-12T23:30:00Z"), TZ).day, "Thursday");
  assert.equal(S.todaySchedule(split, at("2026-11-13T00:30:00Z"), TZ).day, "Friday");
});

const endAt = (iso, week = split) => {
  const r = S.currentPeriodEnd(week, at(iso), TZ);
  return r === null ? null : new Date(r).toISOString();
};

check("currentPeriodEnd: lunch ends 16:00, dinner 23:00, break → null", () => {
  assert.equal(endAt("2026-11-12T15:30:00Z"), "2026-11-12T16:00:00.000Z");
  assert.equal(endAt("2026-11-12T17:00:00Z"), null);
  assert.equal(endAt("2026-11-12T22:15:30Z"), "2026-11-12T23:00:00.000Z");
  assert.equal(endAt("2026-11-12T23:00:00Z"), null);
  assert.equal(endAt("2026-11-13T12:00:00Z"), null); // Friday closed
});

check("currentPeriodEnd: past-midnight slot, from both sides of midnight", () => {
  // Saturday 14 Nov 18:00 → Sunday 02:00
  assert.equal(endAt("2026-11-14T23:00:00Z"), "2026-11-15T02:00:00.000Z");
  assert.equal(endAt("2026-11-15T01:00:00Z"), "2026-11-15T02:00:00.000Z");
  assert.equal(endAt("2026-11-15T03:00:00Z"), null);
});

check("currentPeriodEnd: touching slots join, 24:00 joins next 00:00, 24/7 → null", () => {
  const touching = [
    { day: "Thursday", periods: [{ open: "12:00", close: "16:00" }, { open: "16:00", close: "24:00" }] },
    { day: "Friday", periods: [{ open: "00:00", close: "03:00" }] },
  ];
  assert.equal(endAt("2026-11-12T13:00:00Z", touching), "2026-11-13T03:00:00.000Z");
  // Sunday 24:00 → Monday 00:00 across the week boundary
  const wrap = [
    { day: "Sunday", periods: [{ open: "20:00", close: "24:00" }] },
    { day: "Monday", periods: [{ open: "00:00", close: "01:00" }] },
  ];
  assert.equal(endAt("2026-11-15T21:00:00Z", wrap), "2026-11-16T01:00:00.000Z");
  const always = S.WEEK.map((day) => ({ day, periods: [{ open: "00:00", close: "24:00" }] }));
  assert.equal(endAt("2026-11-12T10:00:00Z", always), null);
});

check("currentPeriodEnd: summer time (UTC+1) reads Lisbon wall clock", () => {
  // 15 Jul 2026 is a Wednesday; 14:30 UTC = 15:30 Lisbon → lunch ends 16:00 Lisbon = 15:00 UTC
  assert.equal(endAt("2026-07-15T14:30:00Z"), "2026-07-15T15:00:00.000Z");
});

console.log(`\n${passed} checks passed`);
