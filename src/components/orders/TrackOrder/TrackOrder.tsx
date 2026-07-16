/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Bike,
  Check,
  CheckCheck,
  CheckCircle,
  CheckSquare,
  Download,
  Headphones,
  Loader2,
  MapPin,
  Navigation,
  Receipt,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { downloadInvoice, extractBlobErrorMessage } from "@/lib/invoice";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { addTax } from "@/lib/tax";
import OrderMap from "./OrderMap/OrderMap";


// Timeline steps based on orderStatus
function getOrderStep(orderStatus: string, t: (key: string) => string) {
  const isCancelled = orderStatus === "CANCELLED" || orderStatus === "REJECTED";

  const steps = [
    {
      key: "PENDING",
      label: t("orderPending"),
      description: t("waitingRestaurantResponse"),
      icon: Check,
    },
    {
      key: "ACCEPTED",
      label: t("orderAccepted"),
      description: t("restaurantAcceptedOrder"),
      icon: CheckCircle,
    },
    {
      key: "PREPARING",
      label: t("preparing"),
      description: t("restaurantPreparingMeal"),
      icon: Utensils,
    },
    {
      key: "READY_FOR_PICKUP",
      label: t("readyForPickup"),
      description: t("orderReadyForPickup"),
      icon: CheckSquare,
    },
    {
      key: "PICKED_UP",
      label: t("pickedUp"),
      description: t("riderPickedUpOrder"),
      icon: Bike,
    },
    {
      key: "ON_THE_WAY",
      label: t("onTheWay"),
      description: t("riderHeadingLocation"),
      icon: Navigation,
    },
  ];

  if (isCancelled) {
    steps.push({
      key: orderStatus,
      label: orderStatus === "CANCELLED" ? (t("cancelled") || "Cancelled") : (t("rejected") || "Rejected"),
      description: orderStatus === "CANCELLED" ? "Order was cancelled" : "Order was rejected by restaurant",
      icon: CheckCircle,
    });
  } else {
    steps.push({
      key: "DELIVERED",
      label: t("delivered"),
      description: t("orderDelivered"),
      icon: CheckCheck,
    });
  }

  return steps;
}

export default function TrackOrder() {
  const { t, langVersion } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxStatusIndex, setMaxStatusIndex] = useState(0);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleDownloadInvoice = async () => {
    if (downloadingInvoice || !order?.orderId) return;
    setDownloadingInvoice(true);
    try {
      await downloadInvoice(order.orderId);
      toast.success(t("invoiceDownloaded"));
    } catch (error) {
      toast.error(await extractBlobErrorMessage(error, t("invoiceDownloadFailed")));
    } finally {
      setDownloadingInvoice(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async (isInitial = false) => {
      try {
        const res = await apiClient.get(`/orders/${orderId}`);
        const orderData = res.data.data;
        setOrder(orderData);

        if (orderData) {
          const activeStatus = orderData.orderStatus === "ASSIGNED" ? "ACCEPTED" : orderData.orderStatus;
          const STEP_KEYS = ["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "ON_THE_WAY"];
          let idx = STEP_KEYS.indexOf(activeStatus);
          if (idx === -1) {
            if (activeStatus === "DELIVERED" || activeStatus === "CANCELLED" || activeStatus === "REJECTED") {
              idx = 6;
            } else {
              idx = 0;
            }
          }
          if (isInitial) {
            setMaxStatusIndex(idx);
          } else {
            setMaxStatusIndex((prevMax) => Math.max(prevMax, idx));
          }
        }

        // Stop polling once the order reaches a final state
        const finalStatuses = ["DELIVERED", "CANCELLED", "REJECTED"];
        if (orderData && finalStatuses.includes(orderData.orderStatus)) {
          stopped = true;
          stopPolling();
        }
      } catch (err: any) {
        if (isInitial) {
          setError(err.response?.data?.message || "Failed to load order");
        }
      } finally {
        if (isInitial) {
          setLoading(false);
        }
      }
    };

    // Phase 2: poll every 5s for live updates, but ONLY while the tab is
    // visible (a backgrounded tracking tab makes zero requests), and stop
    // entirely once the order reaches a terminal state.
    let stopped = false;

    const startPolling = () => {
      if (stopped || intervalRef.current) return;
      intervalRef.current = setInterval(() => fetchOrder(false), 5000);
    };
    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !stopped) {
        fetchOrder(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Initial fetch to load page content immediately
    fetchOrder(true);
    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // langVersion: re-fetch the order in the new language (keeps the current
    // order on screen since loading only toggles on the initial load).
  }, [orderId, langVersion]);

  // Animation observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-10");
          }
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll(".bento-card").forEach((card) => {
      card.classList.add(
        "transition-all",
        "duration-700",
        "opacity-0",
        "translate-y-10",
      );
      observer.observe(card);
    });
    return () => observer.disconnect();
  }, [order]);

  if (loading) {
    return (
      <main className="bg-[#f8f9fa] dark:bg-neutral-950 text-[#191c1d] dark:text-neutral-100 min-h-screen font-sans overflow-x-hidden transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24">
          <div className="animate-pulse space-y-6">
            <div className="h-100 bg-gray-200 dark:bg-neutral-800 rounded-4xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-gray-200 dark:bg-neutral-800 rounded-3xl" />
              <div className="h-32 bg-gray-200 dark:bg-neutral-800 rounded-3xl" />
            </div>
            <div className="h-64 bg-gray-200 dark:bg-neutral-800 rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="bg-[#f8f9fa] dark:bg-neutral-950 text-[#191c1d] dark:text-neutral-100 min-h-screen font-sans overflow-x-hidden transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24 text-center">
          <p className="text-red-500 dark:text-red-400">{error || "Order not found"}</p>
        </div>
      </main>
    );
  }

  // Format vendor name
  const vendorName =
    `${order.vendorId?.name?.firstName || ""} ${order.vendorId?.name?.lastName || ""}`.trim();

  // Delivery address
  const deliveryAddress = order.deliveryAddress;
  const addressString = [
    deliveryAddress?.street,
    deliveryAddress?.city,
    deliveryAddress?.state,
    deliveryAddress?.country,
    deliveryAddress?.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  // Restaurant address – dynamic based on pickupAddress or order status
  const pickupAddress = order.pickupAddress;
  const restaurantAddress = pickupAddress
    ? [
      pickupAddress.street,
      pickupAddress.city,
      pickupAddress.state,
      pickupAddress.country,
      pickupAddress.postalCode,
    ]
      .filter(Boolean)
      .join(", ")
    : order.orderStatus === "PENDING"
      ? t("restaurantAddressPending")
      : t("restaurantAddressComingSoon");

  // Order items and calculations
  const items = order.items || [];
  const totalItems = items.reduce(
    (sum: number, item: any) => sum + (item.itemSummary?.quantity || 0),
    0,
  );
  const payout = order.payoutSummary || {};
  const calc = order.orderCalculation || {};
  const grandTotal = payout.grandTotal || 0;
  // What the customer paid for the items — NOT payoutSummary.vendor.earnings*,
  // which is the restaurant's net take after commission and would neither
  // reconcile with the total nor be any of the customer's business.
  const subtotal = (calc.totalOriginalPrice || 0) - (calc.totalProductDiscount || 0);
  // `serviceCharge` arrives net; the total charges it with VAT.
  const serviceCharge = addTax(calc.serviceCharge || 0);
  const offerDiscount = calc.totalOfferDiscount || 0;
  const deliveryFee = order.delivery?.totalDeliveryCharge || 0;
  const tax = calc.totalTaxAmount || 0;

  const steps = getOrderStep(order.orderStatus, t);

  return (
    <main className="bg-[#f8f9fa] dark:bg-neutral-950 text-[#191c1d] dark:text-neutral-100 min-h-screen font-sans overflow-x-hidden transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <OrderMap
              orderStatus={order.orderStatus}
              pickupLatitude={order.pickupAddress?.latitude}
              pickupLongitude={order.pickupAddress?.longitude}
              pickupAddress={restaurantAddress}
              deliveryLatitude={deliveryAddress?.latitude}
              deliveryLongitude={deliveryAddress?.longitude}
              deliveryAddress={addressString}
              riderLatitude={order.deliveryPartnerId?.currentSessionLocation?.coordinates?.[1]}
              riderLongitude={order.deliveryPartnerId?.currentSessionLocation?.coordinates?.[0]}
              riderName={order.deliveryPartnerId ? `${order.deliveryPartnerId.name?.firstName || ""} ${order.deliveryPartnerId.name?.lastName || ""}` : ""}
              etaMinutes={order.delivery?.estimatedTime}
            />

            {/* Rider Details Card (Dynamic Live view) */}
            {order.deliveryPartnerId && (
              <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-md p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-transparent dark:border-neutral-800 border-l-4 dark:border-l-4 border-[#008080] animate-fadeIn transition-all duration-500 hover:shadow-lg">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-[#008080] bg-gray-100 dark:bg-neutral-950 shrink-0">
                    {order.deliveryPartnerId.profilePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.deliveryPartnerId.profilePhoto}
                        alt="Rider"
                        className="w-full h-full object-cover animate-scaleIn"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#e0f2f1] dark:bg-teal-950/20 text-[#008080]">
                        <Bike className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#5a4044] dark:text-neutral-400 tracking-wide uppercase">
                      {t("yourRider") || "Your Rider"}
                    </p>
                    <h3 className="text-xl font-extrabold text-[#191c1d] dark:text-neutral-50">
                      {`${order.deliveryPartnerId.name?.firstName || ""} ${order.deliveryPartnerId.name?.lastName || ""}`.trim()}
                    </h3>
                    <p className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      {order.orderStatus === "DELIVERED"
                        ? t("orderHasBeenDelivered")
                        : order.orderStatus === "ON_THE_WAY" || order.orderStatus === "PICKED_UP"
                        ? t("riderIsHeadingToYourLocation")
                        : t("riderAssigned")}
                    </p>
                  </div>
                </div>
                {order.deliveryPartnerId.contactNumber && (
                  <a
                    href={`tel:${order.deliveryPartnerId.contactNumber}`}
                    className="w-full md:w-auto text-center bg-[#008080] hover:bg-[#006666] dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-extrabold px-6 py-3.5 rounded-full transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 hover:shadow-lg"
                  >
                    <Navigation className="w-4 h-4 rotate-45" />
                    {t("callRider") || "Call Rider"} ({order.deliveryPartnerId.contactNumber})
                  </a>
                )}
              </div>
            )}

            {/* Restaurant & Delivery Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-md p-6 flex gap-4 border border-transparent dark:border-neutral-800">
                <div className="h-12 w-12 rounded-full bg-[#ffd9de] dark:bg-pink-950/30 flex items-center justify-center shrink-0">
                  <Utensils className="w-6 h-6 text-[#f9186b] dark:text-pink-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#5a4044] dark:text-neutral-400 tracking-wide">
                    {t("restaurant")}
                  </p>
                  <h3 className="text-xl font-bold text-[#191c1d] dark:text-neutral-50">
                    {vendorName || t("restaurant")}
                  </h3>
                  <p className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400 leading-relaxed">
                    {restaurantAddress}
                  </p>
                </div>
              </div>
              <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-md p-6 flex gap-4 border border-transparent dark:border-neutral-800 border-l-4 dark:border-l-4 border-l-[#f9186b] dark:border-l-[#f9186b]">
                <div className="h-12 w-12 rounded-full bg-[#ffd9df] dark:bg-pink-950/30 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-[#f9186b] dark:text-pink-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#5a4044] dark:text-neutral-400">
                    {t("deliveryTo")}
                  </p>
                  <h3 className="text-xl font-bold text-[#191c1d] dark:text-neutral-50">
                    {deliveryAddress?.city || t("location")}
                  </h3>
                  <p className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400">
                    {addressString || t("addressNotProvided")}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items & Bill Summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-5 bg-white dark:bg-neutral-900 rounded-3xl border border-transparent dark:border-neutral-800 shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#ffd9de] dark:bg-pink-950/30 rounded-xl">
                    <ShoppingBag className="w-5 h-5 text-[#f9186b] dark:text-pink-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400">
                    {t("items")} ({totalItems})
                  </h4>
                </div>
                <div className="space-y-2">
                  {items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#f9186b] dark:text-pink-400 font-bold">
                          {item.itemSummary?.quantity}x
                        </span>
                        <span className="text-[#191c1d] dark:text-neutral-300 font-semibold">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[#191c1d] dark:text-neutral-250 font-bold">
                        €{item.itemSummary?.grandTotal?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-7 bg-white dark:bg-neutral-900 rounded-3xl border border-transparent dark:border-neutral-800 shadow-md p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#ffd9df] dark:bg-pink-950/30 rounded-xl">
                    <Receipt className="w-5 h-5 text-[#f9186b] dark:text-pink-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400 uppercase tracking-wider">
                    {t("billSummary")}
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[#5a4044] dark:text-neutral-400">
                    <span>{t("subtotal")}</span>
                    <span>€{subtotal.toFixed(2)}</span>
                  </div>
                  {serviceCharge > 0 && (
                    <div className="flex justify-between text-[#5a4044] dark:text-neutral-400">
                      <span>{t("serviceCharge")}</span>
                      <span>€{serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#5a4044] dark:text-neutral-400">
                    <span>{t("deliveryFee")}</span>
                    <span>€{deliveryFee.toFixed(2)}</span>
                  </div>
                  {offerDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>{t("offerDiscount")}</span>
                      <span>-€{offerDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#5a4044] dark:text-neutral-400">
                    <span>{t("taxIncl")}</span>
                    <span>€{tax.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 mt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                    <span className="text-2xl font-extrabold text-[#191c1d] dark:text-neutral-50">
                      {t("totalAmount")}
                    </span>
                    <span className="text-2xl font-extrabold text-[#f9186b] dark:text-pink-400">
                      €{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mt-6 bg-[#edeeef] dark:bg-neutral-950 p-4 rounded-2xl flex items-center justify-between transition-colors duration-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#5a4044] dark:text-neutral-400">
                      {t("paymentMethod")}
                    </span>
                    <span className="text-[#191c1d] dark:text-neutral-300 font-extrabold">
                      {order.paymentMethod || t("notAvailable")}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full border border-green-200 dark:border-green-900/30">
                    {order.paymentStatus || t("paid")}
                  </span>
                </div>
                <button
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-3 font-bold text-[#191c1d] dark:text-neutral-100 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingInvoice ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{t("downloadInvoice")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <aside className="lg:col-span-5 bg-white dark:bg-neutral-900 rounded-3xl border border-transparent dark:border-neutral-800 shadow-md p-6 h-full min-h-175 transition-colors duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-[#191c1d] dark:text-neutral-50">
                  {t("orderStatus")}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-[#5a4044] dark:text-neutral-400 text-xs font-semibold">
                  <span className="font-bold">{order.orderId}</span>
                  <span>•</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <Link href="/help-center">
                <button className="bg-[#f9186b] dark:bg-pink-600 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-95">
                  <Headphones className="w-4 h-4" />
                  <span className="font-bold">{t("support")}</span>
                </button>
              </Link>
            </div>

            <div className="relative space-y-0 px-2">
              {steps.map((step: any, idx: number) => {
                const isCompleted = idx < maxStatusIndex;
                const isCurrent = idx === maxStatusIndex;
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className="relative flex gap-6 pb-10 last:pb-0"
                  >
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute left-5 top-10 bottom-0 w-0.5 ${isCompleted ? "bg-[#f9186b] dark:bg-pink-600" : "bg-[#e3bdc3] dark:bg-neutral-800"
                          } ${isCurrent && idx !== steps.length - 1 ? "border-l-2 border-dashed border-[#e3bdc3] dark:border-neutral-800" : ""}`}
                      />
                    )}
                    <div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${isCompleted || isCurrent
                        ? "bg-[#f9186b] dark:bg-pink-600 text-white"
                        : "bg-[#f3f4f5] dark:bg-neutral-950 text-[#8e6f74] dark:text-neutral-500 border border-[#e3bdc3] dark:border-neutral-800"
                        } ${isCurrent ? "border-4 border-[#ffd9de] dark:border-pink-950/40" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4
                        className={`text-xl font-bold ${isCompleted || isCurrent
                          ? "text-[#191c1d] dark:text-neutral-50"
                          : "text-[#8e6f74] dark:text-neutral-500"
                          } ${isCurrent ? "text-[#f9186b] dark:text-pink-400" : ""}`}
                      >
                        {step.label}
                      </h4>
                      <p
                        className={`text-base ${isCompleted || isCurrent ? "text-[#5a4044] dark:text-neutral-400" : "text-[#e3bdc3] dark:text-neutral-600"}`}
                      >
                        {step.description}
                      </p>
                      {isCurrent && step.key !== "DELIVERED" && step.key !== "CANCELLED" && step.key !== "REJECTED" && (
                        <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-[#ffd9de] dark:bg-pink-950/40 text-[#f9186b] dark:text-pink-400 rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 bg-[#f9186b] dark:bg-pink-500 rounded-full animate-pulse" />
                          {t("inProgress")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
