/**
 * Which steps the order tracking timeline should show.
 *
 * A live order walks the full happy path, so it shows the full path — the
 * grey steps ahead are a promise of what is coming. A rejected or cancelled
 * order never gets there: showing "Preparing" and "On the way" ticked off
 * above a rejection claims a restaurant cooked and dispatched food it refused.
 * For those, the timeline is cut down to what actually happened, exactly as the
 * mobile app renders it: the steps recorded in `statusHistory`, then the
 * rejection or cancellation itself.
 */

import { isTerminatedStatus } from "./refund";
import {
  normalizeOrderStatus,
  getStatusNote,
  type OrderWithStatusHistory,
} from "./orderStatus";

/** The customer-facing happy path for a delivered order, in order. */
export const PROGRESS_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "ON_THE_WAY",
] as const;

/**
 * The happy path for an order the customer collects themselves.
 *
 * `PICKED_UP` and `ON_THE_WAY` are dropped: both describe a courier, and a
 * self-pickup order never has one. Showing them would promise a rider who is
 * never coming, and `READY_FOR_PICKUP` — which for delivery means "a rider is
 * about to collect this" — for pickup means "it is on the counter waiting for
 * you", which is the last thing that happens before the customer walks in.
 *
 * Confirmed against the real order `ORD-4TN7D8381H`, whose `statusHistory` ran
 * PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP.
 *
 * The list stops before the ending. `PICKED_UP_BY_CUSTOMER` — the status the
 * order reaches when the vendor types the pickup code in — is appended by
 * `getTimelineStepKeys` rather than living here, for the same reason
 * `DELIVERED` is appended to the delivery path: it is the destination, not a
 * step the order is currently working through.
 */
export const PICKUP_PROGRESS_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
] as const;

/**
 * Where a self-pickup order ends up once the vendor verifies the code.
 *
 * Confirmed on the real order `ORD-4TN7D8381H`, whose history records
 * `PICKED_UP_BY_CUSTOMER` with the note "Pickup code verified at counter." at
 * the same instant `pickup.verifiedAt` was stamped.
 *
 * Not to be confused with `PICKED_UP`, which is a *rider* collecting from the
 * restaurant — a mid-journey delivery status, not an ending.
 */
export const PICKUP_COMPLETED_STATUS = "PICKED_UP_BY_CUSTOMER";

/**
 * Whether this order is collected by the customer.
 *
 * Tests for `PICKUP` rather than "not DELIVERY" on purpose: orders created
 * before the fulfilment field existed carry `fulfillmentType: null` (17 of 19
 * on the test account), and every one of those is a delivery.
 */
export function isPickupOrder(order: { fulfillmentType?: string | null } | null | undefined): boolean {
  return order?.fulfillmentType === "PICKUP";
}

/**
 * Fold statuses that are not steps of their own onto the step they belong to.
 * `ASSIGNED` is a dispatch detail — a rider was attached to an order the
 * restaurant had already accepted — and never had a row in this timeline.
 */
export function toTimelineStatus(status: string | null | undefined): string {
  const normalized = normalizeOrderStatus(status);
  return normalized === "ASSIGNED" ? "ACCEPTED" : normalized;
}

export interface TimelineOrder extends OrderWithStatusHistory {
  rejectReason?: string | null;
  fulfillmentType?: string | null;
}

/**
 * The ordered step keys for this order's timeline. Always at least two entries,
 * and the order's own status is always the last one.
 */
export function getTimelineStepKeys(
  order: TimelineOrder | null | undefined,
): string[] {
  const isPickup = isPickupOrder(order);
  // Widened to `readonly string[]`: the two tuples have different literal
  // unions, and the code below compares against a status string the backend
  // may not have told us about yet.
  const progress: readonly string[] = isPickup
    ? PICKUP_PROGRESS_STATUSES
    : PROGRESS_STATUSES;

  if (!isTerminatedStatus(order?.orderStatus)) {
    if (!isPickup) return [...progress, "DELIVERED"];

    // Normally the pickup path ends at its completed status, the same way the
    // delivery path ends at DELIVERED. The extra branch is a safety net: should
    // the backend ever move an order into a pickup status this build has never
    // heard of, that status is appended rather than dropped, so the timeline
    // shows the customer's real position instead of collapsing to step one
    // (which is what `getTimelineStepIndex`'s -1 fallback would otherwise do).
    const current = normalizeOrderStatus(order?.orderStatus);
    if (progress.includes(current) || current === PICKUP_COMPLETED_STATUS) {
      return [...progress, PICKUP_COMPLETED_STATUS];
    }
    return [...progress, current];
  }

  // `PENDING` is not read from the history — an order that exists was created
  // pending, so that step is true by construction even if the backend only
  // starts recording history at the first transition.
  const reached = new Set<string>(["PENDING"]);
  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  for (const entry of history) {
    reached.add(toTimelineStatus(entry?.status));
  }

  return [
    ...progress.filter((status) => reached.has(status)),
    normalizeOrderStatus(order?.orderStatus),
  ];
}

/**
 * How far along the timeline this order has got, as an index into
 * `getTimelineStepKeys`. Falls back to the first step rather than -1, so an
 * unrecognised status still renders a sane timeline.
 */
export function getTimelineStepIndex(
  order: TimelineOrder | null | undefined,
): number {
  const keys = getTimelineStepKeys(order);
  const index = keys.indexOf(toTimelineStatus(order?.orderStatus));
  return index === -1 ? 0 : index;
}

/**
 * Why the order ended this way, in the vendor's own words. The status note is
 * the primary source; `rejectReason` is a top-level duplicate the API also
 * returns on rejected orders, kept as a fallback in case the history entry is
 * written without one.
 */
export function getTerminalReason(
  order: TimelineOrder | null | undefined,
): string | null {
  const note = getStatusNote(order);
  if (note) return note;
  // `|| null` and not `?? null`: a reason of "   " trims to "" and must fall
  // through to the caller's own copy, not render as a blank line.
  return order?.rejectReason?.trim() || null;
}
