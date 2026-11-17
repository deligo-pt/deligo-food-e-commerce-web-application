import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/authCookies";

/**
 * The app's one Socket.IO connection (rider chat, `plan.md` Phase 1).
 *
 * One socket per signed-in customer, shared by every screen: the backend puts
 * each connected socket in the customer's personal room `user_<userId>`, which
 * is where `order-chat:activated` / `order-chat:closed` arrive even when no chat
 * is open. `SocketProvider` decides when it exists; screens only read it.
 *
 * Transports are left at the default (HTTP long-polling first, then upgrade).
 * A websocket-only connection is refused by the test server's proxy
 * (16 Nov 2026), so `transports: ["websocket"]` would never connect there.
 *
 * `auth` is a callback rather than an object so every (re)connect sends the
 * token in the cookie *now*, not the one from when the socket was made.
 */

let socket: Socket | null = null;
let socketToken: string | null = null;

/** Pause before reconnecting after the server closed the connection itself. */
const SERVER_DISCONNECT_RETRY_MS = 2_000;

/**
 * What screens need to know, as a tiny external store for
 * `useSyncExternalStore` (`SocketProvider`): which socket, and whether it is
 * connected right now. A new object only when one of the two changed.
 */
export interface SocketState {
  socket: Socket | null;
  connected: boolean;
}

const SIGNED_OUT: SocketState = { socket: null, connected: false };
let state: SocketState = SIGNED_OUT;
const listeners = new Set<() => void>();

function setState(next: SocketState) {
  if (next.socket === state.socket && next.connected === state.connected) return;
  state = next.socket ? next : SIGNED_OUT;
  listeners.forEach((listener) => listener());
}

export function subscribeSocketState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSocketState(): SocketState {
  return state;
}

/** The server render has no socket. */
export function getServerSocketState(): SocketState {
  return SIGNED_OUT;
}

/**
 * The server refused this session: `connect_error` "NOT_AUTHORIZED" on connect
 * (a bad or expired token; Socket.IO does not retry those), or an
 * `order-chat:error` with `code: "NOT_AUTHORIZED"` later. Set by
 * `SocketProvider`.
 */
let onSessionRejected: (() => void) | null = null;
export function setSessionRejectedHandler(handler: (() => void) | null) {
  onSessionRejected = handler;
}

/** A token the server refused: never connect with it again (no retry loop). */
let rejectedToken: string | null = null;

function sessionRejected() {
  rejectedToken = socketToken;
  closeSocket();
  onSessionRejected?.();
}

/**
 * A socket call was answered `NOT_AUTHORIZED` (the token expired while the
 * socket stayed connected): same path as a refused connect. No-op when there
 * is no socket any more.
 */
export function reportSessionRejected() {
  if (socket) sessionRejected();
}

/**
 * Where the socket server lives: `NEXT_PUBLIC_SOCKET_URL`, else the origin of
 * `NEXT_PUBLIC_API_BASE_URL` (the API and the socket share a server). A `wss:`
 * / `ws:` value is turned into `https:` / `http:` so polling can start.
 */
export function getSocketUrl(
  socketUrl: string | undefined = process.env.NEXT_PUBLIC_SOCKET_URL,
  apiBaseUrl: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL,
): string | null {
  const raw = socketUrl?.trim() || apiBaseUrl?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "wss:") url.protocol = "https:";
    else if (url.protocol === "ws:") url.protocol = "http:";
    return url.origin;
  } catch {
    return null;
  }
}

/** The live socket, or null when signed out. */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * The socket for this token: reuses the current one for the same token, and
 * replaces it when the token changed (another account signed in on this tab).
 * Returns null without a token or a server URL.
 */
export function ensureSocket(token: string | null | undefined): Socket | null {
  if (!token) {
    closeSocket();
    return null;
  }
  if (socket && socketToken === token) return socket;
  if (token === rejectedToken) return null;

  closeSocket();
  const url = getSocketUrl();
  if (!url) return null;

  socketToken = token;
  const created = io(url, {
    auth: (cb) => cb({ token: getAccessToken() ?? token }),
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });
  socket = created;

  created.on("connect", () => setState({ socket: created, connected: true }));
  created.on("disconnect", (reason) => {
    setState({ socket: created, connected: false });
    // Socket.IO reconnects by itself after a network drop, but NOT when the
    // server ended the connection ("io server disconnect"). Try once more
    // after a moment: a live session reconnects (and the chat re-joins); a
    // dead one is answered "NOT_AUTHORIZED" and goes through `sessionRejected`.
    if (reason === "io server disconnect") {
      setTimeout(() => {
        if (socket === created && !created.connected) created.connect();
      }, SERVER_DISCONNECT_RETRY_MS);
    }
  });
  created.on("connect_error", (error) => {
    if (error?.message === "NOT_AUTHORIZED") sessionRejected();
  });
  created.on("order-chat:error", (payload: { code?: string } | undefined) => {
    if (payload?.code === "NOT_AUTHORIZED") sessionRejected();
  });

  setState({ socket: created, connected: false });
  return created;
}

/** Disconnect and forget the socket (sign-out, or a dead session). */
export function closeSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  socket = null;
  socketToken = null;
  setState(SIGNED_OUT);
}
