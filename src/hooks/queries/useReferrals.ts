"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

/**
 * `GET /referrals/my-referrals`, in the shape the loyalty rewrite returns
 * (Oct 2026). The summary used to carry `totalEarned` in euros, a wallet
 * balance and milestones; none of those exist any more. Referral rewards are
 * points now, paid to the referrer when the friend completes a first order.
 */
export type ReferralStatus = "PENDING" | "COMPLETED" | "EXPIRED";

export interface ReferralInvite {
  id: string;
  /** `"DeliGo User"` when the friend has not set a name. */
  friendName: string;
  friendPhoto: string;
  /** Typed loosely: an unknown status is shown like a pending one. */
  status: ReferralStatus | string;
  /** `0` until the friend's first completed order. */
  pointsEarned: number;
  date: string;
}

export interface ReferralData {
  /** Blank or `"N/A"` until the profile has a name. */
  myReferralCode: string;
  summary: {
    totalInvites: number;
    successfulInvites: number;
    pendingInvites: number;
    /** What one completed referral pays right now — set by an admin. */
    pointsPerReferral: number;
    totalPointsEarned: number;
  };
  referralHistory: ReferralInvite[];
}

export const referralKeys = {
  mine: ["referrals", "mine"] as const,
};

export function useReferrals(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: referralKeys.mine,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/referrals/my-referrals", { signal });
      return res.data?.data as ReferralData;
    },
    enabled: options?.enabled ?? true,
    // A friend's first order turns an invite into points with no push to say
    // so; coming back to the tab is when the customer looks again.
    refetchOnWindowFocus: true,
  });
}

/** The API's placeholder for "no code yet" is `"N/A"`, or nothing at all. */
export function hasReferralCode(code: string | null | undefined): code is string {
  const trimmed = code?.trim();
  return !!trimmed && trimmed.toUpperCase() !== "N/A";
}
