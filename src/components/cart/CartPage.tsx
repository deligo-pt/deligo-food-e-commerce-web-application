/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo } from "react";
import CartStoreCard from "./CartStoreCard";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { CartResponse } from "@/types/cart";
import {
  getCartVendorId,
  getCartVendorName,
  getCartVendorOrder,
} from "@/lib/cart";
import { useTranslation } from "@/hooks/useTranslation";
import { useCart } from "@/hooks/queries/useCart";
import { useVendorsCustomer } from "@/hooks/queries/useVendors";

export default function CartPage() {
  const { t } = useTranslation();
  // Cached + deduped, keyed on language. React Query keeps the current cart on
  // screen during a language-switch refetch, so no manual silent-refetch.
  const {
    data: cart = null,
    isLoading: loading,
    error: cartError,
    refetch: refetchCart,
  } = useCart<CartResponse | null>();
  const { data: vendors = [] } = useVendorsCustomer<any>({
    page: 1,
    limit: 100,
  });

  const error = cartError
    ? getApiErrorMessage(cartError, "Failed to load cart")
    : "";

  /**
   * Where every cart mutation on this page ends up, on success and on failure
   * alike.
   *
   * This used to rebuild the cart locally instead — filtering the removed line
   * out and re-deriving totals, discounts and VAT on the client. Two problems:
   * it duplicated pricing rules that belong to the backend, and writing to the
   * query cache reset the entry's freshness timer, so a hand-built cart could
   * outlive the real one indefinitely. Re-reading is the only thing that can't
   * drift.
   *
   * The failure path matters most: a rejected mutation is usually the app
   * finding out the server's cart already differs from what's on screen.
   */
  const resyncCart = async () => {
    // One request, one answer: the navbar badge subscribes to this same query,
    // so refetching here updates the icon and the page together.
    const { data: fresh } = await refetchCart();
    const items = fresh?.items ?? [];
    if (items.length === 0) return;

    // The cart is never left with nothing selected while orders remain: whether
    // the selected order was emptied item by item or deleted outright, the most
    // recent remaining one takes over.
    //
    // No exclusion for a just-deselected order any more — there is no Deactivate
    // button. An order stops being selected only when another one is activated
    // or when it stops existing, and neither can be undone by this rule.
    if (items.some((item) => item.isActive)) return;

    const [mostRecent] = getCartVendorOrder(items);
    if (!mostRecent) return;

    try {
      await apiClient.patch("/carts/toggle-item-status", {
        toggleMode: "VENDOR_BULK",
        vendorId: mostRecent,
      });
    } catch {
      // Deliberately quiet. Nobody asked for this call, so a red toast would be
      // reporting the failure of something the customer never initiated — and a
      // cart with nothing selected is a valid state they can fix by tapping
      // Activate.
      return;
    }
    await refetchCart();
  };

  /** Every product of one store, in the shape `/carts/delete-item` expects. */
  const getStoreDeleteTargets = (vendorId: string) =>
    (cart?.items ?? [])
      .filter((item) => getCartVendorId(item.vendorId) === vendorId)
      .map((item) => {
        // Plain products must omit `variationSku` entirely rather than send
        // null — the backend's Zod schema rejects null. Same rule as the
        // single-product delete in CartProductRow.
        const target: { productId: string; variationSku?: string } = {
          productId: item.productId,
        };
        if (item.variationSku) target.variationSku = item.variationSku;
        return target;
      });

  const stores = useMemo(() => {
    if (!cart?.items) return [];

    const grouped = cart.items.reduce(
      (acc, item) => {
        const vendorId = getCartVendorId(item.vendorId);
        // Vendors from /vendors/customer may key on either `id` or `_id`, so match on both.
        const vendorInfo = vendors.find(
          (vendor) => (vendor.id ?? vendor._id) === vendorId,
        );

        if (!acc[vendorId]) {
          // The cart endpoint doesn't always populate the vendor, so fall back
          // to a placeholder rather than rendering a nameless row.
          const fallbackName = getCartVendorName(item.vendorId) ?? t("store");

          acc[vendorId] = {
            vendorId,
            businessName:
              vendorInfo?.businessDetails?.businessName || fallbackName,
            image: vendorInfo?.storePhoto?.[0] || "",
            rating: vendorInfo?.rating?.average || 0,
            items: [],
            total: 0,
          };
        }

        acc[vendorId].items.push(item);
        acc[vendorId].total += item.itemSummary.grandTotal;

        return acc;
      },
      {} as Record<string, any>,
    );

    // Newest order first. `getCartVendorOrder` explains what stands in for the
    // date the API doesn't send.
    return getCartVendorOrder(cart.items)
      .map((vendorId) => grouped[vendorId])
      .filter(Boolean);
  }, [cart, vendors, t]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header skeleton */}
        <div className="mb-10">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-10 w-72 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="mt-3 h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
        </div>

        {/* Store cards skeleton */}
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm"
            >
              <div className="mb-6 flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                  <div>
                    <div className="h-8 w-56 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
                    <div className="mt-3 flex gap-3">
                      <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200 dark:bg-neutral-800" />
                      <div className="h-10 w-28 animate-pulse rounded-xl bg-gray-200 dark:bg-neutral-800" />
                    </div>
                  </div>
                </div>
                <div className="h-6 w-6 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
              </div>
              {/* Product rows skeleton */}
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-24 w-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-neutral-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
                      <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
                      <div className="flex justify-between">
                        <div className="h-10 w-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-neutral-800" />
                        <div className="h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex animate-pulse items-center justify-between rounded-3xl bg-gray-200 dark:bg-neutral-800 px-6 py-5">
                <div className="h-7 w-40 rounded bg-gray-300 dark:bg-neutral-700" />
                <div className="h-10 w-24 rounded-xl bg-gray-300 dark:bg-neutral-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-2xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/20 p-6 text-red-500 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 transition-colors duration-200">
      <div className="mb-10">
        <p className="mb-3 text-sm text-gray-500 dark:text-neutral-400">{t("cartBreadcrumb")}</p>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-neutral-50">
          {t("myShoppingCart")}
        </h1>
        {/* Counted here rather than read from `cart.totalItems`: the API's
            figure covers only the active items, and since just one store can be
            active at a time it could never describe the basket as a whole. */}
        <p className="mt-2 text-gray-500 dark:text-neutral-400">
          {cart?.items?.length ?? 0} {t("itemsInCart")}
        </p>
      </div>

      <div className="space-y-6">
        {stores.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 dark:border-neutral-800 p-12 text-center text-neutral-800 dark:text-neutral-200">
            <h3 className="text-xl font-semibold">{t("yourCartIsEmpty")}</h3>
            <p className="mt-2 text-gray-500 dark:text-neutral-400">{t("addProductsToContinue")}</p>
          </div>
        ) : (
          stores.map((store: any) => (
            <CartStoreCard
              key={store.vendorId}
              vendorId={store.vendorId}
              businessName={store.businessName}
              image={store.image}
              rating={store.rating}
              items={store.items}
              total={store.total}
              collapsible={stores.length > 1}
              deleteTargets={getStoreDeleteTargets(store.vendorId)}
              onCartChanged={resyncCart}
            />
          ))
        )}
      </div>
    </div>
  );
}
