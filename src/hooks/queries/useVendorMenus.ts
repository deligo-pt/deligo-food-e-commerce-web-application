"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

/**
 * The vendor's own menus, and the sections inside one of them.
 *
 * Separate from `useVendors.ts` on purpose: that file is about a vendor and the
 * flat product catalogue behind it, and this is a third resource with different
 * cache semantics and a different id.
 *
 * ## 🔴 The id is the Mongo `_id`, not the `V-XXXXXXXX` userId
 *
 * ```
 * GET /menus/open/V-YX1U2QHG              → 400  CastError
 * GET /menus/open/6a7b26e8b3c691ae6e46a406 → 200  4 menus
 * ```
 *
 * Our route is `/vendors/[userId]` and carries the `V-` form, so callers must
 * pass `vendor.id` — the value `useVendor` normalizes out of `id ?? _id` — and
 * therefore must wait for the vendor query first. That is what `enabled`
 * expresses below, exactly as `useVendorProducts` already does.
 *
 * ## These are public endpoints, with no second code path
 *
 * Both were verified to answer without an `Authorization` header, and to accept
 * one harmlessly. The restaurant page is browsable by guests today and the menu
 * must be too, so unlike `useVendorProducts` there is no authed/guest branch
 * here — `apiClient` attaches a bearer token when one exists and neither
 * endpoint cares.
 *
 * ## Empty is not an error
 *
 * A valid vendor id with no menus returns `200 { data: [] }`, and a menu with no
 * sections returns `200 { data: [] }`. Both are ordinary states — two of the
 * seven live vendors have no menus at all, and four menus across two more have
 * no sections — so nothing here treats an empty list as a failure. Only a
 * malformed id errors (`400`), which the `enabled` gates make unreachable.
 *
 * ## Order is copied, never computed
 *
 * Menus and sections arrive `sortOrder` ascending; the backend renormalizes
 * every ordering scope on each create, reorder and delete. Responses are handed
 * back untouched — no sorting, no filtering, no reshaping. The join and the
 * language pick both live in `lib/menuModel.ts`, which is where they can be
 * tested without a network.
 */
export const menuKeys = {
  all: ["menus"] as const,
  /**
   * Not language-keyed, unlike `vendorKeys`. `Accept-Language` localizes only
   * the response `message` on these endpoints — `name` and `description` come
   * back as raw `{ en, pt }` either way — so the payload is byte-identical in
   * both languages and a second cache entry would buy nothing.
   */
  vendorMenus: (vendorId: string) => ["menus", "vendor", vendorId] as const,
  sections: (menuId: string) => ["menus", "sections", menuId] as const,
};

/**
 * A vendor's active menus (`GET /menus/open/:vendorId`).
 *
 * Fetched on mount rather than on demand: the list decides whether the menu
 * selector renders at all, so there is nothing to defer it behind. It is small
 * — four menus is roughly 2 KB — and it is the cheap half of the pair.
 */
export function useVendorMenus<T = unknown>(
  vendorId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: menuKeys.vendorMenus(vendorId ?? ""),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get(`/menus/open/${vendorId}`, { signal });
      return (res.data?.data ?? []) as T[];
    },
    enabled: (options?.enabled ?? true) && !!vendorId,
  });
}

/**
 * One menu's active sections, with its items' products populated
 * (`GET /menus/open/:menuId/sections`).
 *
 * ## Fetched for the selected menu only
 *
 * There is no batched endpoint — sections come one menu at a time, so rendering
 * every menu up front costs one request each (five in total for the vendor with
 * four menus) for content behind a control the customer may never touch. Passing
 * `null` while nothing is selected turns that into one request per menu
 * actually opened, cached per menu id so going back is instant.
 *
 * `keepPreviousData` holds the outgoing menu's sections on screen while the
 * incoming one loads, so switching tabs does not blank the body mid-render.
 *
 * The response is returned raw. The join against the product list cannot happen
 * here — this hook has no products — so the caller passes both to
 * `buildMenuView`.
 */
export function useMenuSections<T = unknown>(
  menuId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: menuKeys.sections(menuId ?? ""),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get(`/menus/open/${menuId}/sections`, {
        signal,
      });
      return (res.data?.data ?? []) as T[];
    },
    enabled: (options?.enabled ?? true) && !!menuId,
    placeholderData: keepPreviousData,
  });
}
