"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { listSavedCards } from "@/services/paymentTokenApi";
import type { SavedCard } from "@/types/payment";

export const paymentTokenKeys = {
  all: ["payment-tokens"] as const,
  // Not keyed by language: the payload carries no localized text — `label` and
  // `expiryDate` are formatted server-side from card data, not translated.
  list: () => ["payment-tokens", "list"] as const,
};

/**
 * The current user's saved cards (`GET /payment-tokens`).
 *
 * Expect this to be empty for a while: a card can only be saved by paying with
 * `paymentMethod: "CARD"`, and the standalone save-a-card endpoint is still
 * blocked on a REDUNIQ merchant permission. Callers must treat "no cards" as an
 * ordinary state, not a failure.
 */
export function useSavedCards(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: paymentTokenKeys.list(),
    queryFn: async ({ signal }) => {
      try {
        return await listSavedCards(signal);
      } catch (error) {
        // A customer who has never saved a card is a customer with no cards,
        // not an error — same reasoning as `useCart` treating a missing cart as
        // an empty one. Letting a 404 reject would put an error panel where the
        // empty state belongs.
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return [] as SavedCard[];
        }
        throw error;
      }
    },
    enabled: options?.enabled ?? true,
  });
}

/**
 * Returns a function that invalidates the cached card list so consumers
 * refetch. Call it after removing a card, or after an order that saved one.
 *
 * Memoized, unlike its siblings elsewhere in this folder: the post-payment
 * return page calls it from inside the effect that finalizes the order, and an
 * identity that changed every render would re-run that effect — i.e. re-POST
 * `/orders/create-order`.
 */
export function useInvalidateSavedCards() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: paymentTokenKeys.all }),
    [queryClient],
  );
}
