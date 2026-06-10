import { create } from "zustand";
import { persist } from "zustand/middleware";

type StoreState = {
  lang: "en" | "pt";
  setLang: (selectedLang: "en" | "pt") => void;
  categoryType: string;
  setCategoryType: (categoryType: string) => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      lang: "pt",
      setLang: (selectedLang) => set({ lang: selectedLang }),

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
