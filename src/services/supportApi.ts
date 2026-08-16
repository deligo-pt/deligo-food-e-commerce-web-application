import { apiClient } from "@/lib/apiClient";
import type {
  SupportCategory,
  SupportMessage,
  SupportMessageType,
} from "@/lib/support";

/**
 * The two writes the support chat makes.
 *
 * Plain async functions rather than `useMutation`, matching `orderApi.ts` and
 * `addressApi.ts` — this app keeps reads in `hooks/queries/` and writes in
 * `services/`, and callers own their own pending state.
 */

export interface SendSupportMessageInput {
  /** Already trimmed — see `normalizeOutgoingMessage`. */
  message: string;
  category?: SupportCategory;
  messageType?: SupportMessageType;
  /** Absolute URLs, typically from `POST /uploads`. */
  attachments?: string[];
  /**
   * The order's Mongo **`_id`**, not its `ORD-…` id — the only route in this app
   * that wants the `_id`. Sending `ORD-NHRJYEAID3` returns
   * `400 "referenceOrderId has an invalid format."`
   */
  referenceOrderId?: string;
}

/**
 * `POST /support/send-message` — say something to support.
 *
 * There is no "create ticket" endpoint. This one call opens the customer's
 * ticket if they have none and appends to it if they do, which is why the
 * response is the thing that tells the client which `ticketId` it is now in —
 * for a first-time customer it is the *only* way to find out, since the ticket
 * list was empty a moment ago.
 *
 * ## `category` and `referenceOrderId` are best-effort
 *
 * Both are honoured only on a ticket that has never been classified. Measured:
 * `GENERAL → ORDER_ISSUE` re-files the ticket, but `ORDER_ISSUE → PAYMENT` is
 * ignored, and a second `referenceOrderId` never replaces the first. So sending
 * them is right and costs nothing, but a caller must not treat them as the
 * record of what the customer asked about — that lives in the message text.
 * See `buildTopicPrefill`.
 *
 * ## What the server will accept that the client should not send
 *
 * `message` is validated as `min 1` and nothing else: it is **not trimmed**, so
 * three spaces return `201` and land in the thread as an empty bubble a support
 * agent has to guess at, and there is **no maximum** (20,000 characters were
 * accepted verbatim). `normalizeOutgoingMessage` is the guard.
 *
 * Returns the created message document.
 */
export async function sendSupportMessage(
  input: SendSupportMessageInput,
): Promise<SupportMessage> {
  const res = await apiClient.post("/support/send-message", input);
  return (res.data?.data ?? null) as SupportMessage;
}

/**
 * `PATCH /support/tickets/:ticketId/read` — clear the customer's own unread
 * count on a ticket.
 *
 * Takes the human-readable `ticketId` (`TIC-2608-00003`). The Postman
 * collection's `ROOM_TIC-…` form and the Mongo `_id` both return
 * `404 TICKET_NOT_FOUND`.
 *
 * Zeroes `unreadCount[myUserId]` and leaves the admin-side counters alone.
 *
 * Note there is deliberately no `closeSupportTicket` here: `PATCH …/close` is
 * **403 for customers**, so a customer can never close their own ticket and
 * nothing in this app should offer to.
 */
export async function markSupportTicketRead(ticketId: string): Promise<void> {
  await apiClient.patch(`/support/tickets/${ticketId}/read`);
}

/**
 * `POST /uploads` — put a file somewhere `send-message` can point at.
 *
 * The same endpoint the profile-photo picker uses. Multipart, field name
 * `files`, and it accepts several at once; this sends one and returns its URL.
 *
 * The response is `{ success, data: [url, …] }` with a Cloudinary URL, whose
 * host is already in `next.config`'s `remotePatterns` — so the thumbnail
 * renders through `next/image` without a config change.
 *
 * Rejects rather than returning an empty string when the shape is not what it
 * should be. A caller that took `""` on trust would send a message with an
 * empty attachment, which is worse than not sending it: the customer would be
 * told their photo went.
 *
 * The server enforces its own allowlist (`400 UNSUPPORTED_FILE_TYPE` — PNG,
 * JPEG, JPG, WEBP, PDF). `getAttachmentError` checks first so the common
 * mistakes never become a round trip.
 */
export async function uploadSupportAttachment(file: File): Promise<string> {
  const body = new FormData();
  body.append("files", file);

  const res = await apiClient.post("/uploads", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const url = res.data?.data?.[0];
  if (typeof url !== "string" || !url) {
    throw new Error("Upload response carried no URL");
  }

  return url;
}
