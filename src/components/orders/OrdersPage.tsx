/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import OrderCard from "./OrderCard";

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<"ongoing" | "history">("ongoing");

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getOrders = async () => {
      try {
        const res = await apiClient.get("/orders", {
          params: {
            limit: 10,
          },
        });

        setOrders(res.data.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    getOrders();
  }, []);

  if (loading) {
    return (
      <section className="min-h-screen bg-[#f8f9fa] py-8">
        <div className="mx-auto max-w-5xl px-4 md:px-8">Loading...</div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#f8f9fa] py-8">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-[#191c1d]">My Orders</h1>

          <p className="mt-1 text-sm text-[#5a4044]">
            Track your active orders and view your order history.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex border-b border-[#e3bdc3]">
          <button
            onClick={() => setActiveTab("ongoing")}
            className={`relative flex-1 py-4 text-center font-medium ${
              activeTab === "ongoing" ? "text-[#b0004a]" : "text-[#5a4044]"
            }`}
          >
            Ongoing
            {activeTab === "ongoing" && (
              <div className="absolute bottom-0 left-0 h-1 w-full rounded-t bg-[#b0004a]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`relative flex-1 py-4 text-center font-medium ${
              activeTab === "history" ? "text-[#b0004a]" : "text-[#5a4044]"
            }`}
          >
            History
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 h-1 w-full rounded-t bg-[#b0004a]" />
            )}
          </button>
        </div>

        {activeTab === "ongoing" ? (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard
                key={order._id}
                image={order.items?.[0]?.image}
                restaurant={`${order.vendorId?.name?.firstName ?? ""} ${
                  order.vendorId?.name?.lastName ?? ""
                }`}
                orderId={order.orderId}
                date={new Date(order.createdAt).toLocaleString()}
                price={`€${order.payoutSummary?.grandTotal?.toFixed(2)}`}
                status={
                  order.orderStatus === "ACCEPTED" ? "accepted" : "pending"
                }
                items={order.items
                  ?.map(
                    (item: any) =>
                      `${item.itemSummary?.quantity}x ${item.name}`,
                  )
                  .join(", ")}
                progress={order.orderStatus === "ACCEPTED" ? 65 : 15}
                progressText={
                  order.orderStatus === "ACCEPTED"
                    ? "Chef is preparing your meal"
                    : "Waiting for restaurant confirmation"
                }
                eta="1:15 PM"
                secondaryButton={
                  order.orderStatus === "ACCEPTED"
                    ? "Call Support"
                    : "Cancel Order"
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex h-75 items-center justify-center rounded-xl bg-white">
            <p className="text-[#5a4044]">
              Your previous orders will appear here
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
