/**
 * Refund state for an order the customer already paid for.
 *
 * When a vendor rejects or cancels a paid order the money goes back, but
 * `orderStatus` does not move again — it stays `REJECTED`/`CANCELED` for the
 * whole refund. The transition is visible only on the payment fields:
 *
 *   refund pending    paymentStatus: "PAID"      isPaid: true
 *   refund settled    paymentStatus: "REFUNDED"  isPaid: false
 *
 * So anything keyed off `orderStatus` alone cannot see a refund happen.
 */

import { normalizeOrderStatus } from "./orderStatus";

export type RefundState = "none" | "in_progress" | "completed";

/**
 * Statuses that end an order with the customer's money already taken.
 *
 * `normalizeOrderStatus` folds the API's `CANCELED` onto `CANCELLED`, so both
 * spellings match here without this module having to know about the split.
 */
const TERMINATED_STATUSES = new Set(["REJECTED", "CANCELLED"]);

export function isTerminatedStatus(orderStatus: string | null | undefined): boolean {
  return TERMINATED_STATUSES.has(normalizeOrderStatus(orderStatus));
}

/** The subset of an order this module reads. */
export interface RefundableOrder {
  orderStatus?: string | null;
  paymentStatus?: string | null;
  isPaid?: boolean | null;
}

export function getRefundState(order: RefundableOrder | null | undefined): RefundState {
  if (!order || !isTerminatedStatus(order.orderStatus)) return "none";

  const paymentStatus = (order.paymentStatus ?? "").toUpperCase();

  // Tested before `isPaid`, which the backend flips back to false once the
  // refund settles — reading payment first would report a finished refund as an
  // order that was never paid for.
  if (paymentStatus === "REFUNDED") return "completed";

  // The order is dead and we are still holding the money.
  if (order.isPaid === true || paymentStatus === "PAID") return "in_progress";

  // Terminated without payment ever settling. Nothing to refund, and no banner
  // — one here would promise money that is not coming. In practice the API only
  // lets a vendor act on `isPaid: true` orders, so this is the defensive case.
  return "none";
}

/**
 * Is there anything left to wait for on this order?
 *
 * Not the same question as "has `orderStatus` stopped moving". A rejected order
 * whose refund is still in flight has a settled `orderStatus` and an unsettled
 * `paymentStatus`, so treating status alone as the end of the story would leave
 * a tracking page frozen on "Refund In Progress" for the rest of its life.
 */
export function isOrderFinished(order: RefundableOrder | null | undefined): boolean {
  if (!order) return false;
  if (normalizeOrderStatus(order.orderStatus) === "DELIVERED") return true;
  return (
    isTerminatedStatus(order.orderStatus) && getRefundState(order) !== "in_progress"
  );
}

const LABEL_KEYS: Record<Exclude<RefundState, "none">, string> = {
  in_progress: "refundInProgress",
  completed: "refundCompleted",
};

const DESCRIPTION_KEYS: Record<Exclude<RefundState, "none">, string> = {
  in_progress: "refundInProgressDescription",
  completed: "refundCompletedDescription",
};

/** Heading key, or null when there is no refund to announce. */
export function refundStateLabelKey(state: RefundState): string | null {
  return state === "none" ? null : LABEL_KEYS[state];
}

/** Sub-text key, or null when there is no refund to announce. */
export function refundStateDescriptionKey(state: RefundState): string | null {
  return state === "none" ? null : DESCRIPTION_KEYS[state];
}
