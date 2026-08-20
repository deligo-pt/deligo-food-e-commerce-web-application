/**
 * Which icon a notification row gets.
 *
 * Split out of `NotificationsPage` so the rule is a value, not a JSX detail:
 * the page maps these kinds to lucide components, and this file decides which
 * kind applies. That split is the point — the decision below is testable
 * (`pnpm verify:notifications`), a `<Bike />` inside a render tree is not.
 *
 * ## The rule this exists to enforce
 *
 * Every `ORDER` notification used to draw a **bike**, including the ones for
 * orders the customer collects themselves. Nobody rides to a self-pickup
 * order, so the icon was announcing a rider who does not exist. `ORDER` now
 * splits on fulfilment: `delivery` keeps the bike, `pickup` gets the storefront
 * the rest of the app already uses for self-pickup (the `OrderCard` badge, the
 * checkout pickup card, the payment page's chip).
 *
 * The fulfilment type is **not on the notification** — `data` carries only
 * `orderId`, `status`, `orderStatus` and `type` — so it has to come from the
 * order the notification points at. That is why `getNotificationIconKind`
 * takes the order as a second argument, and why the notifications page fetches
 * its order index for *any* order notification rather than only for ones
 * missing a status.
 */

import { isPickupOrder } from "./orderTimeline";

/**
 * The icons the notifications list can draw, named by meaning rather than by
 * glyph so swapping the glyph is not a semantic change.
 */
export type NotificationIconKind =
  | "delivery"
  | "pickup"
  | "promo"
  | "security"
  | "delivered"
  | "generic";

/**
 * @param type    the backend's `notification.type` — an open string, not a
 *                closed union: `OTHER` is real (cart-expiry warnings arrive
 *                that way) and the server may invent more.
 * @param order   the order this notification concerns, when one is known.
 *                Absent or unresolved means the bike, because an order the
 *                index has not answered for is far more likely to be a
 *                delivery than a pickup, and `isPickupOrder` already treats
 *                legacy `fulfillmentType: null` that way.
 */
export function getNotificationIconKind(
  type: string | null | undefined,
  order: { fulfillmentType?: string | null } | null | undefined,
): NotificationIconKind {
  switch (type) {
    case "ORDER":
      return isPickupOrder(order) ? "pickup" : "delivery";
    case "PROMO":
      return "promo";
    case "SECURITY":
      return "security";
    case "DELIVERED":
      return "delivered";
    default:
      return "generic";
  }
}
