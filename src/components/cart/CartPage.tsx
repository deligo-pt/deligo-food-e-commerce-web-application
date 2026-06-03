/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

import CartStoreCard from "./CartStoreCard";
import CartSummary from "./CartSummary";
import PromoBanner from "./PromoBanner";

import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { CartResponse } from "@/types/cart";

export default function CartPage() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCart = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await apiClient.get("/carts/view-cart");

        setCart(data.data);
      } catch (error) {
        setError(getApiErrorMessage(error, "Failed to load cart"));
      } finally {
        setLoading(false);
      }
    };

    fetchCart();
  }, []);

  const stores = useMemo(() => {
    if (!cart?.items) return [];

    const grouped = cart.items.reduce(
      (acc, item) => {
        const vendorId = item.vendorId._id;

        if (!acc[vendorId]) {
          acc[vendorId] = {
            vendorId,

            vendorUserId: item.vendorId.userId,

            storeName: `${item.vendorId.name.firstName} ${item.vendorId.name.lastName}`,

            items: [],
          };
        }

        acc[vendorId].items.push(item);

        return acc;
      },
      {} as Record<string, any>,
    );

    return Object.values(grouped);
  }, [cart]);

  if (loading) {
    return (
      <div className="flex min-h-125 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />
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
      {/* Header */}
      <div className="mb-10">
        <p className="mb-3 text-sm text-gray-500">Home / Active Carts</p>

        <h1 className="text-4xl font-extrabold text-gray-900">
          My Shopping Cart
        </h1>

        <p className="mt-2 text-gray-500">
          {cart?.totalItems ?? 0} item(s) in your cart
        </p>
      </div>

      {/* Layout */}
      <div className="grid gap-8 xl:grid-cols-12">
        {/* Left Side */}
        <div className="space-y-6 xl:col-span-8">
          {stores.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 p-12 text-center">
              <h3 className="text-xl font-semibold">Your cart is empty</h3>

              <p className="mt-2 text-gray-500">
                Add some products to continue.
              </p>
            </div>
          ) : (
            stores.map((store: any) => {
              const total = store.items.reduce(
                (sum: number, item: any) => sum + item.itemSummary.grandTotal,
                0,
              );

              return (
                <CartStoreCard
                  key={store.vendorId}
                  storeName={store.storeName}
                  itemCount={store.items.length}
                  total={total}
                  items={store.items.map((item: any) => ({
                    productId: item.productId,
                    name: item.name,
                    image: item.image,
                    quantity: item.itemSummary.quantity,
                    grandTotal: item.itemSummary.grandTotal,
                  }))}
                />
              );
            })
          )}
        </div>

        {/* Right Side */}
        <div className="xl:col-span-4">
          <div className="sticky top-24 space-y-6">
            <CartSummary
              originalPrice={cart?.cartCalculation?.totalOriginalPrice ?? 0}
              discount={cart?.cartCalculation?.totalProductDiscount ?? 0}
              taxableAmount={cart?.cartCalculation?.taxableAmount ?? 0}
              tax={cart?.cartCalculation?.totalTaxAmount ?? 0}
              total={cart?.cartCalculation?.grandTotal ?? 0}
            />

            <PromoBanner />
          </div>
        </div>
      </div>
    </div>
  );
}
