/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";

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

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch first 10 categories on mount
  useEffect(() => {
    let alive = true;

    async function fetchInitialCategories() {
      const token = getAccessToken();
      if (!token) {
        if (alive) {
          setError("Authentication token missing. Please log in again.");
          setLoading(false);
        }
        return;
      }

      try {
        const response = await apiClient.get<ApiResponse>(
          "/categories/productCategory?page=1&limit=10",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const payload = response.data;
        const activeCategories = (payload.data?.data ?? []).filter(
          (cat) => cat.isActive && !cat.isDeleted
        );

        if (alive) {
          setCategories(activeCategories);
          setError(null);
        }
      } catch (err) {
        if (alive) setError("Unable to load categories. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchInitialCategories();

    return () => {
      alive = false;
    };
  }, []);

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

  if (error && categories.length === 0) {
    return (
      <section>
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
            What&apos;s on your mind?
          </h2>
        </div>
        <div className="flex h-40 items-center justify-center">
          <div className="text-center text-red-500">{error}</div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
          What&apos;s on your mind?
        </h2>
        <Link
          href="/categories"
          className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] hover:underline"
        >
          View All <ChevronRight size={20} />
        </Link>
      </div>

      <div className="-mx-4 flex gap-12 overflow-x-auto px-4 pb-6 lg:-mx-16 lg:px-16 [scrollbar-none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {displayedCategories.map((category) => (
          <div
            key={category._id}
            className="group flex min-w-35 cursor-pointer flex-col items-center gap-4"
          >
            <div className="h-32 w-32 rounded-full bg-[#e7e8e9] p-1 shadow-md transition-all group-hover:bg-[#b0004a]">
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
            <span className="text-center text-[12px] font-bold leading-4 tracking-[0.16em] uppercase text-[#191c1d] transition-colors group-hover:text-[#b0004a]">
              {category.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
