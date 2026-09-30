"use client";

import { useVendor } from "@/hooks/queries/useVendors";
import {
  getBranchName,
  getVendorCardTitle,
  isBranchVendor,
  type BranchNameSource,
} from "@/lib/vendorName";
import { vendorRouteId, type VendorIdentifiers } from "@/lib/vendorId";

/**
 * What a store is called on screen — the branch's own name for a branch, the
 * business name for a main store. The rule is `getVendorCardTitle`; this hook
 * only finds what the payload in hand does not carry.
 *
 * Used by the vendor cards, and since Phase 5 by the cart, checkout, payment
 * and order screens too, so a branch is called the same thing everywhere.
 *
 * ## When it fetches
 *
 * Measured 30 Sep 2026, the payloads know different amounts:
 *
 * | payload | `userId`/`role` | `branchName` |
 * | --- | --- | --- |
 * | vendor lists | ✅ | ❌ |
 * | `/orders` `vendorId` | ✅ | ❌ |
 * | `/carts/view-cart` `vendorId` | ❌ | ❌ |
 * | `/vendors/customer/:id` | ✅ | ✅ |
 *
 * So it reads the store's own record through `useVendor` — the query the store
 * page uses, cached and shared — when the row is a branch with no name, **or
 * when the row cannot say whether it is a branch at all** (the cart). A row
 * known to be a main store never fetches, and neither does one that already
 * carries `branchName`: once the backend adds the field, the lookups stop
 * without a code change.
 *
 * Until the record arrives, the answer is computed from the row alone: a known
 * branch shows the business name with the "Branch" tag, a row of unknown kind
 * shows its business name — never a blank title, never a guessed tag.
 */
export function useVendorCardTitle(
  vendor: (BranchNameSource & VendorIdentifiers) | null | undefined,
): { title: string; branchTag: boolean } {
  const routeId = vendorRouteId(vendor);
  const kindUnknown = !vendor?.userId && !vendor?.role;
  const needsLookup =
    !!routeId && !getBranchName(vendor) && (kindUnknown || isBranchVendor(vendor));

  const { data } = useVendor<BranchNameSource & VendorIdentifiers>(routeId, {
    enabled: needsLookup,
  });

  // `useVendor` keeps the previous answer on screen while a new key loads, so
  // only trust a record that is actually this vendor's.
  const record = needsLookup && data && vendorRouteId(data) === routeId ? data : null;

  // The store's own record knows everything the row did and more, so it
  // decides once it is here.
  return getVendorCardTitle(record ?? vendor);
}
