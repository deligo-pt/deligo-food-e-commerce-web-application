"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { AddonGroupsBySku } from "@/lib/requiredAddons";

interface AddonGroup {
  _id: string;
  minSelectable?: number;
  options?: { sku: string }[];
}

/**
 * The required add-on groups of the cart's products, by add-on sku — what
 * `isAddonDecrementBlocked` needs to tell "the last sauce" from "one of two
 * sauces". See `lib/requiredAddons.ts`.
 *
 * Only lines that have a required add-on are looked up, and only required
 * groups are kept. `GET /products?_id=…&_id=…` answers for several products in
 * one call; the groups themselves are `/add-ons/{id}`, the same route the
 * product popup reads.
 */
export function useCartAddonGroups(
  items: { productId: string; addons?: { minSelectable?: number }[] }[] | undefined,
) {
  const productIds = [
    ...new Set(
      (items ?? [])
        .filter((i) => i.addons?.some((a) => (a.minSelectable ?? 0) > 0))
        .map((i) => i.productId),
    ),
  ].sort();

  return useQuery({
    queryKey: ["cart", "addon-groups", productIds],
    enabled: productIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<AddonGroupsBySku> => {
      const params = new URLSearchParams();
      for (const id of productIds) params.append("_id", id);
      const res = await apiClient.get(`/products?${params}`, { signal });
      const products: { addonGroups?: unknown[] }[] = res.data?.data ?? [];
      const groupIds = [
        ...new Set(
          products
            .flatMap((p) => p.addonGroups ?? [])
            .filter((g): g is string => typeof g === "string"),
        ),
      ];

      const groups = await Promise.all(
        groupIds.map((id) =>
          apiClient
            .get(`/add-ons/${id}`, { signal })
            .then((r) => r.data?.data as AddonGroup | undefined),
        ),
      );

      const bySku: AddonGroupsBySku = {};
      for (const group of groups) {
        if (!group || !((group.minSelectable ?? 0) > 0)) continue;
        for (const option of group.options ?? []) {
          bySku[option.sku] = {
            groupId: group._id,
            minSelectable: group.minSelectable ?? 0,
          };
        }
      }
      return bySku;
    },
  });
}
