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
  userId?: string | null;
  role?: string | null;
  name?: { firstName?: string; lastName?: string } | null;
  businessDetails?: { businessName?: string | null; branchName?: string | null } | null;
}

export function getVendorDisplayName(
  vendor: VendorNameSource | string | null | undefined,
): string | null {
  // A bare id string is the unpopulated case — there is no name in it to read.
  if (!vendor || typeof vendor === "string") return null;

  // A branch that carries its own name is called by it — the same rule as
  // `getVendorCardTitle`. Screens that can look the name up do so through
  // `useVendorCardTitle`; this covers the pure callers (order search) and any
  // payload that starts sending `branchName`.
  if (isBranchVendor(vendor)) {
    const branchName = getBranchName(vendor);
    if (branchName) return branchName;
  }

  const businessName = vendor.businessDetails?.businessName?.trim();
  if (businessName) return businessName;

  const owner =
    `${vendor.name?.firstName ?? ""} ${vendor.name?.lastName ?? ""}`.trim();
  return owner || null;
}

/**
 * Branches — sub-vendors, `SV-…` — and what their cards are called.
 *
 * Since Sep 2026 branches appear in the customer vendor lists beside their
 * parent, usually under the **same** `businessName`: three cards reading
 * "Tasca do Bairro" with nothing to tell them apart. A branch's own name lives
 * in `businessDetails.branchName`, and it is free text typed by the vendor —
 * measured 30 Sep 2026:
 *
 *   SV-BJQPVEMB  branchName "Tasca do Bairro Bashundhara"
 *   SV-QO041S2I  branchName "Lisboa"
 *   main store   branchName ""
 *
 * Decided 30 Sep: a branch card shows `branchName` **exactly as stored**, and
 * a main store keeps its `businessName`. No joining, no trimming of a repeated
 * brand — a vendor who typed "Lisboa" fixes that in the vendor panel.
 */
export interface BranchNameSource {
  userId?: string | null;
  role?: string | null;
  businessDetails?: { businessName?: string | null; branchName?: string | null } | null;
}

/**
 * Whether this vendor is a branch rather than a main store.
 *
 * Positive evidence only: `role` when the payload carries it, otherwise the
 * `SV-` userId. A record that says neither is a main store — the same rule as
 * the vendor portal's `isMainBranch`, and the safe direction: a main store
 * wrongly called a branch would fire a lookup and could grow a "Branch" tag.
 */
export function isBranchVendor(vendor: BranchNameSource | null | undefined): boolean {
  if (vendor?.role === "SUB_VENDOR") return true;
  if (vendor?.role === "VENDOR") return false;
  return /^SV-/i.test(vendor?.userId ?? "");
}

/** The branch's own name, trimmed; `null` for absent or blank — never a blank label. */
export function getBranchName(vendor: BranchNameSource | null | undefined): string | null {
  return vendor?.businessDetails?.branchName?.trim() || null;
}

/**
 * What a vendor card is titled.
 *
 * - main store → `businessName`
 * - branch → its `branchName`: the one on the row when the list sends it,
 *   else `fetchedBranchName` (read off the vendor's own record — the lists
 *   omit the field as of 30 Sep 2026, see `useVendorCardTitle`)
 * - branch whose name is not known (yet, or at all) → `businessName` with
 *   `branchTag: true`, so the card still says it is a branch and two of them
 *   never read as the same place.
 *
 * `title` can be `""` only for a row with no business name at all, which
 * rendered blank before this too.
 */
export function getVendorCardTitle(
  vendor: BranchNameSource | null | undefined,
  fetchedBranchName?: string | null,
): { title: string; branchTag: boolean } {
  const businessName = vendor?.businessDetails?.businessName?.trim() ?? "";
  if (!isBranchVendor(vendor)) return { title: businessName, branchTag: false };

  const branchName = getBranchName(vendor) ?? (fetchedBranchName?.trim() || null);
  return branchName
    ? { title: branchName, branchTag: false }
    : { title: businessName, branchTag: true };
}
