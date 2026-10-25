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
 * Add-on options carry their own deposit (25 Oct 2026): each add-on line has
 * an `sdr` beside the product's, charged per add-on unit × its containers and
 * NOT multiplied by the product quantity. A line's deposit is the two together.
 *
 * Pure, no imports, so `pnpm verify:sdr` runs it directly.
 */

type ItemSdr = {
  applicable?: boolean;
  /** Containers in one unit (a 6-pack carries 6). */
  containerCount?: number;
  /** Per container. */
  unitDeposit?: number;
  /** Older shape: the deposit for one unit. */
  depositAmount?: number;
} | null | undefined;

type ProductLike = { sdr?: ItemSdr } | null | undefined;

type LineSdrLike = {
  applicable?: boolean;
  /** Checkout and orders. */
  containers?: number;
  /** The cart. */
  totalContainers?: number;
  unitDeposit?: number;
  lineTotal?: number;
} | null | undefined;

type LineLike = {
  sdr?: LineSdrLike;
  addons?: ({ sdr?: LineSdrLike } | null | undefined)[] | null;
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

/** Deposit for one unit of an item: per container × its containers, or 0. */
function itemDeposit(sdr: ItemSdr): number {
  if (sdr?.applicable !== true) return 0;
  const perContainer = money(sdr.unitDeposit);
  if (perContainer === 0) return money(sdr.depositAmount);
  const count = typeof sdr.containerCount === "number" && sdr.containerCount >= 1 ? sdr.containerCount : 1;
  return money(perContainer * count);
}

/** Per-unit deposit on a product, or 0. Display only — the server prices it. */
export function productDeposit(product: ProductLike): number {
  return itemDeposit(product?.sdr);
}

/** Per-unit deposit on an add-on option (`GET /add-ons/:id`), or 0. */
export function addonDeposit(option: { sdr?: ItemSdr } | null | undefined): number {
  return itemDeposit(option?.sdr);
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

/** One `sdr` block (the product's or an add-on's) on a line. */
function sdrPart(sdr: LineSdrLike): LineDeposit {
  if (sdr?.applicable !== true) return NO_LINE_DEPOSIT;
  const unit = money(sdr.unitDeposit);
  const total = money(sdr.lineTotal);
  if (unit === 0 || total === 0) return NO_LINE_DEPOSIT;
  const counted = sdr.containers ?? sdr.totalContainers;
  const containers =
    typeof counted === "number" && counted > 0 ? counted : Math.round(total / unit);
  return { unit, total, containers };
}

/** One add-on line's own deposit (it is also inside `lineDeposit`'s total). */
export function addonLineDeposit(addon: { sdr?: LineSdrLike } | null | undefined): LineDeposit {
  return sdrPart(addon?.sdr);
}

/**
 * A cart, checkout or order line's deposit — the product's and its add-ons'
 * together; all zeros when it has none. One deposit is in force at a time, so
 * every part shares the per-container `unit`.
 */
export function lineDeposit(line: LineLike): LineDeposit {
  const parts = [line?.sdr, ...(line?.addons ?? []).map((addon) => addon?.sdr)]
    .map(sdrPart)
    .filter((part) => part.total > 0);
  if (parts.length === 0) return NO_LINE_DEPOSIT;
  return {
    unit: parts[0].unit,
    total: money(parts.reduce((sum, part) => sum + part.total, 0)),
    containers: parts.reduce((sum, part) => sum + part.containers, 0),
  };
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
