"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { AUTH_CHANGED_EVENT, getAccessToken } from "@/lib/authCookies";
import {
  ensureSocket,
  getServerSocketState,
  getSocketState,
  setSessionRejectedHandler,
  subscribeSocketState,
  type SocketState,
} from "@/lib/socket";
import {
  channelOf,
  CUSTOMER_RIDER,
  type ChatActivatedEvent,
  type ChatClosedEvent,
} from "@/lib/orderChat";
import { applyRoomClosed, orderChatKeys } from "@/hooks/queries/useOrderChat";
import { orderKeys } from "@/hooks/queries/useOrders";

const SocketContext = createContext<SocketState>(getServerSocketState());

/** Bring the socket in line with the session cookie: connect, swap or close. */
function syncSocketWithSession() {
  ensureSocket(getAccessToken());
}

/**
 * Keeps the app's one Socket.IO connection (`lib/socket.ts`) in step with the
 * signed-in customer: connected while there is a session, closed without one,
 * replaced when another account signs in on the tab.
 *
 * The session lives in a cookie with no change event of its own, so it is
 * re-read
 * - when `storeAuthTokens` / `clearAuthTokens` announce a change
 *   (`AUTH_CHANGED_EVENT`) — sign-in, and the API client's dead-session path;
 * - on every navigation — the Navbar and Profile sign-outs remove the cookies
 *   directly and then navigate (same rule as `useFCMNotifications`);
 * - when the tab becomes visible — a sign-in or sign-out in another tab.
 *
 * App-wide rider-chat events (`plan.md` Phase 3): `order-chat:activated` and
 * `order-chat:closed` reach the customer's `user_` room with no chat open, so
 * they are listened to here, for every order: `closed` locks the cached room
 * at once, and both reload that order's chat and orders, so the "Chat with
 * rider" button appears, turns into history or goes away by itself.
 *
 * When the server refuses the session (`NOT_AUTHORIZED`), the socket closes
 * and one `/profile` request lets the API client decide: a dead session goes
 * through its normal sign-out to /login; a live one just stays without a
 * socket until the next sign-in.
 */
export default function SocketProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useSyncExternalStore(
    subscribeSocketState,
    getSocketState,
    getServerSocketState,
  );

  useEffect(() => {
    syncSocketWithSession();
  }, [pathname]);

  const queryClient = useQueryClient();
  const { socket } = state;
  useEffect(() => {
    if (!socket) return;
    const refresh = (orderId: string) => {
      void queryClient.invalidateQueries({ queryKey: orderChatKeys.thread(orderId) });
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    };
    const onActivated = (event: ChatActivatedEvent) => {
      if (!event?.orderId || channelOf(event) !== CUSTOMER_RIDER) return;
      refresh(event.orderId);
    };
    const onClosed = (event: ChatClosedEvent) => {
      if (!event?.orderId || channelOf(event) !== CUSTOMER_RIDER) return;
      applyRoomClosed(queryClient, event.orderId, event);
      refresh(event.orderId);
    };
    socket.on("order-chat:activated", onActivated);
    socket.on("order-chat:closed", onClosed);
    return () => {
      socket.off("order-chat:activated", onActivated);
      socket.off("order-chat:closed", onClosed);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") syncSocketWithSession();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, syncSocketWithSession);
    document.addEventListener("visibilitychange", onVisible);
    setSessionRejectedHandler(() => {
      apiClient.get("/profile").catch(() => {
        // The interceptor already handled a dead session; nothing else to do.
      });
    });
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSocketWithSession);
      document.removeEventListener("visibilitychange", onVisible);
      setSessionRejectedHandler(null);
    };
  }, []);

  return (
    <SocketContext.Provider value={state}>{children}</SocketContext.Provider>
  );
}

/**
 * The shared socket and whether it is connected. `socket` is null when signed
 * out; screens must cope with `connected: false` (reconnecting, or the server
 * is down) and fall back to REST.
 */
export function useSocket(): SocketState {
  return useContext(SocketContext);
}
