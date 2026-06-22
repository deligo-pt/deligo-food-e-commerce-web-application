/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  MapPin,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { CartResponse } from "@/types/cart";
import { useTranslation } from "@/hooks/useTranslation";
import { useCartStore } from "@/stores/cartStore";

interface CheckoutPageProps {
  vendorId: string;
}

export default function CheckoutPage({ vendorId }: CheckoutPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  const pendingUpdatesRef = useRef<Record<string, number>>({});
  const syncTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const isSyncingRef = useRef<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState("");
  const [isProceeding, setIsProceeding] = useState(false);

  const applyPendingUpdates = useCallback((cartData: CartResponse | null): CartResponse | null => {
    if (!cartData) return null;

    const updatedItems = cartData.items.map((cartItem) => {
      const key = cartItem.productId + "_" + (cartItem.variationSku || "default");
      const pendingDelta = pendingUpdatesRef.current[key] || 0;

      if (pendingDelta === 0) return cartItem;

      const pricing = cartItem.productPricing;
      const newQty = Math.max(1, cartItem.itemSummary.quantity + pendingDelta);

      const newTotalProductDiscount = pricing.productDiscountAmount * newQty;
      const newTotalBeforeTax = pricing.priceAfterProductDiscount * newQty;
      const newTotalTaxAmount = newTotalBeforeTax * (pricing.taxRate / 100);
      const newGrandTotal = newTotalBeforeTax + newTotalTaxAmount;

      return {
        ...cartItem,
        itemSummary: {
          ...cartItem.itemSummary,
          quantity: newQty,
          totalProductDiscount: newTotalProductDiscount,
          totalBeforeTax: newTotalBeforeTax,
          totalTaxAmount: newTotalTaxAmount,
          grandTotal: newGrandTotal,
        },
      };
    });

    const totalItems = updatedItems.reduce(
      (sum, i) => sum + i.itemSummary.quantity,
      0,
    );

    return {
      ...cartData,
      items: updatedItems,
      totalItems,
    };
  }, []);

  const fetchCheckoutData = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError("");

        const [cartRes, vendorRes] = await Promise.all([
          apiClient.get("/carts/view-cart"),
          apiClient.get("/vendors/customer?page=1&limit=100"),
        ]);

        const cartData = cartRes.data.data;
        setCart(applyPendingUpdates(cartData));

        const foundVendor = vendorRes.data.data.find(
          (v: any) => v.id === vendorId || v._id === vendorId,
        );

        setVendor(foundVendor);
      } catch (error) {
        setError(getApiErrorMessage(error, "Failed to load checkout"));
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [vendorId, applyPendingUpdates],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCheckoutData(true);
  }, [fetchCheckoutData]);

  useEffect(() => {
    const timeouts = syncTimeoutRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);
  const vendorItems = useMemo(() => {
    return (
      cart?.items.filter(
        (item) => item.vendorId._id === vendorId && item.isActive === true,
      ) || []
    );
  }, [cart, vendorId]);

  const summary = useMemo(() => {
    return vendorItems.reduce(
      (acc, item) => {
        acc.originalPrice +=
          item.productPricing.originalPrice * item.itemSummary.quantity;
        acc.discount += item.itemSummary.totalProductDiscount;
        acc.tax += item.itemSummary.totalTaxAmount;
        acc.total += item.itemSummary.grandTotal;
        return acc;
      },
      { originalPrice: 0, discount: 0, tax: 0, total: 0 },
    );
  }, [vendorItems]);

  const executeSync = async (key: string, item: any) => {
    const delta = pendingUpdatesRef.current[key];
    if (!delta) return;

    delete syncTimeoutRef.current[key];

    isSyncingRef.current[key] = true;
    
    pendingUpdatesRef.current[key] = 0;

    try {
      const syncAction = delta > 0 ? "increment" : "decrement";
      const syncQty = Math.abs(delta);

      const payload: any = {
        productId: item.productId,
        quantity: syncQty,
        action: syncAction,
      };
      if (item.variationSku && item.variationSku !== null) {
        payload.variationSku = item.variationSku;
      }

      await apiClient.patch("/carts/update-quantity", payload);
      
      await fetchCheckoutData(false);
      useCartStore.getState().fetchCart();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to sync cart updates"));
      await fetchCheckoutData(false);
    } finally {
      isSyncingRef.current[key] = false;
      if (pendingUpdatesRef.current[key] && pendingUpdatesRef.current[key] !== 0) {
        triggerSync(key, item);
      }
    }
  };

  const triggerSync = (key: string, item: any) => {
    if (isSyncingRef.current[key]) return;

    if (syncTimeoutRef.current[key]) {
      clearTimeout(syncTimeoutRef.current[key]);
    }

    syncTimeoutRef.current[key] = setTimeout(() => {
      executeSync(key, item);
    }, 500);
  };

  const updateQuantity = (
    item: any,
    action: "increment" | "decrement",
  ) => {
    const key = item.productId + "_" + (item.variationSku || "default");
    const change = action === "increment" ? 1 : -1;
    const currentQty = item.itemSummary.quantity;
    const newQty = currentQty + change;

    if (newQty < 1) return;

    setCart((prevCart) => {
      if (!prevCart) return null;
      const updatedItems = prevCart.items.map((cartItem) => {
        const itemKey = cartItem.productId + "_" + (cartItem.variationSku || "default");
        if (itemKey === key) {
          const pricing = cartItem.productPricing;
          const newTotalProductDiscount = pricing.productDiscountAmount * newQty;
          const newTotalBeforeTax = pricing.priceAfterProductDiscount * newQty;
          const newTotalTaxAmount = newTotalBeforeTax * (pricing.taxRate / 100);
          const newGrandTotal = newTotalBeforeTax + newTotalTaxAmount;

          return {
            ...cartItem,
            itemSummary: {
              ...cartItem.itemSummary,
              quantity: newQty,
              totalProductDiscount: newTotalProductDiscount,
              totalBeforeTax: newTotalBeforeTax,
              totalTaxAmount: newTotalTaxAmount,
              grandTotal: newGrandTotal,
            },
          };
        }
        return cartItem;
      });

      const totalItems = updatedItems.reduce(
        (sum, i) => sum + i.itemSummary.quantity,
        0,
      );

      return {
        ...prevCart,
        items: updatedItems,
        totalItems,
      };
    });

    // 2. Accumulate delta and queue/trigger sync
    pendingUpdatesRef.current[key] = (pendingUpdatesRef.current[key] || 0) + change;
    triggerSync(key, item);
  };

  const deleteItem = async (item: any) => {
    try {
      setDeletingItem(item.productId);

      await apiClient.delete("/carts/delete-item", {
        data: [
          {
            productId: item.productId,
            variationSku: item.variationSku ?? null,
          },
        ],
      });

      await fetchCheckoutData(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to remove item"));
    } finally {
      setDeletingItem(null);
    }
  };

  const handleProceedToCheckout = async () => {
    if (!vendorId) {
      toast.error("Vendor information missing");
      return;
    }
    try {
      setIsProceeding(true);
      const response = await apiClient.post("/checkout", { useCart: true });
      const checkoutId = response.data.data._id;
      // Redirect to payment page under the same vendor route
      router.push(
        `/cart/checkout/${vendorId}/payment?checkoutId=${checkoutId}`,
      );
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Failed to create checkout session"),
      );
    } finally {
      setIsProceeding(false);
    }
  };
  const goBack = () => window.history.back();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-neutral-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-8 bg-[#f8f9fa] dark:bg-neutral-950 min-h-screen">
        <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-6 text-red-500 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const vendorImage =
    vendor?.documents?.storePhoto?.[0] ||
    vendor?.storePhoto?.[0] ||
    "https://placehold.co/400x400?text=No+Image";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <button
        onClick={goBack}
        className="mb-4 flex items-center gap-2 text-gray-500 transition hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        <ArrowLeft size={18} />
        {t("back")}
      </button>

      <h1 className="text-4xl font-extrabold text-gray-900 dark:text-neutral-50">
        {t("reviewYourCart")}
      </h1>
      <p className="mt-2 text-gray-500 dark:text-neutral-400">{t("completeOrderDetails")}</p>

      <div className="mt-8 mb-8 overflow-hidden rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
        <div className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-gray-100 dark:bg-neutral-800">
              <Image
                fill
                src={vendorImage}
                alt={vendor?.businessDetails?.businessName || "Store"}
                className="object-cover"
                sizes="96px"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/400x400?text=No+Image";
                }}
              />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-neutral-50">
                {vendor?.businessDetails?.businessName || "Store"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-pink-50 dark:bg-pink-950/30 px-3 py-2 text-pink-600 dark:text-pink-400">
                  <ShoppingBag size={16} />
                  <span className="font-medium">
                    {vendorItems.length} {t("products")}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 px-3 py-2 text-green-600 dark:text-green-400">
                  <MapPin size={16} />
                  <span className="font-medium">{t("deliveryAvailable")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {vendorItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-neutral-50">{t("noProductsFound")}</h3>
              <p className="mt-2 text-gray-500 dark:text-neutral-400">{t("vendorHasNoProducts")}</p>
            </div>
          ) : (
            vendorItems.map((item) => (
              <div
                key={`${item.productId}-${item.variationSku ?? "default"}`}
                className="overflow-hidden rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm"
              >
                <div className="p-5">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="relative h-28 w-full overflow-hidden rounded-2xl sm:w-28 bg-gray-100 dark:bg-neutral-800">
                      <Image
                        fill
                        src={item.image}
                        alt={item.name}
                        className="object-cover"
                        sizes="112px"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-neutral-50">
                            {item.name}
                          </h3>
                          {item.variationSku && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                              {t("sku")}: {item.variationSku}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteItem(item)}
                          disabled={deletingItem === item.productId}
                          className="rounded-xl p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        >
                          {deletingItem === item.productId ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center rounded-2xl border border-gray-200 dark:border-neutral-800">
                          <button
                            onClick={() => updateQuantity(item, "decrement")}
                            className="p-3 transition hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                          >
                            <Minus size={16} />
                          </button>
                          <div className="min-w-15 text-center font-bold text-gray-900 dark:text-neutral-50">
                            {item.itemSummary.quantity}
                          </div>

                          <button
                            onClick={() => updateQuantity(item, "increment")}
                            className="p-3 transition hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400 dark:text-neutral-500 line-through">
                            €
                            {(
                              item.productPricing.originalPrice *
                              item.itemSummary.quantity
                            ).toFixed(2)}
                          </p>
                          <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                            €{item.itemSummary.grandTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-24 overflow-hidden rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
            <div className="border-b border-gray-100 dark:border-neutral-800 p-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-neutral-50">
                {t("orderSummary")}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                {t("reviewOrderDetails")}
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-400">{t("originalPrice")}</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-50">
                  €{summary.originalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-400">{t("productDiscount")}</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  -€{summary.discount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-400">{t("tax")}</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-50">€{summary.tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-dashed border-gray-200 dark:border-neutral-800 pt-4">
                <div className="flex justify-between">
                  <span className="text-xl font-bold text-gray-900 dark:text-neutral-50">{t("total")}</span>
                  <span className="text-3xl font-extrabold text-pink-600 dark:text-pink-400">
                    €{summary.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-neutral-800 p-6">
              <label className="mb-2 block font-semibold text-gray-900 dark:text-neutral-50">
                {t("deliveryInstructions")}
              </label>
              <textarea
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t("deliveryInstructionsPlaceholder")}
                className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 outline-none transition focus:border-pink-500 dark:focus:border-pink-400 text-gray-900 dark:text-neutral-50 placeholder:text-gray-400 dark:placeholder:text-neutral-600"
              />
            </div>

            <div className="border-t border-gray-100 dark:border-neutral-800 p-6">
              <button
                onClick={handleProceedToCheckout}
                disabled={isProceeding || vendorItems.length === 0}
                className="w-full rounded-2xl bg-pink-600 dark:bg-pink-500 py-4 text-lg font-semibold text-white transition hover:bg-pink-700 dark:hover:bg-pink-600 disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500"
              >
                {isProceeding ? t("processing") : t("proceedToCheckout")}
              </button>
              <p className="mt-3 text-center text-xs text-gray-400 dark:text-neutral-500">
                {t("termsAndConditions")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}