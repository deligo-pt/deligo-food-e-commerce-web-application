"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthed } from "@/hooks/useAuthed";
import { useProductDestination } from "@/hooks/queries/useProductDestination";
import { isLegacyVendorUserId, vendorRouteId } from "@/lib/vendorId";

/**
 * A store link written before 24 Sep 2026, landing after it.
 *
 * Until that day the store route was `/vendors/<V-XXXXXXXX>` — see
 * `lib/vendorId.ts` for what changed. Those links are not ours to fix: they
 * are in other people's chats, in messages customers sent each other from the
 * share button, and they arrive at this page with an id no endpoint answers
 * on. Left alone, every one of them reads "Vendor not found", which says the
 * store closed rather than the link aged.
 *
 * So the id is resolved and the URL corrected, with `router.replace` rather
 * than `push` — the dead URL should not sit in the back button.
 *
 * ## Two ways to resolve one, and what each costs
 *
 * 1. **Through the dish.** A shared link always carries `?product=PROD-…`, and
 *    `GET /products/open/:productId` returns the store's populated record with
 *    its Mongo id. Public, so it works for a signed-out friend — which is the
 *    whole point of a shared link — and it is the same cached request the
 *    search page already makes, so it costs nothing extra.
 * 2. **Through the list.** For a bare `/vendors/V-…` (an old bookmark, no
 *    dish), `/vendors/customer` still returns `userId` on every row, so the
 *    row can be found by it. This one needs a token: the public list refuses
 *    to answer without coordinates, and the coordinates a viewer has are not
 *    necessarily near the store they were linked to.
 *
 * When neither works the page falls through to its own "Vendor not found",
 * which is then the honest answer.
 */
export function useLegacyVendorRedirect(
  vendorId: string,
  productId: string | null,
): { resolving: boolean } {
  const router = useRouter();
  const authed = useAuthed();
  const { resolve } = useProductDestination();
  const legacy = isLegacyVendorUserId(vendorId);
  // Without a dish there is nothing public to resolve through, so for a
  // signed-out visitor there is nothing to try: the list needs a token.
  const canResolve = legacy && (!!productId || authed);

  const { data: resolvedId, isPending } = useQuery({
    queryKey: ["legacy-vendor", vendorId, productId ?? "", authed],
    queryFn: async () => {
      if (productId) return (await resolve(productId)).vendorId;

      // Guarded by `enabled` below: unauthenticated, this call answers 401,
      // and a 401 is what sends the whole app to the login screen. A visitor
      // following an old link is not a session that expired.
      const res = await apiClient.get("/vendors/customer", {
        params: { page: 1, limit: 100 },
      });
      const vendors: { id?: string; _id?: string; userId?: string }[] =
        res.data?.data ?? [];
      const match = vendors.find((vendor) => vendor.userId === vendorId);
      const id = vendorRouteId(match);
      if (!id) throw new Error(`No vendor for ${vendorId}`);
      return id;
    },
    enabled: canResolve,
    // The mapping between the two ids is fixed, so a retry only delays the
    // "not found" that a genuinely unresolvable link deserves.
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!canResolve || !resolvedId) return;
    const query = productId
      ? `?product=${encodeURIComponent(productId)}`
      : "";
    router.replace(`/vendors/${resolvedId}${query}`);
  }, [canResolve, resolvedId, productId, router]);

  // `isPending` stays true for a query that is disabled, so it is only ever
  // read through `canResolve` — a current link, or one nothing can be done
  // about, must not render a skeleton forever.
  return { resolving: canResolve && (isPending || !!resolvedId) };
}
