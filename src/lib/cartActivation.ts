import { apiClient } from "@/lib/apiClient";
import { getCartVendorId } from "@/lib/cart";
import type { CartItem } from "@/types/cart";

/**
 * Flips one store's whole basket. `VENDOR_BULK` is a *toggle*, not a set — it
 * inverts whatever the group currently is, so callers must know the state
 * before they call it.
 */
async function toggleVendor(vendorId: string): Promise<void> {
  await apiClient.patch("/carts/toggle-item-status", {
    toggleMode: "VENDOR_BULK",
    vendorId,
  });
}

/**
 * Leaves `vendorId` as the cart's one active order, given the cart as it stands.
 *
 * The backend refuses to activate a second vendor while one is already active,
 * so the others are switched off *first* and the target on afterwards. Both
 * steps are skipped when the cart already looks the way we want — so if the
 * backend starts doing this on its own, this costs nothing.
 */
async function activateOnly(vendorId: string, items: CartItem[]): Promise<void> {
  const activeVendorIds = new Set(
    items
      .filter((item) => item.isActive)
      .map((item) => getCartVendorId(item.vendorId))
      .filter(Boolean),
  );

  // Already the one and only active order — the usual case when the customer
  // keeps adding to the basket they are working on.
  if (activeVendorIds.size === 1 && activeVendorIds.has(vendorId)) return;

  for (const otherVendorId of activeVendorIds) {
    if (otherVendorId === vendorId) continue;
    await toggleVendor(otherVendorId);
  }

  if (!activeVendorIds.has(vendorId)) {
    await toggleVendor(vendorId);
  }
}

/**
 * Makes one store the cart's active order, reading the cart fresh first.
 *
 * This is the cart page's Activate button. There is no Deactivate — selecting a
 * different order is the only way to change the selection — so this call has to
 * cover the whole switch: the store that was active is turned off before this
 * one goes on, because the backend refuses to hold two active vendors at once.
 *
 * Unlike the post-add helpers below it **throws**, so the button can report a
 * failure the customer did initiate.
 */
export async function activateOrder(vendorId: string): Promise<void> {
  const res = await apiClient.get("/carts/view-cart");
  const items = (res.data?.data?.items ?? []) as CartItem[];
  await activateOnly(vendorId, items);
}

/** A cart line's identity: the same product in two sizes is two lines. */
function lineKey(item: CartItem): string {
  return `${item.productId}::${item.variationSku ?? ""}`;
}

/**
 * Makes the store the customer just added to the cart's active order, and every
 * other store inactive.
 *
 * The line is located by product rather than by an id taken from the product
 * page: `/products/:id` populates its vendor as `{ userId, businessDetails }`
 * while the cart keys its groups on the vendor document's `_id`, and those are
 * not the same value. Reading the vendor off the cart line itself is the only
 * way to be sure the id matches what `toggle-item-status` expects.
 *
 * Never throws. It runs after a successful add, and a failed re-shuffle must not
 * turn "added to cart" into an error the customer can't act on; the item is in
 * the cart either way and Activate is one press away.
 */
export async function activateAddedOrder(target: {
  productId: string;
  variationSku: string | null;
}): Promise<void> {
  try {
    const res = await apiClient.get("/carts/view-cart");
    const items = (res.data?.data?.items ?? []) as CartItem[];

    const addedLine = items.find(
      (item) =>
        item.productId === target.productId &&
        (item.variationSku ?? null) === target.variationSku,
    );
    const vendorId = addedLine ? getCartVendorId(addedLine.vendorId) : "";
    if (!vendorId) return;

    await activateOnly(vendorId, items);
  } catch {
    return;
  }
}

/**
 * The re-order equivalent: `/orders/reorder/:id` replays a whole past order in
 * one call, so the store it revived is found by diffing the cart around it —
 * a line that is new, or whose quantity moved, belongs to the order just added.
 *
 * A diff rather than "the last item in the array" because re-ordering a store
 * the cart already holds *sets* the existing lines instead of appending new
 * ones, and the tail of the array would then point at somebody else's basket.
 *
 * `before` is `null` when the cart before the call couldn't be read — not the
 * same as an empty cart (`[]`). Without that snapshot every line looks changed
 * and the diff would name an arbitrary store, so it does nothing instead.
 *
 * Never throws, for the same reason as `activateAddedOrder`.
 */
export async function activateReorderedOrder(
  before: CartItem[] | null,
  after: CartItem[] | null | undefined,
): Promise<void> {
  try {
    const items = after ?? [];
    if (!before || items.length === 0) return;

    const previousQuantities = new Map(
      before.map((item) => [lineKey(item), item.itemSummary.quantity]),
    );
    const touched = items.find(
      (item) => previousQuantities.get(lineKey(item)) !== item.itemSummary.quantity,
    );

    // Nothing moved: the cart already held that order, line for line. There is
    // no diff to name a store with, so the cart is left as it is.
    if (!touched) return;

    const vendorId = getCartVendorId(touched.vendorId);
    if (!vendorId) return;

    await activateOnly(vendorId, items);
  } catch {
    return;
  }
}
