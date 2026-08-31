/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { isOptimizableImageHost } from "@/lib/imageHosts";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import {
  useBusinessCategoryStore,
  BusinessCategory,
} from "@/stores/businessCategoryStore";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPage: number;
};

// The backend returns the flat envelope ({ meta, data: [...] }), but older
// deployments nested it ({ data: { meta, data: [...] } }). Tolerate both so the
// authenticated path keeps working regardless of which the API returns.
type ApiResponse = {
  success: boolean;
  message: string;
  meta?: Meta;
  data: BusinessCategory[] | { meta?: Meta; data: BusinessCategory[] };
};

export default function ShopSection() {
  const { t, langVersion } = useTranslation();
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedCategory, setSelectedCategory } = useBusinessCategoryStore();
  // const [showFilterModal, setShowFilterModal] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    let alive = true;

    async function fetchBusinessCategories() {
      const token = getAccessToken();

      try {
        let activeCategories: BusinessCategory[] = [];

        if (token) {
          // Authenticated endpoint
          const response = await apiClient.get<ApiResponse>(
            "/categories/businessCategory",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
          const payload = response.data;
          // Flat shape → payload.data is the array; nested shape → payload.data.data.
          const rawList = Array.isArray(payload.data)
            ? payload.data
            : payload.data?.data ?? [];
          activeCategories = rawList.filter(
            (cat) => cat.isActive && !cat.isDeleted,
          );
        } else {
          // Open (unauthenticated) endpoint — response shape: { data: [ ... ] }
          const response = await apiClient.get<{ data: BusinessCategory[]; success: boolean }>(
            "/categories/businessCategory/open",
          );
          activeCategories = (response.data?.data ?? []).filter(
            (cat) => cat.isActive && !cat.isDeleted,
          );
        }

        if (alive) {
          setCategories(activeCategories);

          // Set default selected category to RESTAURANT if none is selected
          if (
            !hasInitialized &&
            !selectedCategory &&
            activeCategories.length > 0
          ) {
            const restaurantCategory = activeCategories.find(
              // Match on the stable, non-localized slug — the name is localized
              // (e.g. "Restaurante" in PT) and would fail this check.
              (cat) => cat.slug?.toLowerCase() === "restaurant",
            );

            if (restaurantCategory) {
              setSelectedCategory(restaurantCategory);
            } else {
              setSelectedCategory(activeCategories[0]);
            }

            setHasInitialized(true);
          }
          setError(null);
        }
      } catch {
        if (alive) {
          setError(t("unableToLoadShopCategories"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchBusinessCategories();

    return () => {
      alive = false;
    };
  }, [selectedCategory, setSelectedCategory, hasInitialized, langVersion]);

  if (loading) {
    return (
      <section>
        <SectionHeading loading skeletonWidth="w-64" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            /* Shaped like the card it stands in for — same padding, same 64px
               icon box, and one title line rather than three, because the card
               only ever renders one. A skeleton that is a different size is a
               layout shift with extra steps. */
            <div
              key={index}
              className={cn(
                cardVariants({ padding: "card" }),
                "flex items-center gap-4",
              )}
            >
              <div className="size-16 shrink-0 animate-pulse rounded-2xl bg-gray-200 dark:bg-neutral-800" />
              <div className="min-w-0 flex-1">
                <div className="h-5 w-36 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error || categories.length === 0) {
    return (
      <section>
        <SectionHeading>{t("shopOnDeligo")}</SectionHeading>
        <div className="flex h-64 items-center justify-center">
          <div className="text-red-500">
            {error || t("noShopCategoriesAvailable")}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Heading to content is 24 at every width (§1.2). The skeleton said
          `mb-5 sm:mb-8` and the live header said a flat `mb-8`, so the whole
          section slid up 12px on mobile when the categories arrived. */}
      {/* Phase 7 #5. The prototype marks every section with a short accent rule
          and an uppercase label beside it. The rule ships; the label does not —
          "Marketplace", "Cuisines", "Delivering now" are new copy, and new copy
          needs a key in both dictionaries and your sign-off.

          Phase 9 moved all three branches of this header into one component, so
          the skeleton and the live heading cannot drift apart. */}
      {/* {selectedCategory?.name === "RESTAURANT" && (
          <button
            onClick={() => setShowFilterModal(true)}
            className="rounded-full border border-[#ffd9de] px-6 py-3 text-[#f9186b]"
          >
            {t("filter")}
          </button>
        )} */}
      <SectionHeading>{t("shopOnDeligo")}</SectionHeading>

      {/* Phase 6 #1. The cards used to appear the instant the fetch resolved,
          straight over the skeleton. Same size, same position — so a fade is
          the whole transition; there is nothing to travel. */}
      <div className="motion-fade grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-6">
        {categories.map((category) => {
          const isActive = selectedCategory?._id === category._id;
          return (
            /* Plan.md Phase 3. This was `p-5 sm:p-7 lg:p-10` around a 160px
               icon with `gap-10` — roughly 240px of card at `lg` to hold one
               word, most of it empty. It is now 24px of padding, a 64px icon
               and a 16px gap.

               And it is a real <button>. It was a `<div onClick>`: not
               focusable, not operable from a keyboard, and invisible to
               assistive tech as a control. `aria-pressed` says which of the
               two is chosen, which the border alone never told anyone. Every
               child is a <span>: a <button> takes phrasing content, so the
               old <div>/<h3> pair could not stay. Nothing is lost — the
               section's own <h2> is the heading here. */
            <button
              key={category._id}
              type="button"
              onClick={() => setSelectedCategory(category)}
              aria-pressed={isActive}
              /* Plan.md Phase 8. This card carried the shell Phase 7 was
                 written to replace — `rounded-4xl`, `border-2
                 border-transparent`, a permanent shadow and a **pink** hover
                 border — thirty lines above the vendor card that replaced it.
                 Phase 7's brief said "the card appears twice" and scoped to
                 the vendor card without checking its neighbour.

                 The shape comes from `cardVariants` now. What stays local is
                 the one thing that is genuinely this card's own: the selected
                 border, which `aria-pressed` also announces. */
              className={cn(
                cardVariants({ variant: "interactive", padding: "card" }),
                "focus-ring motion-press group flex w-full cursor-pointer items-center gap-4 text-left",
                isActive && "border-primary",
              )}
            >
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 shadow-inner transition-transform duration-300 group-hover:scale-105 dark:bg-neutral-800">
                {category.icon ? (
                  <Image
                    alt={category.name}
                    className="h-full w-full object-cover"
                    style={{ height: "100%", width: "100%" }}
                    height={64}
                    width={64}
                    src={category.icon}
                    unoptimized={!isOptimizableImageHost(category.icon)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-400 dark:text-neutral-500">
                    {category.name.charAt(0)}
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold leading-tight text-foreground dark:text-neutral-100">
                  {category.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
