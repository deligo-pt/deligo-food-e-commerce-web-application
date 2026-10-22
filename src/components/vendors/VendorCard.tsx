"use client";

import SafeImage from "@/components/shared/SafeImage";
import Link from "next/link";
import { Star, Truck, Check, Store, Moon } from "lucide-react";
import { memo } from "react";
import { formatCuisine } from "@/lib/cuisine";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { vendorHref } from "@/lib/vendorId";
import { useVendorCardTitle } from "@/hooks/useVendorCardTitle";
import { cardVariants } from "@/components/ui/card";
import { deliveryEstimateText, type EstimatedDeliveryTime } from "@/lib/deliveryEstimate";

export interface Vendor {
  id: string;
  userId: string;
  role?: string;
  businessDetails: {
    businessName: string;
    branchName?: string;
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
  /** The backend's estimate for the position the list was asked for. */
  estimatedDeliveryTime?: EstimatedDeliveryTime | null;
}

interface VendorCardProps {
  vendor: Vendor;
}

// Memoized: the grid renders many cards, so skip re-rendering a card whose
// `vendor` is unchanged when the parent re-renders (pagination and the like).
function VendorCard({ vendor }: VendorCardProps) {
  const { t } = useTranslation();

  // Closed stores are shown dimmed with a "Currently Closed" badge but stay
  // openable — matching the app, where a closed store's menu is browsable and
  // only the add-to-cart action is withdrawn. `isStoreOpen` is authoritative;
  // treat only an explicit `false` as closed so cards with the flag absent
  // still behave as open.
  const isClosed = vendor.businessDetails?.isStoreOpen === false;
  const cardTitle = useVendorCardTitle(vendor);

  // The backend's estimate, sent with the list (see `lib/deliveryEstimate.ts`).
  // No estimate, no badge: this used to fall back to "Under 10 min".
  const displayTime = deliveryEstimateText(vendor.estimatedDeliveryTime, t);

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
          alt={cardTitle.title}
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
        {!isClosed && displayTime && (
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
        {/* A branch is titled with its own `branchName`, a main store with its
            business name — see `useVendorCardTitle`. The tag covers a branch
            whose name is not known, so two of them never read as one place. */}
        <div className="flex min-w-0 items-center gap-2">
          <h3
            className={`line-clamp-1 text-xl font-bold tracking-[-0.015em] min-w-0 ${
              isClosed
                ? "text-[#9aa0a6] dark:text-neutral-500"
                : "text-foreground dark:text-neutral-100"
            }`}
          >
            {cardTitle.title}
          </h3>
          {cardTitle.branchTag && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-bold text-muted-foreground dark:bg-neutral-800 dark:text-neutral-300">
              {t("branchTag")}
            </span>
          )}
        </div>
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
        <div className="mt-auto flex min-w-0 items-center gap-4 border-t border-border pt-3 text-sm font-semibold">
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
      href={vendorHref(vendor)}
      className="motion-press block h-full"
    >
      {cardBody}
    </Link>
  );
}

export default memo(VendorCard);