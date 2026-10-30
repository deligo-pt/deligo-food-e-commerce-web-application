"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { profileKeys } from "./useProfile";
import { pointsKeys } from "./usePoints";

/**
 * A reward from `GET /rewards`. The backend filters by the caller's account
 * type and `isActive`, cheapest first. There is no image, description or stock.
 */
export interface RewardProduct {
  _id: string;
  name: string;
  requiredPoints: number;
  /** Paid in cash at the office; `0` is free. */
  cashPrice: number;
  /** The shelf price, struck through when higher than `cashPrice`. */
  regularPrice: number;
}

/** The claim `POST /rewards/claim` returns (`pointsBreakdown` ignored). */
export interface RewardClaim {
  _id: string;
  pointsSpent: number;
  cashAmount: number;
  status: string;
  scheduledPickupDate: string;
}

export const rewardKeys = {
  catalog: ["rewards", "catalog"] as const,
};

export function useRewardCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rewardKeys.catalog,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/rewards", { signal });
      return (res.data?.data ?? []) as RewardProduct[];
    },
    enabled: options?.enabled ?? true,
    // An admin can hide a reward at any time; always revalidate on open.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/** Everything a claim — or a refused one — can have changed. */
export function useRefreshPoints() {
  const queryClient = useQueryClient();
  return {
    balance: () => queryClient.invalidateQueries({ queryKey: profileKeys.rewardPoints }),
    history: () => queryClient.invalidateQueries({ queryKey: pointsKeys.history }),
    catalog: () => queryClient.invalidateQueries({ queryKey: rewardKeys.catalog }),
  };
}

/**
 * `POST /rewards/claim`. The body is strict — exactly these two keys. Points
 * are deducted atomically, so on success the balance and history are refetched
 * rather than computed here.
 */
export function useClaimReward() {
  const refresh = useRefreshPoints();
  return useMutation({
    mutationFn: async (body: { productId: string; scheduledPickupDate: string }) => {
      const res = await apiClient.post("/rewards/claim", body);
      return res.data?.data as RewardClaim;
    },
    onSuccess: () => {
      void refresh.balance();
      void refresh.history();
    },
  });
}
