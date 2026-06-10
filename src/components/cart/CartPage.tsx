/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import CartStoreCard from "./CartStoreCard";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { CartResponse } from "@/types/cart";

export default function CartPage() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshCart = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError("");

      const [cartRes, vendorsRes] = await Promise.all([
        apiClient.get("/carts/view-cart"),
        apiClient.get("/vendors/customer?page=1&limit=100"),
      ]);

      setCart(cartRes.data.data);
      setVendors(vendorsRes.data.data || []);
    } catch (error) {
      const errMsg = getApiErrorMessage(error, "Failed to load cart");
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Optimistic removal of a single product (used by product row)
  const removeProductFromCart = (productId: string, variationSku: string | null) => {
    if (!cart) return;

    const newItems = cart.items.filter(
      (item) => !(item.productId === productId && item.variationSku === variationSku)
    );

    // Recalculate totals
    const totalItems = newItems.reduce((sum, item) => sum + item.itemSummary.quantity, 0);
    const totalOriginalPrice = newItems.reduce(
      (sum, item) => sum + item.productPricing.originalPrice * item.itemSummary.quantity,
      0
    );
    const totalProductDiscount = newItems.reduce(
      (sum, item) => sum + (item.productPricing.productDiscountAmount || 0) * item.itemSummary.quantity,
      0
    );
    const taxableAmount = newItems.reduce(
      (sum, item) => sum + item.productPricing.priceAfterProductDiscount * item.itemSummary.quantity,
      0
    );
    const totalTaxAmount = newItems.reduce(
      (sum, item) => sum + (item.itemSummary.totalTaxAmount || 0),
      0
    );
    const grandTotal = newItems.reduce(
      (sum, item) => sum + item.itemSummary.grandTotal,
      0
    );

    setCart({
      ...cart,
      items: newItems,
      totalItems,
      cartCalculation: {
        totalOriginalPrice,
        totalProductDiscount,
        taxableAmount,
        totalTaxAmount,
        grandTotal,
      },
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCart(true);
  }, []);

  const stores = useMemo(() => {
    if (!cart?.items) return [];

    const grouped = cart.items.reduce(
      (acc, item) => {
        const vendorId = item.vendorId._id;
        const vendorInfo = vendors.find((vendor) => vendor.id === vendorId);

        if (!acc[vendorId]) {
          acc[vendorId] = {
            vendorId,
            businessName:
              vendorInfo?.businessDetails?.businessName ||
              `${item.vendorId.name.firstName} ${item.vendorId.name.lastName}`,
            image: vendorInfo?.storePhoto?.[0] || "/placeholder-store.jpg",
            rating: vendorInfo?.rating?.average || 0,
            items: [],
            total: 0,
          };
        }

        acc[vendorId].items.push(item);
        acc[vendorId].total += item.itemSummary.grandTotal;

        return acc;
      },
      {} as Record<string, any>
    );

    return Object.values(grouped);
  }, [cart, vendors]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header skeleton */}
        <div className="mb-10">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-72 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-4 w-40 animate-pulse rounded bg-gray-200" />
        </div>

        {/* Store cards skeleton */}
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-start justify-between">
                <div className="flex gap-4">
                  <div className="h-20 w-20 animate-pulse rounded-full bg-gray-200" />
                  <div>
                    <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
                    <div className="mt-3 flex gap-3">
                      <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
                      <div className="h-10 w-28 animate-pulse rounded-xl bg-gray-200" />
                    </div>
                  </div>
                </div>
                <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
              </div>
              {/* Product rows skeleton */}
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-24 w-24 animate-pulse rounded-2xl bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                      <div className="flex justify-between">
                        <div className="h-10 w-28 animate-pulse rounded-2xl bg-gray-200" />
                        <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex animate-pulse items-center justify-between rounded-3xl bg-gray-200 px-6 py-5">
                <div className="h-7 w-40 rounded bg-gray-300" />
                <div className="h-10 w-24 rounded-xl bg-gray-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-10">
        <p className="mb-3 text-sm text-gray-500">Home / Active Carts</p>
        <h1 className="text-4xl font-extrabold text-gray-900">My Shopping Cart</h1>
        <p className="mt-2 text-gray-500">
          {cart?.totalItems ?? 0} item(s) in your cart
        </p>
      </div>

      <div className="space-y-6">
        {stores.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 p-12 text-center">
            <h3 className="text-xl font-semibold">Your cart is empty</h3>
            <p className="mt-2 text-gray-500">Add some products to continue.</p>
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
              onProductUpdate={() => refreshCart(false)}
              onProductRemove={removeProductFromCart}
            />
          ))
        )}
      </div>
    </div>
  );
}