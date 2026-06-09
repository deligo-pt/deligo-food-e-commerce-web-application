/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

interface CheckoutPageProps {
  vendorId: string;
}

export default function CheckoutPage({ vendorId }: CheckoutPageProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingAction, setUpdatingAction] = useState<{
    productId: string;
    action: "increment" | "decrement";
  } | null>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState("");
  const [isProceeding, setIsProceeding] = useState(false);

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
        setCart(cartData);

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
    [vendorId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCheckoutData(true);
  }, [fetchCheckoutData]);
  const vendorItems = useMemo(() => {
    return cart?.items.filter((item) => item.vendorId._id === vendorId) || [];
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

  const updateQuantity = async (
    item: any,
    action: "increment" | "decrement",
  ) => {
    try {
      setUpdatingAction({
        productId: item.productId,
        action,
      });
      const payload: any = { productId: item.productId, quantity: 1, action };
      if (item.variationSku && item.variationSku !== null) {
        payload.variationSku = item.variationSku;
      }
      await apiClient.patch("/carts/update-quantity", payload);
      await fetchCheckoutData(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update quantity"));
    } finally {
      setUpdatingAction(null);
    }
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
      toast.error(getApiErrorMessage(error, "Failed to create checkout session"));
    } finally {
      setIsProceeding(false);
    }
  };
  const goBack = () => window.history.back();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-500">
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
        className="mb-4 flex items-center gap-2 text-gray-500 transition hover:text-gray-700"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <h1 className="text-4xl font-extrabold text-gray-900">
        Review Your Cart
      </h1>
      <p className="mt-2 text-gray-500">
        Complete your order details before checkout
      </p>

      <div className="mt-8 mb-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-gray-100">
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
              <h2 className="text-3xl font-bold text-gray-900">
                {vendor?.businessDetails?.businessName || "Store"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-pink-50 px-3 py-2 text-pink-600">
                  <ShoppingBag size={16} />
                  <span className="font-medium">
                    {vendorItems.length} Products
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-green-600">
                  <MapPin size={16} />
                  <span className="font-medium">Delivery Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {vendorItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <h3 className="text-xl font-semibold">No products found</h3>
              <p className="mt-2 text-gray-500">
                This vendor currently has no products in your cart.
              </p>
            </div>
          ) : (
            vendorItems.map((item) => (
              <div
                key={`${item.productId}-${item.variationSku ?? "default"}`}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="p-5">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="relative h-28 w-full overflow-hidden rounded-2xl sm:w-28 bg-gray-100">
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
                          <h3 className="text-xl font-bold text-gray-900">
                            {item.name}
                          </h3>
                          {item.variationSku && (
                            <p className="mt-1 text-sm text-gray-500">
                              SKU: {item.variationSku}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteItem(item)}
                          disabled={deletingItem === item.productId}
                          className="rounded-xl p-2 text-red-500 transition hover:bg-red-50"
                        >
                          {deletingItem === item.productId ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center rounded-2xl border border-gray-200">
                          <button
                            onClick={() => updateQuantity(item, "decrement")}
                            disabled={
                              updatingAction?.productId === item.productId
                            }
                            className="p-3 transition hover:bg-gray-100"
                          >
                            {updatingAction?.productId === item.productId &&
                            updatingAction?.action === "decrement" ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Minus size={16} />
                            )}
                          </button>
                          <div className="min-w-15 text-center font-bold">
                            {item.itemSummary.quantity}
                          </div>

                          <button
                            onClick={() => updateQuantity(item, "increment")}
                            disabled={
                              updatingAction?.productId === item.productId
                            }
                            className="p-3 transition hover:bg-gray-100"
                          >
                            {updatingAction?.productId === item.productId &&
                            updatingAction?.action === "increment" ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Plus size={16} />
                            )}
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400 line-through">
                            €
                            {(
                              item.productPricing.originalPrice *
                              item.itemSummary.quantity
                            ).toFixed(2)}
                          </p>
                          <p className="text-2xl font-bold text-pink-600">
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
          <div className="sticky top-24 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Order Summary
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Review your order details
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Original Price</span>
                <span className="font-semibold">
                  €{summary.originalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Product Discount</span>
                <span className="font-semibold text-green-600">
                  -€{summary.discount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span className="font-semibold">€{summary.tax.toFixed(2)}</span>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-xl font-bold">Total</span>
                  <span className="text-3xl font-extrabold text-pink-600">
                    €{summary.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 p-6">
              <label className="mb-2 block font-semibold text-gray-900">
                Delivery Instructions
              </label>
              <textarea
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Add any special instructions for delivery..."
                className="w-full rounded-2xl border border-gray-200 p-4 outline-none transition focus:border-pink-500"
              />
            </div>

            <div className="border-t border-gray-100 p-6">
              <button
                onClick={handleProceedToCheckout}
                disabled={isProceeding || vendorItems.length === 0}
                className="w-full rounded-2xl bg-pink-600 py-4 text-lg font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
              >
                {isProceeding ? "Processing..." : "Proceed to Checkout"}
              </button>
              <p className="mt-3 text-center text-xs text-gray-400">
                By continuing you agree to our terms and conditions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}