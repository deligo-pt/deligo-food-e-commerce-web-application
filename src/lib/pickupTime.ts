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
 * ## 2026-08-13 — half-hour slots and multi-day pickup
 *
 * The backend narrowed what it accepts, twice over, and both rules are modelled
 * in the second half of this file:
 *
 *  1. **A pickup time must start on `:00` or `:30`.** Anything else comes back
 *     `PICKUP_TIME_NOT_HALF_HOUR_SLOT`. A free-minute picker is no longer
 *     expressible.
 *  2. **How many days ahead can be booked depends on the vendor.** A `STORE`
 *     takes today plus two days; a `RESTAURANT` is still today-only. Beyond
 *     that: `PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW`.
 *
 * Both were verified live — see `Plan.md` §8, which records the sweeps this
 * model is built to reproduce exactly. The point of generating slots here
 * rather than validating after the fact is that the picker can only ever offer
 * a time the API has been proven to take.
 */

/** The store's timezone. Every function here is anchored to it. */
export const STORE_TIME_ZONE = "Europe/Lisbon";

/**
 * How far ahead of now the earliest selectable slot sits, in minutes.
 *
 * The backend only requires that a pickup time is in the future — it accepted a
 * slot 19 minutes out — so it would happily take a collection one minute from
 * now. That is not an order anyone can fulfil. This floor is a product decision
 * made here on the client: it is **NOT part of the API contract**, and nobody
 * reading this later should treat it as one.
 *
 * ## Why 10 and not 20
 *
 * It was 20 while the picker offered every fifth minute, where the cost of a
 * generous floor was one or two rows. Slots are half-hourly now, so a 20-minute
 * floor costs a customer the **whole next slot for two thirds of every half
 * hour**: at 13:41 it pushes the earliest offer from 14:00 out to 14:30, for an
 * order the store would have accepted. Ten keeps the point of the floor — not
 * offering a collection nobody can prepare — without spending half an hour of
 * the customer's evening to make it.
 */
export const PICKUP_LEAD_MINUTES = 10;

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

/** The current wall-clock time in the store's timezone. */
export function getStoreNow(now: Date = new Date()): TimeOfDay {
  return getStoreTimeOfDay(now);
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

/* ────────────────────────────────────────────────────────────────────────────
 * The slot model
 *
 * Everything above answers "what time is it in Lisbon". Everything below
 * answers "which days, and which half-hours on each day, will the backend
 * accept" — the question the picker is built on.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Length of a bookable slot, in minutes. The backend's rule, not a preference. */
export const SLOT_MINUTES = 30;

/**
 * How many days past today a `STORE` can be booked.
 *
 * **This is the number to change if the answer to Plan.md's Q7 comes back as
 * four chips rather than three.** The mobile mock shows four days; the API
 * accepts three and says so in its own error copy ("today, tomorrow, or the day
 * after tomorrow"). Until that is settled we render what the API honours.
 *
 * It is also where a per-vendor window would land, if the backend ever exposes
 * one (Q9) — at which point this constant becomes a fallback rather than the
 * rule.
 */
export const STORE_ADVANCE_DAYS = 2;

/**
 * The vendor fields the slot model needs.
 *
 * Deliberately structural rather than an import from the cart or vendor types:
 * the same three values arrive from `view-cart` (per cart line) and from
 * `/vendors/customer`, and this module should not care which. `closingDays` is
 * optional because **only the vendor list carries it** — the cart does not.
 */
export interface PickupVendorHours {
  openingHours?: string | null;
  closingHours?: string | null;
  /** `"RESTAURANT" | "STORE"`; widened because backend enums have surprised us. */
  businessType?: string | null;
  /** English weekday names, e.g. `["Friday"]`. Absent ⇒ no day is filtered. */
  closingDays?: string[] | null;
}

/** One day chip: its date, how far ahead it is, and what it can offer. */
export interface PickupDay {
  date: CalendarDate;
  /** 0 = today, 1 = tomorrow, … Drives the chip's label and nothing else. */
  offset: number;
  /**
   * Bookable starts, in order. **Empty is a real answer** — the store is shut
   * that day, or today's last slot has passed — and the picker must render the
   * chip disabled with a reason rather than dropping it. A missing chip reads
   * as "that day is not supported"; a disabled one reads as "not that day".
   */
  slots: TimeOfDay[];
}

/**
 * How many days ahead this vendor can be booked, today included as day 0.
 *
 * Verified live: a `STORE` accepts +1d and +2d and rejects +3d with
 * `PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW`; a `RESTAURANT` rejects +1d with
 * `PICKUP_TIME_MUST_BE_TODAY`.
 *
 * Anything that is not exactly `"STORE"` — including a missing value, or a
 * business type this build has never heard of — gets the today-only rule. That
 * is the conservative direction: offering a day the backend refuses strands the
 * customer on a button that cannot succeed, while not offering one they could
 * have had is a smaller, visible loss.
 */
export function getMaxAdvanceDays(businessType?: string | null): number {
  return businessType === "STORE" ? STORE_ADVANCE_DAYS : 0;
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

/** Same calendar day? Compared field by field, never by instant. */
export function isSameDate(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Sortable form of a date — `2026-08-15` → `20260815`. */
function toOrdinal(date: CalendarDate): number {
  return date.year * 10000 + date.month * 100 + date.day;
}

/** The English weekday name the backend's `closingDays` uses: `"Friday"`. */
export function getWeekdayName(date: CalendarDate): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

/**
 * Every half-hour this store can be collected from on `date`.
 *
 * The rule, established by sweeping `00:00`–`23:30` against the live API:
 * **the slot's start must fall within the store's hours, inclusive at both
 * ends.** Not the slot's end — a store closing at 22:47 offers 22:30, whose
 * nominal half hour outlives it by 13 minutes. So the first slot is opening
 * rounded *up* to the next half hour and the last is closing rounded *down*.
 *
 * `10:47`–`22:47` therefore yields exactly `11:00 … 22:30`, and the opening
 * minute itself is not offered — it is not on the grid.
 *
 * Today gets two extra constraints: a slot that has passed is gone (the backend
 * answers `PICKUP_TIME_MUST_BE_IN_FUTURE`), and `PICKUP_LEAD_MINUTES` on top of
 * that is ours, not the API's. A date already behind the store's today yields
 * nothing at all.
 */
export function getSlotsForDay(
  openingHours: string | null | undefined,
  closingHours: string | null | undefined,
  date: CalendarDate,
  now: Date = new Date(),
): TimeOfDay[] {
  const opening = parseStoreHour(openingHours);
  const closing = parseStoreHour(closingHours);
  if (!opening || !closing) return [];

  const opensAt = toMinutes(opening);
  const closesAt = toMinutes(closing);
  // An overnight shift (closing at or before opening) is not something the
  // backend's per-day rule can express, so guessing at it would only produce
  // times the server rejects.
  if (closesAt <= opensAt) return [];

  const today = getStoreToday(now);
  const dayOrdinal = toOrdinal(date);
  if (dayOrdinal < toOrdinal(today)) return [];

  // Only today is measured against the clock. Tomorrow's 11:00 is in the
  // future no matter what time it is now.
  const floor =
    dayOrdinal === toOrdinal(today)
      ? Math.max(opensAt, toMinutes(getStoreNow(now)) + PICKUP_LEAD_MINUTES)
      : opensAt;

  const first = Math.ceil(floor / SLOT_MINUTES) * SLOT_MINUTES;

  const slots: TimeOfDay[] = [];
  for (let minute = first; minute <= closesAt; minute += SLOT_MINUTES) {
    slots.push(fromMinutes(minute));
  }
  return slots;
}

/**
 * The days this vendor can be booked on, each with its slots.
 *
 * Always returns `getMaxAdvanceDays() + 1` entries, in order, **including days
 * with no slots** — see `PickupDay.slots` for why an empty day is rendered
 * rather than dropped.
 *
 * `closingDays` is applied when it is supplied. Whether the *backend* enforces
 * it for a future pickup date is unknown (Plan.md U10): the only `STORE` on the
 * test data has none, so it could not be probed. Filtering client-side is the
 * safe direction either way — the worst case is a day hidden that would have
 * been accepted, rather than a chip that fails on submit.
 */
export function getPickupDays(
  vendor: PickupVendorHours | null | undefined,
  now: Date = new Date(),
): PickupDay[] {
  if (!vendor) return [];

  const today = getStoreToday(now);
  const closedOn = new Set(
    (vendor.closingDays ?? []).map((day) => day.trim().toLowerCase()),
  );

  return Array.from({ length: getMaxAdvanceDays(vendor.businessType) + 1 }, (_, offset) => {
    const date = addDays(today, offset);
    const isClosedAllDay = closedOn.has(getWeekdayName(date).toLowerCase());

    return {
      date,
      offset,
      slots: isClosedAllDay
        ? []
        : getSlotsForDay(vendor.openingHours, vendor.closingHours, date, now),
    };
  });
}

/** Any bookable slot at all, on any day? The "is pickup possible" question. */
export function hasAnySlots(days: PickupDay[]): boolean {
  return days.some((day) => day.slots.length > 0);
}

/** The day a freshly-opened picker should land on, or `null` if there is none. */
export function findFirstAvailableDay(days: PickupDay[]): PickupDay | null {
  return days.find((day) => day.slots.length > 0) ?? null;
}

/**
 * Which day chip is open, given the one the picker last asked for.
 *
 * The requested day can stop existing while the sheet is open — the list is
 * rebuilt on a clock tick, and at midnight the whole window rolls forward — so
 * this falls back rather than returning nothing: first to any day with slots,
 * then to the first day at all. Lives here rather than in the component so the
 * fallback chain can be tested without a renderer.
 */
export function resolveActiveDay(
  days: PickupDay[],
  requestedOffset: number,
): PickupDay | null {
  return (
    days.find((day) => day.offset === requestedOffset) ??
    findFirstAvailableDay(days) ??
    days[0] ??
    null
  );
}

/**
 * Whether a pending choice belongs to the day on screen, and is still offered.
 *
 * The picker keeps a draft across chip switches — coming back to Saturday should
 * resume, not punish the detour — but only shows it as selected on its own day.
 * A time without its date is not a booking.
 */
export function isSlotOnDay(
  slot: PickupSlot | null | undefined,
  day: PickupDay | null | undefined,
): boolean {
  if (!slot || !day) return false;
  if (!isSameDate(slot.date, day.date)) return false;
  return day.slots.some(
    (time) => time.hours === slot.time.hours && time.minutes === slot.time.minutes,
  );
}

/**
 * Does this selection still exist?
 *
 * Asked on every clock tick, and it is what stops a page left open from
 * checking out on a slot that has since passed. The check is membership in the
 * *current* day list rather than a comparison against "now", so there is one
 * definition of a valid slot and both the picker and the submit path use it.
 */
export function isSlotStillValid(
  slot: PickupSlot | null | undefined,
  days: PickupDay[],
): boolean {
  if (!slot) return false;
  const day = days.find((candidate) => isSameDate(candidate.date, slot.date));
  if (!day) return false;
  return day.slots.some(
    (time) => time.hours === slot.time.hours && time.minutes === slot.time.minutes,
  );
}

/**
 * A slot as the mobile app labels it: `"15:00 → 15:30"`.
 *
 * The end is **clamped to closing time** when the store shuts inside the slot.
 * A store closing at 22:47 offers 22:30, and printing `22:30 → 23:00` would
 * promise thirteen minutes of a shut door. The start is what gets sent either
 * way; the end is presentational, and a label should not overstate.
 */
export function formatSlotRange(
  time: TimeOfDay,
  closingHours?: string | null,
): string {
  const closing = parseStoreHour(closingHours);
  const start = toMinutes(time);
  const nominalEnd = start + SLOT_MINUTES;
  const end = closing && toMinutes(closing) < nominalEnd ? toMinutes(closing) : nominalEnd;

  // A store closing exactly on the grid makes its last slot start at closing
  // time — 23:00 for a store that shuts at 23:00, which the backend accepts.
  // Clamping then collapses the range to "23:00 → 23:00", which reads as a
  // mistake. The start alone is the honest label for a collection with no
  // window after it.
  if (end <= start) return formatTimeOfDay(time);

  return `${formatTimeOfDay(time)} → ${formatTimeOfDay(fromMinutes(end))}`;
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
