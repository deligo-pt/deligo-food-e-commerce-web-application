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
 *
 * Since customer-side cancellation shipped, orders also carry an explicit
 * `refundStatus`, which this module prefers — see `getRefundState`.
 */

import {
  isCompletedStatus,
  isTerminatedStatus,
  normalizeOrderStatus,
} from "./orderStatus";

export type RefundState = "none" | "not_eligible" | "in_progress" | "completed";

/**
 * The backend's own verdict on the money, present on any order that has been
 * cancelled through `PATCH /orders/:orderId/cancel` (and absent on orders that
 * were never cancelled).
 *
 * Confirmed against the test API: cancelling before the vendor accepts gives
 * `REFUNDED` outright for a wallet payment; cancelling afterwards gives
 * `NOT_APPLICABLE`. `PENDING` is the documented in-flight value for refunds
 * that do not settle synchronously.
 */
export type RefundStatus = "NOT_APPLICABLE" | "PENDING" | "REFUNDED";

const REFUND_STATUS_STATES: Record<RefundStatus, RefundState> = {
  NOT_APPLICABLE: "not_eligible",
  PENDING: "in_progress",
  REFUNDED: "completed",
};

/**
 * Which statuses end an order with the customer's money already taken now lives
 * in `lib/orderStatus`, alongside the rest of the vocabulary and — crucially —
 * alongside `getOrderBucket`, which has to agree with it. Re-exported here so
 * the callers that have always asked this module keep working.
 */
export { isTerminatedStatus };

/** The subset of an order this module reads. */
export interface RefundableOrder {
  orderStatus?: string | null;
  paymentStatus?: string | null;
  isPaid?: boolean | null;
  refundStatus?: string | null;
}

export function getRefundState(order: RefundableOrder | null | undefined): RefundState {
  if (!order || !isTerminatedStatus(order.orderStatus)) return "none";

  // `refundStatus` outranks everything below it. The payment fields cannot tell
  // "cancelled too late, no refund" apart from "cancelled in time, money on its
  // way" — both sit at paymentStatus PAID / isPaid true — so without this a
  // customer who cancelled after the restaurant accepted was promised a refund
  // that is never coming.
  const declared = (order.refundStatus ?? "").toUpperCase();
  const mapped = REFUND_STATUS_STATES[declared as RefundStatus];
  if (mapped) return mapped;

  // No `refundStatus`: a vendor-side rejection, or an order that predates the
  // field. Fall back to reading the payment fields.
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
  // Covers both endings — delivered, and collected by the customer. Reading
  // only `DELIVERED` here left a collected pickup order polling at the live
  // cadence indefinitely, because its status is settled but does not match.
  if (isCompletedStatus(order.orderStatus)) return true;
  return (
    isTerminatedStatus(order.orderStatus) && getRefundState(order) !== "in_progress"
  );
}

/**
 * Statuses past the point of no return. `DELIVERED` and
 * `PICKED_UP_BY_CUSTOMER` are the two ways an order completes — the customer
 * has the food either way — and the other two mean the order is already dead.
 * The API answers a cancel at any of these with
 * `ORDER_CANNOT_BE_CANCELED_OR_REJECTED_AT_STAGE`.
 *
 * `PICKED_UP_BY_CUSTOMER` was missing here, which offered a Cancel button on an
 * order the customer had already walked out with.
 */
const UNCANCELLABLE_STATUSES = new Set([
  "DELIVERED",
  "PICKED_UP_BY_CUSTOMER",
  "CANCELLED",
  "REJECTED",
]);

/** The subset of an order `canCancelOrder` reads. */
export interface CancellableOrder {
  orderStatus?: string | null;
  isPaid?: boolean | null;
}

/**
 * May the customer still call off this order?
 *
 * Deliberately does not ask whether a refund would follow — that is the
 * backend's call, made at cancel time, and reported back as `refundStatus`.
 * This only answers whether the button should be on screen at all.
 */
export function canCancelOrder(order: CancellableOrder | null | undefined): boolean {
  if (!order) return false;

  const status = normalizeOrderStatus(order.orderStatus);
  if (!status || UNCANCELLABLE_STATUSES.has(status)) return false;

  // Only paid orders can be cancelled (`ONLY_PAID_ORDER_CAN_BE_CANCELED`).
  // Tested against `false` rather than truthiness so an order whose response
  // omits the field is still offered the button rather than silently losing it.
  return order.isPaid !== false;
}

const LABEL_KEYS: Record<Exclude<RefundState, "none">, string> = {
  not_eligible: "refundNotEligible",
  in_progress: "refundInProgress",
  completed: "refundCompleted",
};

const DESCRIPTION_KEYS: Record<Exclude<RefundState, "none">, string> = {
  not_eligible: "refundNotEligibleDescription",
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
