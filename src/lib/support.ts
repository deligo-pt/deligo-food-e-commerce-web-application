/**
 * The support-ticket model: everything the Help Center chat needs to know that
 * is a function of its inputs, and nothing that is a function of the network.
 *
 * No React, no `apiClient`. That is deliberate — the rules below are the ones
 * that fail silently and expensively (a whitespace-only message the server
 * happily accepts, a thread rendered newest-first, an option id shown to a human
 * being), and keeping them here is what lets `pnpm verify:support` assert them
 * with no token and no network.
 *
 * ## What the API does, since it shapes almost everything in this file
 *
 * Probed live on 2026-08-16. Five endpoints, four of them usable by a customer:
 * `POST /support/send-message`, `GET /support/tickets`,
 * `GET /support/tickets/:ticketId/messages`, `PATCH …/read`. The fifth,
 * `PATCH …/close`, is **403 for customers** — a customer can never close their
 * own ticket, so nothing here models closing one.
 *
 * The path param is the plain `ticketId` (`TIC-2608-00003`). The Postman
 * collection's `ROOM_TIC-…` form returns `404 TICKET_NOT_FOUND`, as does the
 * Mongo `_id`.
 *
 * ## The one constraint worth reading twice
 *
 * A customer has **exactly one open ticket**, and the two fields that classify
 * it are write-once. Measured:
 *
 * | transition | result |
 * |---|---|
 * | `category: GENERAL → ORDER_ISSUE` | re-filed |
 * | `ORDER_ISSUE → PAYMENT`/`TECHNICAL`/`GENERAL` | ignored |
 * | `referenceOrderId: null → an order` | linked |
 * | one order → a different order | ignored |
 *
 * So the ticket is permanently filed under the first non-default category and
 * the first order the customer ever picked, and — since they cannot close it —
 * they can never start a clean thread. That is why {@link buildTopicPrefill}
 * exists: the topic a customer chose travels in the **message text**, which is
 * always honoured, rather than in `category`, which usually is not.
 */

import { DATE_LOCALES } from "./dateFormat";

/* ────────────────────────────────────────────────────────────────────────────
 * The enums the API validates against
 *
 * Read out of its Zod errors rather than guessed, so a value that is not here
 * is a value the server would reject.
 * ──────────────────────────────────────────────────────────────────────────── */

export const SUPPORT_CATEGORIES = [
  "ORDER_ISSUE",
  "PAYMENT",
  "IVA_INVOICE",
  "TECHNICAL",
  "GENERAL",
] as const;

export const SUPPORT_MESSAGE_TYPES = [
  "TEXT",
  "IMAGE",
  "AUDIO",
  "LOCATION",
  "SYSTEM",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportMessageType = (typeof SUPPORT_MESSAGE_TYPES)[number];

/** What the server falls back to when `category` is omitted. */
export const DEFAULT_SUPPORT_CATEGORY: SupportCategory = "GENERAL";

/**
 * Ticket statuses that mean "this thread is over".
 *
 * A blacklist rather than a whitelist of `OPEN`, and the direction matters. If
 * the backend introduces, say, `IN_PROGRESS`, a whitelist would hide a live
 * ticket from the customer who is sitting in it — the worse of the two
 * failures. A blacklist would at worst keep polling a thread that has quietly
 * ended, which the next send reopens anyway. Same reasoning as the notification
 * badge's lookup table: do not assert about values the server has not shown us.
 */
const CLOSED_TICKET_STATUSES = new Set(["CLOSED", "RESOLVED"]);

/** `activeHandler` value that means an automated agent holds the thread. */
const AI_HANDLER = "AI";

/* ────────────────────────────────────────────────────────────────────────────
 * Shapes
 *
 * Declared here rather than in `src/types/` for the same reason
 * `notificationHeader.ts` declares its own: every field is optional and
 * defensively typed, because this file's job is to be the thing that survives
 * a payload changing shape.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SupportMessage {
  _id?: string | null;
  ticketId?: string | null;
  senderId?: string | null;
  senderRole?: string | null;
  message?: string | null;
  messageType?: string | null;
  attachments?: (string | null)[] | null;
  /** `{ [userId]: true }`. Only ever contains the sender so far — see `isRead`. */
  readBy?: Record<string, boolean> | null;
  createdAt?: string | null;
}

export interface SupportTicket {
  _id?: string | null;
  ticketId?: string | null;
  status?: string | null;
  category?: string | null;
  /** `"AI"` today; see {@link getHandlerIdentity}. */
  activeHandler?: string | null;
  assignedAdminId?: string | null;
  /** `{ ADMIN_GENERAL: 3, "C-EP25QIN7": 0 }` — keyed by recipient. */
  unreadCount?: Record<string, number> | null;
  /** Populated back as an object by `GET /support/tickets`, not a bare id. */
  referenceOrderId?: { _id?: string | null; orderId?: string | null } | null;
  lastMessage?: string | null;
  lastMessageSender?: string | null;
  lastMessageTime?: string | null;
  createdAt?: string | null;
}

/** A day's worth of messages, with the divider label already resolved. */
export interface SupportMessageDay {
  /** Stable `YYYY-MM-DD` in local time — safe as a React key. */
  key: string;
  /** "Today", "Yesterday", or a formatted date. */
  label: string;
  messages: SupportMessage[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sending
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The `message` string this input should send, or `null` when there is nothing
 * to send.
 *
 * `null` drives the send button's disabled state, so the two can never
 * disagree — the button is live exactly when there is something to say.
 *
 * The trim is not cosmetic. The API's only rule is `min 1`, and it does **not**
 * trim: a message of three spaces returns `201` and lands in the thread as an
 * empty grey bubble that a support agent has to guess at. The client is the
 * only place that can stop that. (An empty string, by contrast, the server does
 * reject — `"message must be at least 1 characters long."`)
 *
 * There is no maximum on the server side: 20,000 characters were accepted
 * verbatim. Any cap is a product decision made above this function.
 */
export function normalizeOutgoingMessage(
  raw: string | null | undefined,
): string | null {
  return raw?.trim() || null;
}

/**
 * The sentence a topic row drops into the composer, or `null` for none.
 *
 * The mobile app opens the chat with `Payment Question: Unrecognized Charge`
 * already typed and still editable, and that is not a nicety — per the header
 * note, `category` is ignored on every ticket after the first, so this sentence
 * is the only part of "which topic did they pick" that reliably reaches a human.
 *
 * Both halves arrive already resolved, so this function needs no `t` and no key
 * names: callers pass `t("supportPrefillPayment")` for a fixed topic and a bare
 * `#ORD-XXXX` for an order. Composing the two here rather than inside a
 * dictionary value is also forced by `t()` taking a single argument — there is
 * no interpolation to lean on.
 *
 * A missing half is dropped rather than rendered as a dangling separator, and a
 * dictionary that has lost both keys opens the composer empty instead of typing
 * `": "` at the customer.
 */
export function buildTopicPrefill(
  section: string | null | undefined,
  topic: string | null | undefined,
): string | null {
  const left = section?.trim() || "";
  const right = topic?.trim() || "";

  if (left && right) return `${left}: ${right}`;
  return left || right || null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Attachments
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What `POST /uploads` accepts, read from its own rejection.
 *
 * Sending anything else returns `400 UNSUPPORTED_FILE_TYPE` — "Only PNG, JPEG,
 * JPG, WEBP images and PDF files are allowed." The list is narrowed to images
 * here because the chat renders a thumbnail; PDF is a second render path and a
 * second `messageType` decision, deliberately left out (see the plan).
 *
 * Note this is stricter than `accept="image/*"`, which the profile-photo picker
 * uses and which happily offers HEIC and GIF — files the server then refuses.
 */
export const ACCEPTED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Client-side only. The server's own ceiling, if it has one, is unknown. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * Why this file cannot be sent, as a translation key — or `null` if it can.
 *
 * A key rather than a message because `t()` lives in the component; a boolean
 * because the two failures need different words, and "that didn't work" for a
 * 6 MB photo is the kind of dead end that ends in a support ticket about the
 * support form.
 */
export function getAttachmentError(file: File | null | undefined): string | null {
  if (!file) return null;

  if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type as never)) {
    return "attachmentTypeNotSupported";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return "attachmentTooLarge";

  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reading a thread
 * ──────────────────────────────────────────────────────────────────────────── */

/** Was this message written by the customer reading it? */
export function isOutgoing(
  message: SupportMessage | null | undefined,
): boolean {
  return message?.senderRole === "CUSTOMER";
}

/**
 * Has anyone other than the sender read this message?
 *
 * Today the answer is always no: `readBy` on an outgoing message has only ever
 * contained the sender's own id, because nothing has ever replied on the test
 * account. The tick in the UI therefore means **sent**, which is the only thing
 * currently true. This function exists so that the day a reply lands, the
 * stronger claim has one place to become true rather than being invented at a
 * call site.
 */
export function isReadByOthers(
  message: SupportMessage | null | undefined,
): boolean {
  const readBy = message?.readBy;
  if (!readBy) return false;

  return Object.entries(readBy).some(
    ([userId, read]) => read === true && userId !== message?.senderId,
  );
}

/**
 * The thread in reading order, oldest first.
 *
 * `GET …/messages` returns newest-first and paginates that way, so page 2 is
 * *older* than page 1. A plain `.reverse()` would be right for one page and
 * wrong for two concatenated, which is why this sorts by timestamp instead of
 * assuming the incoming order.
 *
 * Never mutates: the array it is handed is React Query's cached data.
 *
 * Entries with an unparseable `createdAt` sort last rather than first. That is
 * the useful direction — the realistic source of one is an optimistic message
 * still on its way out, and the bottom of the thread is where it belongs.
 */
export function toChronological(
  messages: readonly (SupportMessage | null | undefined)[] | null | undefined,
): SupportMessage[] {
  if (!Array.isArray(messages)) return [];

  const timestamp = (message: SupportMessage) => {
    const parsed = Date.parse(message.createdAt ?? "");
    return Number.isNaN(parsed) ? Infinity : parsed;
  };

  return messages
    .filter((message): message is SupportMessage => Boolean(message))
    .slice()
    .sort((a, b) => timestamp(a) - timestamp(b));
}

/**
 * The chronological thread cut into days, for the `TODAY` divider.
 *
 * Grouped by **local calendar day**, not by elapsed hours — a message sent at
 * 23:58 and one sent at 00:02 are two days apart to a reader, whatever the four
 * minutes between them say. Deliberately the *viewer's* timezone rather than
 * `pickupTime.ts`'s store timezone: a pickup slot is a promise about a place, a
 * chat message is a thing that happened to the person reading it.
 *
 * Assumes chronological input — pass it through {@link toChronological} first.
 */
export function groupMessagesByDay(
  messages: readonly SupportMessage[] | null | undefined,
  now: Date,
  t: (key: string) => string,
  lang: "en" | "pt" = "pt",
): SupportMessageDay[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const days: SupportMessageDay[] = [];

  for (const message of messages) {
    const at = new Date(message?.createdAt ?? "");
    if (Number.isNaN(at.getTime())) continue;

    const key = localDayKey(at);
    const last = days[days.length - 1];

    if (last && last.key === key) {
      last.messages.push(message);
      continue;
    }

    days.push({ key, label: dayLabel(at, now, t, lang), messages: [message] });
  }

  return days;
}

/**
 * The `5m • 12:17 PM` line inside a bubble.
 *
 * Two separate readings of one instant, which is why they are returned
 * together: `relative` answers "how long ago" at a glance and goes stale, while
 * `absolute` answers "when exactly" and never does. The app shows both.
 *
 * `relative` is the **compact** form — `5m`, not `5 mins ago`. That is a
 * different string from `NotificationsPage`'s `formatRelativeTime`, which is
 * the long form and stays as it is; a chat bubble has room for two or three
 * characters and a notification row has a line.
 *
 * `now` is a parameter rather than `new Date()` so a ticking clock re-renders
 * this honestly and a test can pin it.
 */
export function getMessageMeta(
  message: SupportMessage | null | undefined,
  now: Date,
  t: (key: string) => string,
  lang: "en" | "pt" = "pt",
): { relative: string; absolute: string } | null {
  const at = new Date(message?.createdAt ?? "");
  if (Number.isNaN(at.getTime())) return null;

  return {
    relative: compactAge(at, now, t, lang),
    absolute: formatTimeOfDay(at, lang),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Reading a ticket
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The ticket the chat should be showing, or `null` for a customer who has never
 * written in.
 *
 * There is no single-ticket endpoint — `GET /support/tickets/:id`,
 * `/support/ticket/:id` and `/support/my-tickets` all 404 — so the list is the
 * only place a ticket's `activeHandler`, `category` and unread count can come
 * from, and this is how the chat finds its own thread in it.
 *
 * "Newest" is by last activity rather than creation, so a long-running ticket
 * that someone replied to today outranks one opened yesterday and abandoned.
 */
export function getActiveTicket(
  tickets: readonly (SupportTicket | null | undefined)[] | null | undefined,
): SupportTicket | null {
  if (!Array.isArray(tickets)) return null;

  const activity = (ticket: SupportTicket) => {
    const parsed = Date.parse(ticket.lastMessageTime ?? ticket.createdAt ?? "");
    return Number.isNaN(parsed) ? -Infinity : parsed;
  };

  return (
    tickets
      .filter((ticket): ticket is SupportTicket => Boolean(ticket?.ticketId))
      .filter(
        (ticket) =>
          !CLOSED_TICKET_STATUSES.has((ticket.status ?? "").toUpperCase()),
      )
      .sort((a, b) => activity(b) - activity(a))[0] ?? null
  );
}

/**
 * How many messages in this ticket the customer has not read.
 *
 * `unreadCount` is keyed by recipient — `{ ADMIN_GENERAL: 3, "C-EP25QIN7": 0 }`
 * — so reading it needs the caller's own `userId`. Passing the wrong one, or
 * none, yields `0` rather than someone else's backlog, which is the failure
 * worth designing for: the admin key sits in the same object and would light up
 * a badge on every message the customer themselves just sent.
 */
export function getUnreadCount(
  ticket: SupportTicket | null | undefined,
  myUserId: string | null | undefined,
): number {
  if (!myUserId) return 0;

  const count = ticket?.unreadCount?.[myUserId];
  return typeof count === "number" && count > 0 ? count : 0;
}

/**
 * Who the chat header says you are talking to.
 *
 * The app shows "AI Agent" with an `A` avatar when an automated agent holds the
 * thread and "Support Team" with an `S` otherwise. `activeHandler` is the only
 * field that plausibly drives it, and `"AI"` is the only value observed — so
 * anything unrecognized falls back to the generic "Support Team" rather than
 * guessing. Degrading to a vaguer label is recoverable; naming the wrong
 * counterparty is not.
 *
 * The initial is derived from the resolved name rather than hardcoded, so a
 * translated header still gets its own first letter instead of an English one.
 */
export function getHandlerIdentity(
  ticket: SupportTicket | null | undefined,
  t: (key: string) => string,
): { name: string; initial: string } {
  const isAi = (ticket?.activeHandler ?? "").toUpperCase() === AI_HANDLER;
  const name = t(isAi ? "aiAgent" : "supportTeam").trim();

  // A dictionary that has lost the key would otherwise put the key's own first
  // letter in the avatar.
  if (!name) return { name: "", initial: isAi ? "A" : "S" };

  return { name, initial: name.charAt(0).toUpperCase() };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Internals
 * ──────────────────────────────────────────────────────────────────────────── */

/** Local `YYYY-MM-DD`. Built from the parts, since `toISOString` is UTC. */
function localDayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole calendar days from `date` to `now`, ignoring the time of day. */
function calendarDaysAgo(date: Date, now: Date): number {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(now) - startOf(date)) / 86_400_000);
}

function dayLabel(
  date: Date,
  now: Date,
  t: (key: string) => string,
  lang: "en" | "pt",
): string {
  const daysAgo = calendarDaysAgo(date, now);

  if (daysAgo === 0) return t("today");
  if (daysAgo === 1) return t("yesterday");

  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

/**
 * `Just now`, `5m`, `3h`, `2d`, or a date past a week.
 *
 * The unit suffixes go through `t` so a translator can change them, even though
 * `m`/`h`/`d` happen to read the same in both languages today. Needs the keys
 * `supportAgeMinute`, `supportAgeHour` and `supportAgeDay`.
 *
 * A negative age — a clock skewed against the server — clamps to "just now"
 * rather than rendering `-2m`.
 */
function compactAge(
  date: Date,
  now: Date,
  t: (key: string) => string,
  lang: "en" | "pt",
): string {
  const elapsedMs = now.getTime() - date.getTime();

  if (elapsedMs < 60_000) return t("justNow");

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}${t("supportAgeMinute")}`;

  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 24) return `${hours}${t("supportAgeHour")}`;

  const days = Math.floor(elapsedMs / 86_400_000);
  if (days < 7) return `${days}${t("supportAgeDay")}`;

  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * `12:17 PM` in English, `12:17` in Portuguese.
 *
 * The reference screenshot is 12-hour with a meridiem because the phone was in
 * English; `en-GB` and `pt-PT` are both 24-hour, so this will not be
 * pixel-identical to that screenshot for a Portuguese reader. That is the right
 * trade — the same one `formatDayShort` in `pickupTime.ts` already documents.
 * Forcing AM/PM onto the app's default language to match one screenshot would
 * be a locale bug dressed as fidelity.
 */
function formatTimeOfDay(date: Date, lang: "en" | "pt"): string {
  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
