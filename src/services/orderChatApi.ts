import axios from "axios";
import type { Socket } from "socket.io-client";
import { apiClient, errorKeyOf } from "@/lib/apiClient";
import { reportSessionRejected } from "@/lib/socket";
import {
  CUSTOMER_RIDER,
  OrderChatError,
  parseThread,
  type OrderChatMessage,
  type OrderChatThread,
} from "@/lib/orderChat";

/**
 * The rider chat's requests (`plan.md` Phase 2). Plain async functions, like
 * `supportApi.ts`: reads are wrapped by `hooks/queries/useOrderChat.ts`, which
 * also owns the pending state.
 *
 * Writes go over the socket when it is connected (the guide's way: the message
 * then comes back to everyone, the sender included, as
 * `order-chat:new-message`) and over REST when it is not, so a chat still
 * works while the socket reconnects.
 *
 * `orderId` is the order's Mongo `_id` throughout: REST takes it as well as
 * `ORD-…`, and socket events only ever carry the `_id`.
 *
 * Every refusal becomes an `OrderChatError` with the server's code
 * (`errorKey` on REST, `code` on the socket); a REST validation failure, which
 * has no `errorKey`, becomes `VALIDATION_ERROR` like the socket's.
 */

/** How long a socket call may take before it counts as failed. */
const ACK_TIMEOUT_MS = 8_000;

interface SocketAck {
  success: boolean;
  code?: string;
  messageId?: string;
  modifiedCount?: number;
}

function toChatError(error: unknown): OrderChatError {
  if (error instanceof OrderChatError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const payload = error.response?.data as
      | { message?: string; errorKey?: string; err?: { errorKey?: string } }
      | undefined;
    const key = errorKeyOf(payload);
    if (key) return new OrderChatError(key, payload?.message, status);
    if (status === 400) return new OrderChatError("VALIDATION_ERROR", payload?.message, 400);
    if (status === 401) return new OrderChatError("NOT_AUTHORIZED", payload?.message, 401);
    return new OrderChatError(status ? `HTTP_${status}` : "NETWORK_ERROR", error.message, status);
  }
  return new OrderChatError("UNKNOWN", error instanceof Error ? error.message : String(error));
}

async function emitWithAck(socket: Socket, event: string, payload: object): Promise<SocketAck> {
  let ack: SocketAck;
  try {
    ack = (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as SocketAck;
  } catch {
    throw new OrderChatError("TIMEOUT", `${event} was not acknowledged`);
  }
  if (!ack?.success) {
    // The token expired mid-chat: the socket was let in when it was valid and
    // only the call says so. Sign out the same way a refused connect does.
    if (ack?.code === "NOT_AUTHORIZED") reportSessionRejected();
    throw new OrderChatError(ack?.code || "UNKNOWN", `${event} refused`);
  }
  return ack;
}

/**
 * `GET /order-chats/:orderId/messages`: one page of `limit` messages, newest
 * first on the server (page 1 = the newest), and the room.
 */
export async function fetchOrderChatThread(
  orderId: string,
  limit: number,
  signal?: AbortSignal,
  page = 1,
): Promise<OrderChatThread> {
  try {
    const res = await apiClient.get(`/order-chats/${encodeURIComponent(orderId)}/messages`, {
      params: { page, limit, sortBy: "-createdAt" },
      signal,
    });
    return parseThread(res.data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toChatError(error);
  }
}

export type SendResult =
  /** Over the socket: only the id; the message itself arrives as an event. */
  | { via: "socket"; messageId: string | null }
  /** Over REST: the saved message. */
  | { via: "rest"; message: OrderChatMessage };

/**
 * Send one message (already checked by `checkOutgoingMessage`). `channel` is
 * always `CUSTOMER_RIDER`, sent explicitly so the call never depends on the
 * server's default.
 */
export async function sendOrderChatMessage(
  socket: Socket | null,
  orderId: string,
  message: string,
): Promise<SendResult> {
  if (socket?.connected) {
    const ack = await emitWithAck(socket, "send-order-message", {
      orderId,
      message,
      channel: CUSTOMER_RIDER,
    });
    return { via: "socket", messageId: ack.messageId ?? null };
  }
  try {
    const res = await apiClient.post(`/order-chats/${encodeURIComponent(orderId)}/messages`, {
      message,
      channel: CUSTOMER_RIDER,
    });
    return { via: "rest", message: res.data?.data as OrderChatMessage };
  } catch (error) {
    throw toChatError(error);
  }
}

/** Mark everything the rider sent as read. Returns how many changed. */
/**
 * One read request per order at a time. The panel (on open) and the socket
 * hook (on a rider message while visible) can both ask in the same moment;
 * the second caller shares the first one's request instead of sending another.
 */
const readsInFlight = new Map<string, Promise<number>>();

export function markOrderChatRead(socket: Socket | null, orderId: string): Promise<number> {
  const inFlight = readsInFlight.get(orderId);
  if (inFlight) return inFlight;
  const request = sendRead(socket, orderId).finally(() => readsInFlight.delete(orderId));
  readsInFlight.set(orderId, request);
  return request;
}

async function sendRead(socket: Socket | null, orderId: string): Promise<number> {
  if (socket?.connected) {
    const ack = await emitWithAck(socket, "mark-order-chat-read", {
      orderId,
      channel: CUSTOMER_RIDER,
    });
    return ack.modifiedCount ?? 0;
  }
  try {
    const res = await apiClient.patch(`/order-chats/${encodeURIComponent(orderId)}/read`, {
      channel: CUSTOMER_RIDER,
    });
    return Number(res.data?.data?.modifiedCount ?? 0);
  } catch (error) {
    throw toChatError(error);
  }
}
