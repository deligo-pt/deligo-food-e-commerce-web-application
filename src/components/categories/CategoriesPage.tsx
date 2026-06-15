"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useProductCategoryStore } from "@/stores/productCategoryStore";
import CategoriesPageSkeleton from "./CategoriesPageSkeleton";
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

// Open endpoint has a flat shape: meta at root, data as array
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

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setSelectedCategory } = useProductCategoryStore();
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    async function fetchCategories() {
      const token = getAccessToken();

      try {
        let activeCategories: Category[] = [];

        if (token) {
          // Authenticated: two-step fetch to get ALL categories
          const initialRes = await apiClient.get<ApiResponse>(
            "/categories/productCategory?page=1&limit=1",
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const total = initialRes.data.data.meta.total;

          const response = await apiClient.get<ApiResponse>(
            `/categories/productCategory?page=1&limit=${total}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          activeCategories = (response.data.data?.data ?? []).filter(
            (category) => category.isActive && !category.isDeleted,
          );
        } else {
          // Open endpoint — meta is at ROOT level, data is a flat array
          // Step 1: get total count
          const countRes = await apiClient.get<OpenApiResponse>(
            "/categories/productCategory/open?page=1&limit=1",
          );
          const total = countRes.data.meta.total;

          // Step 2: fetch all in one request
          const response = await apiClient.get<OpenApiResponse>(
            `/categories/productCategory/open?page=1&limit=${total}`,
          );
          activeCategories = (response.data?.data ?? []).filter(
            (category) => category.isActive && !category.isDeleted,
          );
        }

        if (alive) {
          setCategories(activeCategories);
          setError(null);
        }
      } catch {
        if (alive) {
          setError("Unable to load categories. Please try again.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchCategories();

    return () => {
      alive = false;
    };
  }, []);

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory({
      _id: category._id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
    });
    router.push("/");
  };
  if (loading) {
    return <CategoriesPageSkeleton />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-16">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#b0004a] transition-colors hover:text-[#8d003d]"
          >
            <ChevronLeft size={18} /> {t("backToHome")}
          </Link>
          <h1 className="text-[32px] font-bold leading-10 text-[#191c1d]">
            {t("allCategories")}
          </h1>
          <p className="mt-2 text-[16px] leading-6 text-[#5a4044]">
            {t("browseAllCategories")}
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex h-48 items-center justify-center rounded-3xl bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
          <div className="text-center text-red-500">{error}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {categories.map((category) => (
            <article
              key={category._id}
              onClick={() => handleCategoryClick(category)}
              className="group flex cursor-pointer flex-col items-center gap-4 rounded-3xl bg-white p-5 text-center shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="h-28 w-28 rounded-full bg-[#e7e8e9] p-1 shadow-md transition-all group-hover:bg-[#b0004a]">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#ffffff]">
                  {category.icon ? (
                    <Image
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      height={112}
                      width={112}
                      src={category.icon}
                    />
                  ) : (
                    <Plus size={42} className="text-[#5a4044]" />
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#191c1d] transition-colors group-hover:text-[#b0004a]">
                  {category.name}
                </h2>
                {category.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5a4044]">
                    {category.description}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
