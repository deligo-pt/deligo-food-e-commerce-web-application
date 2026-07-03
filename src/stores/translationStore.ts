import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCuisineFilterStore } from "./cuisineFilterStore";
import { useBusinessCategoryStore } from "./businessCategoryStore";
import { useProductCategoryStore } from "./productCategoryStore";

type StoreState = {
  lang: "en" | "pt";
  // Bumped on every real language change. Components that fetch server-localized
  // (bilingual) data depend on this in their fetch effect so they re-fetch in the
  // new language WITHOUT the page being remounted (which is what caused every
  // component to drop back into its loading state on a language switch).
  langVersion: number;
  setLang: (selectedLang: "en" | "pt") => void;
  categoryType: string;
  setCategoryType: (categoryType: string) => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      lang: "pt",
      langVersion: 0,
      setLang: (selectedLang) => {
        if (get().lang === selectedLang) return;

        // Filter selections are keyed by localized text (cuisine name) or hold a
        // category object with a localized name. On a language switch those values
        // go stale and no longer match the freshly-fetched data, so reset them
        // synchronously — before the language change triggers the re-fetch.
        useCuisineFilterStore.getState().clearCuisines();
        useBusinessCategoryStore.getState().setSelectedCategory(null);
        useProductCategoryStore.getState().setSelectedCategory(null);

        set({ lang: selectedLang, langVersion: get().langVersion + 1 });
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
