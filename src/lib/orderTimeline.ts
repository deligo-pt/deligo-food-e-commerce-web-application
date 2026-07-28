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

/** The customer-facing happy path, in order. */
export const PROGRESS_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "ON_THE_WAY",
] as const;

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
}

/**
 * The ordered step keys for this order's timeline. Always at least two entries,
 * and the order's own status is always the last one.
 */
export function getTimelineStepKeys(
  order: TimelineOrder | null | undefined,
): string[] {
  if (!isTerminatedStatus(order?.orderStatus)) {
    return [...PROGRESS_STATUSES, "DELIVERED"];
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
    ...PROGRESS_STATUSES.filter((status) => reached.has(status)),
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
