import { apiClient } from "@/lib/apiClient";
import { getCartVendorId } from "@/lib/cart";
import type { CartItem } from "@/types/cart";

/**
 * Thrown when the store being activated has no lines left in the cart.
 *
 * Distinguished from a network or server failure so the cart page can say "this
 * order is no longer in your cart" and re-read, rather than surfacing the
 * backend's `NO_ITEMS_FOUND_FOR_THIS_VENDOR` at a customer who is looking
 * straight at the order it claims does not exist.
 */
export class VendorNotInCartError extends Error {
  constructor() {
    super("VENDOR_NOT_IN_CART");
    this.name = "VendorNotInCartError";
  }
}

/**
 * Flips one store's whole basket.
 *
 * `VENDOR_BULK` is a *toggle* keyed on whether the group holds **any** active
 * line — verified against the live API:
 *
 * | group before      | after one call |
 * |-------------------|----------------|
 * | every line active | every line OFF |
 * | every line off    | every line ON  |
 * | **mixed**         | every line OFF |
 *
 * The mixed row is the one that matters and the one that is easy to get wrong:
 * a half-selected group does **not** fill in, it empties. Reaching all-active
 * from mixed therefore takes two calls, not one. Callers must know the group's
 * state before calling — see `activateGroup`.
 */
async function toggleVendor(vendorId: string): Promise<void> {
  await apiClient.patch("/carts/toggle-item-status", {
    toggleMode: "VENDOR_BULK",
    vendorId,
  });
}

type GroupState = "all-active" | "all-inactive" | "mixed" | "absent";

function getGroupState(items: CartItem[], vendorId: string): GroupState {
  const lines = items.filter((item) => getCartVendorId(item.vendorId) === vendorId);
  if (lines.length === 0) return "absent";
  const active = lines.filter((item) => item.isActive).length;
  if (active === 0) return "all-inactive";
  if (active === lines.length) return "all-active";
  return "mixed";
}

/** Vendors holding at least one active line. */
function getActiveVendorIds(items: CartItem[]): Set<string> {
  return new Set(
    items
      .filter((item) => item.isActive)
      .map((item) => getCartVendorId(item.vendorId))
      .filter(Boolean),
  );
}

async function readCartItems(): Promise<CartItem[]> {
  const res = await apiClient.get("/carts/view-cart");
  return (res.data?.data?.items ?? []) as CartItem[];
}

/**
 * Drives one store's group to fully active, whatever state it starts in.
 *
 * The call count is decided by `getGroupState` rather than assumed, because the
 * toggle's behaviour differs per state (see `toggleVendor`). A mixed group —
 * which is exactly what the backend leaves behind after adding a product to a
 * store whose order was not selected — needs two calls: one to collapse it to
 * all-off, one to bring it all back on.
 *
 * Returns the cart as it stands afterwards, so callers do not re-read.
 */
async function activateGroup(vendorId: string, items: CartItem[]): Promise<CartItem[]> {
  const state = getGroupState(items, vendorId);
  if (state === "absent") throw new VendorNotInCartError();
  if (state === "all-active") return items;

  // mixed → collapse to all-off first; all-inactive is already there.
  if (state === "mixed") await toggleVendor(vendorId);
  await toggleVendor(vendorId);

  return readCartItems();
}

/**
 * Leaves `vendorId` as the cart's one fully-active order.
 *
 * Two things have to be true when this returns, and they are checked rather
 * than assumed:
 *
 *  1. **Every** line of the target store is active — not just one of them. This
 *     is the fix for the dropped-item bug: `add-to-cart` activates the line it
 *     just added and leaves that store's older lines switched off, so the store
 *     looks selected on the cart page while checkout silently prices one item.
 *     Checking "is this the only active vendor" was not enough, because that
 *     was already true in the broken state.
 *  2. No other store holds an active line.
 *
 * The second pass re-reads rather than trusting the first: activating a group
 * appears to deactivate the others server-side, but that is the backend's
 * behaviour to change, not ours to depend on. If it already holds, the pass
 * costs one GET and issues nothing.
 */
async function activateOnly(vendorId: string, items: CartItem[]): Promise<void> {
  const afterTarget = await activateGroup(vendorId, items);

  const stragglers = [...getActiveVendorIds(afterTarget)].filter((id) => id !== vendorId);
  if (stragglers.length === 0) return;

  for (const otherVendorId of stragglers) {
    // Every straggler holds at least one active line, so a single toggle empties
    // it — the "any active → all off" row of the table above.
    await toggleVendor(otherVendorId);
  }

  // Deactivating the others can only have left the target alone; but if the
  // backend also toggled the target off in the process, put it back.
  const settled = await readCartItems();
  if (getGroupState(settled, vendorId) !== "all-active") {
    await activateGroup(vendorId, settled);
  }
}

/**
 * Makes one store the cart's active order, reading the cart fresh first.
 *
 * This is the cart page's Activate button. There is no Deactivate — selecting a
 * different order is the only way to change the selection — so this call has to
 * cover the whole switch.
 *
 * Unlike the post-add helpers below it **throws**, so the button can report a
 * failure the customer did initiate. A store that has vanished from the cart
 * throws `VendorNotInCartError` specifically, and is never sent to the backend:
 * that request could only come back as "No items found for this restaurant in
 * your cart", which reads as nonsense next to the order still on screen.
 */
export async function activateOrder(vendorId: string): Promise<void> {
  const items = await readCartItems();
  await activateOnly(vendorId, items);
}

/** A cart line's identity: the same product in two sizes is two lines. */
function lineKey(item: CartItem): string {
  return `${item.productId}::${item.variationSku ?? ""}`;
}

/**
 * Makes the store the customer just added to the cart's active order, with all
 * of its lines active and every other store inactive.
 *
 * The line is located by product rather than by an id taken from the product
 * page: `/products/:id` populates its vendor as `{ userId, businessDetails }`
 * while the cart keys its groups on the vendor document's `_id`, and those are
 * not the same value. Reading the vendor off the cart line itself is the only
 * way to be sure the id matches what `toggle-item-status` expects — and sending
 * the wrong one is what produces "No items found for this restaurant in your
 * cart" on a store that is plainly there.
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
    const items = await readCartItems();

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
