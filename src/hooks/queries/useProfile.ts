"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";

// Shared query keys so every consumer of a resource hits ONE cached, deduped
// entry instead of firing its own request. `/profile` alone had 14 call sites.
export const profileKeys = {
  profile: ["profile"] as const,
  offersCount: ["offers", "count"] as const,
  rewardPoints: ["points", "my-points"] as const,
};

/**
 * The current user's profile. Deduped + cached across the whole app, so the
 * Navbar, profile page, address pages, etc. share a single request instead of
 * each fetching `/profile` on every mount/navigation.
 */
export function useProfile<T = unknown>(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileKeys.profile,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/profile", { signal });
      return res.data?.data as T;
    },
    enabled: options?.enabled ?? true,
  });
}

/** Count of the user's active (non-deleted) offers/vouchers. */
export function useOffersCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileKeys.offersCount,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/offers", { signal });
      const offers = (res.data?.data ?? []) as Array<{
        isActive: boolean;
        isDeleted: boolean;
      }>;
      return offers.filter((o) => o.isActive && !o.isDeleted).length;
    },
    enabled: options?.enabled ?? true,
  });
}

/** The user's current reward-points balance. */
export function useRewardPoints(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileKeys.rewardPoints,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/points/my-points", { signal });
      return (res.data?.data?.currentPoints ?? 0) as number;
    },
    enabled: options?.enabled ?? true,
  });
}

interface DeliveryAddressCoords {
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
}

/**
 * The user's active delivery-address coordinates, derived from the shared,
 * cached profile (no extra `/profile` request). Returns `null` for guests or
 * when no active address has coordinates — callers then fall back to GPS.
 */
export function useActiveAddressCoords(): { lat: number; lng: number } | null {
  const authed = typeof window !== "undefined" && !!getAccessToken();
  const { data: profile } = useProfile<{
    deliveryAddresses?: DeliveryAddressCoords[];
  }>({ enabled: authed });
  return useMemo(() => {
    const active = profile?.deliveryAddresses?.find(
      (a) => a?.isActive === true,
    );
    return active?.latitude && active?.longitude
      ? { lat: active.latitude, lng: active.longitude }
      : null;
  }, [profile]);
}

/**
 * Returns a function that invalidates the cached profile so consumers refetch.
 * Call after mutations that change profile/address data (edit profile, save
 * address, etc.) instead of manually re-fetching in each component.
 */
export function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: profileKeys.profile });
}
