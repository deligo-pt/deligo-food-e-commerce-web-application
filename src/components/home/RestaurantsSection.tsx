"use client";

import { memo, useEffect, useState, useCallback, useMemo, useRef } from "react";
import SafeImage from "@/components/shared/SafeImage";
import Link from "next/link";
import { ChevronRight, Star, Truck, Check, Store, Moon } from "lucide-react";

import { getApiErrorMessage } from "../../lib/apiClient";
import { useBusinessCategoryStore } from "@/stores/businessCategoryStore";
import { useProductCategoryStore } from "@/stores/productCategoryStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useCuisineFilterStore } from "@/stores/cuisineFilterStore";
import { useLocationStore } from "@/stores/locationStore";
import { useActiveAddressCoords } from "@/hooks/queries/useProfile";
import { useVendorsNearby } from "@/hooks/queries/useVendors";
import { X } from "lucide-react";
import type { Vendor } from "@/types/vendor";
import { cuisineMatches, formatCuisine } from "@/lib/cuisine";
import { Button } from "@/components/ui/button";
import { useRevealOnScroll } from "@/hooks/useMotion";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

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

// Memoized card — delivery-time estimates resolve one vendor at a time, so
// without this every resolution would re-render the whole grid. Now only the
// card whose `deliveryTime`/`isTimeLoading` changed re-renders.
const RestaurantCard = memo(function RestaurantCard({
  vendor,
  deliveryTime,
  isTimeLoading,
}: {
  vendor: Vendor;
  deliveryTime?: string;
  isTimeLoading?: boolean;
}) {
  const { t } = useTranslation();
  const displayTime = isTimeLoading
    ? t("calculating")
    : deliveryTime || t("under10Min");

  // Closed stores are shown dimmed with a "Currently Closed" badge but stay
  // openable — the menu is browsable, only ordering is withdrawn. Only an
  // explicit `false` counts as closed.
  const isClosed = vendor.businessDetails?.isStoreOpen === false;

  const cardBody = (
    /* Plan.md Phase 7 #1. Three things changed and each was doing the wrong
       job. The radius was 26 (`rounded-4xl`), which reads as a panel rather
       than a product. The border was `border-2 border-transparent` turning
       pink on hover — pink means action and availability (§1.4), and a hover
       is neither, so it was saying "selected" about a card that is not. And
       the shadow was permanent, so weight that should arrive on interaction
       was already spent. Now: a hairline that is always there, and the lift
       and the shadow on hover only. */
    <article
      className={cn(
        cardVariants({ variant: "interactive" }),
        "group flex h-full cursor-pointer flex-col overflow-hidden",
      )}
    >
      <div className="relative aspect-16/10 overflow-hidden">
        <SafeImage
          src={vendor.storePhoto?.[0]}
          alt={vendor.businessDetails.businessName}
          sizes="(max-width:1024px) 100vw, 33vw"
          // Phase 6 #4. This was 1.10 over 700ms: a tenth of the image's width
          // travelling for the better part of a second, so the picture was
          // still growing well after the pointer had moved on. 1.04 over 300ms
          // finishes under the cursor.
          className={`object-cover transition-transform duration-300 ${
            isClosed ? "grayscale" : "group-hover:scale-[1.04]"
          }`}
          fallbackIcon={<Store className="h-12 w-12" />}
        />

        {/* Both overlay pills were `rounded-2xl px-4 py-2 text-sm` with an
            18px icon — roughly 36px tall, sitting 20px in from the corner, on
            an image that is 200px tall on a phone. They are a fixed 32 now,
            12px inset, and fully round. */}
        <div className="absolute left-3 top-3">
          <span className="flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-bold text-foreground shadow-lg backdrop-blur-md dark:bg-neutral-900/95 dark:text-white">
            <Star size={14} className="text-warning" />
            {vendor.rating?.average ?? 0}
          </span>
        </div>
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

      {/* `p-5 sm:p-8` was 20 and 32; neither is on the §1.2 scale. And the
          three children carried `mb-2`, `mb-4 sm:mb-6` and `pt-4 sm:pt-6`
          between them — three margins doing what one `gap` does, each free to
          drift from the others. */}
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

        {/* 14px sentence case sat two steps under a 20px title with nothing
            but size between them. 12 uppercase at 700 separates them by kind
            — and it is already how the cuisine circles label themselves, so
            the page agrees with itself rather than inventing a third voice. */}
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
    /* Phase 6 #3. The whole card is the tap target and it gave nothing back —
       on a phone, the only feedback was the page changing a moment later. The
       press sits on the <Link> rather than the <article> because the anchor is
       the control; the article keeps its own hover transition, untouched. */
    <Link
      href={`/vendors/${vendor.userId}`}
      className="motion-press block h-full"
    >
      {cardBody}
    </Link>
  );
});

export default function RestaurantsSection() {
  const { t } = useTranslation();
  // Phase 6 #2. `revealed` is rendered as the container's own attribute rather
  // than written to the DOM by the hook, so the re-render that lands each
  // delivery-time estimate cannot reset it to hidden.
  const [gridRef, revealed] = useRevealOnScroll<HTMLDivElement>();
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>({});
  const [loadingTimes, setLoadingTimes] = useState<Record<string, boolean>>({});

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

  // Active delivery-address coords from the shared cache, GPS as fallback.
  const activeAddressCoords = useActiveAddressCoords();
  const resolvedCoords = useMemo(
    () =>
      activeAddressCoords ??
      (geoCoords ? { lat: geoCoords.latitude, lng: geoCoords.longitude } : null),
    [activeAddressCoords, geoCoords],
  );

  const {
    data: nearbyData,
    isLoading,
    error: queryError,
  } = useVendorsNearby<Vendor>(resolvedCoords, {
    enabled: permissionStatus !== "loading",
  });

  const allVendors = useMemo(() => nearbyData?.data ?? [], [nearbyData]);
  // Skeleton only while permissions resolve or the first coords-backed fetch
  // runs; a language switch keeps the current list (keepPreviousData).
  const loading =
    permissionStatus === "loading" || (!!resolvedCoords && isLoading);
  const error = queryError
    ? getApiErrorMessage(queryError, "Unable to load nearby restaurants.")
    : "";

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
        <SectionHeading
          loading
          skeletonWidth="w-40"
          /* The "View all" link is `text-sm` now, not 20px, so its stand-in
             shrinks with it. */
          action={
            <div className="hidden h-5 w-24 animate-pulse rounded-full bg-gray-200 sm:block dark:bg-neutral-800" />
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            /* Shaped like the card it stands in for, down to the class names:
               same radius, same hairline, same `gap-3 p-4 sm:p-6`, the dot
               beside the title line, and a single footer row now that the
               open/closed state has moved up. Phase 5 #2 — a skeleton that is
               a different shape is a layout shift with extra steps, and the
               Phase 6 crossfade would run right over it. */
            <div
              key={index}
              className={cn(cardVariants(), "overflow-hidden")}
            >
              <div className="aspect-16/10 animate-pulse bg-gray-200 dark:bg-neutral-800" />
              <div className="flex flex-col gap-3 p-4 sm:p-6">
                <div className="h-7 w-2/3 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                <div className="flex items-center gap-4 border-t border-border pt-3 dark:border-neutral-800">
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
        <SectionHeading
          action={
            <Link
              href="/vendors"
              className="flex items-center gap-2 text-sm font-bold text-primary hover:underline dark:text-pink-500"
            >
              {t("viewAll")} <ChevronRight size={20} />
            </Link>
          }
        >
          {t("nearYou")}
        </SectionHeading>
        {(selectedBusinessCategory ||
          selectedProductCategory ||
          selectedCuisines.length > 0) && (
            <div className="mb-6 flex flex-wrap gap-2">
              {selectedBusinessCategory && (
                <Button
                  size="sm"
                  onClick={() => setSelectedBusinessCategory(null)}
                  className="gap-2 rounded-full"
                >
                  {selectedBusinessCategory.name}
                  <X size={16} />
                </Button>
              )}
              {selectedProductCategory && (
                <Button
                  size="sm"
                  onClick={() => setSelectedProductCategory(null)}
                  className="gap-2 rounded-full"
                >
                  {selectedProductCategory.name}
                  <X size={16} />
                </Button>
              )}
              {selectedCuisines.map((cuisine) => (
                <Button
                  key={cuisine}
                  size="sm"
                  onClick={() => toggleCuisine(cuisine)}
                  className="gap-2 rounded-full"
                >
                  {cuisine}
                  <X size={16} />
                </Button>
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
      {/* Phase 5 #2 again. `mb-6 sm:mb-10` in the skeleton against a flat
          `mb-10` here: the heading jumped 16px on mobile the moment the vendors
          arrived. Phase 9 retired that whole class of bug in this file — all
          three branches are one component now. */}
      <SectionHeading
        action={
          <Link
            href="/vendors"
            className="flex items-center gap-2 text-sm font-bold text-primary hover:underline dark:text-pink-500"
          >
            {t("viewAll")} <ChevronRight size={20} />
          </Link>
        }
      >
        {t("nearYou")}
      </SectionHeading>
      {(selectedBusinessCategory ||
        selectedProductCategory ||
        selectedCuisines.length > 0) && (
          <div className="mb-6 flex flex-wrap gap-2">
            {selectedBusinessCategory && (
              <Button
                size="sm"
                onClick={() => setSelectedBusinessCategory(null)}
                className="gap-2 rounded-full"
              >
                {selectedBusinessCategory.name}
                <X size={16} />
              </Button>
            )}

            {selectedProductCategory && (
              <Button
                size="sm"
                onClick={() => setSelectedProductCategory(null)}
                className="gap-2 rounded-full"
              >
                {selectedProductCategory.name}
                <X size={16} />
              </Button>
            )}

            {selectedCuisines.map((cuisine) => (
              <Button
                key={cuisine}
                size="sm"
                onClick={() => toggleCuisine(cuisine)}
                className="gap-2 rounded-full"
              >
                {cuisine}
                <X size={16} />
              </Button>
            ))}
          </div>
        )}

      {/* Plan.md Phase 5 #2. The skeleton above was `gap-6 lg:gap-10` and this
          was a flat `gap-10`, so every card jumped 16px sideways the moment the
          data landed — on mobile and tablet, which is most of the traffic. Both
          are now the §1.2 grid gap, written identically.

          Phase 6 #2: this grid reveals rather than fades. A reveal is a fade
          with an 8px rise and a 50ms stagger, so it does the crossfade's job as
          well — the two are never stacked on one element. It earns the stagger
          because it is the one place on this page with six cards in a row; the
          two-card shop grid above would just look hesitant. */}
      <div
        ref={gridRef}
        data-revealed={revealed}
        className="reveal-group grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {filteredVendors.map((vendor) => (
          <RestaurantCard
            key={vendor.userId}
            vendor={vendor}
            deliveryTime={deliveryTimes[vendor.userId]}
            isTimeLoading={loadingTimes[vendor.userId]}
          />
        ))}
      </div>
    </section>
  );
}
