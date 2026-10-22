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

/**
 * "30–40 min" (or "30 min" when both ends agree), or `null` when there is no
 * usable estimate, in which case the card shows none rather than a guess.
 */
export function deliveryEstimateText(
  estimate: EstimatedDeliveryTime | null | undefined,
  t: (key: string) => string,
): string | null {
  const min = Number(estimate?.minMinutes);
  const max = Number(estimate?.maxMinutes);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
  const low = Math.round(min);
  const high = Math.round(max);
  return low === high
    ? t("deliveryMinutes").replace("{min}", String(low))
    : t("deliveryMinutesRange").replace("{min}", String(low)).replace("{max}", String(high));
}
