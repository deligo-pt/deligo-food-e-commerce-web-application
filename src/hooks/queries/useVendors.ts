"use client";

import {
  keepPreviousData,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import {
  coordsKey,
  hasCoords,
  withCoords,
  type Coords,
} from "@/lib/customerCoords";
import { getAccessToken } from "@/lib/authCookies";
import { ownedBy } from "@/lib/vendorId";
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
  search: (lang: string, lat: number | null, lng: number | null, term: string) =>
    ["vendors", "search", lang, lat, lng, term] as const,
  detail: (lang: string, authed: boolean, vendorId: string) =>
    ["vendors", "detail", lang, authed, vendorId] as const,
  // `place` is where the menu was asked from (`coordsKey`) — see
  // `useVendorProducts`. A different position can answer with a different menu.
  products: (lang: string, authed: boolean, vendorId: string, place = "") =>
    ["vendors", "products", lang, authed, vendorId, place] as const,
  // Category names are server-localized too, so this is keyed by language for
  // the same reason the others are. Not keyed by auth: the `/open` endpoint is
  // the only one used, for guests and signed-in customers alike.
  productCategories: (lang: string, vendorId: string) =>
    ["vendors", "product-categories", lang, vendorId] as const,
  // One category of a vendor's menu, and the size of the whole menu — see
  // `useVendorMenuByCategory`. Keyed like `products`, for the same reasons.
  categoryProducts: (
    lang: string,
    authed: boolean,
    vendorId: string,
    place: string,
    categoryId: string,
  ) => ["vendors", "category-products", lang, authed, vendorId, place, categoryId] as const,
  productTotal: (lang: string, authed: boolean, vendorId: string, place = "") =>
    ["vendors", "product-total", lang, authed, vendorId, place] as const,
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
 * Every vendor `/vendors/nearby/open` returns for a position — all pages — for
 * the home page's "Near You", which lists them nearest first with "Load more"
 * (2 Oct 2026).
 *
 * The API does not order by distance (and ignores `sortBy=distance`), so its
 * pages cannot be shown one at a time as "the next nearest": the whole list is
 * read and the caller sorts it (`sortVendorsByDistance`). 100 per page keeps
 * that to one request today (14 vendors); `meta.totalPage` covers the day it
 * is not.
 */
export function useVendorsNearbyAll<T = unknown>(
  coords: { lat: number; lng: number } | null,
  options?: { enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);
  return useQuery({
    queryKey: ["vendors", "nearby-all", lang, coords?.lat ?? null, coords?.lng ?? null] as const,
    queryFn: async ({ signal }) => {
      const params = { latitude: coords!.lat, longitude: coords!.lng, limit: 100 };
      const first = await apiClient.get("/vendors/nearby/open", {
        params: { ...params, page: 1 },
        signal,
      });
      const vendors = [...((first.data?.data ?? []) as T[])];
      const totalPage = Number(first.data?.meta?.totalPage ?? 1);
      for (let page = 2; page <= totalPage; page++) {
        const next = await apiClient.get("/vendors/nearby/open", {
          params: { ...params, page },
          signal,
        });
        vendors.push(...((next.data?.data ?? []) as T[]));
      }
      return vendors;
    },
    enabled: (options?.enabled ?? true) && !!coords,
    placeholderData: keepPreviousData,
  });
}

/**
 * Vendors near the customer whose **name** matches what they typed
 * (`/vendors/nearby/open?searchTerm=`).
 *
 * The search index the results page reads is `food_items` — dishes only, no
 * vendor documents — so searching "tasco" returned nine of Tasca do Bairro's
 * dishes and never the restaurant itself. This is the other half of the answer,
 * and it is a different endpoint because that is where vendors live.
 *
 * Measured 20 Sep 2026: with no `businessType` the call returns **restaurants
 * and stores together** (5 vendors near Dhaka: 4 restaurants, 1 store);
 * `searchTerm=tasca` narrows it to 1, `searchTerm=zzz` to none. So the name
 * filter is the API's, not ours.
 *
 * Needs coordinates — it is a proximity endpoint first — and is disabled
 * without them, which is why the places row is absent rather than empty for a
 * viewer who has neither a saved address nor a browser location.
 */
export function useVendorSearch<T = unknown>(
  coords: { lat: number; lng: number } | null,
  term: string,
  options?: { limit?: number; enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);
  const trimmed = term.trim();
  return useQuery({
    queryKey: vendorKeys.search(
      lang,
      coords?.lat ?? null,
      coords?.lng ?? null,
      trimmed,
    ),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/vendors/nearby/open", {
        params: {
          latitude: coords!.lat,
          longitude: coords!.lng,
          searchTerm: trimmed,
          limit: options?.limit ?? 12,
        },
        signal,
      });
      return (res.data?.data ?? []) as T[];
    },
    enabled: (options?.enabled ?? true) && !!coords && trimmed.length > 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * A single vendor. Logged-in users hit `/vendors/customer/:id`; guests hit the
 * public `/vendors/nearby/open/:id`. Normalizes `_id → id` for downstream use.
 *
 * `vendorId` is the store's **Mongo id**. Both routes answered on the `V-…`
 * userId until 24 Sep 2026 and now reject it with 400 "The provided ID is
 * invalid." — see `lib/vendorId.ts`, and pass `vendorRouteId(vendor)` rather
 * than anything read off `userId`.
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
 * Products asked for per request. Large on purpose: a usual store's whole menu
 * fits in one, and one request is what the customer waits for.
 */
const MENU_PAGE_SIZE = 500;

/**
 * Every page of a product list: the first, then — only when the backend says
 * there are more — the rest together. `path` already carries its `?vendorId=`
 * (and `&category=` when it is one category's list).
 * One failed page fails the lot, so a menu is never shown with a hole in it.
 */
async function everyMenuPage<T>(
  path: string,
  params: Record<string, unknown>,
  signal: AbortSignal,
  pageSize: number = MENU_PAGE_SIZE,
): Promise<T[]> {
  const ask = (page: number) =>
    apiClient.get(`${path}&page=${page}&limit=${pageSize}`, { params, signal });
  const first = await ask(1);
  const pages = Number(first.data?.meta?.totalPage) || 1;
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) => ask(index + 2)),
  );
  return [first, ...rest].flatMap((res) => (res.data?.data ?? []) as T[]);
}

/**
 * A vendor's products/menu — all of it. Logged-in: `/products?vendorId=…`.
 * Guests: `/products/open?vendorId=…`. Both go through `everyMenuPage`.
 *
 * ## The whole menu, not the first page (13 Oct 2026)
 *
 * The signed-in branch used to ask for `limit=100` and stop. A store with 183
 * products in 12 categories showed 100 of them in 5, because a category none
 * of the first hundred products sits in has nothing to draw.
 *
 * The vendor page no longer waits on this request — it loads a category at a
 * time through `useVendorMenuByCategory`, and comes here only for what that
 * cannot reach (see there) and to ask whether a store delivers at all.
 *
 * `vendorId` is the Mongo id here too: both accept nothing else since
 * 24 Sep 2026, and a `V-…` comes back 400, not empty.
 *
 * ## Asked from where the customer is — both branches
 *
 * `place` comes from `menuCoords`: the customer's position when known, else
 * nothing (signed in) or the store's own (guest). Re-measured 30 Sep 2026 from
 * a Dhaka address, the vendor filter holds with the customer's coordinates on
 * both endpoints, for main stores and branches alike:
 *
 * ```
 * /products?vendorId=<Tasca main>&lat=<Dhaka>        → 13, all Tasca ✅
 * /products/open?vendorId=<Bashundhara>&lat=<Dhaka>  → 7, all the branch's ✅
 * /products?vendorId=<Lisbon branch>&lat=<Dhaka>     → 0 — does not deliver
 * /products?vendorId=<Lisbon branch>&lat=<Lisbon>    → 11 ✅
 * ```
 *
 * The empty answer is the point: a store that cannot reach the customer says
 * so, and the page shows "doesn't deliver to you" instead of a menu that could
 * not arrive. Until that date the opposite held — coordinates dropped the
 * vendor filter — and this hook sent none, or the store's own.
 *
 * `place` is in the cache key for both branches, so a new delivery address
 * refetches the menu rather than reading the old area's answer.
 *
 * ## `ownedBy` stays
 *
 * On 27 Sep the same call answered with 30 products from five vendors, because
 * distance was never a test of ownership. Both branches still end in
 * `ownedBy(…, vendorId)`: the page knows which store it is rendering, and that
 * stays true whatever the backend decides proximity means next.
 *
 * The filter runs on the whole list, after every page is in: the page count
 * comes from the backend's own `meta`, so foreign items could not push any of
 * this vendor's products off the end before the filter sees them.
 */
export function useVendorProducts<T = unknown>(
  vendorId: string | undefined,
  /** Where to ask from — resolve it with `menuCoords`. Required for guests. */
  place?: Coords | null,
  options?: { enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);
  const authed = isAuthed();
  // A guest cannot ask this endpoint anything without a position, so the query
  // waits rather than firing into a 400.
  const guestReady = authed || hasCoords(place);

  return useQuery({
    queryKey: vendorKeys.products(lang, authed, vendorId ?? "", coordsKey(place)),
    queryFn: async ({ signal }) => {
      const params = withCoords({}, place);

      const path = authed
        ? `/products?vendorId=${vendorId}`
        : `/products/open?vendorId=${vendorId}`;
      return ownedBy(await everyMenuPage<T>(path, params, signal), vendorId);
    },
    enabled: (options?.enabled ?? true) && !!vendorId && guestReady,
    placeholderData: keepPreviousData,
  });
}

/** Category lists in flight together; the rest wait their turn, in page order. */
const MENU_CATEGORIES_AT_ONCE = 6;
/** One request covers a category of up to this many products. */
const CATEGORY_PAGE_SIZE = 100;

export type MenuCategoryStatus = "pending" | "success" | "error";

/** Per category, in the order the ids were given. */
interface MenuByCategory<T> {
  /** The category's products once loaded; `undefined` until then. */
  lists: (T[] | undefined)[];
  statuses: MenuCategoryStatus[];
}

// At module level so its identity is stable: React Query then hands back the
// same object until a category's result actually changes, and the page's
// grouping is not redone on every render.
function combineMenuCategories<T>(results: UseQueryResult<T[]>[]): MenuByCategory<T> {
  return {
    lists: results.map((result) => result.data),
    statuses: results.map((result) => result.status),
  };
}

/**
 * A vendor's menu, loaded a category at a time (13 Oct 2026) — the way the
 * vendor's own All Items page loads, and for the same reason: the customer
 * should not wait for the last category before seeing the first.
 *
 * Measured on a store of 183 products in 12 categories: the whole menu in one
 * request took 2.5 s and nothing could be drawn before it; one category's
 * list (`&category=<id>`, accepted by `/products` and `/products/open` alike)
 * takes about 0.8 s.
 *
 * - **Order.** Categories load in the order given — the order the page shows
 *   them — `MENU_CATEGORIES_AT_ONCE` at a time, so the top of the page fills
 *   first and a store with fifty categories does not fire fifty requests.
 *   `urgentId` is the one the customer just jumped to: it skips the queue.
 * - **Counted too.** `total` is the size of the whole menu, from one
 *   `limit=1` request. Categories cannot say what sits in none of them
 *   ("Other"), or whether the store has anything at all; the total can.
 * - **Position and ownership** follow `useVendorProducts`: asked from `place`,
 *   keyed on it, and every list ends in `ownedBy`.
 *
 * A category that fails is reported as `"error"` and not retried here beyond
 * React Query's own retries — the page falls back to `useVendorProducts`.
 */
export function useVendorMenuByCategory<T = unknown>(
  vendorId: string | undefined,
  /** Where to ask from — resolve it with `menuCoords`. Required for guests. */
  place: Coords | null | undefined,
  categoryIds: readonly string[],
  options?: { enabled?: boolean; urgentId?: string | null },
) {
  const lang = useStore((s) => s.lang);
  const authed = isAuthed();
  const queryClient = useQueryClient();
  const ready = (options?.enabled ?? true) && !!vendorId && (authed || hasCoords(place));
  const placeKey = coordsKey(place);
  const path = authed
    ? `/products?vendorId=${vendorId}`
    : `/products/open?vendorId=${vendorId}`;

  const totalQuery = useQuery({
    queryKey: vendorKeys.productTotal(lang, authed, vendorId ?? "", placeKey),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get(`${path}&page=1&limit=1`, {
        params: withCoords({ fields: "productId" }, place),
        signal,
      });
      return Number(res.data?.meta?.total) || 0;
    },
    enabled: ready,
  });

  // A category that has answered keeps its place; the free slots go to the
  // first ones still waiting. Read from the cache, so finishing one opens the
  // next on the render that result causes.
  let slots = MENU_CATEGORIES_AT_ONCE;
  const byCategory = useQueries({
    queries: categoryIds.map((categoryId) => {
      const queryKey = vendorKeys.categoryProducts(
        lang,
        authed,
        vendorId ?? "",
        placeKey,
        categoryId,
      );
      const status = queryClient.getQueryState(queryKey)?.status;
      const answered = status === "success" || status === "error";
      const open = answered || categoryId === options?.urgentId || slots-- > 0;
      return {
        queryKey,
        queryFn: async ({ signal }: { signal: AbortSignal }) =>
          ownedBy(
            await everyMenuPage<T>(
              `${path}&category=${categoryId}`,
              withCoords({}, place),
              signal,
              CATEGORY_PAGE_SIZE,
            ),
            vendorId,
          ),
        enabled: ready && open,
      };
    }),
    combine: combineMenuCategories<T>,
  });

  return {
    lists: byCategory.lists,
    statuses: byCategory.statuses,
    /** Products in the whole menu; `undefined` until known. */
    total: totalQuery.data,
    /** Still being asked. False once it has answered, either way. */
    totalPending: ready && totalQuery.isPending,
    totalFailed: totalQuery.isError,
  };
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
 * not a global catalogue. It must be the Mongo id: given a `V-…` this endpoint
 * answers with that *same* missing-id message rather than an invalid-id one,
 * so a wrong id here reads as a missing parameter.
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
