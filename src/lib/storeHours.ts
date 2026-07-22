// Store opening/closing-hours helpers for the "closing soon" countdown.
//
// The backend stores `openingHours`/`closingHours` as free-form strings in a
// *mixed* format — some vendors use 12-hour ("7:00 AM", often with a narrow
// no-break space U+202F before AM/PM), others 24-hour ("19:25"). There is no
// per-vendor timezone, so hours are treated as store-local Portugal time
// (Europe/Lisbon) and "now" is computed in that zone so the countdown is
// correct regardless of the viewer's device timezone.

// Store-local timezone. Swap for a per-vendor field if the backend ever adds one.
export const STORE_TIMEZONE = "Europe/Lisbon";

const MINUTES_PER_DAY = 24 * 60;

// Parses a clock string into minutes-since-midnight, or `null` if unparseable.
// Accepts "H:MM AM/PM", "HH:MM AM/PM" and 24-hour "H:MM" / "HH:MM". Any spaces
// (including U+202F / U+00A0) around AM/PM are normalized first.
export function parseTimeToMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null;

  const cleaned = raw
    .replace(/[  ]/g, " ") // narrow / non-breaking spaces → normal space
    .trim()
    .toUpperCase();

  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

// Current wall-clock in the given timezone, as { minutes-since-midnight, seconds,
// weekday }. Uses Intl so it stays correct across DST without hardcoding offsets.
export function nowInTimezone(tz: string = STORE_TIMEZONE): {
  minutes: number;
  seconds: number;
  weekday: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  return {
    minutes: hour * 60 + minute,
    seconds: second,
    weekday: get("weekday"), // e.g. "Wednesday"
  };
}

// Whether today (store-local) is one of the vendor's closing days. `closingDays`
// comes back inconsistently — full names ("Sunday") or short forms ("thu_short"),
// any case — so we match the weekday's first three letters against each entry.
export function isClosingDayToday(
  closingDays: string[] | null | undefined,
  tz: string = STORE_TIMEZONE,
): boolean {
  if (!closingDays?.length) return false;
  const { weekday } = nowInTimezone(tz);
  const todayPrefix = weekday.slice(0, 3).toLowerCase(); // "wed"
  return closingDays.some(
    (d) => typeof d === "string" && d.trim().slice(0, 3).toLowerCase() === todayPrefix,
  );
}

// Milliseconds remaining until the store closes, or `null` when a countdown
// doesn't apply: unparseable hours, a 24h/always-open store (open == close),
// today is a closing day, or the store is already flagged closed. A closing
// time at or before "now" is treated as the next day (overnight close).
export function getMsUntilClosing(
  closingHours: string | null | undefined,
  opts: {
    openingHours?: string | null;
    closingDays?: string[] | null;
    isStoreOpen?: boolean;
    tz?: string;
  } = {},
): number | null {
  const { openingHours, closingDays, isStoreOpen, tz = STORE_TIMEZONE } = opts;

  if (isStoreOpen === false) return null;
  if (isClosingDayToday(closingDays, tz)) return null;

  const closeMin = parseTimeToMinutes(closingHours);
  if (closeMin === null) return null;

  // Same open/close time signals an always-open store — no meaningful countdown.
  const openMin = parseTimeToMinutes(openingHours);
  if (openMin !== null && openMin === closeMin) return null;

  const now = nowInTimezone(tz);
  const nowSecondsIntoDay = now.minutes * 60 + now.seconds;
  let closeSecondsIntoDay = closeMin * 60;

  // Overnight / already-passed close → it's tomorrow.
  if (closeSecondsIntoDay <= nowSecondsIntoDay) {
    closeSecondsIntoDay += MINUTES_PER_DAY * 60;
  }

  return (closeSecondsIntoDay - nowSecondsIntoDay) * 1000;
}
