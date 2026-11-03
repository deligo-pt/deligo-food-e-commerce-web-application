/**
 * Turning the app's two languages into BCP-47 locales, in one place.
 *
 * `Intl` needs a locale tag; the store holds `"en" | "pt"`. Every formatter in
 * this repo has to make the same translation, and three of them had made their
 * own copy of this table before it was pulled out here.
 */
export const DATE_LOCALES: Record<"en" | "pt", string> = {
  en: "en-GB",
  pt: "pt-PT",
};

/**
 * An order's date, as it appears on an order card: `15/08/2026`.
 *
 * Date only, no time — which is what the mobile app's Report an Issue list
 * shows, and enough to tell two orders apart at a glance.
 *
 * The app's screenshot reads `8/15/2026` because that phone was in US English;
 * `en-GB` and `pt-PT` both put the day first. Locale-correct beats
 * pixel-identical here, the same trade `formatDayShort` in `pickupTime.ts`
 * already documents — forcing month-first onto a Portuguese reader to match one
 * screenshot would be a localisation bug dressed as fidelity.
 *
 * Returns an empty string for an unparseable date rather than "Invalid Date".
 */
export function formatOrderDate(
  iso: string | null | undefined,
  lang: "en" | "pt" = "pt",
): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * The store's timezone when a response does not name one. Every DeliGo store is
 * in Portugal today; `GET /checkout/pickup-slots` sends the real value.
 */
export const DEFAULT_STORE_TIME_ZONE = "Europe/Lisbon";

function zonedDateParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: read("year"), month: read("month"), day: read("day") };
}

/**
 * The calendar day `iso` falls on in `timeZone`, as `YYYY-MM-DD` — the format
 * the slots endpoint takes as `date` and returns in `allowedDates`.
 * Empty string for an unparseable date.
 */
export function zonedDateKey(
  iso: string | number | Date,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const { year, month, day } = zonedDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

/**
 * A time of day in the store's timezone: `15:00`. Both languages use the
 * 24-hour clock, as the rest of the app does. Empty string if unparseable.
 */
export function formatInZone(
  iso: string | null | undefined,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
  lang: "en" | "pt" = "pt",
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** A slot window in the store's timezone: `15:00–15:30`. */
export function formatSlotWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
  lang: "en" | "pt" = "pt",
): string {
  const from = formatInZone(start, timeZone, lang);
  const to = formatInZone(end, timeZone, lang);
  if (!from) return "";
  return to ? `${from}–${to}` : from;
}

/** Whole days between two `YYYY-MM-DD` keys (`b - a`). */
function dayKeyDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Which day `iso` is, relative to `now`, in the store's timezone.
 *
 * `offset` is 0 for today and 1 for tomorrow, so callers can say `t("today")` /
 * `t("tomorrow")`; `label` is the short weekday and date for any other day
 * (`qui., 5 de nov.` / `Thu 5 Nov`). Pass `now` from `serverNow()` for countdown
 * screens. Null for an unparseable date.
 */
export function describeZonedDay(
  iso: string | null | undefined,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
  lang: "en" | "pt" = "pt",
  now: number = Date.now(),
): { offset: number; label: string } | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const offset = dayKeyDiff(zonedDateKey(now, timeZone), zonedDateKey(date, timeZone));
  // Plain "pt", not "pt-PT": pt-PT prints the full weekday and a numeric month
  // ("quinta, 5/11"); "pt" gives "qui., 5 de nov.", the same as the pickup
  // chips (`formatDayShort` in pickupTime.ts).
  const label = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);

  return { offset, label };
}
