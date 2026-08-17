// /* eslint-disable @typescript-eslint/no-unused-vars */
// "use client";

// import { useEffect, useState } from "react";
// import Image from "next/image";
// import Link from "next/link";
// import { ChevronRight, Plus } from "lucide-react";
// import { apiClient } from "@/lib/apiClient";
// import { getAccessToken } from "@/lib/authCookies";
// import { useProductCategoryStore } from "@/stores/productCategoryStore";
// import { useTranslation } from "@/hooks/useTranslation";
// type Category = {
//   _id: string;
//   name: string;
//   slug: string;
//   description?: string;
//   icon: string;
//   businessCategoryId: string;
//   isActive: boolean;
//   isDeleted: boolean;
//   createdAt: string;
//   updatedAt: string;
// };

// type ApiResponse = {
//   success: boolean;
//   message: string;
//   data: {
//     meta: {
//       page: number;
//       limit: number;
//       total: number;
//       totalPage: number;
//     };
//     data: Category[];
//   };
// };

// // Open endpoint: meta at root level, data is a flat array
// type OpenApiResponse = {
//   success: boolean;
//   message: string;
//   meta: {
//     page: number;
//     limit: number;
//     total: number;
//     totalPage: number;
//   };
//   data: Category[];
// };

// export default function CategoriesSection() {
//   const { t } = useTranslation();
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [errorKey, setErrorKey] = useState<string | null>(null);
//   const { selectedCategory, setSelectedCategory } = useProductCategoryStore();

//   useEffect(() => {
//     let alive = true;

//     async function fetchInitialCategories() {
//       const token = getAccessToken();

//       try {
//         let activeCategories: Category[] = [];

//         if (token) {
//           // Authenticated: two-step fetch to get ALL categories
//           const initialRes = await apiClient.get<ApiResponse>(
//             "/categories/productCategory?page=1&limit=1",
//             { headers: { Authorization: `Bearer ${token}` } }
//           );
//           const total = initialRes.data.data.meta.total;

//           const response = await apiClient.get<ApiResponse>(
//             `/categories/productCategory?page=1&limit=${total}`,
//             { headers: { Authorization: `Bearer ${token}` } }
//           );
//           activeCategories = (response.data.data?.data ?? []).filter(
//             (cat) => cat.isActive && !cat.isDeleted
//           );
//         } else {
//           // Open endpoint — meta is at ROOT level, data is a flat array
//           // Step 1: get total count
//           const countRes = await apiClient.get<OpenApiResponse>(
//             "/categories/productCategory/open?page=1&limit=1"
//           );
//           const total = countRes.data.meta.total;

//           // Step 2: fetch all in one request
//           const response = await apiClient.get<OpenApiResponse>(
//             `/categories/productCategory/open?page=1&limit=${total}`
//           );
//           activeCategories = (response.data?.data ?? []).filter(
//             (cat) => cat.isActive && !cat.isDeleted
//           );
//         }

//         if (alive) {
//           setCategories(activeCategories);
//           setErrorKey(null);
//         }
//       } catch (err) {
//         if (alive) setErrorKey("unableToLoadCategories");
//       } finally {
//         if (alive) setLoading(false);
//       }
//     }

//     fetchInitialCategories();

//     return () => {
//       alive = false;
//     };
//   }, []);

//   const handleCategoryClick = (category: Category) => {
//     if (selectedCategory?._id === category._id) {
//       setSelectedCategory(null);
//     } else {
//       setSelectedCategory({
//         _id: category._id,
//         name: category.name,
//         slug: category.slug,
//         icon: category.icon,
//       });
//     }
//   };

//   const displayedCategories = categories.slice(0, 10);

//   if (loading && categories.length === 0) {
//     return (
//       <section>
//         <div className="mb-5 flex items-center justify-between sm:mb-10">
//           <div className="h-10 w-72 animate-pulse rounded-full bg-gray-200" />
//           <div className="hidden h-7 w-24 animate-pulse rounded-full bg-gray-200 sm:block" />
//         </div>
//         <div className="-mx-4 flex gap-12 overflow-hidden px-4 pb-6 lg:-mx-16 lg:px-16">
//           {Array.from({ length: 8 }).map((_, index) => (
//             <div key={index} className="flex min-w-35 flex-col items-center gap-4">
//               <div className="h-32 w-32 animate-pulse rounded-full bg-gray-200" />
//               <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200" />
//             </div>
//           ))}
//         </div>
//       </section>
//     );
//   }

//   if (errorKey && categories.length === 0) {
//     return (
//       <section>
//         <div className="mb-5 flex items-center justify-between sm:mb-10">
//           <h2 className="text-3xl font-bold text-[#191c1d]">
//             {t("whatsOnYourMind")}
//           </h2>
//         </div>
//         <div className="flex h-40 items-center justify-center">
//           <div className="text-center text-red-500">{t(errorKey)}</div>
//         </div>
//       </section>
//     );
//   }

//   return (
//     <section>
//       <div className="mb-10 flex items-center justify-between">
//         <h2 className="text-3xl font-bold text-[#191c1d]">
//           {t("whatsOnYourMind")}
//         </h2>
//         <Link
//           href="/categories"
//           className="flex items-center gap-2 text-xl font-bold leading-7 text-[#f9186b] hover:underline"
//         >
//           {t("viewAll")} <ChevronRight size={20} />
//         </Link>
//       </div>

//       <div className="-mx-4 flex gap-12 overflow-x-auto px-4 pb-6 lg:-mx-16 lg:px-16 [scrollbar-none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
//         {displayedCategories.map((category) => {
//           const isActive = selectedCategory?._id === category._id;
//           return (
//             <div
//               key={category._id}
//               onClick={() => handleCategoryClick(category)}
//               className="group flex min-w-35 cursor-pointer flex-col items-center gap-4"
//             >
//               <div
//                 className={`h-32 w-32 rounded-full p-1 shadow-md transition-all ${
//                   isActive
//                     ? "bg-[#f9186b] ring-4 ring-[#ffd9de]"
//                     : "bg-[#e7e8e9] group-hover:bg-[#f9186b]"
//                 }`}
//               >
//                 <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#ffffff]">
//                   {category.icon ? (
//                     <Image
//                       alt={category.name}
//                       className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
//                       height={128}
//                       width={128}
//                       src={category.icon}
//                     />
//                   ) : (
//                     <Plus size={48} className="text-[#5a4044]" />
//                   )}
//                 </div>
//               </div>
//               <span
//                 className={`text-center text-xs font-bold leading-4 tracking-[0.16em] uppercase transition-colors ${
//                   isActive
//                     ? "text-[#f9186b]"
//                     : "text-[#191c1d] group-hover:text-[#f9186b]"
//                 }`}
//               >
//                 {category.name}
//               </span>
//             </div>
//           );
//         })}
//       </div>
//     </section>
//   );
// }

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { isOptimizableImageHost } from "@/lib/imageHosts";
import { useCuisineFilterStore } from "@/stores/cuisineFilterStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useBusinessCategoryStore } from "@/stores/businessCategoryStore";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { Utensils, Check, ChevronRight, ChevronLeft, X } from "lucide-react";

// Cuisine data contract for the dynamic "What's on your mind?" section.
type Cuisine = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  isActive: boolean;
  isDeleted: boolean;
};

// Cuisine endpoints (both authenticated and open) return meta at root level,
// with data as a flat array.
type CuisineOpenApiResponse = {
  success: boolean;
  message: string;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: Cuisine[];
};

export default function CategoriesSection() {
  const { t, langVersion } = useTranslation();
  const { selectedCategory } = useBusinessCategoryStore();
  const { selectedCuisines, toggleCuisine, clearCuisines } =
    useCuisineFilterStore();

  // Dynamic cuisines fetched from the API for the "What's on your mind?" cards.
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function fetchCuisines() {
      const token = getAccessToken();

      try {
        let activeCuisines: Cuisine[] = [];

        if (token) {
          // Authenticated: meta is at ROOT level, data is a flat array
          // Step 1: get total count
          const countRes = await apiClient.get<CuisineOpenApiResponse>(
            "/categories/cuisine?page=1&limit=1",
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const total = countRes.data.meta.total;

          // Step 2: fetch all in one request
          const response = await apiClient.get<CuisineOpenApiResponse>(
            `/categories/cuisine?page=1&limit=${total}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          activeCuisines = (response.data?.data ?? []).filter(
            (cuisine) => cuisine.isActive && !cuisine.isDeleted
          );
        } else {
          // Open endpoint — meta is at ROOT level, data is a flat array
          // Step 1: get total count
          const countRes = await apiClient.get<CuisineOpenApiResponse>(
            "/categories/cuisine/open?page=1&limit=1"
          );
          const total = countRes.data.meta.total;

          // Step 2: fetch all in one request
          const response = await apiClient.get<CuisineOpenApiResponse>(
            `/categories/cuisine/open?page=1&limit=${total}`
          );
          activeCuisines = (response.data?.data ?? []).filter(
            (cuisine) => cuisine.isActive && !cuisine.isDeleted
          );
        }

        if (alive) {
          setCuisines(activeCuisines);
          setErrorKey(null);
        }
      } catch {
        if (alive) setErrorKey("unableToLoadCuisines");
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchCuisines();

    return () => {
      alive = false;
    };
  }, [langVersion]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [dragged, setDragged] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
    setDragged(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      setDragged(true);
    }
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Scroll affordances so mobile users can tell the row is swipeable:
  // an edge fade + a progress indicator that reflect the current position,
  // plus desktop arrow buttons enabled only when there is room to move.
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
    setScrollProgress(maxScroll > 0 ? el.scrollLeft / maxScroll : 0);
  }, []);

  // Recompute once cards render and whenever the viewport resizes, so the
  // affordances hide themselves when everything already fits on screen.
  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [cuisines, updateScrollState]);

  const scrollByCards = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleCuisineClick = (value: string) => {
    if (dragged) return;
    if (selectedCuisines.includes(value)) {
      clearCuisines();
    } else {
      clearCuisines();
      toggleCuisine(value);
    }
  };

  // Compare on the stable slug, not the localized name (which is "Restaurante"
  // in PT and would wrongly hide this section when Portuguese is selected).
  if (selectedCategory && selectedCategory.slug?.toLowerCase() !== "restaurant") {
    return null;
  }

  if (loading && cuisines.length === 0) {
    return (
      <section>
        <div className="mb-5 flex items-center justify-between sm:mb-10">
          <h2 className="text-xl font-bold leading-7 text-[#191c1d] sm:text-3xl sm:leading-10 dark:text-neutral-100">
            {t("whatsOnYourMind")}
          </h2>
        </div>
        <div className="overflow-hidden pb-6">
          <div className="-mx-4 flex gap-4 overflow-hidden px-4 pb-4 sm:gap-8 lg:-mx-16 lg:px-16">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="flex w-[calc((100vw-5rem)/4)] min-w-0 shrink-0 flex-col items-center gap-2 sm:w-auto sm:min-w-35 sm:gap-4"
              >
                <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800 sm:h-32 sm:w-32" />
                <div className="h-3 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-neutral-800 sm:h-4 sm:w-24" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (errorKey && cuisines.length === 0) {
    return (
      <section>
        <div className="mb-5 flex items-center justify-between sm:mb-10">
          <h2 className="text-xl font-bold leading-7 text-[#191c1d] sm:text-3xl sm:leading-10 dark:text-neutral-100">
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
        <h2 className="text-xl font-bold leading-7 text-[#191c1d] sm:text-3xl sm:leading-10 dark:text-neutral-100">
          {t("whatsOnYourMind")}
        </h2>
        {/* <button
          onClick={() => setIsModalOpen(true)}
          onMouseEnter={() => setIsModalOpen(true)}
          className="flex items-center gap-2 text-xl font-bold leading-7 text-[#f9186b] hover:underline cursor-pointer"
        >
          {t("viewAll")} <ChevronRight size={20} />
        </button> */}
      </div>

      <div className="relative">
        {/* Desktop-only arrow buttons (touch devices swipe instead). */}
        <button
          type="button"
          onClick={() => scrollByCards("left")}
          aria-label="Scroll left"
          className={`absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 p-2 shadow-md backdrop-blur transition-opacity dark:border-neutral-700 dark:bg-neutral-900/90 sm:flex ${canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <ChevronLeft size={22} className="text-[#191c1d] dark:text-neutral-100" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCards("right")}
          aria-label="Scroll right"
          className={`absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 p-2 shadow-md backdrop-blur transition-opacity dark:border-neutral-700 dark:bg-neutral-900/90 sm:flex ${canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <ChevronRight size={22} className="text-[#191c1d] dark:text-neutral-100" />
        </button>

        {/* Right-only edge fade — the "there's more, swipe me" cue on mobile.
            No left fade: it pooled over the leftmost card and obscured it. */}
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-[#f8f9fa] to-transparent transition-opacity dark:from-neutral-950 sm:hidden ${canScrollRight ? "opacity-100" : "opacity-0"}`}
        />

        <div className="overflow-hidden pb-6">
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-4 sm:gap-8 lg:-mx-16 lg:scroll-px-16 lg:px-16 select-none cursor-grab active:cursor-grabbing [scrollbar-none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {cuisines.map((cuisine) => {
            const cuisineLabel = cuisine.name?.trim() || cuisine.slug;
            const isActive = selectedCuisines.includes(cuisineLabel);
            return (
              <div
                key={cuisine._id}
                onClick={() => handleCuisineClick(cuisineLabel)}
                className="group flex w-[calc((100vw-5rem)/4)] min-w-0 shrink-0 snap-start select-none cursor-pointer flex-col items-center gap-2 sm:w-auto sm:min-w-35 sm:gap-4"
              >
                <div
                  className={`h-16 w-16 rounded-full p-1 shadow-md transition-all duration-300 sm:h-32 sm:w-32 ${isActive
                      ? "bg-[#f9186b] ring-4 ring-[#ffd9de] dark:ring-pink-500/20"
                      : "bg-[#e7e8e9] dark:bg-neutral-800 group-hover:bg-[#f9186b]"
                    }`}
                >
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white dark:border-neutral-900 bg-[#ffffff] dark:bg-neutral-900 transition-all duration-300 sm:border-4">
                    {cuisine.imageUrl ? (
                      <Image
                        alt={cuisineLabel}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        height={128}
                        width={128}
                        src={cuisine.imageUrl}
                        unoptimized={!isOptimizableImageHost(cuisine.imageUrl)}
                      />
                    ) : (
                      <Utensils
                        size={40}
                        className={`transition-all duration-300 ${isActive
                            ? "text-[#f9186b] dark:text-pink-500 scale-110"
                            : "text-[#5a4044] dark:text-neutral-300 group-hover:text-[#f9186b] group-hover:scale-110"
                          }`}
                      />
                    )}
                  </div>
                </div>
                <span
                  className={`text-center text-[10px] font-bold leading-3 tracking-normal uppercase transition-colors sm:text-xs sm:leading-4 sm:tracking-[0.16em] ${isActive
                      ? "text-[#f9186b] dark:text-pink-500"
                      : "text-[#191c1d] dark:text-neutral-100 group-hover:text-[#f9186b] dark:group-hover:text-pink-500"
                    }`}
                >
                  {cuisineLabel}
                </span>
              </div>
            );
          })}
        </div>
        </div>

        {/* Mobile-only progress indicator: a moving thumb makes it unmistakable
            that the row scrolls and shows how far through it you are. */}
        {(canScrollLeft || canScrollRight) && (
          <div className="relative mx-auto mt-2 h-1 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-800 sm:hidden">
            <div
              className="absolute top-0 h-full w-1/3 rounded-full bg-[#f9186b] transition-[left] duration-150"
              style={{ left: `${scrollProgress * 66}%` }}
            />
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white dark:bg-neutral-900 border dark:border-neutral-800 rounded-2xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden animate-scaleIn"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 px-6 py-4">
              <h3 className="text-xl font-bold text-[#191c1d] dark:text-neutral-100">
                {t("allCategories")}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 flex flex-col gap-3 max-h-[60vh] [scrollbar-none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {cuisines.map((cuisine) => {
                const cuisineLabel = cuisine.name?.trim() || cuisine.slug;
                const isActive = selectedCuisines.includes(cuisineLabel);
                return (
                  <button
                    key={cuisine._id}
                    onClick={() => {
                      handleCuisineClick(cuisineLabel);
                      setIsModalOpen(false);
                    }}
                    className={`group flex w-full items-center justify-between rounded-xl border p-4 transition-all duration-300 cursor-pointer ${isActive
                        ? "border-[#f9186b] bg-[#ffd9de]/30 dark:bg-pink-950/20 text-[#f9186b] dark:text-pink-500"
                        : "border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-[#ffd9de]/10 dark:hover:bg-neutral-800 hover:border-[#ffd9de] text-[#191c1d] dark:text-neutral-200"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border transition-all duration-300 ${isActive
                            ? "bg-[#f9186b] border-[#f9186b] text-white"
                            : "bg-[#e7e8e9] dark:bg-neutral-800 border-white dark:border-neutral-900 text-[#5a4044] dark:text-neutral-300 group-hover:bg-[#f9186b] group-hover:text-white"
                          }`}
                      >
                        {cuisine.imageUrl ? (
                          <Image
                            alt={cuisineLabel}
                            className="h-full w-full rounded-full object-cover transition-transform duration-300 group-hover:scale-110"
                            height={48}
                            width={48}
                            src={cuisine.imageUrl}
                            unoptimized={!isOptimizableImageHost(cuisine.imageUrl)}
                          />
                        ) : (
                          <Utensils
                            size={24}
                            className="transition-transform duration-300 group-hover:scale-110"
                          />
                        )}
                      </div>
                      <span
                        className={`text-sm font-bold tracking-widest uppercase transition-colors ${isActive
                            ? "text-[#f9186b] dark:text-pink-500"
                            : "text-[#191c1d] dark:text-neutral-200 group-hover:text-[#f9186b] dark:group-hover:text-pink-500"
                          }`}
                      >
                        {cuisineLabel}
                      </span>
                    </div>
                    {isActive ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f9186b] text-white">
                        <Check size={14} />
                      </div>
                    ) : (
                      <ChevronRight
                        size={18}
                        className="text-gray-300 dark:text-neutral-600 group-hover:text-[#f9186b] dark:group-hover:text-pink-500 transition-colors"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
