/**
 * What an order status is *called* on screen, in its short form.
 *
 * Short deliberately. The tracking timeline in `TrackOrder` has its own longer
 * copy — "Order Pending", "Order Accepted" — because each of those is a row in
 * a list of steps and reads as a sentence fragment. This module serves the
 * places where the status is a *suffix* to something that already says "Order":
 * a chip, or the notification header `Order #ORD-XXXX — Accepted`. Repeating
 * the word there would read "Order #ORD-XXXX — Order Accepted".
 *
 * So the two label sets are legitimately different and are not merged. What
 * they do share is `humanizeStatus`, which lives here as the single fallback
 * for a status no build has copy for.
 */

import { normalizeOrderStatus } from "./orderStatus";

/**
 * Status → translation key. Every one of these keys already existed in both
 * dictionaries before this module did, except `notCollected`.
 *
 * `ASSIGNED` folds onto "Accepted" for the same reason `toTimelineStatus` folds
 * it: a rider being attached is a dispatch detail, not a stage the customer is
 * waiting through, and the restaurant had already accepted.
 */
export const STATUS_LABEL_KEYS: Record<string, string> = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  ASSIGNED: "accepted",
  PREPARING: "preparing",
  READY_FOR_PICKUP: "readyForPickup",
  PICKED_UP: "pickedUp",
  ON_THE_WAY: "onTheWay",
  DELIVERED: "delivered",
  PICKED_UP_BY_CUSTOMER: "orderCollected",
  REJECTED: "rejected",
  // `normalizeOrderStatus` folds the API's one-L `CANCELED` onto this spelling.
  CANCELLED: "cancelled",
  // The ending for a pickup order nobody came to collect. The API's own name is
  // `NO_SHOW`, which describes the customer; the label describes the order.
  NO_SHOW: "notCollected",
};

/**
 * Last-resort label for a status this build has no copy for.
 *
 * Turning `SOME_NEW_STATUS` into "Some New Status" is presentation of a value
 * the backend sent, not copy invented here — which is why it is untranslated
 * and deliberately plain. It should stop appearing the moment a real status
 * gets a real key.
 *
 * Moved out of `TrackOrder.tsx` when the notification header needed the same
 * fallback: two copies of this would drift the first time one was tweaked.
 */
export function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The short display label for a status, or `null` when there is no status at
 * all.
 *
 * Null rather than an empty string so callers can tell "no status to show" from
 * "a status that renders as blank", and drop the separator around it instead of
 * printing a dangling dash.
 */
export function getOrderStatusLabel(
  status: string | null | undefined,
  t: (key: string) => string,
): string | null {
  const normalized = normalizeOrderStatus(status);
  if (!normalized) return null;

  const key = STATUS_LABEL_KEYS[normalized];
  return key ? t(key) : humanizeStatus(normalized);
}
