import type { RateableOrder, RatingStatus } from "@/types/rating";

/**
 * What is left to rate on an order.
 *
 * Split from `lib/ratings.ts` deliberately: that module imports the axios
 * client, and a module that reaches the network cannot be loaded by a
 * `verify:*` script. These two functions decide what the Rate button says and
 * whether the modal opens at all — the exact place the previous
 * implementation got it wrong — so they are worth **executing** in a guard
 * rather than grepping for. Nothing here imports anything but a type, which is
 * erased, so `scripts/ts-resolve-hook.mjs` can load this file as it stands.
 */

/**
 * `ratingStatus`, for an order that may predate it.
 *
 * Orders placed before the rating system carry no `ratingStatus` at all, and
 * an absent one means nothing has been rated — not that everything has. The
 * default is what keeps `?.isProductRated` from reading `undefined` and being
 * treated as `false` in one place and as "unknown" in another.
 */
export function getRatingStatus(order: RateableOrder | null | undefined): RatingStatus {
  return {
    isProductRated: order?.ratingStatus?.isProductRated ?? false,
    isDeliveryRated: order?.ratingStatus?.isDeliveryRated ?? false,
  };
}

/**
 * Whether there is anything left for this customer to rate on this order.
 *
 * **This is the question the Rate button asks, and getting it wrong is the bug
 * being fixed.** The previous answer came from scanning
 * `/ratings/get-all-ratings` and treating *any* rating on the order as done —
 * so an order whose products were rated but whose rider was not showed
 * "Feedback Submitted", disabled, with no way to finish it. There is a live
 * order in exactly that state.
 *
 * `order.isRated` is the backend's own answer and is true only when both
 * halves are; it is preferred when present, and the two flags are the fallback
 * for orders that predate it. A rider that does not exist — every self-pickup
 * order — cannot be outstanding.
 */
export function hasUnratedParts(order: RateableOrder | null | undefined): boolean {
  if (!order) return false;
  if (order.isRated) return false;

  const status = getRatingStatus(order);
  const productsOutstanding = (order.items?.length ?? 0) > 0 && !status.isProductRated;
  const riderOutstanding = Boolean(order.deliveryPartnerId) && !status.isDeliveryRated;

  return productsOutstanding || riderOutstanding;
}
