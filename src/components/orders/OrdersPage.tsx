/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import OrderCard from "./OrderCard";
import OrdersPageSkeleton from "./OrdersPageSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

export default function OrdersPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"ongoing" | "history">("ongoing");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getOrders = async () => {
      try {
        const res = await apiClient.get("/orders", {
          params: { limit: 10 },
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
    return <OrdersPageSkeleton />;
  }

  const ongoingOrders = orders.filter((order) =>
    [
      "PENDING",
      "ACCEPTED",
      "ASSIGNED",
      "PREPARING",
      "READY_FOR_PICKUP",
      "PICKED_UP",
      "ON_THE_WAY",
    ].includes(order.orderStatus)
  );

  const historyOrders = orders.filter((order) =>
    ["DELIVERED", "CANCELLED", "REJECTED"].includes(order.orderStatus)
  );

  const getOrderProgress = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          progress: 15,
          text: t("waitingRestaurantConfirmation"),
          status: "pending" as const,
        };
      case "ACCEPTED":
      case "ASSIGNED":
        return {
          progress: 40,
          text: t("orderAccepted") || t("accepted"),
          status: "accepted" as const,
        };
      case "PREPARING":
        return {
          progress: 60,
          text: t("chefPreparingMeal") || t("preparing"),
          status: "accepted" as const,
        };
      case "READY_FOR_PICKUP":
        return {
          progress: 75,
          text: t("readyForPickup"),
          status: "accepted" as const,
        };
      case "PICKED_UP":
      case "ON_THE_WAY":
        return {
          progress: 90,
          text: t("onTheWay") || t("riderHeadingLocation"),
          status: "accepted" as const,
        };
      default:
        return {
          progress: 15,
          text: t("waitingRestaurantConfirmation"),
          status: "pending" as const,
        };
    }
  };

  return (
    <section className="min-h-screen bg-[#f8f9fa] py-8">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-[#191c1d]">
            {t("myOrders")}
          </h1>

          <p className="mt-1 text-sm text-[#5a4044]">
            {t("trackOrdersDescription")}
          </p>
        </div>

        <div className="mb-8 flex border-b border-[#e3bdc3]">
          <button
            onClick={() => setActiveTab("ongoing")}
            className={`relative flex-1 py-4 text-center font-medium ${
              activeTab === "ongoing" ? "text-[#b0004a]" : "text-[#5a4044]"
            }`}
          >
            {t("ongoing")}
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
            {t("history")}
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 h-1 w-full rounded-t bg-[#b0004a]" />
            )}
          </button>
        </div>

        {activeTab === "ongoing" ? (
          <div className="space-y-6">
            {ongoingOrders.length === 0 ? (
              <div className="flex h-75 items-center justify-center rounded-xl bg-white">
                <p className="text-[#5a4044]">{t("noOngoingOrders")}</p>
              </div>
            ) : (
              ongoingOrders.map((order) => {
                const { progress, text, status } = getOrderProgress(order.orderStatus);
                return (
                  <OrderCard
                    key={order._id}
                    image={order.items?.[0]?.image}
                    restaurant={`${order.vendorId?.name?.firstName ?? ""} ${
                      order.vendorId?.name?.lastName ?? ""
                    }`}
                    orderId={order.orderId}
                    date={new Date(order.createdAt).toLocaleString()}
                    price={`€${order.payoutSummary?.grandTotal?.toFixed(2)}`}
                    status={status}
                    items={order.items
                      ?.map(
                        (item: any) =>
                          `${item.itemSummary?.quantity}x ${item.name}`,
                      )
                      .join(", ")}
                    progress={progress}
                    progressText={text}
                  />
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {historyOrders.length === 0 ? (
              <div className="flex h-75 items-center justify-center rounded-xl bg-white">
                <p className="text-[#5a4044]">{t("previousOrdersMessage")}</p>
              </div>
            ) : (
              historyOrders.map((order) => (
                <OrderCard
                  key={order._id}
                  image={order.items?.[0]?.image}
                  restaurant={`${order.vendorId?.name?.firstName ?? ""} ${
                    order.vendorId?.name?.lastName ?? ""
                  }`}
                  orderId={order.orderId}
                  date={new Date(order.createdAt).toLocaleString()}
                  price={`€${order.payoutSummary?.grandTotal?.toFixed(2)}`}
                  status={order.orderStatus === "DELIVERED" ? "delivered" : "cancelled"}
                  items={order.items
                    ?.map(
                      (item: any) =>
                        `${item.itemSummary?.quantity}x ${item.name}`,
                    )
                    .join(", ")}
                  progress={100}
                  progressText={
                    order.orderStatus === "DELIVERED"
                      ? t("delivered")
                      : order.orderStatus === "CANCELLED"
                      ? t("cancelled") || "Cancelled"
                      : t("rejected") || "Rejected"
                  }
                />
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
