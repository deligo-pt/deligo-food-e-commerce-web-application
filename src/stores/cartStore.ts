/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { apiClient } from "@/lib/apiClient";

interface CartStore {
  vendorCount: number;
  itemCount: number;
  fetchCart: () => Promise<void>;
}

export const useCartStore = create<CartStore>((set) => ({
  vendorCount: 0,
  itemCount: 0,

  fetchCart: async () => {
    try {
      const response = await apiClient.get("/carts/view-cart");

      const cartData = response.data?.data;

      const uniqueVendors = new Set(
        (cartData?.items || []).map(
          (item: any) => item.vendorId?._id
        )
      );

      set({
        itemCount: cartData?.totalItems ?? 0,
        vendorCount: uniqueVendors.size,
      });
    } catch {
      set({
        itemCount: 0,
        vendorCount: 0,
      });
    }
  },
}));