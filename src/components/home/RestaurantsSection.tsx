/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Star, Truck, Check } from "lucide-react";

import { apiClient, getApiErrorMessage } from "../../lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useBusinessCategoryStore } from "@/stores/businessCategoryStore";
import { useProductCategoryStore } from "@/stores/productCategoryStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useCuisineFilterStore } from "@/stores/cuisineFilterStore";
import { useLocationStore } from "@/stores/locationStore";
import { X } from "lucide-react";
import type { Vendor } from "@/types/vendor";
import { cuisineMatches, formatCuisine } from "@/lib/cuisine";

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTimeRange(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${Math.floor(totalMinutes)} to ${Math.ceil(totalMinutes + 10)} mins`;
  }
  const hours = totalMinutes / 60;
  if (hours < 24) {
    const low = Math.floor(hours);
    const high = Math.ceil(hours + 10 / 60);
    return low === high
      ? `${low} hour${low !== 1 ? "s" : ""}`
      : `${low} to ${high} hours`;
  }
  const days = totalMinutes / (60 * 24);
  if (days < 7) {
    const low = Math.floor(days);
    const high = Math.ceil(days + 10 / (60 * 24));
    return low === high
      ? `${low} day${low !== 1 ? "s" : ""}`
      : `${low} to ${high} days`;
  }
  const weeks = totalMinutes / (60 * 24 * 7);
  if (weeks < 4) {
    const low = Math.floor(weeks);
    const high = Math.ceil(weeks + 10 / (60 * 24 * 7));
    return low === high
      ? `${low} week${low !== 1 ? "s" : ""}`
      : `${low} to ${high} weeks`;
  }
  const months = totalMinutes / (60 * 24 * 30);
  if (months < 12) {
    const low = Math.floor(months);
    const high = Math.ceil(months + 10 / (60 * 24 * 30));
    return low === high
      ? `${low} month${low !== 1 ? "s" : ""}`
      : `${low} to ${high} months`;
  }
  const years = totalMinutes / (60 * 24 * 365);
  const low = Math.floor(years);
  const high = Math.ceil(years + 10 / (60 * 24 * 365));
  return low === high
    ? `${low} year${low !== 1 ? "s" : ""}`
    : `${low} to ${high} years`;
}

function getVendorCoords(vendor: Vendor): { lat: number; lng: number } | null {
  const { latitude, longitude } = vendor.businessLocation;
  return latitude && longitude ? { lat: latitude, lng: longitude } : null;
}

export default function RestaurantsSection() {
  const { t } = useTranslation();
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>({});
  const [loadingTimes, setLoadingTimes] = useState<Record<string, boolean>>({});
  // Active delivery address coords — fetched fresh every time the component mounts (no caching)
  const [activeAddressCoords, setActiveAddressCoords] = useState<{ lat: number; lng: number } | null>(null);

  const { coords: geoCoords, permissionStatus } = useLocationStore();
  const {
    selectedCategory: selectedBusinessCategory,
    setSelectedCategory: setSelectedBusinessCategory,
  } = useBusinessCategoryStore();
  const {
    selectedCategory: selectedProductCategory,
    setSelectedCategory: setSelectedProductCategory,
  } = useProductCategoryStore();
  const { selectedCuisines, toggleCuisine, clearCuisines } = useCuisineFilterStore();

  useEffect(() => {
    if (permissionStatus === "loading") return;

    const fetchVendors = async () => {
      try {
        setLoading(true);
        setError("");

        const token = getAccessToken();

        // Step 1: always fetch the active delivery address fresh from the API (no cache)
        let activeCoords: { lat: number; lng: number } | null = null;
        if (token) {
          try {
            const { data } = await apiClient.get("/profile");
            const active = data?.data?.deliveryAddresses?.find(
              (a: any) => a.isActive === true,
            );
            if (active?.latitude && active?.longitude) {
              activeCoords = { lat: active.latitude, lng: active.longitude };
            }
          } catch {
            // Profile fetch failed — fall through to GPS / default
          }
        }

        setActiveAddressCoords(activeCoords);

        // Step 2: pick the best coords for vendor lookup
        // Priority: active delivery address > browser GPS
        const coords =
          activeCoords ??
          (geoCoords ? { lat: geoCoords.latitude, lng: geoCoords.longitude } : null);

        if (!coords) {
          setAllVendors([]);
          setLoading(false);
          return;
        }

        const response = await apiClient.get("/vendors/nearby/open", {
          params: { latitude: coords.lat, longitude: coords.lng },
        });
        setAllVendors(response.data?.data || []);
      } catch (err) {
        console.error("Failed to fetch vendors:", err);
        setError(getApiErrorMessage(err, "Unable to load nearby restaurants."));
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, [geoCoords, permissionStatus]);

  // Clear cuisines filter if selected category is not RESTAURANT. Compare on the
  // stable slug — the name is localized ("Restaurante" in PT) and would trip this
  // check in Portuguese, wrongly clearing the cuisine filter.
  useEffect(() => {
    if (
      selectedBusinessCategory &&
      selectedBusinessCategory.slug?.toLowerCase() !== "restaurant"
    ) {
      clearCuisines();
    }
  }, [selectedBusinessCategory, clearCuisines]);

  const filteredVendors = useMemo(() => {
    if (!allVendors.length) return [];

    let filtered = allVendors;

    if (selectedBusinessCategory) {
      filtered = filtered.filter(
        (vendor) =>
          vendor.businessDetails.businessType?.toUpperCase() ===
          selectedBusinessCategory.name?.toUpperCase(),
      );
    }

    if (selectedProductCategory) {
      filtered = filtered.filter((vendor) =>
        vendor.availableCategories?.some(
          (cat) => cat._id === selectedProductCategory._id,
        ),
      );
    }
    if (selectedCuisines.length > 0) {
      filtered = filtered.filter((vendor) =>
        cuisineMatches(
          vendor.businessDetails.restaurantCuisineType,
          selectedCuisines,
        ),
      );
    }

    return filtered;
  }, [
    allVendors,
    selectedBusinessCategory,
    selectedProductCategory,
    selectedCuisines,
  ]);

  const estimateDeliveryTime = useCallback(
    async (vendor: Vendor) => {
      const refCoords =
        activeAddressCoords ??
        (geoCoords ? { lat: geoCoords.latitude, lng: geoCoords.longitude } : null);

      if (!refCoords) {
        setDeliveryTimes((prev) => ({ ...prev, [vendor.userId]: "Under 10 min" }));
        return;
      }
      const vendorCoords = getVendorCoords(vendor);
      if (!vendorCoords) {
        setDeliveryTimes((prev) => ({ ...prev, [vendor.userId]: "Under 10 min" }));
        return;
      }

      setLoadingTimes((prev) => ({ ...prev, [vendor.userId]: true }));
      try {
        const url = `/api/distance-matrix?originLat=${vendorCoords.lat}&originLng=${vendorCoords.lng}&destLat=${refCoords.lat}&destLng=${refCoords.lng}`;
        const res = await fetch(url);
        const data = await res.json();

        if (
          data.status === "OK" &&
          data.rows?.[0]?.elements?.[0]?.status === "OK"
        ) {
          const minutes = Math.round(
            data.rows[0].elements[0].duration.value / 60,
          );
          setDeliveryTimes((prev) => ({
            ...prev,
            [vendor.userId]: formatTimeRange(minutes),
          }));
          return;
        }
        const distance = getDistanceKm(
          vendorCoords.lat,
          vendorCoords.lng,
          refCoords.lat,
          refCoords.lng,
        );
        const estimatedMinutes = Math.round((distance / 30) * 60);
        const timeStr =
          estimatedMinutes < 10
            ? "Under 10 min"
            : formatTimeRange(estimatedMinutes);
        setDeliveryTimes((prev) => ({ ...prev, [vendor.userId]: timeStr }));
      } catch (err) {
        console.error("Time estimation error", err);
        setDeliveryTimes((prev) => ({ ...prev, [vendor.userId]: "Under 10 min" }));
      } finally {
        setLoadingTimes((prev) => ({ ...prev, [vendor.userId]: false }));
      }
    },
    [activeAddressCoords, geoCoords],
  );

  const lastFetchedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (loading || filteredVendors.length === 0) return;

    const currentCoords =
      activeAddressCoords ??
      (geoCoords ? { lat: geoCoords.latitude, lng: geoCoords.longitude } : null);

    if (!currentCoords) {
      filteredVendors.forEach((vendor) => {
        setDeliveryTimes((prev) => ({ ...prev, [vendor.userId]: "Under 10 min" }));
      });
      return;
    }

    const coordsChanged =
      !lastFetchedCoordsRef.current ||
      lastFetchedCoordsRef.current.lat !== currentCoords.lat ||
      lastFetchedCoordsRef.current.lng !== currentCoords.lng;

    const hasUnestimatedVendors = filteredVendors.some(
      (vendor) => !deliveryTimes[vendor.userId]
    );

    if (coordsChanged || hasUnestimatedVendors) {
      lastFetchedCoordsRef.current = currentCoords;
      filteredVendors.forEach((vendor) => {
        const hasTime = deliveryTimes[vendor.userId];
        if (coordsChanged || !hasTime) {
          estimateDeliveryTime(vendor);
        }
      });
    }
  }, [activeAddressCoords, geoCoords, loading, filteredVendors, deliveryTimes, estimateDeliveryTime]);

  if (loading) {
    return (
      <section>
        <div className="mb-10 flex items-center justify-between">
          <div className="h-10 w-40 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
          <div className="hidden h-7 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800 sm:block" />
        </div>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-4xl bg-white dark:bg-neutral-900 shadow-[0_10px_40px_rgba(0,0,0,0.06)]"
            >
              <div className="aspect-16/10 animate-pulse bg-gray-200 dark:bg-neutral-800" />
              <div className="space-y-5 p-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="h-7 w-2/3 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                  <div className="h-6 w-6 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                </div>
                <div className="h-5 w-1/2 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                <div className="flex gap-4 border-t border-[#edeeef] dark:border-neutral-800 pt-6">
                  <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                  <div className="h-5 w-32 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <div className="rounded-3xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/20 p-6 text-red-600 dark:text-red-400">
          {error}
        </div>
      </section>
    );
  }

  if (filteredVendors.length === 0) {
    return (
      <section>
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-[32px] font-bold leading-10 text-[#191c1d] dark:text-neutral-100">
            {t("nearYou")}
          </h2>
          <Link
            href="/vendors"
            className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] dark:text-pink-500 hover:underline"
          >
            {t("viewAll")} <ChevronRight size={20} />
          </Link>
        </div>
        {(selectedBusinessCategory ||
          selectedProductCategory ||
          selectedCuisines.length > 0) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {selectedBusinessCategory && (
                <button
                  onClick={() => setSelectedBusinessCategory(null)}
                  className="flex items-center gap-2 rounded-full bg-[#d81b60] px-4 py-2 text-white"
                >
                  {selectedBusinessCategory.name}
                  <X size={16} />
                </button>
              )}
              {selectedProductCategory && (
                <button
                  onClick={() => setSelectedProductCategory(null)}
                  className="flex items-center gap-2 rounded-full bg-[#d81b60] px-4 py-2 text-white"
                >
                  {selectedProductCategory.name}
                  <X size={16} />
                </button>
              )}
              {selectedCuisines.map((cuisine) => (
                <button
                  key={cuisine}
                  onClick={() => toggleCuisine(cuisine)}
                  className="flex items-center gap-2 rounded-full bg-[#d81b60] px-4 py-2 text-white"
                >
                  {cuisine}
                  <X size={16} />
                </button>
              ))}
            </div>
          )}
        <div className="py-12 text-center text-gray-500 dark:text-neutral-400">
          {selectedProductCategory
            ? `${t("noVendorsFoundFor")} "${selectedProductCategory.name}"`
            : t("noVendorsFoundForCategory")}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d] dark:text-neutral-100">
          {t("nearYou")}
        </h2>
        <Link
          href="/vendors"
          className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] dark:text-pink-500 hover:underline"
        >
          {t("viewAll")} <ChevronRight size={20} />
        </Link>
      </div>
      {(selectedBusinessCategory ||
        selectedProductCategory ||
        selectedCuisines.length > 0) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {selectedBusinessCategory && (
              <button
                onClick={() => setSelectedBusinessCategory(null)}
                className="flex items-center gap-2 rounded-full bg-[#d81b60] px-4 py-2 text-white"
              >
                {selectedBusinessCategory.name}
                <X size={16} />
              </button>
            )}

            {selectedProductCategory && (
              <button
                onClick={() => setSelectedProductCategory(null)}
                className="flex items-center gap-2 rounded-full bg-[#d81b60] px-4 py-2 text-white"
              >
                {selectedProductCategory.name}
                <X size={16} />
              </button>
            )}

            {selectedCuisines.map((cuisine) => (
              <button
                key={cuisine}
                onClick={() => toggleCuisine(cuisine)}
                className="flex items-center gap-2 rounded-full bg-[#d81b60] px-4 py-2 text-white"
              >
                {cuisine}
                <X size={16} />
              </button>
            ))}
          </div>
        )}

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {filteredVendors.map((vendor) => {
          const deliveryTime = deliveryTimes[vendor.userId];
          const isTimeLoading = loadingTimes[vendor.userId];
          const displayTime = isTimeLoading
            ? t("calculating")
            : deliveryTime || t("under10Min");

          return (
            <Link
              key={vendor.userId}
              href={`/vendors/${vendor.userId}`}
              className="block"
            >
              <article className="group overflow-hidden rounded-4xl border-2 border-transparent bg-white dark:bg-neutral-900 shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-300 hover:border-[#ffd9de] dark:hover:border-neutral-800 hover:shadow-2xl">
                <div className="relative aspect-16/10 overflow-hidden">
                  <Image
                    fill
                    sizes="(max-width:1024px) 100vw, 33vw"
                    alt={vendor.businessDetails.businessName}
                    src={
                      vendor.storePhoto?.[0] ||
                      "https://placehold.co/600x400/png"
                    }
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />

                  <div className="absolute left-5 top-5">
                    <span className="flex items-center gap-1.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 px-4 py-2 text-sm font-bold text-[#191c1d] dark:text-white shadow-lg backdrop-blur-md">
                      <Star size={18} className="text-[#f6c344]" />
                      {vendor.rating?.average ?? 0}
                    </span>
                  </div>
                  <div className="absolute bottom-5 right-5">
                    <span className="flex items-center gap-2 rounded-2xl bg-black/70 px-4 py-2 text-sm text-white backdrop-blur-md">
                      <Truck size={18} />
                      {displayTime}
                    </span>
                  </div>
                </div>

                <div className="p-8">
                  <div className="mb-2 flex items-center gap-4">
                    <h3 className="line-clamp-1 text-2xl font-bold text-[#191c1d] dark:text-neutral-100">
                      {vendor.businessDetails.businessName}
                    </h3>
                  </div>

                  <p className="mb-6 text-lg text-[#5a4044] dark:text-neutral-400">
                    {formatCuisine(
                      vendor.businessDetails.restaurantCuisineType,
                    ) || vendor.businessDetails.businessType}
                  </p>

                  <div className="flex items-center gap-6 border-t border-[#edeeef] dark:border-neutral-800 pt-6 text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    <span className="flex items-center gap-2 text-[#b0004a] dark:text-pink-500">
                      <Truck size={18} />
                      {vendor.businessDetails.isStoreOpen
                        ? t("openNow")
                        : t("closed")}
                    </span>
                    <span className="flex items-center gap-2 text-[#b70052] dark:text-pink-400">
                      <Check size={18} />
                      {vendor.businessLocation.city},{" "}
                      {vendor.businessLocation.country}
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
