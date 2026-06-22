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
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d] dark:text-neutral-100">
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
                      ? "bg-[#b0004a] ring-4 ring-[#ffd9de] dark:ring-pink-500/20"
                      : "bg-[#e7e8e9] dark:bg-neutral-800 group-hover:bg-[#b0004a]"
                  }`}
                >
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-4 border-white dark:border-neutral-900 bg-[#ffffff] dark:bg-neutral-900 transition-all duration-300">
                    <Icon
                      size={40}
                      className={`transition-all duration-300 ${
                        isActive
                          ? "text-[#b0004a] dark:text-pink-500 scale-110"
                          : "text-[#5a4044] dark:text-neutral-300 group-hover:text-[#b0004a] group-hover:scale-110"
                      }`}
                    />
                  </div>
                </div>
                <span
                  className={`text-center text-[12px] font-bold leading-4 tracking-[0.16em] uppercase transition-colors ${
                    isActive
                      ? "text-[#b0004a] dark:text-pink-500"
                      : "text-[#191c1d] dark:text-neutral-100 group-hover:text-[#b0004a] dark:group-hover:text-pink-500"
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
                        ? "border-[#b0004a] bg-[#ffd9de]/30 dark:bg-pink-950/20 text-[#b0004a] dark:text-pink-500"
                        : "border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 hover:bg-[#ffd9de]/10 dark:hover:bg-neutral-800 hover:border-[#ffd9de] text-[#191c1d] dark:text-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300 ${
                          isActive
                            ? "bg-[#b0004a] border-[#b0004a] text-white"
                            : "bg-[#e7e8e9] dark:bg-neutral-800 border-white dark:border-neutral-900 text-[#5a4044] dark:text-neutral-300 group-hover:bg-[#b0004a] group-hover:text-white"
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
                            ? "text-[#b0004a] dark:text-pink-500"
                            : "text-[#191c1d] dark:text-neutral-200 group-hover:text-[#b0004a] dark:group-hover:text-pink-500"
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
                        className="text-gray-300 dark:text-neutral-600 group-hover:text-[#b0004a] dark:group-hover:text-pink-500 transition-colors"
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
