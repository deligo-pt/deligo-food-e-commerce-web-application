/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Bike,
  Check,
  CheckCheck,
  CheckCircle,
  CheckSquare,
  Headphones,
  MapPin,
  Navigation,
  Receipt,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";


// Google Maps component
function OrderMap({
  pickupLatitude,
  pickupLongitude,
  pickupAddress,
  deliveryLatitude,
  deliveryLongitude,
  deliveryAddress,
  riderLatitude,
  riderLongitude,
  riderName,
}: {
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryAddress: string;
  riderLatitude?: number;
  riderLongitude?: number;
  riderName?: string;
}) {
  const { t } = useTranslation();
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasFitBoundsRef = useRef(false);

  const mapRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const deliveryMarkerRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const fallbackPolylineRef = useRef<any>(null);

  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setMapLoaded(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !window.google) return;

    const mapDiv = document.getElementById("track-order-map");
    if (!mapDiv || mapRef.current) return;

    const center = {
      lat: deliveryLatitude || pickupLatitude || 23.7282,
      lng: deliveryLongitude || pickupLongitude || 89.1432,
    };

    const map = new window.google.maps.Map(mapDiv, {
      center,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "transit",
          elementType: "labels.icon",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    mapRef.current = map;
  }, [mapLoaded, deliveryLatitude, pickupLatitude, deliveryLongitude, pickupLongitude]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google) return;

    const map = mapRef.current;

    // --- 1. Customer Marker ---
    if (deliveryLatitude && deliveryLongitude) {
      const deliveryPos = { lat: deliveryLatitude, lng: deliveryLongitude };

      if (!deliveryMarkerRef.current) {
        const customerIcon = {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
                <circle cx="20" cy="22" r="16" fill="rgba(0,0,0,0.15)" filter="blur(2px)" />
                <circle cx="20" cy="20" r="15" fill="#ffffff" stroke="#008080" stroke-width="2" />
                <circle cx="20" cy="20" r="12" fill="#008080" />
                <path d="M20,11 C17.8,11 16,12.8 16,15 C16,18.2 20,23 20,23 C20,23 24,18.2 24,15 C24,12.8 22.2,11 20,11 Z M20,16.5 C19.2,16.5 18.5,15.8 18.5,15 C18.5,14.2 19.2,13.5 20,13.5 C20.8,13.5 21.5,14.2 21.5,15 C21.5,15.8 20.8,16.5 20,16.5 Z" fill="#ffffff" />
              </svg>
            `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20),
        };

        deliveryMarkerRef.current = new window.google.maps.Marker({
          position: deliveryPos,
          map,
          title: deliveryAddress || t("deliveryTo"),
          icon: customerIcon,
          zIndex: 100,
        });
      } else {
        deliveryMarkerRef.current.setPosition(deliveryPos);
      }
    }

    // --- 2. Restaurant Marker ---
    if (pickupLatitude && pickupLongitude) {
      const pickupPos = { lat: pickupLatitude, lng: pickupLongitude };

      if (!pickupMarkerRef.current) {
        const storeIcon = {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
                <circle cx="20" cy="22" r="16" fill="rgba(0,0,0,0.15)" filter="blur(2px)" />
                <circle cx="20" cy="20" r="15" fill="#ffffff" stroke="#b0004a" stroke-width="2" />
                <circle cx="20" cy="20" r="12" fill="#b0004a" />
                <path d="M14,14 L26,14 L26,18 L14,18 Z M13,11 L27,11 L27,14 L13,14 Z M15,18 L15,25 C15,25.6 15.4,26 16,26 L24,26 C24.6,26 25,25.6 25,25 L25,18 Z" fill="#ffffff" />
              </svg>
            `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20),
        };

        pickupMarkerRef.current = new window.google.maps.Marker({
          position: pickupPos,
          map,
          title: pickupAddress || t("restaurant"),
          icon: storeIcon,
          zIndex: 90,
        });
      } else {
        pickupMarkerRef.current.setPosition(pickupPos);
      }
    }

    // --- 3. Directions Path ---
    if (pickupLatitude && pickupLongitude && deliveryLatitude && deliveryLongitude) {
      const origin = { lat: pickupLatitude, lng: pickupLongitude };
      const destination = { lat: deliveryLatitude, lng: deliveryLongitude };

      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#b70052",
            strokeOpacity: 0.8,
            strokeWeight: 5,
          },
        });

        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
          {
            origin,
            destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === window.google.maps.DirectionsStatus.OK && result) {
              directionsRendererRef.current?.setDirections(result);
              if (fallbackPolylineRef.current) {
                fallbackPolylineRef.current.setMap(null);
                fallbackPolylineRef.current = null;
              }
            } else {
              console.warn("Directions request failed, drawing fallback line:", status);
              if (!fallbackPolylineRef.current) {
                fallbackPolylineRef.current = new window.google.maps.Polyline({
                  path: [origin, destination],
                  map,
                  geodesic: true,
                  strokeColor: "#b70052",
                  strokeOpacity: 0,
                  icons: [
                    {
                      icon: {
                        path: "M 0,-1 0,1",
                        strokeOpacity: 0.8,
                        strokeColor: "#b70052",
                        scale: 3,
                      },
                      offset: "0",
                      repeat: "20px",
                    },
                  ],
                });
              } else {
                fallbackPolylineRef.current.setPath([origin, destination]);
              }
            }
          }
        );
      }
    }

    // --- 4. Rider Marker and Smooth Animation ---
    const hasRider = typeof riderLatitude === "number" && typeof riderLongitude === "number";
    if (hasRider) {
      const newRiderPos = { lat: riderLatitude!, lng: riderLongitude! };

      const getRiderIcon = () => {
        return {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
                <!-- Drop shadow -->
                <circle cx="22" cy="24" r="17" fill="rgba(0,0,0,0.16)" filter="blur(2.5px)" />
                <!-- Outer white circle -->
                <circle cx="22" cy="22" r="17" fill="#ffffff" stroke="#ffd9de" stroke-width="1.5" />
                <!-- Inner pink/crimson circle -->
                <circle cx="22" cy="22" r="14" fill="#b0004a" />
                
                <!-- Stylized delivery motorcycle rider (side view) -->
                <g transform="translate(10, 11) scale(0.9)" fill="#ffffff">
                  <circle cx="14" cy="4" r="2.5" />
                  <rect x="2" y="8" width="6" height="6" rx="1" />
                  <path d="M13,6.5 L15,6.5 C16.1,6.5 17,7.4 17,8.5 L17,11.5 L14,11.5 L12,9 L10,9 L9,8 L11.5,6.5 Z" />
                  <path d="M14,11.5 L16,15 L11,15 L10.5,12 Z" />
                  <rect x="19" y="8" width="1" height="8" rx="0.5" transform="rotate(15 19 8)" />
                  <circle cx="17.5" cy="8.5" r="1" />
                  <path d="M6,13.5 L19,13.5 L20,16.5 L10,16.5 Z" />
                  <circle cx="7" cy="18" r="3" />
                  <circle cx="19" cy="18" r="3" />
                  <circle cx="7" cy="18" r="1" fill="#b0004a" />
                  <circle cx="19" cy="18" r="1" fill="#b0004a" />
                </g>
              </svg>
            `),
          scaledSize: new window.google.maps.Size(44, 44),
          anchor: new window.google.maps.Point(22, 22),
        };
      };

      if (!riderMarkerRef.current) {
        riderMarkerRef.current = new window.google.maps.Marker({
          position: newRiderPos,
          map,
          title: riderName || t("rider"),
          icon: getRiderIcon(),
          zIndex: 110,
        });
      } else {
        const riderMarker = riderMarkerRef.current;
        const startPos = riderMarker.getPosition();

        if (startPos) {
          const startLat = startPos.lat();
          const startLng = startPos.lng();
          const endLat = newRiderPos.lat;
          const endLng = newRiderPos.lng;

          if (Math.abs(startLat - endLat) > 0.00001 || Math.abs(startLng - endLng) > 0.00001) {
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }

            const duration = 1500;
            const startTime = performance.now();

            const step = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);

              const easeProgress =
                progress < 0.5
                  ? 2 * progress * progress
                  : 1 - Math.pow(-2 * progress + 2, 2) / 2;

              const currentLat = startLat + (endLat - startLat) * easeProgress;
              const currentLng = startLng + (endLng - startLng) * easeProgress;

              const currentPos = new window.google.maps.LatLng(currentLat, currentLng);
              riderMarker.setPosition(currentPos);
              riderMarker.setIcon(getRiderIcon());

              if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(step);
              } else {
                animationFrameRef.current = null;
              }
            };
            animationFrameRef.current = requestAnimationFrame(step);
          }
        }
      }
    } else {
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setMap(null);
        riderMarkerRef.current = null;
      }
    }

    // --- 5. Fit Bounds ---
    const fitBounds = () => {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;

      if (pickupLatitude && pickupLongitude) {
        bounds.extend({ lat: pickupLatitude, lng: pickupLongitude });
        hasPoints = true;
      }
      if (deliveryLatitude && deliveryLongitude) {
        bounds.extend({ lat: deliveryLatitude, lng: deliveryLongitude });
        hasPoints = true;
      }
      if (typeof riderLatitude === "number" && typeof riderLongitude === "number") {
        bounds.extend({ lat: riderLatitude, lng: riderLongitude });
        hasPoints = true;
      }

      if (hasPoints) {
        map.fitBounds(bounds, {
          top: 60,
          right: 60,
          bottom: 60,
          left: 60,
        });

        const listener = window.google.maps.event.addListener(map, "bounds_changed", () => {
          if (map.getZoom()! > 16) {
            map.setZoom(16);
          }
          window.google.maps.event.removeListener(listener);
        });
      }
    };

    if (!hasFitBoundsRef.current && (pickupLatitude || deliveryLatitude)) {
      fitBounds();
      hasFitBoundsRef.current = true;
    }
  }, [
    mapLoaded,
    pickupLatitude,
    pickupLongitude,
    pickupAddress,
    deliveryLatitude,
    deliveryLongitude,
    deliveryAddress,
    riderLatitude,
    riderLongitude,
    riderName,
    t,
  ]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="relative h-100 md:h-125 w-full rounded-4xl overflow-hidden shadow-xl group bg-gray-100">
      <div id="track-order-map" className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-pulse text-gray-400">{t("loadingMap")}</div>
        </div>
      )}
    </div>
  );
}

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
  const { t } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxStatusIndex, setMaxStatusIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
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

    // Initial fetch to load page content immediately
    fetchOrder(true);

    // Dynamic real-time updates every 5 seconds
    intervalRef.current = setInterval(() => {
      fetchOrder(false);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
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
  const grandTotal = payout.grandTotal || 0;
  const subtotal = payout.vendor?.earningsWithoutTax || 0;
  const deliveryFee = order.delivery?.totalDeliveryCharge || 0;
  const tax = order.orderCalculation?.totalTaxAmount || 0;

  const steps = getOrderStep(order.orderStatus, t);

  return (
    <main className="bg-[#f8f9fa] dark:bg-neutral-950 text-[#191c1d] dark:text-neutral-100 min-h-screen font-sans overflow-x-hidden transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <OrderMap
              pickupLatitude={order.pickupAddress?.latitude}
              pickupLongitude={order.pickupAddress?.longitude}
              pickupAddress={restaurantAddress}
              deliveryLatitude={deliveryAddress?.latitude}
              deliveryLongitude={deliveryAddress?.longitude}
              deliveryAddress={addressString}
              riderLatitude={order.deliveryPartnerId?.currentSessionLocation?.coordinates?.[1]}
              riderLongitude={order.deliveryPartnerId?.currentSessionLocation?.coordinates?.[0]}
              riderName={order.deliveryPartnerId ? `${order.deliveryPartnerId.name?.firstName || ""} ${order.deliveryPartnerId.name?.lastName || ""}` : ""}
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
                  <Utensils className="w-6 h-6 text-[#b0004a] dark:text-pink-400" />
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
              <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-md p-6 flex gap-4 border border-transparent dark:border-neutral-800 border-l-4 dark:border-l-4 border-l-[#b70052] dark:border-l-[#b70052]">
                <div className="h-12 w-12 rounded-full bg-[#ffd9df] dark:bg-pink-950/30 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-[#b70052] dark:text-pink-400" />
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
                    <ShoppingBag className="w-5 h-5 text-[#b0004a] dark:text-pink-400" />
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
                        <span className="text-[#b0004a] dark:text-pink-400 font-bold">
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
                    <Receipt className="w-5 h-5 text-[#b70052] dark:text-pink-400" />
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
                  <div className="flex justify-between text-[#5a4044] dark:text-neutral-400">
                    <span>{t("deliveryFee")}</span>
                    <span>€{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#5a4044] dark:text-neutral-400">
                    <span>{t("tax")}</span>
                    <span>€{tax.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 mt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                    <span className="text-2xl font-extrabold text-[#191c1d] dark:text-neutral-50">
                      {t("totalAmount")}
                    </span>
                    <span className="text-2xl font-extrabold text-[#b70052] dark:text-pink-400">
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
                <button className="bg-[#b0004a] dark:bg-pink-600 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-95">
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
                        className={`absolute left-5 top-10 bottom-0 w-0.5 ${isCompleted ? "bg-[#b0004a] dark:bg-pink-600" : "bg-[#e3bdc3] dark:bg-neutral-800"
                          } ${isCurrent && idx !== steps.length - 1 ? "border-l-2 border-dashed border-[#e3bdc3] dark:border-neutral-800" : ""}`}
                      />
                    )}
                    <div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${isCompleted || isCurrent
                        ? "bg-[#b0004a] dark:bg-pink-600 text-white"
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
                          } ${isCurrent ? "text-[#b0004a] dark:text-pink-400" : ""}`}
                      >
                        {step.label}
                      </h4>
                      <p
                        className={`text-base ${isCompleted || isCurrent ? "text-[#5a4044] dark:text-neutral-400" : "text-[#e3bdc3] dark:text-neutral-600"}`}
                      >
                        {step.description}
                      </p>
                      {isCurrent && step.key !== "DELIVERED" && step.key !== "CANCELLED" && step.key !== "REJECTED" && (
                        <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-[#ffd9de] dark:bg-pink-950/40 text-[#b0004a] dark:text-pink-400 rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 bg-[#b0004a] dark:bg-pink-500 rounded-full animate-pulse" />
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
