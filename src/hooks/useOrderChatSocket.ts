"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/providers/SocketProvider";
import {
  CUSTOMER_RIDER,
  isEventForThread,
  isMine,
  isOtherSideTyping,
  markTheirsRead,
  MY_ROLE,
  TYPING_IDLE_MS,
  TYPING_SHOW_MS,
  type ChatActivatedEvent,
  type ChatEventBase,
  type ChatNewMessageEvent,
  type ChatReadEvent,
  type ChatTypingEvent,
} from "@/lib/orderChat";
import {
  addIncomingMessage,
  applyRiderRead,
  orderChatKeys,
  updateThreadMessages,
} from "@/hooks/queries/useOrderChat";
import { markOrderChatRead } from "@/services/orderChatApi";

/**
 * The live half of the rider chat, while the chat is on screen (`plan.md`
 * Phase 3). Pairs with `useOrderChat`, which owns the data; this only joins
 * the room and feeds the socket's events into the same cache.
 *
 * - `join-order-chat` when it opens, again after every reconnect (Socket.IO
 *   forgets rooms) and after `order-chat:activated` (a new rider's room);
 *   `leave-order-chat` when it closes.
 * - `order-chat:new-message` → appended once (`_id`), only for this order,
 *   this channel and the cached room. A rider's message while the chat is
 *   visible is marked read straight away.
 * - `order-chat:typing` → "rider is typing…", cleared after 5 s without news.
 * - `order-chat:read` from the rider → my messages get ✓✓. From the customer
 *   (this account read the chat in another tab) → the rider's messages are
 *   read here too, so this tab's badge clears.
 * - `order-chat:closed` → "typing…" goes; the lock itself is `SocketProvider`'s.
 * - My own typing: `isTyping: true` once when I start, `false` after 3 s of
 *   silence or when I send — never one event per key press (each one costs
 *   the server a few database lookups).
 *
 * `order-chat:activated` / `order-chat:closed` for a closed chat are handled
 * app-wide in `SocketProvider`; they also reach here when the chat is open.
 *
 * `orderId` is the order's Mongo `_id` (socket events carry nothing else).
 */
export function useOrderChatSocket(
  orderId: string | null | undefined,
  options: { active: boolean; visible?: boolean },
) {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [joined, setJoined] = useState(false);
  const [riderTyping, setRiderTyping] = useState(false);

  // Read inside socket handlers, which must not re-subscribe on every change.
  const visibleRef = useRef(options.visible ?? true);
  useEffect(() => {
    visibleRef.current = options.visible ?? true;
  }, [options.visible]);

  const active = options.active && !!orderId && !!socket;

  useEffect(() => {
    if (!active || !socket || !orderId) return;
    let typingTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;
    const payload = { orderId, channel: CUSTOMER_RIDER };
    const refetch = () =>
      void queryClient.invalidateQueries({ queryKey: orderChatKeys.thread(orderId) });

    const join = () => {
      socket.emit("join-order-chat", payload, (ack?: { success?: boolean }) => {
        if (alive) setJoined(!!ack?.success);
      });
    };

    const markReadNow = () => {
      markOrderChatRead(socket, orderId)
        .then(() => updateThreadMessages(queryClient, orderId, markTheirsRead))
        .catch(() => {});
    };

    const onConnect = () => {
      // A reconnect lost the room and maybe messages: join and reload.
      join();
      refetch();
    };
    const onDisconnect = () => {
      if (alive) setJoined(false);
    };
    const onNewMessage = (event: ChatNewMessageEvent) => {
      if (!isEventForThread(event, orderId)) return;
      addIncomingMessage(queryClient, orderId, event.message);
      if (!isMine(event.message)) {
        setRiderTyping(false);
        if (visibleRef.current) markReadNow();
      }
    };
    const onTyping = (event: ChatTypingEvent) => {
      if (!isEventForThread(event, orderId) || event.role === "CUSTOMER") return;
      if (typingTimer) clearTimeout(typingTimer);
      const typing = isOtherSideTyping(event);
      setRiderTyping(typing);
      if (typing) typingTimer = setTimeout(() => setRiderTyping(false), TYPING_SHOW_MS);
    };
    const onRead = (event: ChatReadEvent) => {
      if (!isEventForThread(event, orderId)) return;
      if (event.readerRole === MY_ROLE) {
        updateThreadMessages(queryClient, orderId, markTheirsRead);
        return;
      }
      if (event.roomId) applyRiderRead(queryClient, orderId, event.roomId);
    };
    const onClosed = (event: ChatEventBase) => {
      if (!isEventForThread(event, orderId)) return;
      if (typingTimer) clearTimeout(typingTimer);
      setRiderTyping(false);
    };
    const onActivated = (event: ChatActivatedEvent) => {
      if (!isEventForThread(event, orderId)) return;
      // A (new) room for this order: its history and its room.
      join();
      refetch();
    };

    if (socket.connected) join();
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("order-chat:new-message", onNewMessage);
    socket.on("order-chat:typing", onTyping);
    socket.on("order-chat:read", onRead);
    socket.on("order-chat:activated", onActivated);
    socket.on("order-chat:closed", onClosed);

    return () => {
      alive = false;
      if (typingTimer) clearTimeout(typingTimer);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("order-chat:new-message", onNewMessage);
      socket.off("order-chat:typing", onTyping);
      socket.off("order-chat:read", onRead);
      socket.off("order-chat:activated", onActivated);
      socket.off("order-chat:closed", onClosed);
      if (socket.connected) socket.emit("leave-order-chat", payload);
      setJoined(false);
      setRiderTyping(false);
    };
  }, [active, socket, orderId, queryClient]);

  // ── My typing ──
  const iAmTyping = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (iAmTyping.current && socket?.connected && orderId) {
      socket.emit("order-chat-typing", { orderId, isTyping: false, channel: CUSTOMER_RIDER });
    }
    iAmTyping.current = false;
  }, [socket, orderId]);

  /** Call on every keystroke; it sends at most one event per typing burst. */
  const onTyping = useCallback(() => {
    if (!active || !socket?.connected || !orderId) return;
    if (!iAmTyping.current) {
      iAmTyping.current = true;
      socket.emit("order-chat-typing", { orderId, isTyping: true, channel: CUSTOMER_RIDER });
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [active, socket, orderId, stopTyping]);

  // Closing the chat mid-sentence must not leave "typing…" on the rider's side.
  useEffect(() => stopTyping, [stopTyping]);

  return { joined, riderTyping, onTyping, stopTyping };
}
