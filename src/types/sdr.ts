/**
 * SDR — Portugal's container deposit, as each endpoint reports it (`sdr.md`
 * §3, shapes checked on the test API 18 Oct 2026).
 *
 * Every field is optional: an order or checkout built without a deposit
 * carries none of them, and a product requested with `fields=` lacking `sdr`
 * has no object at all. Read through `lib/sdr.ts`, never directly.
 */

/** `GET /products`, `/products/:productId`, `/products/open[/:productId]`. */
export interface ProductSdr {
  applicable?: boolean;
  /** Containers in one unit. Also on add-on options (`GET /add-ons/:id`). */
  containerCount?: number;
  /** Per container. */
  unitDeposit?: number;
  /** Per unit, the deposit in force now; `0` when not applicable or none is active. */
  depositAmount?: number;
  currency?: string;
}

/**
 * A line's deposit — on the product line and on each of its add-ons. The cart
 * sends `{ applicable, containerCount, totalContainers, unitDeposit, lineTotal }`;
 * checkout and orders send `containers` instead of `totalContainers` (add-ons
 * neither: derived from the totals).
 */
export interface LineSdr {
  applicable?: boolean;
  containers?: number;
  /** The cart's name for `containers`. */
  totalContainers?: number;
  containerCount?: number;
  unitDeposit?: number;
  lineTotal?: number;
}

/** `orderCalculation.sdr` on a checkout or order. Absent when there is no deposit. */
export interface OrderCalculationSdr {
  unitDeposit?: number;
  total?: number;
  currency?: string;
  depositId?: string;
  effectiveFrom?: string;
  custody?: string;
}

/** `payoutSummary.sdr` — `amount` is already inside `payoutSummary.grandTotal`. */
export interface PayoutSdr {
  amount?: number;
}
