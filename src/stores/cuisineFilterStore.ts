import { create } from "zustand";

interface CuisineFilterStore {
  selectedCuisines: string[];
  toggleCuisine: (cuisine: string) => void;
  clearCuisines: () => void;
}

export const useCuisineFilterStore = create<CuisineFilterStore>((set) => ({
  selectedCuisines: [],

  toggleCuisine: (cuisine) =>
    set((state) => ({
      selectedCuisines: state.selectedCuisines.includes(cuisine)
        ? state.selectedCuisines.filter((item) => item !== cuisine)
        : [...state.selectedCuisines, cuisine],
    })),

  clearCuisines: () =>
    set({
      selectedCuisines: [],
    }),
}));