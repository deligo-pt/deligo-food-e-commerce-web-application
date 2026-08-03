import { apiClient } from "@/lib/apiClient";

/**
 * `PATCH /orders/:orderId/cancel` — the customer calls off their own order.
 *
 * `reason` is mandatory (the API rejects a missing or empty string with a Zod
 * error on `body.reason`) and is stored on the order as `cancelReason`, as well
 * as being written as the note on the `CANCELED` entry in `statusHistory` —
 * which is what the tracking timeline renders under the terminal step.
 *
 * Whether the money comes back is *not* decided here. The backend refunds only
 * when the vendor has not accepted yet, and reports which way it went on the
 * updated order's `refundStatus`. See `getRefundState` in `lib/refund`.
 *
 * Two errors are worth knowing about, both meaning "this order has moved on
 * since the page was painted" — they are given customer-facing copy in
 * `ERROR_KEY_MESSAGES`:
 *   ONLY_PAID_ORDER_CAN_BE_CANCELED
 *   ORDER_CANNOT_BE_CANCELED_OR_REJECTED_AT_STAGE
 *
 * Takes the human-readable `orderId` (`ORD-…`), not the Mongo `_id`, matching
 * every other order route in this app.
 *
 * Returns the updated order so a caller holding it in local state can repaint
 * without waiting for a refetch. Typed `unknown` because the Order shape is not
 * modelled in this app.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
): Promise<unknown> {
  const res = await apiClient.patch(`/orders/${orderId}/cancel`, { reason });
  return res.data?.data;
}
