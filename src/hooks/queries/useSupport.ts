"use client";

import { useCallback } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/apiClient";
import {
  getActiveTicket,
  toChronological,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/support";

/**
 * The support chat's reads.
 *
 * Two queries and an invalidator. Writes live in `services/supportApi.ts`,
 * matching how this app already splits orders and addresses.
 *
 * ## Neither key is language-keyed, unlike orders and the cart
 *
 * There is nothing localized in either payload: a ticket carries ids, counters
 * and enum values, and a message carries whatever a human typed. Keying by
 * language would refetch the thread on a language switch and change nothing in
 * it.
 */
export const supportKeys = {
  all: ["support"] as const,
  tickets: ["support", "tickets"] as const,
  /** Prefix covering every window size of one ticket's thread. */
  messagesRoot: (ticketId: string) =>
    ["support", "messages", ticketId] as const,
  messages: (ticketId: string, limit: number) =>
    ["support", "messages", ticketId, limit] as const,
};

/** The newest `limit` messages, plus how many exist in total. */
export interface SupportThread {
  messages: SupportMessage[];
  total: number;
}

/** How many messages the thread opens with, and how many "load older" adds. */
export const SUPPORT_MESSAGE_PAGE_SIZE = 50;

/**
 * One definition of the tickets request, shared by both hooks below.
 *
 * They read the same `supportKeys.tickets` cache entry and differ only in
 * `select`, so whichever mounts first performs the fetch and the other is served
 * from cache. Spelling the request out twice would mean the behaviour depended
 * on mount order the moment the two copies drifted.
 */
function ticketsQuery(options?: { enabled?: boolean }) {
  return {
    queryKey: supportKeys.tickets,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const res = await apiClient.get("/support/tickets", {
        params: { limit: 20 },
        signal,
      });
      return (res.data?.data ?? []) as SupportTicket[];
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  };
}

/**
 * The customer's support tickets (`GET /support/tickets`).
 *
 * `enabled` is the auth gate — pass `mounted && !!getAccessToken()`, the
 * pattern at `SearchContent.tsx:213`. A guest has no tickets and asking would
 * only produce a 401.
 *
 * `limit: 20` rather than the default 10 because this is also where the unread
 * badge and the chat header's identity come from, and paging for them would be
 * absurd. In practice a customer has exactly one ticket — there is no way for
 * them to open a second — so 20 is already generous.
 *
 * Polls at 60s with `refetchIntervalInBackground` left false, so a hidden tab
 * makes no requests. Same cadence and same reasoning as
 * `useUnreadNotificationCount`: this is a badge count, not a live surface, and
 * the live surface (the thread) has its own faster poll below.
 */
export function useSupportTickets(options?: { enabled?: boolean }) {
  return useQuery({
    ...ticketsQuery(options),
  });
}

/**
 * The one ticket the chat is about, or `null` for a customer who has never
 * written in.
 *
 * A `select` over the query above rather than a second request: both hooks
 * share one cache entry, so mounting the badge and the dialog together still
 * costs a single `GET /support/tickets`.
 *
 * This exists because the API has no single-ticket read — `/support/tickets/:id`,
 * `/support/ticket/:id` and `/support/my-tickets` all 404 — so "which thread am
 * I in" can only be answered by looking through the list.
 */
export function useActiveSupportTicket(options?: { enabled?: boolean }) {
  return useQuery({
    ...ticketsQuery(options),
    select: getActiveTicket,
  });
}

/**
 * A ticket's messages, oldest first (`GET /support/tickets/:ticketId/messages`).
 *
 * ## Ticket-id bootstrapping
 *
 * A customer who has never written in has no ticket and therefore nothing to
 * poll, so `ticketId` is nullable and the query stays disabled until one
 * exists. The id arrives from one of two places: `useActiveSupportTicket` for a
 * returning customer, or the `201` from the very first `sendSupportMessage` for
 * a new one.
 *
 * ## Why it polls, and why 10s
 *
 * A reply can only reach the customer by being fetched: the Socket.io server
 * authenticates fine (`auth: { token }`) but which event carries a support
 * reply to a customer is not documented and could not be established from the
 * client side, so nothing here depends on it. 10s while the panel is open is
 * six requests a minute against a 100/min budget, and
 * `refetchIntervalInBackground` stays false so a hidden tab is silent. The day
 * the socket contract is known, this interval goes and the components above do
 * not change — which is the reason the transport lives behind this hook.
 *
 * `staleTime: 0` so the focus refetch actually fires; with the app's default
 * 60s, alt-tabbing back to a minute-old thread would show a minute-old thread.
 *
 * ## "Load older" grows the window rather than fetching a second page
 *
 * The API paginates **newest-first**, so `limit: N` is "the newest N messages"
 * and page 2 is *older* than page 1. A chat wants the newest end pinned, which
 * makes a growing window the natural read: `limit` goes 50 → 100 → 150, one
 * cache entry per size, and each poll re-reads the newest N. Merging separately
 * fetched pages would have to reconcile them against a poll that is
 * simultaneously prepending new messages at the other end — the kind of
 * bookkeeping that produces duplicated or vanishing bubbles.
 *
 * `keepPreviousData` so asking for more never blanks the thread mid-read.
 *
 * `total` comes back with the window so the list knows whether "load older" has
 * anything left to load.
 */
export function useSupportMessages(
  ticketId: string | null | undefined,
  options?: { enabled?: boolean; limit?: number },
) {
  const limit = options?.limit ?? SUPPORT_MESSAGE_PAGE_SIZE;

  return useQuery({
    queryKey: supportKeys.messages(ticketId ?? "", limit),
    queryFn: async ({ signal }): Promise<SupportThread> => {
      try {
        const res = await apiClient.get(
          `/support/tickets/${ticketId}/messages`,
          { params: { limit }, signal },
        );
        return {
          messages: toChronological(
            (res.data?.data ?? []) as SupportMessage[],
          ),
          total: (res.data?.meta?.total ?? 0) as number,
        };
      } catch (error) {
        // A ticket that no longer exists is an empty thread, not a failure.
        // `TICKET_NOT_FOUND` is reachable whenever an admin closes or removes
        // the ticket while the panel is open, and the customer's next message
        // simply opens a new one — replacing the composer with a full-panel
        // error would strand them mid-sentence for nothing. Same reasoning as
        // `useCart`'s 404 handling.
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return { messages: [], total: 0 };
        }
        throw error;
      }
    },
    enabled: Boolean(ticketId) && (options?.enabled ?? true),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * Cache control for the two queries above.
 *
 * `tickets` is invalidated alongside `messages` on every send, not instead of
 * it: a sent message moves the ticket's `lastMessage`, `lastMessageTime` and —
 * on a ticket that had never been classified — its `category` and
 * `referenceOrderId` too. Refreshing one and not the other is what leaves a
 * header describing a thread that has moved on, which is exactly the bug the
 * notifications page had to be fixed for.
 */
export function useInvalidateSupport() {
  const queryClient = useQueryClient();

  const invalidateTickets = useCallback(
    () => queryClient.invalidateQueries({ queryKey: supportKeys.tickets }),
    [queryClient],
  );

  // The root key, so every window size of the thread refreshes — the customer
  // may have grown theirs with "load older", and refreshing only the 50-message
  // entry would leave the one they are actually looking at untouched.
  const invalidateMessages = useCallback(
    (ticketId: string) =>
      queryClient.invalidateQueries({
        queryKey: supportKeys.messagesRoot(ticketId),
      }),
    [queryClient],
  );

  /** After a send: the thread and the ticket that summarises it, together. */
  const invalidateThread = useCallback(
    async (ticketId: string) => {
      await Promise.all([invalidateMessages(ticketId), invalidateTickets()]);
    },
    [invalidateMessages, invalidateTickets],
  );

  /**
   * Drop everything — for logout. Invalidating is not enough: the entries
   * survive unfetched (the queries are now disabled) and the next account to
   * sign in would read the previous one's support thread out of the cache.
   */
  const clear = useCallback(
    () => queryClient.removeQueries({ queryKey: supportKeys.all }),
    [queryClient],
  );

  return { invalidateTickets, invalidateMessages, invalidateThread, clear };
}
