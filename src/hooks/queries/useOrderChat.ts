"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useSocket } from "@/providers/SocketProvider";
import {
  checkOutgoingMessage,
  countUnread,
  markMineRead,
  markTheirsRead,
  mergeMessages,
  OrderChatError,
  ORDER_CHAT_PAGE_SIZE,
  unconfirmedPending,
  type OrderChatMessage,
  type OrderChatRoom,
  type OrderChatThread,
  type PendingChatMessage,
} from "@/lib/orderChat";
import {
  fetchOrderChatThread,
  markOrderChatRead,
  sendOrderChatMessage,
} from "@/services/orderChatApi";

/**
 * The rider chat for one order (`plan.md` Phase 2): history, sending, read
 * state. Live socket events are wired in Phase 3 through the cache helpers at
 * the bottom of this file.
 *
 * ## Keys
 *
 * By the order's Mongo `_id`, because that is the only id socket events carry.
 * Not language-keyed: nothing in a chat is localized (same reasoning as
 * `supportKeys`).
 *
 * ## Pages, merged by `_id`
 *
 * The API pages newest first (`page=1` is the newest 30). Older pages are
 * fetched on "load older" and every page is merged by `_id`
 * (`mergeMessages`), so when new messages shift the pages under us a message
 * can show up in two pages and still renders once.
 *
 * ## Pending messages are local, not cached
 *
 * A sent message is shown at once as "sending", kept in this hook's state so a
 * refetch cannot drop it, and removed when the server's copy is in the thread
 * (matched by the `messageId` the socket ack names, or the REST answer). A
 * refused one stays as "failed" with retry / discard.
 *
 * ## Without the socket (Phase 6)
 *
 * Live updates come from the socket. While it is down (or the room was not
 * joined), a caller that passes `pollMs` gets the thread re-read on that
 * interval instead, but only for an active room: a locked one cannot change.
 * Sending already falls back to REST by itself (`sendOrderChatMessage`).
 */

export const orderChatKeys = {
  all: ["orderChat"] as const,
  thread: (orderId: string) => ["orderChat", "thread", orderId] as const,
};

/** One fetched page, as the cache holds it. */
export interface OrderChatPage extends OrderChatThread {
  page: number;
}

type ThreadCache = InfiniteData<OrderChatPage, number>;

function latestRoom(data: ThreadCache | undefined): OrderChatRoom | null {
  // Page 1 is the newest fetch of the newest messages; its room is current.
  return data?.pages[0]?.room ?? null;
}

/** How long a socket send waits for its own `order-chat:new-message`. */
const SOCKET_ECHO_GRACE_MS = 4_000;

let localIdCounter = 0;
const nextLocalId = () => `local-${Date.now().toString(36)}-${++localIdCounter}`;

export interface UseOrderChatResult {
  /** The room, or null when this order has no chat (yet). */
  room: OrderChatRoom | null;
  /** Server messages, oldest first. */
  messages: OrderChatMessage[];
  /** Sent but not yet confirmed (or failed), oldest first. */
  pending: PendingChatMessage[];
  total: number;
  unread: number;
  isLoading: boolean;
  /** The history request failed (an `OrderChatError` when the server said why). */
  error: OrderChatError | Error | null;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  loadOlder: () => void;
  /** Resolves false when the text was refused before sending (empty / too long). */
  send: (text: string) => Promise<boolean>;
  retry: (localId: string) => void;
  discard: (localId: string) => void;
  /** Mark the rider's messages read (no request when nothing is unread). */
  markRead: () => Promise<void>;
  refetch: () => void;
}

/**
 * `orderId`: the order's Mongo `_id`. `enabled`: pass false for a pickup
 * order, a signed-out visitor, or while the order itself is loading.
 */
export function useOrderChat(
  orderId: string | null | undefined,
  options?: {
    enabled?: boolean;
    /** Told about every refused send (the bubble also shows "not sent"). */
    onSendError?: (error: OrderChatError) => void;
    /** Re-read the thread this often while live updates are missing. */
    pollMs?: number;
    /**
     * Whether live updates are arriving for this thread. Defaults to "the
     * socket is connected"; the open panel passes "the room is joined".
     */
    live?: boolean;
  },
): UseOrderChatResult {
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket();
  const enabled = (options?.enabled ?? true) && !!orderId;
  const pollMs = options?.pollMs;
  const live = options?.live ?? connected;
  const key = orderChatKeys.thread(orderId ?? "");

  const query = useInfiniteQuery<OrderChatPage, Error, ThreadCache, readonly string[], number>({
    queryKey: key,
    queryFn: async ({ pageParam, signal }): Promise<OrderChatPage> => ({
      ...(await fetchOrderChatThread(orderId!, ORDER_CHAT_PAGE_SIZE, signal, pageParam)),
      page: pageParam,
    }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * ORDER_CHAT_PAGE_SIZE < last.total ? last.page + 1 : undefined,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) =>
      pollMs && !live && latestRoom(q.state.data)?.isActive ? pollMs : false,
    // A refusal (not a participant, unknown order) will not change on retry.
    retry: (count, error) => !(error instanceof OrderChatError && error.status) && count < 2,
  });

  const room = latestRoom(query.data);
  const messages = useMemo(
    () =>
      (query.data?.pages ?? []).reduce<OrderChatMessage[]>(
        (all, page) => mergeMessages(all, page.messages),
        [],
      ),
    [query.data],
  );
  const total = Math.max(query.data?.pages[0]?.total ?? 0, messages.length);

  const onSendErrorRef = useRef(options?.onSendError);
  useEffect(() => {
    onSendErrorRef.current = options?.onSendError;
  }, [options?.onSendError]);

  const [pendingAll, setPending] = useState<PendingChatMessage[]>([]);
  const pending = useMemo(() => unconfirmedPending(pendingAll, messages), [pendingAll, messages]);

  const deliver = useCallback(
    async (localId: string, text: string) => {
      if (!orderId) return;
      setPending((list) =>
        list.map((p) => (p.localId === localId ? { ...p, status: "sending", errorCode: undefined } : p)),
      );
      try {
        const result = await sendOrderChatMessage(socket, orderId, text);
        if (result.via === "rest") {
          addIncomingMessage(queryClient, orderId, result.message);
          setPending((list) => list.filter((p) => p.localId !== localId));
        } else {
          const messageId = result.messageId ?? undefined;
          setPending((list) =>
            list.map((p) => (p.localId === localId ? { ...p, serverId: messageId } : p)),
          );
          // The message itself comes back as `order-chat:new-message`
          // (`useOrderChatSocket`). If it has not by now (the event was missed,
          // or this socket had not joined), read it from the history instead.
          setTimeout(() => {
            if (!messageId || !threadHasMessage(queryClient, orderId, messageId)) {
              void queryClient.invalidateQueries({ queryKey: orderChatKeys.thread(orderId) });
            }
          }, SOCKET_ECHO_GRACE_MS);
        }
      } catch (error) {
        const chatError = error instanceof OrderChatError ? error : new OrderChatError("UNKNOWN");
        setPending((list) =>
          list.map((p) =>
            p.localId === localId ? { ...p, status: "failed", errorCode: chatError.code } : p,
          ),
        );
        onSendErrorRef.current?.(chatError);
        // The order finished while this was on its way (guide §4: a message
        // can cross the delivery). Lock now; the refetch below fills in why.
        if (chatError.action === "lock") applyRoomClosed(queryClient, orderId, {});
        // The room changed or closed: reload it so the screen shows why.
        if (["lock", "refetch", "hide"].includes(chatError.action)) {
          void queryClient.invalidateQueries({ queryKey: orderChatKeys.thread(orderId) });
        }
      }
    },
    [orderId, socket, queryClient],
  );

  const send = useCallback(
    async (text: string) => {
      const checked = checkOutgoingMessage(text);
      if (!checked.ok || !orderId) return false;
      const localId = nextLocalId();
      setPending((list) => [
        ...list,
        {
          localId,
          roomId: room?._id ?? null,
          message: checked.message,
          createdAt: new Date().toISOString(),
          status: "sending",
        },
      ]);
      await deliver(localId, checked.message);
      return true;
    },
    [orderId, room?._id, deliver],
  );

  const retry = useCallback(
    (localId: string) => {
      const item = pendingAll.find((p) => p.localId === localId);
      if (item && item.status === "failed") void deliver(localId, item.message);
    },
    [pendingAll, deliver],
  );

  const discard = useCallback((localId: string) => {
    setPending((list) => list.filter((p) => p.localId !== localId));
  }, []);

  const unread = countUnread(messages);
  const markRead = useCallback(async () => {
    if (!orderId || unread === 0) return;
    try {
      await markOrderChatRead(socket, orderId);
      updateThreadMessages(queryClient, orderId, markTheirsRead);
    } catch {
      // Not worth interrupting the chat for; the next open tries again.
    }
  }, [orderId, unread, socket, queryClient]);

  return {
    room,
    messages,
    pending,
    total,
    unread,
    isLoading: query.isLoading,
    error: (query.error as OrderChatError | Error | null) ?? null,
    hasOlder: !!query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    loadOlder: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    send,
    retry,
    discard,
    markRead,
    refetch: () => void query.refetch(),
  };
}

// ─── Cache helpers (used by the socket events in Phase 3) ───────────────────

/** Apply `fn` to every cached page's messages of this order's thread. */
export function updateThreadMessages(
  queryClient: QueryClient,
  orderId: string,
  fn: (messages: OrderChatMessage[]) => OrderChatMessage[],
) {
  queryClient.setQueryData<ThreadCache>(orderChatKeys.thread(orderId), (data) =>
    data
      ? { ...data, pages: data.pages.map((page) => ({ ...page, messages: fn(page.messages) })) }
      : data,
  );
}

/**
 * A new message (REST answer or `order-chat:new-message`) into the newest
 * page, once. Ignored when it is for another room than the cached one — a
 * rider change gives a new room, and its history must be fetched, not mixed.
 */
export function addIncomingMessage(
  queryClient: QueryClient,
  orderId: string,
  message: OrderChatMessage | null | undefined,
) {
  if (!message?._id) return;
  queryClient.setQueryData<ThreadCache>(orderChatKeys.thread(orderId), (data) => {
    if (!data?.pages.length) return data;
    const [first, ...rest] = data.pages;
    if (first.room && message.roomId && first.room._id !== message.roomId) return data;
    const already = data.pages.some((p) => p.messages.some((m) => m._id === message._id));
    const messages = mergeMessages(first.messages, [message]);
    return {
      ...data,
      pages: [
        { ...first, messages, total: already ? first.total : first.total + 1 },
        ...rest,
      ],
    };
  });
}

/** The rider read my messages in this room (✓✓). */
export function applyRiderRead(queryClient: QueryClient, orderId: string, roomId: string) {
  updateThreadMessages(queryClient, orderId, (messages) => markMineRead(messages, roomId));
}

/** Whether this message is already in the cached thread. */
export function threadHasMessage(queryClient: QueryClient, orderId: string, messageId: string) {
  const data = queryClient.getQueryData<ThreadCache>(orderChatKeys.thread(orderId));
  return !!data?.pages.some((page) => page.messages.some((m) => m._id === messageId));
}

/**
 * `order-chat:closed`: lock the cached room at once, so the composer is
 * disabled before any refetch (guide: "immediately, without waiting for a
 * failed send"). Only the room the event names; a newer room is left alone.
 */
export function applyRoomClosed(
  queryClient: QueryClient,
  orderId: string,
  event: { roomId?: string; closedAt?: string | null; closedReason?: string | null },
) {
  queryClient.setQueryData<ThreadCache>(orderChatKeys.thread(orderId), (data) => {
    const first = data?.pages[0];
    if (!data || !first?.room) return data;
    if (event.roomId && first.room._id !== event.roomId) return data;
    const room: OrderChatRoom = {
      ...first.room,
      isActive: false,
      closedAt: event.closedAt ?? first.room.closedAt ?? null,
      closedReason: event.closedReason ?? first.room.closedReason ?? null,
    };
    return { ...data, pages: [{ ...first, room }, ...data.pages.slice(1)] };
  });
}
