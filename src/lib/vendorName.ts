/**
 * The one place that decides what a vendor is called on screen.
 *
 * A populated `vendorId` carries two names and they are not interchangeable:
 *
 *   name:            { firstName, lastName }   ← the person who owns the account
 *   businessDetails: { businessName }          ← the shop the customer ordered from
 *
 * Customers know the shop. Reading `name` puts a real person's name where the
 * restaurant belongs — the track-order page headed a Leopold order "Samin
 * Israk" — which tells the customer nothing they can act on and publishes an
 * owner's name onto a receipt-like surface that had no reason to carry it.
 *
 * The owner's name is kept as a fallback rather than dropped: `businessDetails`
 * is populated inconsistently across endpoints (`/carts/view-cart` sends four
 * of its fields, the order list sends five, the vendor list sends everything),
 * and a less useful name still beats an empty card.
 *
 * Returns null when neither is present, so each caller picks the placeholder
 * that suits its surface — "Restaurant" on an order, "Store" in the cart —
 * rather than this deciding for them.
 */
export interface VendorNameSource {
  name?: { firstName?: string; lastName?: string } | null;
  businessDetails?: { businessName?: string } | null;
}

export function getVendorDisplayName(
  vendor: VendorNameSource | string | null | undefined,
): string | null {
  // A bare id string is the unpopulated case — there is no name in it to read.
  if (!vendor || typeof vendor === "string") return null;

  const businessName = vendor.businessDetails?.businessName?.trim();
  if (businessName) return businessName;

  const owner =
    `${vendor.name?.firstName ?? ""} ${vendor.name?.lastName ?? ""}`.trim();
  return owner || null;
}
