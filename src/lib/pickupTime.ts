/**
 * Every date calculation for self-pickup, in one place.
 *
 * ## Why this module exists at all
 *
 * The backend decides whether a `pickupTime` is "today" using the *store's*
 * calendar day, not UTC and not the customer's. Probing the live API pinned it
 * down: `2026-08-11T23:30:00Z` is rejected as `PICKUP_TIME_MUST_BE_IN_FUTURE`
 * (so the server considers it today) while `2026-08-12T23:00:00Z` is rejected
 * as `PICKUP_TIME_MUST_BE_TODAY` (so the server considers it tomorrow). Both
 * only make sense if the day boundary sits at UTC+1 — Europe/Lisbon in August.
 *
 * That makes the browser's own timezone the wrong basis for every calculation
 * here. A customer in Dhaka (UTC+6) picking 20:00 with a naive
 * `new Date().toISOString()` sends 14:00 UTC, which is 15:00 in Lisbon — an
 * hour the store may already be shut. Worse, late-evening choices roll over
 * into the server's tomorrow and are rejected outright. None of this is
 * reproducible by anyone testing from Portugal, which is exactly why it is
 * written down rather than left to the call sites.
 *
 * So: the picker deals in Lisbon wall-clock time throughout, and this module
 * owns the two conversions at the edges.
 *
 * ## Why the offset is derived rather than written down
 *
 * Lisbon is UTC+1 (WEST) in summer and UTC+0 (WET) in winter. Hardcoding
 * `+01:00` would work until the last Sunday of October and then silently shift
 * every pickup by an hour. `Intl.DateTimeFormat` knows the rules; we ask it.
 *
 * ## 2026-11-03 — slots come from the server now
 *
 * This file used to generate the checkout's bookable half-hours itself
 * (`getPickupDays`, `getSlotsForDay`, …), reproducing the backend's rules.
 * Checkout now reads them from `GET /checkout/pickup-slots`
 * (`useCheckoutSlots`), which lists exactly what `POST /checkout` accepts, so
 * that model was deleted. What remains is used by reward pickup
 * (`rewardPickup.ts`) and by order and payment screens (`formatPickupMoment`).
 */

/** The store's timezone. Every function here is anchored to it. */
export const STORE_TIME_ZONE = "Europe/Lisbon";


/** A wall-clock time of day, in whatever timezone the caller is working in. */
export interface TimeOfDay {
  hours: number;
  minutes: number;
}

/** A calendar date with no timezone attached. */
export interface CalendarDate {
  year: number;
  month: number; // 1-12, not the Date object's 0-11
  day: number;
}

/**
 * A bookable half-hour, identified by the instant it starts.
 *
 * The end is never sent and never stored — only `formatSlotRange` invents one,
 * for the label. A slot is a date plus a start, because a time without its date
 * is not a booking: `15:30` means nothing once three days are selectable.
 */
export interface PickupSlot {
  date: CalendarDate;
  time: TimeOfDay;
}

/**
 * Reads the parts of an instant as they appear on a clock in `timeZone`.
 *
 * `Intl.DateTimeFormat.formatToParts` is the only built-in that answers "what
 * does the wall clock in Lisbon say right now" without pulling in a date
 * library. `en-GB` is chosen purely because its part names are stable — the
 * numbers are what we read, never the formatting.
 */
function getZonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    // At midnight `hour` comes back as "24" in some engines rather than "00".
    // Left as-is would make `getStoreNow()` report hour 24, which compares
    // wrong against every store-hours bound.
    hours: read("hour") % 24,
    minutes: read("minute"),
    seconds: read("second"),
  };
}

/**
 * How far ahead of UTC `timeZone` is at `instant`, in minutes.
 *
 * Works by formatting the instant in the target zone, re-reading those parts as
 * if they were UTC, and measuring the gap. The result already accounts for
 * whichever side of a DST switch `instant` falls on.
 */
function getZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = getZonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds,
  );
  // Drop sub-second precision on both sides so the difference is a whole number
  // of minutes rather than a value carrying the instant's milliseconds.
  return (asIfUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000;
}

/** Today's calendar date in the store's timezone — never the browser's. */
export function getStoreToday(now: Date = new Date()): CalendarDate {
  const { year, month, day } = getZonedParts(now, STORE_TIME_ZONE);
  return { year, month, day };
}

/** What the store's wall clock reads at `instant`. */
export function getStoreTimeOfDay(instant: Date): TimeOfDay {
  const { hours, minutes } = getZonedParts(instant, STORE_TIME_ZONE);
  return { hours, minutes };
}


/**
 * Turns a store-local wall-clock time on a given date into the UTC ISO string
 * the API expects.
 *
 * The conversion is done twice on purpose. The first pass uses the offset in
 * effect *now* to get a provisional instant; the second re-reads the offset at
 * that instant and corrects. Those differ only when the chosen slot sits on the
 * far side of a DST change from the current moment — and this is the whole
 * reason the function does not simply subtract a constant.
 *
 * That case used to be near-theoretical, because every pickup was today. With a
 * two-day horizon it is **reachable**: on the last Saturday of October the
 * day-after-tomorrow chip sits on the other side of the WEST→WET switch, and a
 * single-pass conversion books every slot on it an hour wrong. Nobody should
 * "simplify" this into one pass.
 *
 * The API also accepts a string with no timezone suffix (`"2026-08-12 19:00"`
 * returns 200), leaving the server to interpret it. We always send an explicit
 * `Z` so the meaning is never open to interpretation.
 */
export function slotToIso(slot: PickupSlot, now: Date = new Date()): string {
  const asIfUtc = Date.UTC(
    slot.date.year,
    slot.date.month - 1,
    slot.date.day,
    slot.time.hours,
    slot.time.minutes,
    0,
    0,
  );

  const provisional = new Date(asIfUtc - getZoneOffsetMinutes(now, STORE_TIME_ZONE) * 60000);
  const corrected = new Date(
    asIfUtc - getZoneOffsetMinutes(provisional, STORE_TIME_ZONE) * 60000,
  );

  return corrected.toISOString();
}


/** `{ hours: 9, minutes: 5 }` → `"09:05"`. */
export function formatTimeOfDay(time: TimeOfDay): string {
  return `${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}`;
}

/**
 * The chosen slot as the customer should read it back: `"12 Aug 2026  20:00"`.
 *
 * Formatted in the store's timezone rather than the browser's, so the time
 * shown here is the same number the customer will say at the counter. Showing
 * it in local time would be defensible on its own, but it would then disagree
 * with the store hours printed beside it and with the backend's error messages,
 * which are all store-local.
 *
 * `locale` follows the app's current language so the month abbreviates the way
 * the rest of the page reads.
 */
function formatPickupLabel(iso: string, locale: string = "pt"): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";

  const date = new Intl.DateTimeFormat(locale, {
    timeZone: STORE_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(instant);

  return `${date}  ${formatTimeOfDay(getStoreTimeOfDay(instant))}`;
}

/** `{ 2026, 8, 13 }` + 2 → `{ 2026, 8, 15 }`. Rolls months and years. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  // Noon UTC, so the arithmetic cannot be nudged across a boundary by an
  // offset — this is calendar maths, with no timezone in it at all.
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * A day chip's date: `"Sat 15 Aug"` / `"sáb., 15 de ago."`.
 *
 * Deliberately does **not** return "Today" or "Tomorrow". Those are copy, they
 * live in the dictionaries, and a lib module that returned English strings
 * would be a translation bug waiting to happen. The caller branches on
 * `PickupDay.offset` and falls back to this.
 *
 * ## Why `"pt"` and not `"pt-PT"`
 *
 * `pt-PT`'s CLDR pattern renders this combination as **"sábado, 15/08"** — the
 * weekday unabbreviated despite `weekday: "short"`, and the month as a number.
 * That is both too long for a chip and inconsistent with the English form.
 * Plain `pt` gives the compact "sáb., 15 de ago.". The dates are identical;
 * only the pattern differs. (`formatPickupLabel` already passes the app's raw
 * `lang` through for the same reason.)
 *
 * The English form has no comma — `en-GB` does not use one here — so it reads
 * "Sat 15 Aug" where the mobile mock shows "Sat, 15 Aug". Locale-correct beats
 * pixel-identical; forcing the comma would mean composing the string by hand
 * and fighting every other locale's pattern.
 */
export function formatDayShort(date: CalendarDate, locale: string = "pt"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

/**
 * How many days from today an instant falls on, in the store's timezone.
 *
 * `0` today, `1` tomorrow, negative for the past, `null` for an unparseable
 * string. Counted in **calendar days, not elapsed hours** — which is the same
 * basis the backend uses for its advance window, and the reason this cannot be
 * done with a division by 86,400,000.
 */
export function getDayOffsetFromToday(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const instant = new Date(iso ?? "");
  if (Number.isNaN(instant.getTime())) return null;

  const target = getStoreToday(instant);
  const today = getStoreToday(now);

  const toUtcNoon = (date: CalendarDate) =>
    Date.UTC(date.year, date.month - 1, date.day, 12);

  return Math.round((toUtcNoon(target) - toUtcNoon(today)) / 86_400_000);
}

/**
 * A booked pickup as the customer should read it back: `"Today  15:00"`.
 *
 * The date is spelled out only when naming it adds something. A collection
 * later today rendered as "13 de ago. de 2026  15:00" makes the customer parse
 * a date to learn it is today — and that is the most common case there is, since
 * a restaurant cannot be booked for any other day.
 *
 * Anything beyond tomorrow, or in the past, keeps the full date: an order in
 * history saying "Today" would be a lie, and one saying "Tomorrow" about last
 * Tuesday would be worse.
 *
 * ## Why the labels are arguments
 *
 * "Today" and "Tomorrow" are copy. They live in the dictionaries, and a lib
 * module returning English strings is a translation bug waiting to happen — so
 * the caller passes `t("today")` and `t("tomorrow")` in. Same reasoning as
 * `formatDayShort`, which deliberately returns a date and no day name.
 */
export function formatPickupMoment(
  iso: string | null | undefined,
  locale: string,
  labels: { today: string; tomorrow: string },
): string {
  const instant = new Date(iso ?? "");
  if (Number.isNaN(instant.getTime())) return "";

  const time = formatTimeOfDay(getStoreTimeOfDay(instant));
  const offset = getDayOffsetFromToday(iso);

  if (offset === 0) return `${labels.today}  ${time}`;
  if (offset === 1) return `${labels.tomorrow}  ${time}`;

  return formatPickupLabel(iso as string, locale);
}
