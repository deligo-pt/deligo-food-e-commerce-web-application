/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { apiClient } from "@/lib/apiClient";
import { getCartVendorId } from "@/lib/cart";

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
        (cartData?.items || []).map((item: any) =>
          getCartVendorId(item.vendorId)
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