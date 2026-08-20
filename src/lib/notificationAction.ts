/**
 * The one action button under a notification row.
 *
 * Sibling of `notificationHeader` (what the row says) and `notificationIcon`
 * (what it draws) — this is what it offers. Same reason for existing: the rule
 * is a decision about backend data, so it belongs where it can be asserted
 * (`pnpm verify:notifications`) rather than inside a render tree.
 *
 * ## Rate, not Track, once the order is finished
 *
 * A delivered order has nothing left to track — the tracking page shows a
 * completed timeline and a map of a journey that ended. What the customer can
 * still do is rate it, which is the single action the order card offers for the
 * same order on `/orders`.
 */

import { isCompletedStatus } from "./orderStatus";
import { isCartExpiryNotification, type NotificationLike } from "./notificationHeader";

export type NotificationActionKind = "rate" | "track" | "cart" | "none";

export interface NotificationAction {
  kind: NotificationActionKind;
  /** Where the button goes. `""` for `none`, which is not rendered. */
  href: string;
  /** A key for `t()`, never copy — the row is translated, the data is not. */
  labelKey: string;
}

const NO_ACTION: NotificationAction = { kind: "none", href: "", labelKey: "" };

/** The order this notification concerns, as far as the action cares. */
export interface ActionOrderSource {
  orderStatus?: string | null;
}

/**
 * @param notification the stored notification.
 * @param order        the order it names, when the index has answered for it.
 *
 * The order's **current** status decides the button, not the status the
 * notification announced: "Rate Order" is about what can be done now, so an
 * "Order Accepted" notification for an order that has since been delivered
 * offers the rating too. `data.status` is consulted only when the order is
 * unknown — it drops out of the index once it is older than the hundred most
 * recent — and is the announced status, which for a `DELIVERED` notification is
 * the right answer anyway.
 *
 * Keyed on having an order id rather than on `type === "ORDER"`, so a
 * notification of any type that names an order gets a working button.
 */
export function getNotificationAction(
  notification: NotificationLike | null | undefined,
  order: ActionOrderSource | null | undefined,
): NotificationAction {
  if (isCartExpiryNotification(notification)) {
    // No id travels in this one and none is needed: there is exactly one cart
    // per customer.
    return { kind: "cart", href: "/cart", labelKey: "viewCart" };
  }

  const orderId = notification?.data?.orderId?.trim();
  if (!orderId) return NO_ACTION;

  const status = order?.orderStatus ?? notification?.data?.status;
  if (isCompletedStatus(status)) {
    // `/orders` rather than a deep link: that route is statically rendered and
    // reading a search param there would opt it out (`OrdersPage.tsx`). Which
    // order to rate travels in `stores/orderRatingStore` instead.
    return { kind: "rate", href: "/orders", labelKey: "rateOrder" };
  }

  return {
    kind: "track",
    href: `/orders/track-order/${encodeURIComponent(orderId)}`,
    labelKey: "trackOrder",
  };
}
