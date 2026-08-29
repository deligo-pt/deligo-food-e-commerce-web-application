"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useStore } from "@/stores/translationStore";

export const vendorKeys = {
  all: ["vendors"] as const,
  // Vendor/business names are server-localized → keyed by language. Also keyed
  // by auth, since logged-in vs guest hit different endpoints.
  customerList: (lang: string, page: number, limit: number) =>
    ["vendors", "customer", "list", lang, page, limit] as const,
  // Nearby list is keyed by language + resolved coords (+ optional page/limit).
  nearby: (
    lang: string,
    lat: number | null,
    lng: number | null,
    page: number | null,
    limit: number | null,
  ) => ["vendors", "nearby", lang, lat, lng, page, limit] as const,
  detail: (lang: string, authed: boolean, vendorId: string) =>
    ["vendors", "detail", lang, authed, vendorId] as const,
  products: (lang: string, authed: boolean, vendorId: string) =>
    ["vendors", "products", lang, authed, vendorId] as const,
  // Category names are server-localized too, so this is keyed by language for
  // the same reason the others are. Not keyed by auth: the `/open` endpoint is
  // the only one used, for guests and signed-in customers alike.
  productCategories: (lang: string, vendorId: string) =>
    ["vendors", "product-categories", lang, vendorId] as const,
};

function isAuthed() {
  return typeof window !== "undefined" && !!getAccessToken();
}

/** Paginated customer-facing vendor list (`/vendors/customer`). */
export function useVendorsCustomer<T = unknown>(params?: {
  page?: number;
  limit?: number;
  enabled?: boolean;
}) {
  const lang = useStore((s) => s.lang);
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 100;
  return useQuery({
    queryKey: vendorKeys.customerList(lang, page, limit),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/vendors/customer", {
        params: { page, limit },
        signal,
      });
      return (res.data?.data ?? []) as T[];
    },
    enabled: params?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

/**
 * Nearby open vendors for a set of coordinates (`/vendors/nearby/open`). Works
 * for guests and logged-in users alike. Pass `page`/`limit` for the paginated
 * grid; omit them for the "near you" home section. Returns the vendor list plus
 * `totalPage` for pagination. Keeps the previous list on a language switch.
 */
export function useVendorsNearby<T = unknown>(
  coords: { lat: number; lng: number } | null,
  options?: { page?: number; limit?: number; enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);
  const page = options?.page;
  const limit = options?.limit;
  return useQuery({
    queryKey: vendorKeys.nearby(
      lang,
      coords?.lat ?? null,
      coords?.lng ?? null,
      page ?? null,
      limit ?? null,
    ),
    queryFn: async ({ signal }) => {
      const params: Record<string, number> = {
        latitude: coords!.lat,
        longitude: coords!.lng,
      };
      if (page != null) params.page = page;
      if (limit != null) params.limit = limit;
      const res = await apiClient.get("/vendors/nearby/open", {
        params,
        signal,
      });
      return {
        data: (res.data?.data ?? []) as T[],
        totalPage: (res.data?.meta?.totalPage ?? 1) as number,
      };
    },
    enabled: (options?.enabled ?? true) && !!coords,
    placeholderData: keepPreviousData,
  });
}

/**
 * A single vendor. Logged-in users hit `/vendors/customer/:id`; guests hit the
 * public `/vendors/nearby/open/:id`. Normalizes `_id → id` for downstream use.
 */
export function useVendor<T = unknown>(
  vendorId: string | undefined,
  options?: { enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);
  const authed = isAuthed();
  return useQuery({
    queryKey: vendorKeys.detail(lang, authed, vendorId ?? ""),
    queryFn: async ({ signal }) => {
      const url = authed
        ? `/vendors/customer/${vendorId}`
        : `/vendors/nearby/open/${vendorId}`;
      const res = await apiClient.get(url, { signal });
      const raw = res.data?.data;
      if (!raw) throw new Error("Vendor not found");
      return { ...raw, id: raw.id ?? raw._id ?? "" } as T;
    },
    enabled: (options?.enabled ?? true) && !!vendorId,
    placeholderData: keepPreviousData,
  });
}

/**
 * A vendor's products/menu. Logged-in: `/products?vendorId=…&limit=100`.
 * Guests: `/products/open` — count first, then fetch all in one request.
 */
export function useVendorProducts<T = unknown>(
  vendorId: string | undefined,
  options?: { enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);
  const authed = isAuthed();
  return useQuery({
    queryKey: vendorKeys.products(lang, authed, vendorId ?? ""),
    queryFn: async ({ signal }) => {
      if (authed) {
        const res = await apiClient.get(
          `/products?vendorId=${vendorId}&limit=100`,
          { signal },
        );
        return (res.data?.data ?? []) as T[];
      }
      const countRes = await apiClient.get(
        `/products/open?vendorId=${vendorId}&page=1&limit=1`,
        { signal },
      );
      const total = countRes.data?.meta?.total || 10;
      const res = await apiClient.get(
        `/products/open?vendorId=${vendorId}&page=1&limit=${total}`,
        { signal },
      );
      return (res.data?.data ?? []) as T[];
    },
    enabled: (options?.enabled ?? true) && !!vendorId,
    placeholderData: keepPreviousData,
  });
}

/**
 * The categories a vendor owns and has active.
 *
 * 🔴 **This is the authority for what the vendor page shows.** Products filed
 * under anything not in this list are not rendered — see
 * `groupByVendorCategories`. That is a deliberate reversal of the earlier rule
 * (`category` on the product decided everything, and every product was shown),
 * made on instruction once the vendor side committed to requiring a category.
 *
 * `/product-categories/open` is public and needs no token, so unlike products
 * there is no authed/guest branch. `vendorId` is **required** — the backend
 * answers `400 VENDOR_ID_REQUIRED` without it, because vendor categories are
 * not a global catalogue.
 *
 * `limit=100` mirrors `useVendorProducts`. The default page size is 10, and a
 * vendor with more than ten categories would otherwise lose the rest of their
 * catalogue rather than just the tail of a list — the same ceiling noted for
 * products, with a sharper consequence now that this list gates rendering.
 */
export function useVendorProductCategories<T = unknown>(
  vendorId: string | undefined,
  options?: { enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);
  return useQuery({
    queryKey: vendorKeys.productCategories(lang, vendorId ?? ""),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get(
        `/product-categories/open?vendorId=${vendorId}&page=1&limit=100`,
        { signal },
      );
      return (res.data?.data ?? []) as T[];
    },
    enabled: (options?.enabled ?? true) && !!vendorId,
    placeholderData: keepPreviousData,
  });
}
