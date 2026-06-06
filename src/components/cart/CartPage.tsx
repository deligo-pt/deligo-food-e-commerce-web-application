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
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const [cartRes, vendorsRes] = await Promise.all([
          apiClient.get("/carts/view-cart"),
          apiClient.get("/vendors/customer?page=1&limit=100"),
        ]);

        setCart(cartRes.data.data);
        setVendors(vendorsRes.data.data || []);
      } catch (error) {
        setError(getApiErrorMessage(error, "Failed to load cart"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
      {} as Record<string, any>,
    );

    return Object.values(grouped);
  }, [cart, vendors]);
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
            stores.map((store: any) => (
              <CartStoreCard
                key={store.vendorId}
                vendorId={store.vendorId}
                businessName={store.businessName}
                image={store.image}
                rating={store.rating}
                itemCount={store.items.length}
                total={store.total}
              />
            ))
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
