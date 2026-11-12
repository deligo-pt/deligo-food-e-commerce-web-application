/**
 * A vendor's weekly opening hours, for display (FRONTEND_VENDOR_SCHEDULE_GUIDE).
 *
 * Since Nov 2026 a vendor can have several time slots a day (lunch
 * `12:00–16:00` and dinner `19:00–23:00`). `businessDetails.weeklySchedule`
 * is the source of truth once a vendor has one; the legacy `openingHours` /
 * `closingHours` / `closingDays` are then a lossy summary (lunch + dinner
 * reads as 12:00–23:00) and must not be shown on their own.
 *
 * ## What this file is NOT for
 *
 * Whether a store is open, closed or paused **now** comes from the backend's
 * `businessDetails.availability` (`lib/availability.ts`), never from here. The
 * backend also applies pauses, extended hours, admin suspensions and the
 * cut-off before closing, none of which the schedule knows about (guide §6).
 * The one time-based helper, `currentPeriodEnd`, answers "when does the slot
 * that is open now end" for the closing-soon countdown, and callers use it
 * only while the backend says `OPEN`.
 *
 * ## Why it imports nothing
 *
 * Pure date arithmetic, so `scripts/verify-weekly-schedule.mjs` can load it
 * with Node's type stripping (same pattern as `pickupTime.ts`). Callers pass
 * the locale, time zone and "now" in.
 */

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

/** One time slot. `open` is `HH:mm`; `close` is `HH:mm` or `24:00`. */
export interface ClockPeriod {
  open: string;
  close: string;
}

/** One weekday. `periods: []` means closed that day. */
export interface WeeklyDaySchedule {
  day: Weekday;
  periods: ClockPeriod[];
}

/** The fields of `businessDetails` this file reads. */
export interface ScheduleDetails {
  weeklySchedule?: WeeklyDaySchedule[] | null;
  /** Legacy, read-only. Mixed format: `"7:00 AM"` or `"19:25"`. */
  openingHours?: string | null;
  /** Legacy, read-only. */
  closingHours?: string | null;
  /** Legacy, read-only. `"Sunday"` or `"sun_short"`, any case. */
  closingDays?: string[] | null;
}

/** Monday first, the order the backend uses and the hours list shows. */
export const WEEK: readonly Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_MINUTES = 24 * 60;
const CLOCK_RE = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** Minutes after midnight for a schedule time; `"24:00"` → 1440. `NaN` if malformed. */
export function toMinutes(time: string): number {
  if (!CLOCK_RE.test(time)) return NaN;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** A slot that closes earlier than it opens runs past midnight. */
export function isOvernight(period: ClockPeriod): boolean {
  return toMinutes(period.close) < toMinutes(period.open);
}

/** Guide §7: a schedule exists only when the array has at least one entry. */
export function hasSchedule(
  details: ScheduleDetails | null | undefined,
): details is ScheduleDetails & { weeklySchedule: WeeklyDaySchedule[] } {
  return Array.isArray(details?.weeklySchedule) && details.weeklySchedule.length > 0;
}

/**
 * All seven days, Monday first. A weekday missing from the input is closed (as
 * the backend reads it); a slot with a malformed time is dropped rather than
 * shown as "undefined–undefined".
 */
export function normalizeWeek(
  schedule: readonly WeeklyDaySchedule[] | null | undefined,
): WeeklyDaySchedule[] {
  const byDay = new Map((schedule ?? []).map((d) => [d?.day, d?.periods]));
  return WEEK.map((day) => ({
    day,
    periods: (Array.isArray(byDay.get(day)) ? byDay.get(day)! : [])
      .filter(
        (p) =>
          p &&
          !Number.isNaN(toMinutes(p.open)) &&
          p.open !== "24:00" &&
          !Number.isNaN(toMinutes(p.close)),
      )
      .map((p) => ({ open: p.open, close: p.close })),
  }));
}

/**
 * A legacy hours string as `HH:mm`, or null. Accepts `"7:00 AM"`, `"07:00 pm"`
 * (with a normal, narrow or non-breaking space before AM/PM) and `"19:25"`.
 * Same rules as `parseTimeToMinutes` in `storeHours.ts`.
 */
export function legacyToClock(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw
    .replace(/[  ]/g, " ")
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
  } else if (hours > 23) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** `closingDays` entries are `"Sunday"` or `"sun_short"`: match on the first three letters. */
function isLegacyClosedDay(day: Weekday, closingDays: readonly unknown[]): boolean {
  const prefix = day.slice(0, 3).toLowerCase();
  return closingDays.some(
    (d) => typeof d === "string" && d.trim().slice(0, 3).toLowerCase() === prefix,
  );
}

/**
 * The week built from the legacy fields (guide §7), for a vendor that has no
 * schedule yet. Null when the hours are missing or unreadable — unlike the
 * vendor panel's editor, the customer app must not invent "open all day" for a
 * store that never set its hours. Equal open and close is the old way of
 * saying "open 24 hours".
 */
export function fromLegacy(details: ScheduleDetails | null | undefined): WeeklyDaySchedule[] | null {
  const open = legacyToClock(details?.openingHours);
  const close = legacyToClock(details?.closingHours);
  if (!open || !close) return null;

  const period: ClockPeriod =
    open === close ? { open: "00:00", close: "24:00" } : { open, close: close === "00:00" ? "24:00" : close };
  const closingDays = Array.isArray(details?.closingDays) ? details.closingDays : [];
  return WEEK.map((day) => ({
    day,
    periods: isLegacyClosedDay(day, closingDays) ? [] : [{ ...period }],
  }));
}

/**
 * The week to display: the weekly schedule, else the legacy hours, else null
 * ("hours not set").
 */
export function weekFrom(details: ScheduleDetails | null | undefined): WeeklyDaySchedule[] | null {
  if (hasSchedule(details)) return normalizeWeek(details.weeklySchedule);
  return fromLegacy(details);
}

/** `"12:00–16:00, 19:00–23:00"`, or `closedLabel` for a day with no slots. */
export function formatPeriods(periods: readonly ClockPeriod[], closedLabel: string): string {
  return periods.length ? periods.map((p) => `${p.open}–${p.close}`).join(", ") : closedLabel;
}

function samePeriods(a: readonly ClockPeriod[], b: readonly ClockPeriod[]): boolean {
  return a.length === b.length && a.every((p, i) => p.open === b[i].open && p.close === b[i].close);
}

export interface DayGroup {
  /** First and last weekday of a run of consecutive days with the same hours. */
  from: Weekday;
  to: Weekday;
  periods: ClockPeriod[];
}

/**
 * Consecutive days (Monday first) with identical hours, merged:
 * "Mon – Thu 12:00–16:00, 19:00–23:00", "Fri Closed". `from === to` for a
 * single day. The caller translates the day names.
 */
export function groupDays(week: readonly WeeklyDaySchedule[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const { day, periods } of normalizeWeek(week)) {
    const last = groups[groups.length - 1];
    if (last && samePeriods(last.periods, periods)) last.to = day;
    else groups.push({ from: day, to: day, periods });
  }
  return groups;
}

/** A weekday's name in the given locale (`"pt-PT"` → `"segunda-feira"` / `"seg."`). */
export function weekdayName(day: Weekday, locale: string, width: "long" | "short" = "long"): string {
  // 1 Jan 2024 was a Monday; noon UTC is the same date in every time zone.
  const date = new Date(Date.UTC(2024, 0, 1 + WEEK.indexOf(day), 12));
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(date);
}

/** The store-local weekday and time of day at `nowMs`. */
export function storeClock(
  nowMs: number,
  timeZone: string,
): { day: Weekday; dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday") as Weekday;
  const minutes = Number(get("hour")) * 60 + Number(get("minute")) + Number(get("second")) / 60;
  return { day, dayIndex: WEEK.indexOf(day), minutes };
}

/** Today's slots in the store's time zone, with the weekday. */
export function todaySchedule(
  week: readonly WeeklyDaySchedule[],
  nowMs: number,
  timeZone: string,
): WeeklyDaySchedule {
  const { day } = storeClock(nowMs, timeZone);
  const today = normalizeWeek(week).find((d) => d.day === day);
  return { day, periods: today?.periods ?? [] };
}

/** A slot on the Monday-first week line, in minutes: day index × 1440 + minute of day. */
type Span = { start: number; end: number };

/** Every slot of the week as a span on a 7-day line; past-midnight slots run into the next day. */
function weekSpans(week: readonly WeeklyDaySchedule[]): Span[] {
  const spans: Span[] = [];
  normalizeWeek(week).forEach(({ periods }, d) => {
    for (const p of periods) {
      const open = toMinutes(p.open);
      const close = toMinutes(p.close);
      const start = d * DAY_MINUTES + open;
      spans.push({ start, end: d * DAY_MINUTES + (close < open ? close + DAY_MINUTES : close) });
    }
  });
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * When the time slot that is open at `nowMs` ends (epoch ms), or null when no
 * slot is open by the schedule, or the store is open around the clock.
 *
 * Touching slots count as one (`12:00–16:00` then `16:00–20:00`, or
 * `…–24:00` then `00:00–…` the next day), as the backend reads them. A
 * past-midnight slot from yesterday counts for this morning.
 *
 * Display only, for the closing-soon countdown — call it only while the
 * backend's `availability.state` is `OPEN`. Across a DST change night the
 * result can be an hour off; the countdown only shows in the last hour and
 * refetches when it reaches zero, so that is acceptable.
 */
export function currentPeriodEnd(
  week: readonly WeeklyDaySchedule[],
  nowMs: number,
  timeZone: string,
): number | null {
  const { dayIndex, minutes } = storeClock(nowMs, timeZone);
  if (dayIndex < 0) return null;

  const WEEK_MINUTES = 7 * DAY_MINUTES;
  const base = weekSpans(week);
  if (!base.length) return null;
  // Three copies of the week (last, this, next) so Sunday-night slots reach
  // Monday and the chain can run past the week's end.
  const spans = [-1, 0, 1, 2].flatMap((w) =>
    base.map((s) => ({ start: s.start + w * WEEK_MINUTES, end: s.end + w * WEEK_MINUTES })),
  );

  const now = dayIndex * DAY_MINUTES + minutes;
  const current = spans.find((s) => s.start <= now && now < s.end);
  if (!current) return null;

  let end = current.end;
  // Follow touching or overlapping slots; give up after a full week (24/7).
  for (;;) {
    const next = spans.find((s) => s.start <= end && s.end > end);
    if (!next) break;
    end = next.end;
    if (end - now >= WEEK_MINUTES) return null;
  }

  return nowMs + Math.round((end - now) * 60_000);
}
