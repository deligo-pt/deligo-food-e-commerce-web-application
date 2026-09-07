import { apiClient } from "@/lib/apiClient";
import { activateAddedOrder } from "@/lib/cartActivation";

/**
 * Sets a plain product's quantity on the cart, or removes the line at zero.
 *
 * "Plain" is the whole contract: no variation, no add-ons. That is what lets
 * this send an **absolute** quantity and nothing else.
 *
 * ## Why absolute, and why that matters here
 *
 * `/carts/add-to-cart` SETS the quantity it is given — it does not add to it.
 * `ProductDetailsModal` has to work around that by reading `/carts/view-cart`
 * immediately before every add, because its own control means "add N more" on
 * top of a base it does not know.
 *
 * A stepper on a product card is the opposite case: the number under the
 * customer's thumb *is* the line quantity, so the target is already known and
 * the call is idempotent. Two clicks that land out of order cannot corrupt the
 * line — the later value simply wins, which is what the customer asked for.
 * That property is why the card debounces instead of queueing, and why it does
 * not need a read before every write.
 *
 * ## The two shapes the backend insists on
 *
 * `variationSku` is omitted rather than sent as `null`: the delete endpoint's
 * schema rejects null with "Expected string, received null" (the lesson is
 * recorded on `CartProductRow`, which learned it first). And `delete-item`
 * takes an array, even for one line.
 */
export async function setCartLineQuantity(
  /** The Mongo `_id`. The business `productId` (PROD-XXXX) is rejected as an
   *  "Invalid Id" by the cart endpoints — same as everywhere else in the cart. */
  productId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await apiClient.delete("/carts/delete-item", {
      data: [{ productId }],
    });
    return;
  }

  const response = await apiClient.post("/carts/add-to-cart", {
    items: [{ productId, quantity }],
  });
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to add to cart");
  }

  // The store just added to becomes the cart's active order and the others go
  // quiet, so the basket being built is always the one selected for checkout.
  // Same call the modal makes, for the same reason; it never throws.
  await activateAddedOrder({ productId, variationSku: null });
}
