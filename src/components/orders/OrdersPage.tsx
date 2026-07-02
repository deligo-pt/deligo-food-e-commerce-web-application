/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import OrderCard from "./OrderCard";
import OrdersPageSkeleton from "./OrdersPageSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { Star, X } from "lucide-react";
import { toast } from "sonner";

interface StarRatingProps {
  value: number;
  onChange: (val: number) => void;
  size?: number;
}

function StarRating({ value, onChange, size = 28 }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hoverValue !== null ? star <= hoverValue : star <= value;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            className="transition-transform active:scale-95 duration-100 hover:scale-110"
          >
            <Star
              size={size}
              className={`transition-all duration-100 ${
                active
                  ? "fill-[#f6c344] text-[#f6c344] drop-shadow-[0_2px_4px_rgba(246,195,68,0.2)]"
                  : "text-gray-300 dark:text-neutral-700 hover:text-gray-400 dark:hover:text-neutral-600"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"ongoing" | "history">("ongoing");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<any[]>([]);
  const [activeRatingOrder, setActiveRatingOrder] = useState<any | null>(null);

  // Food Rating State
  const [foodRating, setFoodRating] = useState<number>(0);
  const [foodQuality, setFoodQuality] = useState<number>(0);
  const [packaging, setPackaging] = useState<number>(0);

  // Delivery Rating State
  const [deliveryRating, setDeliveryRating] = useState<number>(0);
  const [deliverySpeed, setDeliverySpeed] = useState<number>(0);
  const [riderBehavior, setRiderBehavior] = useState<number>(0);

  const [submittingRating, setSubmittingRating] = useState<boolean>(false);

  const fetchOrdersAndRatings = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const [ordersRes, ratingsRes] = await Promise.all([
        apiClient.get("/orders", { params: { limit: 100 } }),
        apiClient.get("/ratings/get-all-ratings"),
      ]);

      setOrders(ordersRes.data.data || []);
      setRatings(ratingsRes.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrdersAndRatings(true);
  }, [fetchOrdersAndRatings]);

  const handleSubmitReview = async () => {
    if (!activeRatingOrder) return;

    if (
      foodRating === 0 &&
      (activeRatingOrder.deliveryPartnerId ? deliveryRating === 0 : true)
    ) {
      toast.error(t("provideAtLeastOneRating"));
      return;
    }

    setSubmittingRating(true);

    try {
      let productStatus = "SKIPPED";
      let driverStatus = "SKIPPED";

      const submitSingleRating = async (payload: any) => {
        try {
          const response = await apiClient.post(
            "/ratings/create-rating",
            payload,
          );
          const message = response.data?.message?.toLowerCase() || "";
          if (
            message.includes("already rated") ||
            message.includes("already submitted")
          ) {
            return "ALREADY_RATED";
          }
          return "SUCCESS";
        } catch (err: any) {
          const errMsg = err.response?.data?.message?.toLowerCase() || "";
          const status = err.response?.status;
          if (
            status === 409 ||
            (status === 400 &&
              (errMsg.includes("already rated") ||
                errMsg.includes("already submitted")))
          ) {
            return "ALREADY_RATED";
          }
          throw err;
        }
      };

      // 1. Submit Product Rating
      if (foodRating > 0) {
        const productPayload = {
          ratingType: "PRODUCT",
          rating: foodRating,
          orderId: activeRatingOrder._id,
          subRatings: {
            foodQuality: foodQuality || foodRating,
            packaging: packaging || foodRating,
          },
        };
        productStatus = await submitSingleRating(productPayload);
      }

      // 2. Submit Delivery Partner Rating (if applicable)
      if (activeRatingOrder.deliveryPartnerId && deliveryRating > 0) {
        const driverPayload = {
          ratingType: "DELIVERY_PARTNER",
          rating: deliveryRating,
          orderId: activeRatingOrder._id,
          subRatings: {
            deliverySpeed: deliverySpeed || deliveryRating,
            riderBehavior: riderBehavior || deliveryRating,
          },
        };
        driverStatus = await submitSingleRating(driverPayload);
      }

      console.log("Rating Statuses:", { productStatus, driverStatus });

      if (
        productStatus === "ALREADY_RATED" &&
        (driverStatus === "ALREADY_RATED" || driverStatus === "SKIPPED")
      ) {
        toast.info(t("alreadyRated") || "You have already rated this order.");
      } else if (productStatus === "SUCCESS" || driverStatus === "SUCCESS") {
        toast.success(
          t("ratingsSubmitted") || "Thank you! Your feedback helps us improve.",
        );
      } else {
        toast.success(
          t("ratingsSubmitted") || "Thank you! Your feedback helps us improve.",
        );
      }

      setActiveRatingOrder(null);

      // Re-fetch ratings and orders lists to update states
      await fetchOrdersAndRatings(false);
    } catch (error) {
      console.error("Failed to submit rating", error);
      toast.error(
        getApiErrorMessage(error, "Failed to submit rating. Please try again."),
      );
    } finally {
      setSubmittingRating(false);
    }
  };

  const isOrderRated = (orderId: string) => {
    return ratings.some(
      (r: any) =>
        r.orderId === orderId ||
        (r.orderId &&
          typeof r.orderId === "object" &&
          r.orderId._id === orderId),
    );
  };

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
    ].includes(order.orderStatus),
  );

  const historyOrders = orders.filter((order) =>
    ["DELIVERED", "CANCELLED", "REJECTED"].includes(order.orderStatus),
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
    <section className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-8">
          <h1 className="text-[32px] font-bold text-[#191c1d] dark:text-neutral-50">
            {t("myOrders")}
          </h1>

          <p className="mt-1 text-sm text-[#5a4044] dark:text-neutral-400">
            {t("trackOrdersDescription")}
          </p>
        </div>

        <div className="mb-8 flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab("ongoing")}
            className={`relative flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === "ongoing" ? "text-[#b0004a] dark:text-pink-500" : "text-[#5a4044] dark:text-neutral-400"
            }`}
          >
            {t("ongoing")}
            {activeTab === "ongoing" && (
              <div className="absolute bottom-0 left-0 h-1 w-full rounded-t bg-[#b0004a] dark:bg-pink-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`relative flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === "history" ? "text-[#b0004a] dark:text-pink-500" : "text-[#5a4044] dark:text-neutral-400"
            }`}
          >
            {t("history")}
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 h-1 w-full rounded-t bg-[#b0004a] dark:bg-pink-500" />
            )}
          </button>
        </div>

        {activeTab === "ongoing" ? (
          <div className="space-y-6">
            {ongoingOrders.length === 0 ? (
              <div className="flex h-75 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-xs">
                <p className="text-[#5a4044] dark:text-neutral-400">{t("noOngoingOrders")}</p>
              </div>
            ) : (
              ongoingOrders.map((order) => {
                const { progress, text, status } = getOrderProgress(
                  order.orderStatus,
                );
                return (
                  <OrderCard
                    key={order._id}
                    dbId={order._id}
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
              <div className="flex h-75 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-xs">
                <p className="text-[#5a4044] dark:text-neutral-400">{t("previousOrdersMessage")}</p>
              </div>
            ) : (
              historyOrders.map((order) => (
                <OrderCard
                  key={order._id}
                  dbId={order._id}
                  image={order.items?.[0]?.image}
                  restaurant={`${order.vendorId?.name?.firstName ?? ""} ${
                    order.vendorId?.name?.lastName ?? ""
                  }`}
                  orderId={order.orderId}
                  date={new Date(order.createdAt).toLocaleString()}
                  price={`€${order.payoutSummary?.grandTotal?.toFixed(2)}`}
                  status={
                    order.orderStatus === "DELIVERED"
                      ? "delivered"
                      : "cancelled"
                  }
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
                  isRated={isOrderRated(order._id)}
                  onRateOrder={() => {
                    setFoodRating(0);
                    setFoodQuality(0);
                    setPackaging(0);
                    setDeliveryRating(0);
                    setDeliverySpeed(0);
                    setRiderBehavior(0);
                    setActiveRatingOrder(order);
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>      {/* Rating Modal */}
      {activeRatingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/60 p-4 backdrop-blur-xs transition-all duration-300">
          <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white dark:bg-neutral-900 border border-transparent dark:border-neutral-800 shadow-2xl transition-all duration-300 max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-[#191c1d] dark:text-neutral-50">
                  {t("rateYourOrder")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {t("order")} #{activeRatingOrder.orderId}
                </p>
              </div>
              <button
                onClick={() => setActiveRatingOrder(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-700 dark:hover:text-neutral-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white dark:bg-neutral-900">
              {/* Product / Food Rating Section */}
              <div className="rounded-2xl border border-pink-100/55 dark:border-neutral-800 bg-linear-to-b from-[#fafbfc] to-[#f4f6f8] dark:from-neutral-950/60 dark:to-neutral-950/30 p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-2">
                  <span className="rounded-full bg-pink-50 dark:bg-pink-950/30 px-2.5 py-0.5 text-xs font-semibold text-[#b0004a] dark:text-pink-400 uppercase tracking-wider">
                    {t("foodReview")}
                  </span>
                </div>

                {/* Overall Food Rating */}
                <div className="flex flex-col items-center justify-center py-2 space-y-2">
                  <span className="text-xs font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                    {t("overallRating")}
                  </span>
                  <StarRating
                    value={foodRating}
                    onChange={setFoodRating}
                    size={32}
                  />
                </div>

                {/* Sub-ratings: quality & packaging */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-t border-gray-100/80 dark:border-neutral-800 pt-3">
                    <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                      {t("foodQuality")}
                    </span>
                    <StarRating
                      value={foodQuality}
                      onChange={setFoodQuality}
                      size={20}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                      {t("packaging")}
                    </span>
                    <StarRating
                      value={packaging}
                      onChange={setPackaging}
                      size={20}
                    />
                  </div>
                </div>
              </div>

              {/* Rider / Delivery Partner Rating Section */}
              {activeRatingOrder.deliveryPartnerId && (
                <div className="rounded-2xl border border-pink-100/55 dark:border-neutral-800 bg-linear-to-b from-[#fafbfc] to-[#f4f6f8] dark:from-neutral-950/60 dark:to-neutral-950/30 p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-2">
                    <span className="rounded-full bg-pink-50 dark:bg-pink-950/30 px-2.5 py-0.5 text-xs font-semibold text-[#b0004a] dark:text-pink-400 uppercase tracking-wider">
                      {t("deliveryReview")}
                    </span>
                  </div>

                  {/* Overall Delivery Rating */}
                  <div className="flex flex-col items-center justify-center py-2 space-y-2">
                    <span className="text-xs font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                      {t("overallRating")}
                    </span>
                    <StarRating
                      value={deliveryRating}
                      onChange={setDeliveryRating}
                      size={32}
                    />
                  </div>

                  {/* Sub-ratings: speed & rider behavior */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-t border-gray-100/80 dark:border-neutral-800 pt-3">
                      <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                        {t("deliverySpeed")}
                      </span>
                      <StarRating
                        value={deliverySpeed}
                        onChange={setDeliverySpeed}
                        size={20}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                        {t("riderBehavior")}
                      </span>
                      <StarRating
                        value={riderBehavior}
                        onChange={setRiderBehavior}
                        size={20}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 px-6 py-4">
              <button
                type="button"
                onClick={() => setActiveRatingOrder(null)}
                disabled={submittingRating}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition disabled:opacity-50"
              >
                {t("cancel")}
              </button>

              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={
                  submittingRating ||
                  (foodRating === 0 &&
                    (activeRatingOrder.deliveryPartnerId
                      ? deliveryRating === 0
                      : true))
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-[#b0004a] dark:bg-pink-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#90003c] transition disabled:opacity-50 disabled:cursor-not-allowed min-w-30"
              >
                {submittingRating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>{t("submitting") || "Submitting..."}</span>
                  </>
                ) : (
                  <span>{t("submitReview")}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
