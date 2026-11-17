/**
 * Rider chat (customer ↔ rider), the rules (`plan.md` Phase 2). Pure — no
 * React, no network, no `@/` imports — so `pnpm verify:order-chat` runs it in
 * plain Node.
 *
 * Source: "Order Chat (Customer–Rider and Vendor–Rider): Frontend Guide", and
 * the test server as measured on 16 Nov 2026.
 *
 * - A customer only ever has the `CUSTOMER_RIDER` channel. Asking for
 *   `VENDOR_RIDER` answers `403 ORDER_CHAT_NOT_PARTICIPANT` (measured), so the
 *   app never sends a channel other than this one.
 * - Socket events name the order by its Mongo `_id`, never `ORD-…`, so
 *   everything here is keyed by `_id`. REST takes either.
 * - Which side a message is on comes from `senderRole`, never `senderId`
 *   (a profile id, not the login `userId`).
 */

export type ChatChannel = "CUSTOMER_RIDER" | "VENDOR_RIDER";
export const CUSTOMER_RIDER: ChatChannel = "CUSTOMER_RIDER";

export type ChatSenderRole = "CUSTOMER" | "VENDOR" | "DELIVERY_PARTNER";
/** The role this app speaks as. */
export const MY_ROLE: ChatSenderRole = "CUSTOMER";

export type ChatClosedReason =
  | "ORDER_DELIVERED"
  | "ORDER_PICKED_UP_BY_CUSTOMER"
  | "ORDER_CANCELED"
  | "ORDER_REJECTED"
  | "ORDER_NO_SHOW"
  | "RIDER_UNASSIGNED"
  | "RIDER_REASSIGNED";

export interface OrderChatRoom {
  _id: string;
  channel?: ChatChannel;
  isActive: boolean;
  closedAt?: string | null;
  closedReason?: ChatClosedReason | string | null;
}

export interface OrderChatMessage {
  _id: string;
  roomId: string;
  orderId: string;
  /** Missing on messages from before channels existed: `CUSTOMER_RIDER`. */
  channel?: ChatChannel;
  senderId?: string;
  senderRole: ChatSenderRole | string;
  message: string;
  attachments?: string[];
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * A message the customer sent that the server has not confirmed yet. Lives only
 * in the hook's local state, never in the query cache, so a refetch can't wipe
 * it. Dropped as soon as the server's copy (`serverId`) is in the thread.
 */
export interface PendingChatMessage {
  localId: string;
  /** The server's `_id` once the socket ack named it. */
  serverId?: string;
  roomId: string | null;
  message: string;
  createdAt: string;
  status: "sending" | "failed";
  /** Why it failed: an `errorKey`, `VALIDATION_ERROR`, `TIMEOUT`, … */
  errorCode?: string;
}

/** What one `GET /order-chats/:orderId/messages` says, newest messages last. */
export interface OrderChatThread {
  room: OrderChatRoom | null;
  messages: OrderChatMessage[];
  total: number;
}

/** First window and each "load older" step (the API allows 1–100). */
export const ORDER_CHAT_PAGE_SIZE = 30;
export const ORDER_CHAT_MAX_LIMIT = 100;
/** The server's limit on one message, after trimming. */
export const ORDER_CHAT_MESSAGE_MAX = 2000;

/**
 * Order statuses with a live delivery, where a rider chat can be open. The
 * button still follows the room (`chatButtonState`); this is for callers that
 * need to know whether to look for one at all.
 */
export const CHAT_ACTIVE_STATUSES = [
  "ASSIGNED",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "ON_THE_WAY",
] as const;

export function isChatActiveStatus(status: string | null | undefined): boolean {
  return !!status && (CHAT_ACTIVE_STATUSES as readonly string[]).includes(status);
}

// ─── Messages ────────────────────────────────────────────────────────────────

/** A message's channel; older messages have none and are customer–rider. */
export function channelOf(message: { channel?: string | null } | null | undefined): string {
  return message?.channel || CUSTOMER_RIDER;
}

/** Whether this app should show the message: our channel only. */
export function isOurChannel(message: { channel?: string | null } | null | undefined): boolean {
  return channelOf(message) === CUSTOMER_RIDER;
}

export function isMine(message: { senderRole?: string | null } | null | undefined): boolean {
  return message?.senderRole === MY_ROLE;
}

function timeOf(message: { createdAt?: string | null }): number {
  const parsed = Date.parse(message.createdAt ?? "");
  return Number.isNaN(parsed) ? Infinity : parsed;
}

/**
 * Oldest first, as a chat reads. The API sends newest first. Ties keep their
 * order; an unparseable date sorts last rather than throwing.
 */
export function toChronological(
  messages: readonly (OrderChatMessage | null | undefined)[] | null | undefined,
): OrderChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m): m is OrderChatMessage => !!m && typeof m._id === "string")
    .map((m, i) => ({ m, i }))
    .sort((a, b) => timeOf(a.m) - timeOf(b.m) || a.i - b.i)
    .map(({ m }) => m);
}

/**
 * `existing` plus `incoming`, each `_id` once, oldest first, our channel only.
 * A message seen twice (REST answer and socket event, or a refetch) keeps the
 * newer copy, so a read receipt that arrived in between is not lost.
 */
export function mergeMessages(
  existing: readonly OrderChatMessage[] | null | undefined,
  incoming: readonly (OrderChatMessage | null | undefined)[] | null | undefined,
): OrderChatMessage[] {
  const byId = new Map<string, OrderChatMessage>();
  for (const m of existing ?? []) if (m?._id) byId.set(m._id, m);
  for (const m of incoming ?? []) {
    if (!m?._id || !isOurChannel(m)) continue;
    const prev = byId.get(m._id);
    byId.set(m._id, prev ? { ...prev, ...m, isRead: prev.isRead || m.isRead } : m);
  }
  return toChronological([...byId.values()]);
}

/** Pending messages whose server copy has not arrived yet. */
export function unconfirmedPending(
  pending: readonly PendingChatMessage[],
  messages: readonly OrderChatMessage[],
): PendingChatMessage[] {
  const known = new Set(messages.map((m) => m._id));
  return pending.filter((p) => !p.serverId || !known.has(p.serverId));
}

/** Messages from the rider this customer has not read yet. */
export function countUnread(messages: readonly OrderChatMessage[] | null | undefined): number {
  return (messages ?? []).filter((m) => isOurChannel(m) && !isMine(m) && !m.isRead).length;
}

/** The rider read everything: my messages in that room become read (✓✓). */
export function markMineRead(
  messages: readonly OrderChatMessage[],
  roomId: string,
): OrderChatMessage[] {
  return messages.map((m) =>
    m.roomId === roomId && isMine(m) && !m.isRead ? { ...m, isRead: true } : m,
  );
}

/** I read everything: the rider's messages become read. */
export function markTheirsRead(messages: readonly OrderChatMessage[]): OrderChatMessage[] {
  return messages.map((m) => (!isMine(m) && !m.isRead ? { ...m, isRead: true } : m));
}

export type OutgoingCheck =
  | { ok: true; message: string }
  | { ok: false; reason: "empty" | "tooLong" };

/**
 * What would be sent: trimmed, 1–2000 characters (the server's rule). Checked
 * here so a bad message never leaves, and the composer can say why.
 */
export function checkOutgoingMessage(text: string | null | undefined): OutgoingCheck {
  const message = (text ?? "").trim();
  if (!message) return { ok: false, reason: "empty" };
  if (message.length > ORDER_CHAT_MESSAGE_MAX) return { ok: false, reason: "tooLong" };
  return { ok: true, message };
}

// ─── The response ────────────────────────────────────────────────────────────

/**
 * The history response's `{ success, meta, data: { room, messages } }` as a
 * thread. Anything malformed reads as "no room, no messages" rather than
 * throwing: the chat is an extra on the order page and must never break it.
 */
export function parseThread(body: unknown): OrderChatThread {
  const b = (body && typeof body === "object" ? body : {}) as {
    meta?: { total?: unknown };
    data?: { room?: unknown; messages?: unknown };
  };
  const rawRoom = b.data?.room as Partial<OrderChatRoom> | null | undefined;
  const room: OrderChatRoom | null =
    rawRoom && typeof rawRoom === "object" && typeof rawRoom._id === "string"
      ? {
          _id: rawRoom._id,
          channel: rawRoom.channel,
          isActive: rawRoom.isActive === true,
          closedAt: rawRoom.closedAt ?? null,
          closedReason: rawRoom.closedReason ?? null,
        }
      : null;
  const list = Array.isArray(b.data?.messages) ? (b.data!.messages as OrderChatMessage[]) : [];
  const messages = toChronological(list.filter(isOurChannel));
  const total = typeof b.meta?.total === "number" ? b.meta.total : messages.length;
  return { room, messages, total };
}

// ─── State ───────────────────────────────────────────────────────────────────

export type ClosedKind = "finished" | "riderChanged";

/** Why a room is locked, as the customer is told it. */
export function closedReasonKind(reason: string | null | undefined): ClosedKind | null {
  if (!reason) return null;
  if (reason === "RIDER_REASSIGNED" || reason === "RIDER_UNASSIGNED") return "riderChanged";
  return "finished";
}

export type ChatButtonState = "hidden" | "open" | "history";

/**
 * The "Chat with rider" button, decided by the backend's room (guide §4: never
 * lock or unlock from a guess about the order status).
 *
 * - An active room → open.
 * - A room locked because the order ended → "Chat history", if there is any.
 * - A room locked because the rider changed → hidden; a new room (and an
 *   `order-chat:activated`) comes with the next rider.
 * - No room → hidden: no rider yet, a pickup order, or an order assigned
 *   before the feature went live (its sends answer `ORDER_CHAT_ROOM_INACTIVE`).
 */
export function chatButtonState(
  thread: Pick<OrderChatThread, "room" | "total"> | null | undefined,
): ChatButtonState {
  const room = thread?.room;
  if (!room) return "hidden";
  if (room.isActive) return "open";
  if (closedReasonKind(room.closedReason) === "riderChanged") return "hidden";
  return (thread?.total ?? 0) > 0 ? "history" : "hidden";
}

/** Whether the composer can send. */
export function canSend(room: OrderChatRoom | null | undefined): boolean {
  return !!room?.isActive;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * What the chat does about a refusal, by `errorKey` (REST) or `code` (socket).
 * Never by `message` — the socket's is English only.
 *
 * - `lock`: the order finished; disable the input, keep the history.
 * - `refetch`: the room changed under us (rider reassigned); reload order and history.
 * - `hide`: there is no chat for this order (yet).
 * - `leave`: not our chat (any more).
 * - `notFound`: unknown order.
 * - `signOut`: the session is gone.
 * - `invalid`: the message itself was refused (empty, too long, bad field).
 * - `retry`: anything else (timeout, network, server error): offer a retry.
 */
export type ChatErrorAction =
  | "lock"
  | "refetch"
  | "hide"
  | "leave"
  | "notFound"
  | "signOut"
  | "invalid"
  | "retry";

export function chatErrorAction(code: string | null | undefined): ChatErrorAction {
  switch (code) {
    case "ORDER_CHAT_CLOSED":
      return "lock";
    case "ORDER_CHAT_ROOM_INACTIVE":
      return "refetch";
    case "ORDER_CHAT_NO_RIDER_ASSIGNED":
    case "ORDER_CHAT_NOT_AVAILABLE_YET":
      return "hide";
    case "ORDER_CHAT_NOT_PARTICIPANT":
      return "leave";
    case "NOT_FOUND_MESSAGE":
      return "notFound";
    case "NOT_AUTHORIZED":
      return "signOut";
    case "VALIDATION_ERROR":
      return "invalid";
    default:
      return "retry";
  }
}

/** A chat request the server (or the socket) refused, with its code. */
export class OrderChatError extends Error {
  readonly code: string;
  readonly status: number | null;
  constructor(code: string, message?: string, status: number | null = null) {
    super(message || code);
    this.name = "OrderChatError";
    this.code = code;
    this.status = status;
  }
  get action(): ChatErrorAction {
    return chatErrorAction(this.code);
  }
}

// ─── Socket events (Phase 3) ─────────────────────────────────────────────────

/** Fields every `order-chat:*` server event carries. `orderId` is the Mongo `_id`. */
export interface ChatEventBase {
  orderId: string;
  channel?: ChatChannel | string;
  roomId?: string;
}
export interface ChatNewMessageEvent extends ChatEventBase {
  message: OrderChatMessage;
}
export interface ChatReadEvent extends ChatEventBase {
  readerRole: string;
  readCount?: number;
}
export interface ChatTypingEvent extends ChatEventBase {
  role: string;
  isTyping: boolean;
}
export interface ChatActivatedEvent extends ChatEventBase {
  isActive: true;
  deliveryPartnerId?: string;
}
export interface ChatClosedEvent extends ChatEventBase {
  isActive: false;
  closedAt?: string | null;
  closedReason?: string | null;
}

/**
 * Whether a socket event belongs to this order's customer–rider thread: the
 * same `_id` and our channel (a missing `channel` counts as ours, like old
 * messages). The rider's vendor thread never reaches a customer, but the
 * check costs nothing.
 */
export function isEventForThread(
  event: ChatEventBase | null | undefined,
  orderId: string | null | undefined,
): boolean {
  return !!event && !!orderId && event.orderId === orderId && channelOf(event) === CUSTOMER_RIDER;
}

/** "Typing…" from someone other than me. */
export function isOtherSideTyping(event: Pick<ChatTypingEvent, "role" | "isTyping">): boolean {
  return event.role !== MY_ROLE && event.isTyping === true;
}

/** How long a "typing…" lasts without a `false` (guide: about 5 s). */
export const TYPING_SHOW_MS = 5_000;
/** Silence after which I send `isTyping: false` (guide: about 3 s). */
export const TYPING_IDLE_MS = 3_000;

// ─── Copy (Phase 4) ──────────────────────────────────────────────────────────

/**
 * The translation key to tell the customer why a send was refused, or null
 * when there is nothing to say (a dead session goes through sign-out).
 */
export function chatErrorMessageKey(code: string | null | undefined): string | null {
  switch (chatErrorAction(code)) {
    case "lock":
      return "riderChatClosedFinished";
    case "refetch":
      return "riderChatErrorRoomChanged";
    case "hide":
      return "riderChatErrorUnavailable";
    case "leave":
      return "riderChatErrorNotParticipant";
    case "notFound":
      return "riderChatErrorNotFound";
    case "signOut":
      return null;
    default:
      return "messageSendFailed";
  }
}

/**
 * Why the composer is locked, as a translation key: the order finished, the
 * rider changed, or there is no chat for this order (yet). Null when it can send.
 */
export function lockedMessageKey(room: OrderChatRoom | null | undefined): string | null {
  if (room?.isActive) return null;
  if (!room) return "riderChatErrorUnavailable";
  return closedReasonKind(room.closedReason) === "riderChanged"
    ? "riderChatClosedRiderChanged"
    : "riderChatClosedFinished";
}
