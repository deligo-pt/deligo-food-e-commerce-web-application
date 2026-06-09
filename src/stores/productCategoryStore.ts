import { create } from 'zustand';

export type ProductCategory = {
  _id: string;
  name: string;
  slug: string;
  icon: string;
};

interface ProductCategoryState {
  selectedCategory: ProductCategory | null;
  setSelectedCategory: (category: ProductCategory | null) => void;
}

export const useProductCategoryStore = create<ProductCategoryState>((set) => ({
  selectedCategory: null,
  setSelectedCategory: (category) => set({ selectedCategory: category }),
}));