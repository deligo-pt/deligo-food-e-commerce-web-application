"use client";

import { useMemo, useState } from "react";

import VendorCard, { Vendor } from "./VendorCard";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocationStore } from "@/stores/locationStore";
import { useActiveAddressCoords } from "@/hooks/queries/useProfile";
import { useVendorsNearby } from "@/hooks/queries/useVendors";

import { Button } from "@/components/ui/button";
import { useRevealOnScroll } from "@/hooks/useMotion";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";

const ITEMS_PER_PAGE = 10;

function VendorCardSkeleton() {
  return (
    /* Phase 7 #1. This skeleton lives in a different file from the card it
       stands in for, which is exactly the drift Phase 5 went looking for — so
       it moves in the same commit, to the same numbers: `rounded-3xl`, the
       hairline, `gap-3 p-4 sm:p-6`, a 32px pill inset 12, the dot beside the
       title, and one footer row. */
    <article
      className={cn(
        cardVariants(),
        "group flex h-full cursor-pointer flex-col overflow-hidden",
      )}
    >
      <div className="relative aspect-16/10 shrink-0 overflow-hidden">
        <div className="h-full w-full animate-pulse bg-gray-200 dark:bg-neutral-800" />
        <div className="absolute left-3 top-3">
          <div className="h-8 w-16 animate-pulse rounded-full bg-white/95 shadow-lg backdrop-blur-md dark:bg-neutral-900/95" />
        </div>
        <div className="absolute bottom-3 right-3">
          <div className="h-8 w-28 animate-pulse rounded-full bg-black/20 backdrop-blur-md dark:bg-black/40" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        <div className="h-7 w-2/3 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
        <div className="mt-auto flex items-center gap-4 border-t border-border pt-3">
          <div className="h-5 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
          <div className="h-5 w-32 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
        </div>
      </div>
    </article>
  );
}

export default function VendorsGrid() {
  const { t } = useTranslation();
  const [gridRef, revealed] = useRevealOnScroll<HTMLDivElement>();
  const [page, setPage] = useState(1);
  const { coords: geoCoords, permissionStatus } = useLocationStore();

  // Resolve coords from the cached active delivery address, falling back to GPS.
  const activeCoords = useActiveAddressCoords();
  const resolvedCoords = useMemo(
    () =>
      activeCoords ??
      (geoCoords ? { lat: geoCoords.latitude, lng: geoCoords.longitude } : null),
    [activeCoords, geoCoords],
  );

  const {
    data,
    isLoading,
    error: queryError,
  } = useVendorsNearby<Vendor>(resolvedCoords, {
    page,
    limit: ITEMS_PER_PAGE,
    enabled: permissionStatus !== "loading",
  });

  const vendors = data?.data ?? [];
  const totalPages = data?.totalPage ?? 1;
  // Skeleton while permissions resolve or the first coords-backed fetch runs.
  // A language switch keeps the current grid (keepPreviousData), no skeleton.
  const loading =
    permissionStatus === "loading" || (!!resolvedCoords && isLoading);
  const error = queryError
    ? getApiErrorMessage(queryError, "Unable to load vendors. Please try again.")
    : "";

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
          <VendorCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/20 p-6 text-center text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!vendors.length) {
    return (
      <div className={cn(cardVariants(), "p-8 text-center")}>
        <h3 className="text-xl font-semibold text-gray-700 dark:text-neutral-200">
          {t("noVendorsFound")}
        </h3>
      </div>
    );
  }

  return (
    <>
      {/* Phase 6 #2 — the same reveal the homepage grid uses, for the same
          reason: ten cards arriving at once is the one place a stagger reads
          as arrival rather than as lag. It fires once, so paging to the next
          set does not replay it. */}
      <div
        ref={gridRef}
        data-revealed={revealed}
        className="reveal-group grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {vendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            userCoords={resolvedCoords}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-16 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => setPage((prev) => prev - 1)}
            disabled={page === 1}
          >
            {t("previous")}
          </Button>

          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;

            return (
              /* The page number is square, so it takes the icon size rather
                 than a hand-typed `h-11 w-11`, and the selected one is the
                 default variant — which is what `bg-primary` means. */
              <Button
                key={pageNumber}
                size="icon"
                variant={page === pageNumber ? "default" : "outline"}
                onClick={() => setPage(pageNumber)}
                className="rounded-xl font-semibold"
                aria-current={page === pageNumber ? "page" : undefined}
              >
                {pageNumber}
              </Button>
            );
          })}

          <Button
            variant="outline"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page === totalPages}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </>
  );
}
