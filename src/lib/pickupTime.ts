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
 */

/** The store's timezone. Every function here is anchored to it. */
export const STORE_TIME_ZONE = "Europe/Lisbon";

/**
 * How far ahead of now the earliest selectable slot sits, in minutes.
 *
 * The backend only requires that a pickup time is in the future, so it would
 * happily accept a collection one minute from now. That is not an order anyone
 * can fulfil. This floor is a product decision made here on the client — it is
 * NOT part of the API contract, and nobody reading this later should treat it
 * as one.
 */
export const PICKUP_LEAD_MINUTES = 20;

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

/** The current wall-clock time in the store's timezone. */
export function getStoreNow(now: Date = new Date()): TimeOfDay {
  return getStoreTimeOfDay(now);
}

/**
 * Turns a store-local wall-clock time today into the UTC ISO string the API
 * expects.
 *
 * The conversion is done twice on purpose. The first pass uses the offset in
 * effect *now* to get a provisional instant; the second re-reads the offset at
 * that instant and corrects. Those differ only when the chosen time sits on the
 * far side of a DST change from the current moment — rare, but the whole reason
 * this function does not simply subtract a constant.
 *
 * The API also accepts a string with no timezone suffix (`"2026-08-12 19:00"`
 * returns 200), leaving the server to interpret it. We always send an explicit
 * `Z` so the meaning is never open to interpretation.
 */
export function toPickupIso(time: TimeOfDay, now: Date = new Date()): string {
  const today = getStoreToday(now);

  const asIfUtc = Date.UTC(
    today.year,
    today.month - 1,
    today.day,
    time.hours,
    time.minutes,
    0,
    0,
  );

  const provisional = new Date(asIfUtc - getZoneOffsetMinutes(now, STORE_TIME_ZONE) * 60000);
  const corrected = new Date(
    asIfUtc - getZoneOffsetMinutes(provisional, STORE_TIME_ZONE) * 60000,
  );

  return corrected.toISOString();
}

/** `"07:00"` → `{ hours: 7, minutes: 0 }`. Returns null for anything malformed. */
export function parseStoreHour(value: string | null | undefined): TimeOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return { hours, minutes };
}

/** Minutes since midnight — the comparable form of a wall-clock time. */
export function toMinutes(time: TimeOfDay): number {
  return time.hours * 60 + time.minutes;
}

/** Minutes since midnight back to a wall-clock time. */
export function fromMinutes(total: number): TimeOfDay {
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export interface PickupWindow {
  /** Earliest selectable time, store-local. */
  earliest: TimeOfDay;
  /** Latest selectable time, store-local. */
  latest: TimeOfDay;
}

/**
 * The band of times a customer may pick today, or `null` when there isn't one.
 *
 * Three constraints are intersected:
 *
 *  1. the store's own opening hours, which the backend enforces with
 *     `PICKUP_TIME_OUTSIDE_STORE_HOURS`;
 *  2. now + `PICKUP_LEAD_MINUTES`, which keeps the picker from offering a slot
 *     the kitchen cannot meet;
 *  3. the end of the store's day, because the backend refuses any other date
 *     (`PICKUP_TIME_MUST_BE_TODAY`).
 *
 * `null` is a real, reachable answer — the store closed at 22:30 and it is now
 * 22:45 — and callers must handle it by disabling self-pickup rather than
 * opening a picker that cannot produce a valid value.
 *
 * A store whose closing time is at or before its opening time is treated as
 * having no window. That reads as an overnight shift, which the backend's
 * today-only rule cannot express anyway, so guessing at it would only produce
 * times the server rejects.
 */
export function getPickupWindow(
  openingHours: string | null | undefined,
  closingHours: string | null | undefined,
  now: Date = new Date(),
): PickupWindow | null {
  const opening = parseStoreHour(openingHours);
  const closing = parseStoreHour(closingHours);
  if (!opening || !closing) return null;

  const opensAt = toMinutes(opening);
  const closesAt = toMinutes(closing);
  if (closesAt <= opensAt) return null;

  const earliestAllowed = toMinutes(getStoreNow(now)) + PICKUP_LEAD_MINUTES;
  const earliest = Math.max(opensAt, earliestAllowed);
  if (earliest > closesAt) return null;

  return { earliest: fromMinutes(earliest), latest: fromMinutes(closesAt) };
}

/** Clamps a time into a window. Assumes the window is valid. */
export function clampToWindow(time: TimeOfDay, window: PickupWindow): TimeOfDay {
  const minutes = toMinutes(time);
  const earliest = toMinutes(window.earliest);
  const latest = toMinutes(window.latest);

  if (minutes < earliest) return window.earliest;
  if (minutes > latest) return window.latest;
  return time;
}

/** Whether a time falls inside the window, inclusive of both ends. */
export function isWithinWindow(time: TimeOfDay, window: PickupWindow): boolean {
  const minutes = toMinutes(time);
  return minutes >= toMinutes(window.earliest) && minutes <= toMinutes(window.latest);
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
export function formatPickupLabel(iso: string, locale: string = "pt"): string {
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
