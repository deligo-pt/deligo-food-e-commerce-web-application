/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Truck, Check } from "lucide-react";
import { useCallback, useEffect, useState, useRef } from "react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useLocationStore } from "@/stores/locationStore";
import { formatCuisine } from "@/lib/cuisine";

export interface Vendor {
  id: string;
  userId: string;
  businessDetails: {
    businessName: string;
    businessType: string;
    restaurantCuisineType?: string[] | string;
    openingHours: string;
    closingHours: string;
    isStoreOpen: boolean;
  };
  businessLocation: {
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  storePhoto: string[];
  rating: { average: number; totalReviews: number };
}

interface VendorCardProps {
  vendor: Vendor;
  userCoords?: { lat: number; lng: number } | null;
}

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
    const high = Math.ceil(hours + 10 / 60); // add 10 min buffer
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

let cachedUserCoords: { lat: number; lng: number } | null = null;
let userPromise: Promise<{ lat: number; lng: number } | null> | null = null;

async function fetchUserPrimaryAddress() {
  if (cachedUserCoords) return cachedUserCoords;
  // Only call profile API if user is authenticated
  const token = getAccessToken();
  if (!token) return null;
  try {
    const { data } = await apiClient.get("/profile");
    const primary = data?.data?.deliveryAddresses?.find(
      (a: any) => a.isActive === true,
    );
    if (primary?.latitude && primary?.longitude) {
      cachedUserCoords = { lat: primary.latitude, lng: primary.longitude };
    }
    return cachedUserCoords;
  } catch (error) {
    console.error("Failed to fetch user address", error);
    return null;
  }
}

function useUserAddress() {
  const { coords: geoCoords, permissionStatus } = useLocationStore();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    cachedUserCoords,
  );
  const [loading, setLoading] = useState(
    !cachedUserCoords && permissionStatus === "loading",
  );

  useEffect(() => {
    if (cachedUserCoords) {
      setCoords(cachedUserCoords);
      setLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      if (permissionStatus !== "loading") {
        if (geoCoords) {
          setCoords({ lat: geoCoords.latitude, lng: geoCoords.longitude });
        } else {
          setCoords(null);
        }
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    if (!userPromise) {
      userPromise = fetchUserPrimaryAddress();
    }
    userPromise
      .then((profileCoords) => {
        if (profileCoords) {
          setCoords(profileCoords);
        } else if (geoCoords) {
          setCoords({ lat: geoCoords.latitude, lng: geoCoords.longitude });
        } else {
          setCoords(null);
        }
      })
      .catch(() => {
        if (geoCoords) {
          setCoords({ lat: geoCoords.latitude, lng: geoCoords.longitude });
        } else {
          setCoords(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [geoCoords, permissionStatus]);

  return { coords, loading };
}

// Skeleton component matching the exact layout of VendorCard
function VendorCardSkeleton() {
  return (
    <article className="group cursor-pointer overflow-hidden rounded-4xl border-2 border-transparent bg-white dark:bg-neutral-900 shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all">
      <div className="relative aspect-16/10 overflow-hidden">
        <div className="h-full w-full animate-pulse bg-gray-200 dark:bg-neutral-800" />
        <div className="absolute left-5 top-5">
          <div className="h-9 w-16 animate-pulse rounded-2xl bg-white/95 dark:bg-neutral-900/95 shadow-lg backdrop-blur-md" />
        </div>
      </div>

      <div className="p-8">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-neutral-800" />
          <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
        </div>
        <div className="mb-6 h-6 w-32 animate-pulse rounded-lg bg-gray-200 dark:bg-neutral-800" />
        <div className="flex items-center gap-6 border-t border-[#edeeef] dark:border-neutral-800 pt-6">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function VendorCard({ vendor, userCoords }: VendorCardProps) {
  const { coords: internalCoords, loading: userLoading } = useUserAddress();
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);

  const hasUserCoords = userCoords !== undefined;
  const coordsToUse = hasUserCoords ? userCoords : internalCoords;
  const isUserLoading = hasUserCoords ? false : userLoading;

  const fetchTime = useCallback(async () => {
    const vendorCoords = getVendorCoords(vendor);
    if (!vendorCoords || !coordsToUse) {
      setEstimatedTime("Under 10 min");
      return;
    }

    setLoadingTime(true);
    try {
      // 1) Try Google Distance Matrix via our proxy
      const url = `/api/distance-matrix?originLat=${vendorCoords.lat}&originLng=${vendorCoords.lng}&destLat=${coordsToUse.lat}&destLng=${coordsToUse.lng}`;
      const res = await fetch(url);
      const data = await res.json();

      if (
        data.status === "OK" &&
        data.rows?.[0]?.elements?.[0]?.status === "OK"
      ) {
        const minutes = Math.round(
          data.rows[0].elements[0].duration.value / 60,
        );
        setEstimatedTime(formatTimeRange(minutes));
        return;
      }

      // 2) Fallback: straight‑line distance + average speed (30 km/h)
      const distance = getDistanceKm(
        vendorCoords.lat,
        vendorCoords.lng,
        coordsToUse.lat,
        coordsToUse.lng,
      );
      const estimatedMinutes = Math.round((distance / 30) * 60);
      setEstimatedTime(
        estimatedMinutes < 10
          ? "Under 10 min"
          : formatTimeRange(estimatedMinutes),
      );
    } catch (err) {
      console.error("Time estimation error", err);
      setEstimatedTime("Under 10 min");
    } finally {
      setLoadingTime(false);
    }
  }, [vendor, coordsToUse]);

  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!coordsToUse) {
      if (!isUserLoading) setEstimatedTime("Under 10 min");
      return;
    }

    const coordsChanged =
      !lastCoordsRef.current ||
      lastCoordsRef.current.lat !== coordsToUse.lat ||
      lastCoordsRef.current.lng !== coordsToUse.lng;

    if (coordsChanged) {
      lastCoordsRef.current = coordsToUse;
      fetchTime();
    }
  }, [coordsToUse, isUserLoading, fetchTime]);

  // Show skeleton while user address is being fetched (initial load)
  if (isUserLoading) {
    return <VendorCardSkeleton />;
  }

  const displayTime = loadingTime
    ? "Calculating..."
    : estimatedTime || "Under 10 min";

  return (
    <Link href={`/vendors/${vendor.userId}`} className="block">
      <article className="group cursor-pointer overflow-hidden rounded-4xl border-2 border-transparent bg-white dark:bg-neutral-900 shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all hover:border-[#ffd9de] dark:hover:border-neutral-800 hover:shadow-2xl">
        <div className="relative aspect-16/10 overflow-hidden">
          <Image
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            alt={vendor.businessDetails.businessName}
            src={vendor.storePhoto?.[0] || "https://placehold.co/600x400/png"}
            className="object-cover transition-transform duration-1000 group-hover:scale-110"
          />
          <div className="absolute left-5 top-5">
            <span className="flex items-center gap-1.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 px-4 py-2 text-[14px] font-bold text-[#191c1d] dark:text-white shadow-lg backdrop-blur-md">
              <Star size={18} className="text-[#f6c344]" />
              {vendor.rating?.average ?? 0}
            </span>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-2 flex items-center gap-4">
            <h3 className="line-clamp-1 text-[24px] font-bold leading-8 text-[#191c1d] dark:text-neutral-100">
              {vendor.businessDetails.businessName}
            </h3>
          </div>
          <p className="mb-6 text-[18px] leading-7 text-[#5a4044] dark:text-neutral-400">
            {formatCuisine(vendor.businessDetails.restaurantCuisineType) ||
              vendor.businessDetails.businessType}
          </p>
          <div className="flex items-center gap-6 border-t border-[#edeeef] dark:border-neutral-800 pt-6 text-[14px] font-medium">
            <span className="flex items-center gap-2 text-[#b0004a] dark:text-pink-500">
              <Truck size={20} />
              {displayTime}
            </span>
            <span className="flex items-center gap-2 text-[#b70052] dark:text-pink-400">
              <Check size={20} />
              {vendor.businessLocation.city}, {vendor.businessLocation.country}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}