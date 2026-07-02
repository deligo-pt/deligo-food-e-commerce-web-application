import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCuisineFilterStore } from "./cuisineFilterStore";
import { useBusinessCategoryStore } from "./businessCategoryStore";
import { useProductCategoryStore } from "./productCategoryStore";

type StoreState = {
  lang: "en" | "pt";
  setLang: (selectedLang: "en" | "pt") => void;
  categoryType: string;
  setCategoryType: (categoryType: string) => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      lang: "pt",
      setLang: (selectedLang) => {
        // Filter selections are keyed by localized text (cuisine name) or hold a
        // category object with a localized name. On a language switch those values
        // go stale and no longer match the freshly-fetched data, so reset them
        // synchronously — before the language change triggers a re-render/remount.
        if (get().lang !== selectedLang) {
          useCuisineFilterStore.getState().clearCuisines();
          useBusinessCategoryStore.getState().setSelectedCategory(null);
          useProductCategoryStore.getState().setSelectedCategory(null);
        }
        set({ lang: selectedLang });
      },

      categoryType: "",
      setCategoryType: (categoryType) => set({ categoryType }),
    }),
    {
      name: "app-storage",
      partialize: (state) => ({
        lang: state.lang,
        categoryType: state.categoryType,
      }),
    },
  ),
);
