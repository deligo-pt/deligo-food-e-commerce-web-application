/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import {
  useBusinessCategoryStore,
  BusinessCategory,
} from "@/stores/businessCategoryStore";
import { useTranslation } from "@/hooks/useTranslation";
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
        <div className="mb-5 flex items-center justify-between sm:mb-8">
          <div className="h-10 w-64 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-4xl bg-white dark:bg-neutral-900 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:gap-6 sm:p-7 lg:gap-10 lg:p-10"
            >
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-gray-200 dark:bg-neutral-800 sm:h-28 sm:w-28 sm:rounded-3xl lg:h-40 lg:w-40" />
              <div className="flex-1 space-y-4">
                <div className="h-8 w-36 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                <div className="h-5 w-full animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
                <div className="h-5 w-3/4 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800" />
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
        <div className="mb-5 flex items-center justify-between sm:mb-8">
          <h2 className="text-xl font-bold leading-7 text-[#191c1d] sm:text-3xl sm:leading-10 dark:text-neutral-100">
            {t("shopOnDeligo")}
          </h2>
        </div>
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
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-xl font-bold leading-7 text-[#191c1d] sm:text-3xl sm:leading-10 dark:text-neutral-100">
          {t("shopOnDeligo")}
        </h2>

        {/* {selectedCategory?.name === "RESTAURANT" && (
          <button
            onClick={() => setShowFilterModal(true)}
            className="rounded-full border border-[#ffd9de] px-6 py-3 text-[#f9186b]"
          >
            {t("filter")}
          </button>
        )} */}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-6">
        {categories.map((category) => {
          const isActive = selectedCategory?._id === category._id;
          return (
            <div
              key={category._id}
              onClick={() => setSelectedCategory(category)}
              className={`
                group flex cursor-pointer items-center gap-4 rounded-4xl
                bg-[#ffffff] dark:bg-neutral-900 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]
                transition-all duration-300 hover:shadow-2xl
                sm:gap-6 sm:p-7 lg:gap-10 lg:p-10
                ${
                  isActive
                    ? "border-2 border-[#f9186b] dark:border-pink-500 shadow-lg"
                    : "border-2 border-transparent hover:border-[#ffd9de] dark:hover:border-neutral-800"
                }
              `}
            >
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-neutral-800 shadow-inner transition-transform duration-500 group-hover:scale-105 sm:h-28 sm:w-28 sm:rounded-3xl lg:h-40 lg:w-40">
                {category.icon ? (
                  <Image
                    alt={category.name}
                    className="h-full w-full object-cover"
                    style={{ height: "100%", width: "100%" }}
                    height={160}
                    width={160}
                    src={category.icon}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-gray-400 dark:text-neutral-500">
                    {category.name.charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-black leading-tight text-[#191c1d] dark:text-neutral-100 sm:text-xl">
                  {category.name}
                </h3>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
