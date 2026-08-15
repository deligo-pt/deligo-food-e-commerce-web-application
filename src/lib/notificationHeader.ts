/**
 * What a notification is *about* — the questions the notifications page has to
 * answer before it can draw a header.
 *
 * Three of them: which order does this concern, is it the cart-expiry warning,
 * and which status was it announcing. All three are answered from `data`, never
 * from `title` or `message`.
 *
 * ## Why the title is not a data source
 *
 * `title` and `message` are stored **pre-rendered and English-only** — the
 * backend renders the copy when it sends the notification and keeps the result,
 * so `Accept-Language` has nothing left to resolve (verified: the `en` and `pt`
 * responses are byte-identical). The cart-expiry message even splices both
 * languages into one string with a slash. Reading a status out of "Order
 * Accepted" would put untranslatable English into the very header this exists
 * to make translatable.
 */

import { normalizeOrderStatus } from "./orderStatus";

/** The `data.type` the backend stamps on a cart-expiry warning. */
export const CART_EXPIRY_SUBTYPE = "CART_ITEM_EXPIRY_WARNING";

/**
 * How long after a status change its notification may be written and still be
 * considered a report of that change.
 *
 * Measured across every notification on the test account, the gap is 0.1–0.3
 * seconds — the two records are written together. 60s is generous enough to
 * absorb any plausible queue delay while still refusing to label a notification
 * that has nothing to do with a status change.
 */
const STATUS_MATCH_WINDOW_MS = 60_000;

export interface NotificationLike {
  createdAt?: string | null;
  data?: {
    orderId?: string | null;
    status?: string | null;
    type?: string | null;
  } | null;
}

export interface OrderStatusSource {
  orderStatus?: string | null;
  statusHistory?:
    | ({ status?: string | null; timestamp?: string | null } | null)[]
    | null;
}

/**
 * The order this notification concerns (`ORD-…`), or null.
 *
 * Null is a real answer, not a failure: the cart-expiry warning genuinely has
 * no order, so the header falls back to the backend's title for it.
 */
export function getNotificationOrderId(
  notification: NotificationLike | null | undefined,
): string | null {
  return notification?.data?.orderId?.trim() || null;
}

/** Is this the "your cart is about to expire" warning? */
export function isCartExpiryNotification(
  notification: NotificationLike | null | undefined,
): boolean {
  return notification?.data?.type === CART_EXPIRY_SUBTYPE;
}

/**
 * Which order status this notification was announcing.
 *
 * 1. `data.status` — what the backend itself said. Authoritative, costs nothing.
 * 2. The `statusHistory` entry nearest in time to when the notification was
 *    written. See below.
 * 3. The order's current status — last resort, and knowingly imperfect: an old
 *    notification would be labelled with today's status. Only reachable when
 *    the order has no history entry anywhere near the notification.
 * 4. `null`, so the header renders `Order #XXX` with no dangling separator.
 *
 * ## Step 2 is a workaround, and should be deleted
 *
 * Only 4 of 13 order notifications on the test account declare `data.status` —
 * `PREPARING` and `READY_FOR_PICKUP` do, while `Order Accepted` (the most
 * common of all), `Order Rejected` and the not-collected cancellation do not.
 * The day the backend fills that field in for every notification, this branch
 * becomes dead code and goes.
 *
 * ## Why *nearest*, rather than "the last entry at or before"
 *
 * Both records are written by the same server at the same moment, so which one
 * carries the earlier timestamp is down to sub-second ordering — measured, the
 * history entry lands 0.1–0.3s *before* the notification, but nothing
 * guarantees that direction. "At or before" breaks the moment it flips, and a
 * grace window wide enough to absorb the flip is also wide enough to cause a
 * worse bug: the tightest real pair, `PREPARING` → `READY_FOR_PICKUP`, is
 * **1.4 seconds apart**, so a 5s grace would resolve both notifications to the
 * later status.
 *
 * Nearest-absolute has neither failure. Verified against all 13: every one
 * matched its own entry, largest delta 0.3s, and where `data.status` also
 * existed the two agreed 4 times out of 4.
 */
export function resolveNotificationStatus(
  notification: NotificationLike | null | undefined,
  order: OrderStatusSource | null | undefined,
): string | null {
  const declared = normalizeOrderStatus(notification?.data?.status);
  if (declared) return declared;

  const at = Date.parse(notification?.createdAt ?? "");
  const history = order?.statusHistory;

  if (!Number.isNaN(at) && Array.isArray(history)) {
    let best: string | null = null;
    let bestDistance = Infinity;

    for (const entry of history) {
      const status = normalizeOrderStatus(entry?.status);
      if (!status) continue;
      const stamp = Date.parse(entry?.timestamp ?? "");
      if (Number.isNaN(stamp)) continue;

      const distance = Math.abs(stamp - at);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = status;
      }
    }

    if (best && bestDistance <= STATUS_MATCH_WINDOW_MS) return best;
  }

  return normalizeOrderStatus(order?.orderStatus) || null;
}
