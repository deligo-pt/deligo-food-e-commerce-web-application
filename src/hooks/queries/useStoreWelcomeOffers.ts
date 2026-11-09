"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthed } from "@/hooks/useAuthed";
import { storeWelcomeOffers, type StoreWelcomeOffer } from "@/lib/firstOrderOffer";

const EMPTY = new Map<string, StoreWelcomeOffer>();

/**
 * Every store's active welcome offer, for the store cards. One request shared
 * by every card on the page (React Query dedupes it). Signed-in customers
 * only: the endpoint answers 401 without a token, and a failure just means no
 * badges — never an error on the page.
 */
export function useStoreWelcomeOffers(): Map<string, StoreWelcomeOffer> {
  const authed = useAuthed();
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
  return data ?? EMPTY;
}
