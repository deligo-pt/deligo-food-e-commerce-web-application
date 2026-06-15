/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useProductCategoryStore } from "@/stores/productCategoryStore";
import { useTranslation } from "@/hooks/useTranslation";
type Category = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  businessCategoryId: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  success: boolean;
  message: string;
  data: {
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPage: number;
    };
    data: Category[];
  };
};

// Open endpoint: meta at root level, data is a flat array
type OpenApiResponse = {
  success: boolean;
  message: string;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: Category[];
};

export default function CategoriesSection() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const { selectedCategory, setSelectedCategory } = useProductCategoryStore();

  useEffect(() => {
    let alive = true;

    async function fetchInitialCategories() {
      const token = getAccessToken();

      try {
        let activeCategories: Category[] = [];

        if (token) {
          // Authenticated: two-step fetch to get ALL categories
          const initialRes = await apiClient.get<ApiResponse>(
            "/categories/productCategory?page=1&limit=1",
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const total = initialRes.data.data.meta.total;

          const response = await apiClient.get<ApiResponse>(
            `/categories/productCategory?page=1&limit=${total}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          activeCategories = (response.data.data?.data ?? []).filter(
            (cat) => cat.isActive && !cat.isDeleted
          );
        } else {
          // Open endpoint — meta is at ROOT level, data is a flat array
          // Step 1: get total count
          const countRes = await apiClient.get<OpenApiResponse>(
            "/categories/productCategory/open?page=1&limit=1"
          );
          const total = countRes.data.meta.total;

          // Step 2: fetch all in one request
          const response = await apiClient.get<OpenApiResponse>(
            `/categories/productCategory/open?page=1&limit=${total}`
          );
          activeCategories = (response.data?.data ?? []).filter(
            (cat) => cat.isActive && !cat.isDeleted
          );
        }

        if (alive) {
          setCategories(activeCategories);
          setErrorKey(null);
        }
      } catch (err) {
        if (alive) setErrorKey("unableToLoadCategories");
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchInitialCategories();

    return () => {
      alive = false;
    };
  }, []);


  const handleCategoryClick = (category: Category) => {
    if (selectedCategory?._id === category._id) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory({
        _id: category._id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
      });
    }
  };

  const displayedCategories = categories.slice(0, 10);

  if (loading && categories.length === 0) {
    return (
      <section>
        <div className="mb-10 flex items-center justify-between">
          <div className="h-10 w-72 animate-pulse rounded-full bg-gray-200" />
          <div className="hidden h-7 w-24 animate-pulse rounded-full bg-gray-200 sm:block" />
        </div>
        <div className="-mx-4 flex gap-12 overflow-hidden px-4 pb-6 lg:-mx-16 lg:px-16">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex min-w-35 flex-col items-center gap-4">
              <div className="h-32 w-32 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (errorKey && categories.length === 0) {
    return (
      <section>
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
            {t("whatsOnYourMind")}
          </h2>
        </div>
        <div className="flex h-40 items-center justify-center">
          <div className="text-center text-red-500">{t(errorKey)}</div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
          {t("whatsOnYourMind")}
        </h2>
        <Link
          href="/categories"
          className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] hover:underline"
        >
          {t("viewAll")} <ChevronRight size={20} />
        </Link>
      </div>

      <div className="-mx-4 flex gap-12 overflow-x-auto px-4 pb-6 lg:-mx-16 lg:px-16 [scrollbar-none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {displayedCategories.map((category) => {
          const isActive = selectedCategory?._id === category._id;
          return (
            <div
              key={category._id}
              onClick={() => handleCategoryClick(category)}
              className="group flex min-w-35 cursor-pointer flex-col items-center gap-4"
            >
              <div
                className={`h-32 w-32 rounded-full p-1 shadow-md transition-all ${
                  isActive
                    ? "bg-[#b0004a] ring-4 ring-[#ffd9de]"
                    : "bg-[#e7e8e9] group-hover:bg-[#b0004a]"
                }`}
              >
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#ffffff]">
                  {category.icon ? (
                    <Image
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      height={128}
                      width={128}
                      src={category.icon}
                    />
                  ) : (
                    <Plus size={48} className="text-[#5a4044]" />
                  )}
                </div>
              </div>
              <span
                className={`text-center text-[12px] font-bold leading-4 tracking-[0.16em] uppercase transition-colors ${
                  isActive
                    ? "text-[#b0004a]"
                    : "text-[#191c1d] group-hover:text-[#b0004a]"
                }`}
              >
                {category.name}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}