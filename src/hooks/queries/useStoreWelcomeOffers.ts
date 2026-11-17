"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthed } from "@/hooks/useAuthed";
import { useWelcomeOfferUsage } from "@/hooks/queries/useOrders";
import { storeWelcomeOffers, type StoreWelcomeOffer } from "@/lib/firstOrderOffer";

const EMPTY = new Map<string, StoreWelcomeOffer>();

/**
 * Every store's active welcome offer, for the store cards. One request shared
 * by every card on the page (React Query dedupes it). Signed-in customers
 * only: the endpoint answers 401 without a token, and a failure just means no
 * badges — never an error on the page.
 *
 * A store whose welcome offer this customer has already used is left out
 * (`useWelcomeOfferUsage`): the list itself says every offer is still open to
 * everyone. Nothing shows until both answers are in, so a used offer never
 * flashes on the card first.
 */
export function useStoreWelcomeOffers(): Map<string, StoreWelcomeOffer> {
  const authed = useAuthed();
  const { usage, ready } = useWelcomeOfferUsage({ enabled: authed });
  const { data } = useQuery({
    queryKey: ["offers", "first-order", "stores"],
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/offers", {
        params: { "eligibility.type": "FIRST_ORDER", limit: 100 },
        signal,
      });
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    select: (offers) => storeWelcomeOffers(offers),
    enabled: authed,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return useMemo(() => {
    if (!data || !ready) return EMPTY;
    if (usage.vendors.size === 0) return data;
    const open = new Map(data);
    for (const vendorId of usage.vendors) open.delete(vendorId);
    return open;
  }, [data, ready, usage]);
}
