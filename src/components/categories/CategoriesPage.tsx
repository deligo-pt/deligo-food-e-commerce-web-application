"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { isOptimizableImageHost } from "@/lib/imageHosts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useProductCategoryStore } from "@/stores/productCategoryStore";
import CategoriesPageSkeleton from "./CategoriesPageSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";

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
  const { t, langVersion } = useTranslation();
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
          setError(t("unableToLoadCategories"));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchCategories();

    return () => {
      alive = false;
    };
  }, [t, langVersion]);

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
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-[#8d003d]"
          >
            <ChevronLeft size={18} /> {t("backToHome")}
          </Link>
          <h1 className="text-2xl lg:text-display font-bold text-foreground">
            {t("allCategories")}
          </h1>
          <p className="mt-2 text-base leading-6 text-muted-foreground">
            {t("browseAllCategories")}
          </p>
        </div>
      </div>

      {error ? (
        <div
          className={cn(
            cardVariants(),
            "flex h-48 items-center justify-center",
          )}
        >
          <div className="text-center text-red-500">{error}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {categories.map((category) => (
            <article
              key={category._id}
              onClick={() => handleCategoryClick(category)}
              /* Plan.md Phase 8. Was `rounded-3xl bg-white` over a permanent
                 `0 10px 40px` shadow with no border at all — a fourth shell,
                 for a tile that is the same thing as the cuisine tile on the
                 homepage. `p-5` went with it; 20 is not on the §1.2 scale. */
              className={cn(
                cardVariants({ variant: "interactive", padding: "card" }),
                "group flex cursor-pointer flex-col items-center gap-4 text-center",
              )}
            >
              <div className="h-28 w-28 rounded-full bg-[#e7e8e9] p-1 shadow-md transition-all group-hover:bg-primary">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#ffffff]">
                  {category.icon ? (
                    <Image
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      height={112}
                      width={112}
                      src={category.icon}
                      unoptimized={!isOptimizableImageHost(category.icon)}
                    />
                  ) : (
                    <Plus size={42} className="text-muted-foreground" />
                  )}
                </div>
              </div>

              <div>
                {/* Phase 9. This was an `<h2>` — a 12px uppercase label marked
                    up as a section heading, one per tile, so the page announced
                    a dozen headings that were really the names of twelve links.
                    It is a `<span>`; the section's own heading is the heading. */}
                <span className="block text-xs font-bold uppercase tracking-[0.06em] text-foreground transition-colors group-hover:text-primary">
                  {category.name}
                </span>
                {category.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
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
