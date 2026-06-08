import { create } from 'zustand';

export type BusinessCategory = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

interface BusinessCategoryState {
  selectedCategory: BusinessCategory | null;
  setSelectedCategory: (category: BusinessCategory | null) => void;
}

export const useBusinessCategoryStore = create<BusinessCategoryState>((set) => ({
  selectedCategory: null,
  setSelectedCategory: (category) => set({ selectedCategory: category }),
}));