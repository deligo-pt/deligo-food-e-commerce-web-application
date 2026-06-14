"use client";

import { useCuisineFilterStore } from "@/stores/cuisineFilterStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

const CUISINE_OPTIONS = [
  "Portuguese Food",
  "Sushi",
  "Kebab",
  "Barbecue",
  "Indian Food",
  "Italian Food",
  "Vegetarian Food",
  "Thai Food",
  "Japanese Food",
  "Ramen",
  "Seafood",
  "Burger",
  "Halal",
  "Others",
];

export default function RestaurantFilterModal({ open, onClose }: Props) {
  const { selectedCuisines, toggleCuisine, clearCuisines } =
    useCuisineFilterStore();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <div className="max-h-[80vh] w-full rounded-t-4xl bg-white p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#191c1d]">Filter</h2>

          <button
            onClick={clearCuisines}
            className="font-semibold text-[#d81b60]"
          >
            Clear all
          </button>
        </div>

        {/* Filter Options */}
        <div className="mb-8 flex flex-wrap gap-3 overflow-y-auto">
          {CUISINE_OPTIONS.map((item) => {
            const active = selectedCuisines.includes(item);

            return (
              <button
                key={item}
                onClick={() => toggleCuisine(item)}
                className={`rounded-full px-5 py-3 text-sm font-medium transition-all ${
                  active
                    ? "bg-[#d81b60] text-white"
                    : "border border-[#e7e8e9] bg-white text-[#191c1d]"
                }`}
              >
                {active && "✓ "}
                {item}
              </button>
            );
          })}
        </div>

        {/* Apply Button */}
        <button
          onClick={onClose}
          className="w-full rounded-full bg-[#d81b60] py-4 text-lg font-bold text-white"
        >
          Apply{" "}
          {selectedCuisines.length > 0 ? `(${selectedCuisines.length})` : ""}
        </button>
      </div>
    </div>
  );
}
