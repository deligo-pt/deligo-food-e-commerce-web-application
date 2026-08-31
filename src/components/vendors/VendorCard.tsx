/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import SafeImage from "@/components/shared/SafeImage";
import Link from "next/link";
import { Star, Truck, Check, Store, Moon } from "lucide-react";
import { memo, useCallback, useEffect, useState, useRef } from "react";
import { formatCuisine } from "@/lib/cuisine";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";

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

// Memoized: the grid renders many cards, and each runs its own distance-matrix
// estimate — so skip re-rendering a card whose `vendor`/`userCoords` are
// unchanged when the parent re-renders (pagination, coords resolving, etc.).
function VendorCard({ vendor, userCoords }: VendorCardProps) {
  const { t } = useTranslation();
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);

  // Closed stores are shown dimmed with a "Currently Closed" badge but stay
  // openable — matching the app, where a closed store's menu is browsable and
  // only the add-to-cart action is withdrawn. `isStoreOpen` is authoritative;
  // treat only an explicit `false` as closed so cards with the flag absent
  // still behave as open.
  const isClosed = vendor.businessDetails?.isStoreOpen === false;

  // Coords are always resolved by the parent (VendorsGrid) from the shared,
  // cached profile — no per-card /profile fetch.
  const coordsToUse = userCoords ?? null;

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
      setEstimatedTime("Under 10 min");
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
  }, [coordsToUse, fetchTime]);

  const displayTime = loadingTime
    ? "Calculating..."
    : estimatedTime || "Under 10 min";

  const cardBody = (
    /* Plan.md Phase 7 #1 — the same card as the homepage's, class for class.
       It is one design that happens to be rendered by two components; letting
       the copies drift is how "the vendor card" stops meaning anything. */
    <article
      className={cn(
        cardVariants({ variant: "interactive" }),
        "group flex h-full cursor-pointer flex-col overflow-hidden",
      )}
    >
      <div className="relative aspect-16/10 shrink-0 overflow-hidden">
        <SafeImage
          src={vendor.storePhoto?.[0]}
          alt={vendor.businessDetails.businessName}
          sizes="(max-width: 1024px) 100vw, 33vw"
          // Phase 6 #4. A full second at 1.10 — the slowest of the three
          // copies of this construct in the tree, all now 1.04 over 300ms.
          className={`object-cover transition-transform duration-300 ${
            isClosed ? "grayscale" : "group-hover:scale-[1.04]"
          }`}
          fallbackIcon={<Store className="h-12 w-12" />}
        />
        <div className="absolute left-3 top-3">
          <span className="flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-bold text-foreground shadow-lg backdrop-blur-md dark:bg-neutral-900/95 dark:text-white">
            <Star size={14} className="text-warning" />
            {vendor.rating?.average ?? 0}
          </span>
        </div>
        {/* The delivery estimate was a pink row in the footer here and an
            overlay pill on the homepage — the same fact drawn two ways in two
            files. It is the overlay in both now. */}
        {!isClosed && (
          <div className="absolute bottom-3 right-3">
            <span className="flex h-8 items-center gap-2 rounded-full bg-black/70 px-3 text-xs font-bold text-white backdrop-blur-md">
              <Truck size={14} />
              {displayTime}
            </span>
          </div>
        )}
        {isClosed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="flex h-8 items-center gap-2 rounded-full bg-black/70 px-4 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
              <Moon size={14} />
              {t("currentlyClosed")}
            </span>
          </div>
        )}
      </div>

      {/* flex-1 + mt-auto on the footer keeps every card's divider and meta row
          aligned regardless of how long the cuisine list is. */}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        <h3
          className={`line-clamp-1 text-xl font-bold tracking-[-0.015em] ${
            isClosed
              ? "text-[#9aa0a6] dark:text-neutral-500"
              : "text-foreground dark:text-neutral-100"
          }`}
        >
          {vendor.businessDetails.businessName}
        </h3>
        <p
          className={`line-clamp-1 text-xs font-bold uppercase tracking-[0.06em] ${
            isClosed
              ? "text-[#9aa0a6] dark:text-neutral-600"
              : "text-muted-foreground dark:text-neutral-400"
          }`}
        >
          {formatCuisine(vendor.businessDetails.restaurantCuisineType) ||
            vendor.businessDetails.businessType}
        </p>
        {/* 🔴 The city line was `text-primary dark:text-pink-400` — the §1.4
            violation Phase 4 fixed on the homepage card and missed here,
            because §9's guard only ever read the other file. A city is a fact,
            not an action. */}
        {/* Availability is a labelled status, not a dot on its own. Phase 7
            moved it up to the title as a bare dot and dropped the words to
            `sr-only`, which asked a sighted reader to know what a coloured dot
            means. It is back beside the city where it was, with two changes:
            the truck icon is a dot, and it is green rather than the brand pink
            — §1.4 gives pink to action *and* availability, so painting both in
            it distinguished neither. Closed is untouched: the same muted
            #9aa0a6 it has always been. */}
        <div className="mt-auto flex min-w-0 items-center gap-4 border-t border-border pt-3 text-sm font-semibold dark:border-neutral-800">
          <span
            className={`flex shrink-0 items-center gap-2 ${
              isClosed ? "text-[#9aa0a6] dark:text-neutral-500" : "text-success"
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${
                isClosed ? "bg-[#9aa0a6] dark:bg-neutral-600" : "bg-success"
              }`}
            />
            {vendor.businessDetails.isStoreOpen ? t("openNow") : t("closed")}
          </span>
          <span
            className={`flex min-w-0 items-center gap-2 ${
              isClosed
                ? "text-[#9aa0a6] dark:text-neutral-500"
                : "text-muted-foreground dark:text-neutral-400"
            }`}
          >
            <Check size={16} className="shrink-0" />
            <span className="truncate">
              {vendor.businessLocation.city}, {vendor.businessLocation.country}
            </span>
          </span>
        </div>
      </div>
    </article>
  );

  return (
    /* Phase 6 #3 — press feedback on the anchor, which is the control. The
       <article> keeps its own hover transition. */
    <Link
      href={`/vendors/${vendor.userId}`}
      className="motion-press block h-full"
    >
      {cardBody}
    </Link>
  );
}

export default memo(VendorCard);