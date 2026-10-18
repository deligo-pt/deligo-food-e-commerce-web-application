/**
 * The container deposit (SDR), read one way everywhere.
 *
 * "No deposit" arrives in several shapes: the object missing, `applicable:
 * false`, or an amount of `0` (the product is flagged but no deposit is active
 * — the state the test API is in on 18 Oct 2026). Every screen asks through
 * these functions, so all of them mean the same thing: nothing to show.
 *
 * What is and is not inside each total (`sdr.md` §3):
 * - the **cart** `grandTotal` does NOT include the deposit — show it beside;
 * - the **checkout / order** `payoutSummary.grandTotal` DOES — never add it again.
 *
 * Pure, no imports, so `pnpm verify:sdr` runs it directly.
 */

type ProductLike = {
  sdr?: { applicable?: boolean; depositAmount?: number } | null;
} | null | undefined;

type LineLike = {
  sdr?: {
    applicable?: boolean;
    containers?: number;
    unitDeposit?: number;
    lineTotal?: number;
  } | null;
} | null | undefined;

type TotalsLike = {
  cartCalculation?: { sdrTotal?: number } | null;
  payoutSummary?: { sdr?: { amount?: number } | null } | null;
} | null | undefined;

/** A positive, finite amount rounded to the cent; anything else is 0. */
function money(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : 0;
}

/** Per-unit deposit on a product, or 0. Display only — the server prices it. */
export function productDeposit(product: ProductLike): number {
  const sdr = product?.sdr;
  return sdr?.applicable === true ? money(sdr.depositAmount) : 0;
}

export interface LineDeposit {
  /** Per container. */
  unit: number;
  /** For the whole line. */
  total: number;
  /** Containers charged; the cart omits it, so it is derived there. */
  containers: number;
}

const NO_LINE_DEPOSIT: LineDeposit = { unit: 0, total: 0, containers: 0 };

/** A cart, checkout or order line's deposit; all zeros when it has none. */
export function lineDeposit(line: LineLike): LineDeposit {
  const sdr = line?.sdr;
  if (sdr?.applicable !== true) return NO_LINE_DEPOSIT;
  const unit = money(sdr.unitDeposit);
  const total = money(sdr.lineTotal);
  if (unit === 0 || total === 0) return NO_LINE_DEPOSIT;
  const containers =
    typeof sdr.containers === "number" && sdr.containers > 0
      ? sdr.containers
      : Math.round(total / unit);
  return { unit, total, containers };
}

/**
 * The cart's deposit total (`cartCalculation.sdrTotal`) — NOT in the cart's
 * `grandTotal`, so it is shown as "plus deposit", never added to that figure.
 */
export function cartDepositTotal(cart: TotalsLike): number {
  return money(cart?.cartCalculation?.sdrTotal);
}

/**
 * A checkout's or order's deposit (`payoutSummary.sdr.amount`) — ALREADY in
 * `payoutSummary.grandTotal`. A row for it in the breakdown is fine; adding it
 * to the total again would show more than is charged.
 */
export function orderDepositTotal(summary: TotalsLike): number {
  return money(summary?.payoutSummary?.sdr?.amount);
}
