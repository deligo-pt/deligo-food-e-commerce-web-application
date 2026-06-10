/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Bike,
  Check,
  CheckCheck,
  CheckCircle,
  CheckSquare,
  Clock,
  Headphones,
  MapPin,
  Navigation,
  Receipt,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import Link from "next/link";

// Google Maps component
function OrderMap({
  latitude,
  longitude,
  address,
}: {
  latitude?: number;
  longitude?: number;
  address: string;
}) {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setMapLoaded(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !window.google) return;

    const mapDiv = document.getElementById("track-order-map");
    if (!mapDiv || mapDiv.hasChildNodes()) return;

    const center = { lat: latitude || 23.8103, lng: longitude || 90.4125 };
    const map = new window.google.maps.Map(mapDiv, {
      center,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    new window.google.maps.Marker({
      position: center,
      map,
      title: address,
      draggable: false,
    });
  }, [mapLoaded, latitude, longitude, address]);

  return (
    <div className="relative h-100 md:h-125 w-full rounded-4xl overflow-hidden shadow-xl group bg-gray-100">
      <div id="track-order-map" className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-pulse text-gray-400">Loading map...</div>
        </div>
      )}
      <div className="absolute top-6 left-6 flex flex-col gap-3">
        <div className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg text-[#b0004a] flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// Timeline steps based on orderStatus
function getOrderStep(orderStatus: string) {
  const steps = [
    {
      key: "PENDING",
      label: "Order Pending",
      description: "Waiting for restaurant response",
      icon: Check,
    },
    {
      key: "ACCEPTED",
      label: "Order Accepted",
      description: "Restaurant accepted your order",
      icon: CheckCircle,
    },
    {
      key: "PREPARING",
      label: "Preparing",
      description: "Restaurant is preparing your meal",
      icon: Utensils,
    },
    {
      key: "READY_FOR_PICKUP",
      label: "Ready for Pickup",
      description: "Your order is ready for pickup",
      icon: CheckSquare,
    },
    {
      key: "PICKED_UP",
      label: "Picked Up",
      description: "Rider has picked up your order",
      icon: Bike,
    },
    {
      key: "ON_THE_WAY",
      label: "On the way",
      description: "Rider is heading to your location",
      icon: Navigation,
    },
    {
      key: "DELIVERED",
      label: "Delivered",
      description: "Order has been delivered",
      icon: CheckCheck,
    },
  ];
  const currentIndex = steps.findIndex((step) => step.key === orderStatus);
  return { steps, currentIndex: currentIndex === -1 ? 0 : currentIndex };
}

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const fetchOrder = async () => {
      try {
        const res = await apiClient.get(`/orders/${orderId}`);
        setOrder(res.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

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
      <main className="bg-[#f8f9fa] text-[#191c1d] min-h-screen font-sans overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24">
          <div className="animate-pulse space-y-6">
            <div className="h-100 bg-gray-200 rounded-4xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-gray-200 rounded-3xl" />
              <div className="h-32 bg-gray-200 rounded-3xl" />
            </div>
            <div className="h-64 bg-gray-200 rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="bg-[#f8f9fa] text-[#191c1d] min-h-screen font-sans overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24 text-center">
          <p className="text-red-500">{error || "Order not found"}</p>
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
      ? "Restaurant address will appear after order confirmation"
      : "Address coming soon";

  // Order items and calculations
  const items = order.items || [];
  const totalItems = items.reduce(
    (sum: number, item: any) => sum + (item.itemSummary?.quantity || 0),
    0,
  );
  const payout = order.payoutSummary || {};
  const grandTotal = payout.grandTotal || 0;
  const subtotal = payout.vendor?.earningsWithoutTax || 0;
  const deliveryFee = order.delivery?.totalDeliveryCharge || 0;
  const tax = order.orderCalculation?.totalTaxAmount || 0;

  const { steps, currentIndex } = getOrderStep(order.orderStatus);

  return (
    <main className="bg-[#f8f9fa] text-[#191c1d] min-h-screen font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <OrderMap
              latitude={deliveryAddress?.latitude}
              longitude={deliveryAddress?.longitude}
              address={addressString}
            />

            {/* Restaurant & Delivery Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl shadow-md p-6 flex gap-4">
                <div className="h-12 w-12 rounded-full bg-[#ffd9de] flex items-center justify-center shrink-0">
                  <Utensils className="w-6 h-6 text-[#b0004a]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#5a4044] tracking-wide">
                    Restaurant
                  </p>
                  <h3 className="text-xl font-bold text-[#191c1d]">
                    {vendorName || "Restaurant"}
                  </h3>
                  <p className="text-sm font-semibold text-[#5a4044] leading-relaxed">
                    {restaurantAddress}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-3xl shadow-md p-6 flex gap-4 border-l-4 border-[#b70052]">
                <div className="h-12 w-12 rounded-full bg-[#ffd9df] flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-[#b70052]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#5a4044]">
                    Delivery to
                  </p>
                  <h3 className="text-xl font-bold text-[#191c1d]">
                    {deliveryAddress?.city || "Location"}
                  </h3>
                  <p className="text-sm font-semibold text-[#5a4044]">
                    {addressString || "Address not provided"}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items & Bill Summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-5 bg-white rounded-3xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#ffd9de] rounded-xl">
                    <ShoppingBag className="w-5 h-5 text-[#b0004a]" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#5a4044]">
                    items ({totalItems})
                  </h4>
                </div>
                <div className="space-y-2">
                  {items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#b0004a] font-bold">
                          {item.itemSummary?.quantity}x
                        </span>
                        <span className="text-[#191c1d] font-semibold">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[#191c1d] font-bold">
                        €{item.itemSummary?.grandTotal?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-7 bg-white rounded-3xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#ffd9df] rounded-xl">
                    <Receipt className="w-5 h-5 text-[#b70052]" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#5a4044] uppercase tracking-wider">
                    Bill Summary
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[#5a4044]">
                    <span>Subtotal</span>
                    <span>€{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#5a4044]">
                    <span>Delivery fee</span>
                    <span>€{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#5a4044]">
                    <span>Tax</span>
                    <span>€{tax.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 mt-2 border-t border-[#e3bdc3] flex justify-between items-center">
                    <span className="text-2xl font-extrabold text-[#191c1d]">
                      Total Amount
                    </span>
                    <span className="text-2xl font-extrabold text-[#b70052]">
                      €{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mt-6 bg-[#edeeef] p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#5a4044]">
                      Payment method
                    </span>
                    <span className="text-[#191c1d] font-extrabold">
                      {order.paymentMethod || "N/A"}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full border border-green-200">
                    {order.paymentStatus || "PAID"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <aside className="lg:col-span-5 bg-white rounded-3xl shadow-md p-6 h-full min-h-175">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-[#191c1d]">
                  Order Status
                </h2>
                <div className="flex items-center gap-2 mt-1 text-[#5a4044] text-xs font-semibold">
                  <span className="font-bold">{order.orderId}</span>
                  <span>•</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <Link href="/help-center">
                <button className="bg-[#b0004a] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-95">
                  <Headphones className="w-4 h-4" />
                  <span className="font-bold">Support</span>
                </button>
              </Link>
            </div>

            <div className="relative space-y-0 px-2">
              {steps.map((step, idx) => {
                const isCompleted = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className="relative flex gap-6 pb-10 last:pb-0"
                  >
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute left-5 top-10 bottom-0 w-0.5 ${
                          isCompleted ? "bg-[#b0004a]" : "bg-[#e3bdc3]"
                        } ${isCurrent && idx !== steps.length - 1 ? "border-l-2 border-dashed border-[#e3bdc3]" : ""}`}
                      />
                    )}
                    <div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                        isCompleted || isCurrent
                          ? "bg-[#b0004a] text-white"
                          : "bg-[#f3f4f5] text-[#8e6f74] border border-[#e3bdc3]"
                      } ${isCurrent ? "border-4 border-[#ffd9de]" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4
                        className={`text-xl font-bold ${
                          isCompleted || isCurrent
                            ? "text-[#191c1d]"
                            : "text-[#8e6f74]"
                        } ${isCurrent ? "text-[#b0004a]" : ""}`}
                      >
                        {step.label}
                      </h4>
                      <p
                        className={`text-base ${isCompleted || isCurrent ? "text-[#5a4044]" : "text-[#e3bdc3]"}`}
                      >
                        {step.description}
                      </p>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-[#ffd9de] text-[#b0004a] rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 bg-[#b0004a] rounded-full animate-pulse" />
                          inProgress
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
