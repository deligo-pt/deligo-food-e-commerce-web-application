"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { calibrateServerClock } from "@/lib/serverClock";
import { normalizeSlotsResponse, type CheckoutSlotsResponse, type FulfillmentType } from "@/types/slots";

export const checkoutSlotKeys = {
  all: ["checkout-slots"] as const,
  // Not keyed by language: labels are clock times, and only error messages are
  // translated, which are not cached as data.
  list: (vendorId: string, fulfillmentType: FulfillmentType, date: string | null) =>
    ["checkout-slots", vendorId, fulfillmentType, date ?? "today"] as const,
};

/** Slots expire as time passes; refetch this often while the list is in use. */
const SLOTS_REFETCH_MS = 3 * 60_000;

interface UseCheckoutSlotsOptions {
  /** The vendor's Mongo `_id` — the `V-…` userId fails validation. */
  vendorId: string | null | undefined;
  fulfillmentType?: FulfillmentType;
  /** `YYYY-MM-DD` in the store's timezone; omitted means today. */
  date?: string | null;
  /** Pass `false` while the picker is closed, so nothing polls in the background. */
  enabled?: boolean;
}

/**
 * The slots `POST /checkout` will accept, from `GET /checkout/pickup-slots`.
 *
 * The backend already removes past, too-soon, closed, paused and after-cutoff
 * slots, so the result is rendered as-is — never filtered on the client.
 * Customer-only, so it stays off for guests. Errors (a date outside the window,
 * `VENDOR_NOT_ACCEPTING_ORDERS`, 404) are returned as the query error; read them
 * with `getApiErrorKey` and `SLOT_DATE_WINDOW_ERRORS`. 4xx is not retried
 * (QueryProvider default).
 */
export function useCheckoutSlots({
  vendorId,
  fulfillmentType = "PICKUP",
  date = null,
  enabled = true,
}: UseCheckoutSlotsOptions) {
  const isEnabled = enabled && Boolean(vendorId) && Boolean(getAccessToken());

  // Slot screens show countdowns; make sure the clock is corrected first.
  useEffect(() => {
    if (isEnabled) void calibrateServerClock();
  }, [isEnabled]);

  return useQuery({
    queryKey: checkoutSlotKeys.list(vendorId ?? "", fulfillmentType, date),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/checkout/pickup-slots", {
        params: { vendorId, fulfillmentType, ...(date ? { date } : {}) },
        signal,
      });
      // Read through the normaliser: the backend now sends `days[]` instead
      // of `slots` (4 Nov 2026), and `slots` is what every screen reads.
      return normalizeSlotsResponse(res.data?.data as CheckoutSlotsResponse, date) ?? null;
    },
    enabled: isEnabled,
    staleTime: 60_000,
    refetchInterval: isEnabled ? SLOTS_REFETCH_MS : false,
    refetchOnWindowFocus: true,
  });
}
