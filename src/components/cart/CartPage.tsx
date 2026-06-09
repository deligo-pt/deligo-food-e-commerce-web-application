/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";

import CartStoreCard from "./CartStoreCard";

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
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header Skeleton */}
        <div className="mb-10">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-72 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-4 w-40 animate-pulse rounded bg-gray-200" />
        </div>

        {/* Store Cards Skeleton */}
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-6 flex items-start justify-between">
                <div className="flex gap-4">
                  {/* Store Image */}
                  <div className="h-20 w-20 animate-pulse rounded-full border-4 border-gray-100 bg-gray-200" />

                  {/* Store Info */}
                  <div>
                    {/* Business Name */}
                    <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />

                    {/* Rating + Items */}
                    <div className="mt-3 flex gap-3">
                      <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />

                      <div className="h-10 w-28 animate-pulse rounded-xl bg-gray-200" />
                    </div>
                  </div>
                </div>

                {/* More Button */}
                <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
              </div>

              {/* Checkout Button */}
              <div className="flex items-center justify-between rounded-3xl bg-gray-200 px-6 py-5 animate-pulse">
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

      {/* Full Width Store List */}
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
              itemCount={store.items.length}
              total={store.total}
            />
          ))
        )}
      </div>
    </div>
  );
}
