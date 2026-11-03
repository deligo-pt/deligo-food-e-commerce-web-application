/**
 * The small order fee (guide §3). A platform fee the backend adds when the
 * basket (items only, before offers) is strictly below a global threshold.
 * Off by default, when every field is `0` and nothing is rendered.
 *
 * Every figure is the backend's: the threshold, fee and tax are never
 * hard-coded or recomputed here, only added up for display.
 */

/** The fee fields as cart, checkout and order responses carry them. */
export interface SmallOrderFeeFields {
  smallOrderFee?: number | null;
  smallOrderFeeTax?: number | null;
  smallOrderFeeTaxRate?: number | null;
}

const amount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

const cents = (value: number) => Math.round(value * 100) / 100;

/** What the customer pays for the fee: net + tax. `0` when there is none. */
export function smallOrderFeeGross(calc: SmallOrderFeeFields | null | undefined): number {
  return cents(amount(calc?.smallOrderFee) + amount(calc?.smallOrderFeeTax));
}

export interface SmallOrderFeeNudge {
  /** Fee + tax the basket would pay. */
  fee: number;
  /** How much more to add to avoid it. */
  differenceToFree: number;
  /** `grandTotal + differenceToFree`. */
  threshold: number;
  /** 0–1, `grandTotal / threshold`. */
  progress: number;
}

/**
 * The cart nudge, or null when it should not show. Shown only when
 * `smallOrderFee > 0 && differenceToFree > 0`; waived and disabled look the
 * same (all zeros), so neither says anything.
 */
export function smallOrderFeeNudge(
  calc: (SmallOrderFeeFields & { grandTotal?: number | null; differenceToFree?: number | null }) | null | undefined,
): SmallOrderFeeNudge | null {
  const net = amount(calc?.smallOrderFee);
  const differenceToFree = amount(calc?.differenceToFree);
  if (net <= 0 || differenceToFree <= 0) return null;
  const grandTotal = amount(calc?.grandTotal);
  const threshold = cents(grandTotal + differenceToFree);
  return {
    fee: smallOrderFeeGross(calc),
    differenceToFree: cents(differenceToFree),
    threshold,
    progress: threshold > 0 ? Math.min(1, grandTotal / threshold) : 0,
  };
}
