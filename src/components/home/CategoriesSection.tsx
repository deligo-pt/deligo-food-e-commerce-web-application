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
//         <div className="mb-10 flex items-center justify-between">
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
//         <div className="mb-10 flex items-center justify-between">
//           <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
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
//         <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
//           {t("whatsOnYourMind")}
//         </h2>
//         <Link
//           href="/categories"
//           className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] hover:underline"
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
//                     ? "bg-[#b0004a] ring-4 ring-[#ffd9de]"
//                     : "bg-[#e7e8e9] group-hover:bg-[#b0004a]"
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
//                 className={`text-center text-[12px] font-bold leading-4 tracking-[0.16em] uppercase transition-colors ${
//                   isActive
//                     ? "text-[#b0004a]"
//                     : "text-[#191c1d] group-hover:text-[#b0004a]"
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

import { useState, useEffect, useRef } from "react";
import { useCuisineFilterStore } from "@/stores/cuisineFilterStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useBusinessCategoryStore } from "@/stores/businessCategoryStore";
import {
  Utensils,
  Flame,
  Leaf,
  Fish,
  Check,
  ChefHat,
  Pizza,
  Soup,
  UtensilsCrossed,
  ChevronRight,
  X,
} from "lucide-react";

const CUISINE_OPTIONS = [
  {
    value: "Portuguese Food",
    labelKey: "cuisinePortugueseFood",
    icon: ChefHat,
  },
  {
    value: "Sushi",
    labelKey: "cuisineSushi",
    icon: Fish,
  },
  {
    value: "Kebab",
    labelKey: "cuisineKebab",
    icon: UtensilsCrossed,
  },
  {
    value: "Barbecue",
    labelKey: "cuisineBarbecue",
    icon: Flame,
  },
  {
    value: "Indian Food",
    labelKey: "cuisineIndianFood",
    icon: Utensils,
  },
  {
    value: "Italian Food",
    labelKey: "cuisineItalianFood",
    icon: Pizza,
  },
  {
    value: "Vegetarian Food",
    labelKey: "cuisineVegetarianFood",
    icon: Leaf,
  },
  {
    value: "Thai Food",
    labelKey: "cuisineThaiFood",
    icon: Soup,
  },
  {
    value: "Japanese Food",
    labelKey: "cuisineJapaneseFood",
    icon: Soup,
  },
  {
    value: "Ramen",
    labelKey: "cuisineRamen",
    icon: Soup,
  },
  {
    value: "Seafood",
    labelKey: "cuisineSeafood",
    icon: Fish,
  },
  {
    value: "Burger",
    labelKey: "cuisineBurger",
    icon: UtensilsCrossed,
  },
  {
    value: "Halal",
    labelKey: "cuisineHalal",
    icon: Check,
  },
  {
    value: "Others",
    labelKey: "cuisineOthers",
    icon: Utensils,
  },
];

export default function CategoriesSection() {
  const { t } = useTranslation();
  const { selectedCategory } = useBusinessCategoryStore();
  const { selectedCuisines, toggleCuisine, clearCuisines } =
    useCuisineFilterStore();

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

  const handleCuisineClick = (value: string) => {
    if (dragged) return;
    if (selectedCuisines.includes(value)) {
      clearCuisines();
    } else {
      clearCuisines();
      toggleCuisine(value);
    }
  };

  if (selectedCategory && selectedCategory.name !== "RESTAURANT") {
    return null;
  }

  return (
    <section>
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
          {t("whatsOnYourMind")}
        </h2>
        {/* <button
          onClick={() => setIsModalOpen(true)}
          onMouseEnter={() => setIsModalOpen(true)}
          className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] hover:underline cursor-pointer"
        >
          {t("viewAll")} <ChevronRight size={20} />
        </button> */}
      </div>

      <div className="overflow-hidden pb-6">
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="-mx-4 flex gap-8 overflow-x-auto px-4 pb-4 lg:-mx-16 lg:px-16 select-none cursor-grab active:cursor-grabbing [scrollbar-none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {CUISINE_OPTIONS.map((item) => {
            const isActive = selectedCuisines.includes(item.value);
            const Icon = item.icon;
            return (
              <div
                key={item.value}
                onClick={() => handleCuisineClick(item.value)}
                className="group flex min-w-35 shrink-0 select-none cursor-pointer flex-col items-center gap-4"
              >
                <div
                  className={`h-32 w-32 rounded-full p-1 shadow-md transition-all duration-300 ${
                    isActive
                      ? "bg-[#b0004a] ring-4 ring-[#ffd9de]"
                      : "bg-[#e7e8e9] group-hover:bg-[#b0004a]"
                  }`}
                >
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#ffffff] transition-all duration-300">
                    <Icon
                      size={40}
                      className={`transition-all duration-300 ${
                        isActive
                          ? "text-[#b0004a] scale-110"
                          : "text-[#5a4044] group-hover:text-[#b0004a] group-hover:scale-110"
                      }`}
                    />
                  </div>
                </div>
                <span
                  className={`text-center text-[12px] font-bold leading-4 tracking-[0.16em] uppercase transition-colors ${
                    isActive
                      ? "text-[#b0004a]"
                      : "text-[#191c1d] group-hover:text-[#b0004a]"
                  }`}
                >
                  {t(item.labelKey)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden animate-scaleIn"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-xl font-bold text-[#191c1d]">
                {t("allCategories")}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 flex flex-col gap-3 max-h-[60vh] [scrollbar-none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {CUISINE_OPTIONS.map((item) => {
                const isActive = selectedCuisines.includes(item.value);
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    onClick={() => {
                      handleCuisineClick(item.value);
                      setIsModalOpen(false);
                    }}
                    className={`group flex w-full items-center justify-between rounded-xl border p-4 transition-all duration-300 cursor-pointer ${
                      isActive
                        ? "border-[#b0004a] bg-[#ffd9de]/30 text-[#b0004a]"
                        : "border-gray-100 bg-white hover:bg-[#ffd9de]/10 hover:border-[#ffd9de] text-[#191c1d]"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300 ${
                          isActive
                            ? "bg-[#b0004a] border-[#b0004a] text-white"
                            : "bg-[#e7e8e9] border-white text-[#5a4044] group-hover:bg-[#b0004a] group-hover:text-white"
                        }`}
                      >
                        <Icon
                          size={24}
                          className="transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                      <span
                        className={`text-sm font-bold tracking-widest uppercase transition-colors ${
                          isActive
                            ? "text-[#b0004a]"
                            : "text-[#191c1d] group-hover:text-[#b0004a]"
                        }`}
                      >
                        {t(item.labelKey)}
                      </span>
                    </div>
                    {isActive ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#b0004a] text-white">
                        <Check size={14} />
                      </div>
                    ) : (
                      <ChevronRight
                        size={18}
                        className="text-gray-300 group-hover:text-[#b0004a] transition-colors"
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
