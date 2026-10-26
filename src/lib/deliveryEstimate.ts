/**
 * The delivery estimate `/vendors/nearby/open` sends with every vendor, worked
 * out by the backend from the position the list was asked for:
 * `estimatedDeliveryTime: { minMinutes, maxMinutes }`, or `null` when it has
 * none (measured 22 Oct 2026: 30–40 for a Dhaka branch asked from Dhaka,
 * 180–190 for the same branch asked from Lisbon, which looks like a cap).
 *
 * The vendor cards show it as it comes. They used to ask Google's distance
 * matrix once per card (up to 100 requests for the home page) and show
 * "Under 10 min" whenever that failed, which read as a fact. The single-vendor
 * routes don't send the field, so the store page still estimates on its own.
 */
export type EstimatedDeliveryTime = {
  minMinutes: number;
  maxMinutes: number;
};

const HOUR = 60;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

type Translate = (key: string) => string;

/**
 * One duration from the backend's minutes, in the largest unit that reads
 * naturally: "45 min", "2h 45m", "3h". Days and weeks only come as ranges —
 * see `formatMinutesRange`.
 */
export function formatMinutes(minutes: number, t: Translate): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < HOUR) return t("deliveryMinutes").replace("{min}", String(total));
  const hours = Math.floor(total / HOUR);
  const rest = total % HOUR;
  return rest === 0
    ? t("durationHours").replace("{h}", String(hours))
    : t("durationHoursMinutes").replace("{h}", String(hours)).replace("{m}", String(rest));
}

/** "2 days", "1–2 weeks": whole units, the low end rounded down and the high end up. */
function wholeUnitRange(min: number, max: number, unit: number, one: string, many: string, range: string, t: Translate): string {
  const low = Math.max(1, Math.floor(min / unit));
  const high = Math.max(low, Math.ceil(max / unit));
  if (low === high) return t(low === 1 ? one : many).replace("{n}", String(low));
  return t(range).replace("{min}", String(low)).replace("{max}", String(high));
}

/**
 * A backend range of minutes as the customer reads it (26 Oct 2026): under an
 * hour stays "30–40 min"; up to a day, hours and minutes ("2h 45m – 2h 55m");
 * then days ("1–2 days"), then weeks ("1–2 weeks"). Only the wording changes —
 * the numbers are the backend's.
 */
export function formatMinutesRange(min: number, max: number, t: Translate): string {
  const low = Math.max(0, Math.round(min));
  const high = Math.max(low, Math.round(max));
  if (high >= WEEK) return wholeUnitRange(low, high, WEEK, "durationWeek", "durationWeeks", "durationWeeksRange", t);
  if (high >= DAY) return wholeUnitRange(low, high, DAY, "durationDay", "durationDays", "durationDaysRange", t);
  if (low === high) return formatMinutes(low, t);
  if (high < HOUR) {
    return t("deliveryMinutesRange").replace("{min}", String(low)).replace("{max}", String(high));
  }
  return `${formatMinutes(low, t)} – ${formatMinutes(high, t)}`;
}

/**
 * The card's text — "30–40 min", "2h 45m – 2h 55m", "1–2 days" — or `null`
 * when there is no usable estimate, in which case the card shows none rather
 * than a guess.
 */
export function deliveryEstimateText(
  estimate: EstimatedDeliveryTime | null | undefined,
  t: Translate,
): string | null {
  const min = Number(estimate?.minMinutes);
  const max = Number(estimate?.maxMinutes);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
  return formatMinutesRange(min, max, t);
}
