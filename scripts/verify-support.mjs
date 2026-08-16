/**
 * Checks the Help Center's support model against the API it was built from.
 *
 *   pnpm verify:support
 *
 * No token, no network. `src/lib/support.ts`, `src/lib/supportTopics.ts` and the
 * Portugal half of `src/lib/phone.ts` hold every rule the chat depends on that
 * TypeScript cannot see, and this is what holds them still.
 *
 * ## Why these rules and not others
 *
 * Each section below exists because the failure it guards is **silent**. None of
 * them show up in `tsc`, `eslint` or the build, and most of them look fine on
 * screen right up until a real customer or a support agent reads the result:
 *
 * - A whitespace-only message is accepted by the API with a `201` and lands in
 *   the thread as an empty bubble somebody has to guess at.
 * - `GET …/messages` returns **newest-first**; render it as-received and the
 *   conversation runs backwards.
 * - `unreadCount` carries the admin's backlog in the same object as the
 *   customer's, so reading the wrong key shows a customer 16 unread messages
 *   they do not have.
 * - The prefilled sentence is the only part of "which topic did they pick" that
 *   survives, because `category` is honoured once per ticket and ignored after;
 *   an option id reaching it puts `UNRECOGNIZED_CHARGE` in front of a person.
 * - `PATCH /profile/send-otp` rejects `+351 920 136 680` for its **spaces**,
 *   with an error naming a format the customer appears to have used.
 * - A wrong OTP digit answers `401`, and a blanket status check reads that as an
 *   expired token — logging out a customer whose session was never in question.
 *
 * ## Why `phone.ts` is in a file called verify-support
 *
 * The Help Center's Call Us row is one of its two consumers, and the profile's
 * OTP flow — fixed in the same wave — is the other. A sixth verify script for
 * one exported function is worse than a named section in this one.
 *
 * Type stripping and the resolve hook work the same way as
 * `verify-cancel-reason.mjs`.
 */

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

const {
  buildTopicPrefill,
  getActiveTicket,
  getAttachmentError,
  getHandlerIdentity,
  getMessageMeta,
  groupMessagesByDay,
  getUnreadCount,
  isOutgoing,
  isReadByOthers,
  normalizeOutgoingMessage,
  toChronological,
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  SUPPORT_CATEGORIES,
  SUPPORT_MESSAGE_TYPES,
} = await import(join(here, "../src/lib/support.ts"));

const { PAYMENT_HELP_TOPICS } = await import(
  join(here, "../src/lib/supportTopics.ts")
);

const { normalizePortugueseNumber } = await import(
  join(here, "../src/lib/phone.ts")
);

const { isSessionEndedResponse } = await import(
  join(here, "../src/lib/authError.ts")
);

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail === undefined ? "" : `  → ${detail}`}`);
  }
}

const eq = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));

function section(title) {
  console.log(`\n${title}`);
}

/** English copy, from `en.ts` — the strings a customer actually sees and sends. */
const EN = {
  justNow: "Just now",
  today: "Today",
  yesterday: "Yesterday",
  supportAgeMinute: "m",
  supportAgeHour: "h",
  supportAgeDay: "d",
  aiAgent: "AI Agent",
  supportTeam: "Support Team",
  supportPrefillPayment: "Payment Question",
  supportPrefillOrderIssue: "Order Issue",
  refundStatus: "Refund Status",
  unrecognizedCharge: "Unrecognized Charge",
  paymentMethods: "Payment Methods",
  requestInvoice: "Request Invoice",
};
const t = (key) => EN[key] ?? key;

/**
 * Real messages from ticket `TIC-2608-00003`, as `GET …/messages` returns them
 * — newest first, every one `senderRole: "CUSTOMER"` because nothing has ever
 * replied on the test account.
 */
const THREAD = [
  { _id: "e", ticketId: "TIC-2608-00003", senderId: "C-EP25QIN7", senderRole: "CUSTOMER", message: "[ref probe 2 - ignore]", messageType: "TEXT", attachments: [], readBy: { "C-EP25QIN7": true }, createdAt: "2026-08-16T06:16:12.000Z" },
  { _id: "d", ticketId: "TIC-2608-00003", senderId: "C-EP25QIN7", senderRole: "CUSTOMER", message: "[attach probe - ignore]", messageType: "IMAGE", attachments: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"], readBy: { "C-EP25QIN7": true }, createdAt: "2026-08-16T06:16:04.000Z" },
  { _id: "c", ticketId: "TIC-2608-00003", senderId: "C-EP25QIN7", senderRole: "CUSTOMER", message: "[socket probe 1 - ignore]", messageType: "TEXT", attachments: [], readBy: { "C-EP25QIN7": true }, createdAt: "2026-08-16T06:11:48.904Z" },
  { _id: "b", ticketId: "TIC-2608-00003", senderId: "C-EP25QIN7", senderRole: "CUSTOMER", message: "Hi", messageType: "TEXT", attachments: [], readBy: { "C-EP25QIN7": true }, createdAt: "2026-08-16T05:58:14.996Z" },
  { _id: "a", ticketId: "TIC-2608-00003", senderId: "C-EP25QIN7", senderRole: "CUSTOMER", message: "Hello", messageType: "TEXT", attachments: [], readBy: { "C-EP25QIN7": true }, createdAt: "2026-08-16T05:57:56.421Z" },
];

/** The real ticket, as `GET /support/tickets` returns it. */
const TICKET = {
  _id: "6a815164693ff5a0b80338af",
  ticketId: "TIC-2608-00003",
  status: "OPEN",
  category: "ORDER_ISSUE",
  activeHandler: "AI",
  assignedAdminId: null,
  unreadCount: { ADMIN_GENERAL: 16, "C-EP25QIN7": 0 },
  referenceOrderId: { _id: "6a8087da693ff5a0b802c1f8", orderId: "ORD-NHRJYEAID3" },
  lastMessageTime: "2026-08-16T06:16:12.000Z",
  createdAt: "2026-08-16T05:57:56.393Z",
};

const NOW = new Date("2026-08-16T07:30:00.000Z");

section("The enums, read out of the API's own Zod errors");
{
  eq("categories", [...SUPPORT_CATEGORIES],
    ["ORDER_ISSUE", "PAYMENT", "IVA_INVOICE", "TECHNICAL", "GENERAL"]);
  eq("message types", [...SUPPORT_MESSAGE_TYPES],
    ["TEXT", "IMAGE", "AUDIO", "LOCATION", "SYSTEM"]);
}

section("🔴 What may be sent — the API accepts things it should not");
{
  // `message` is validated as `min 1` and nothing else. Three spaces return a
  // 201 and drop an empty bubble into the thread; the client is the only place
  // that can stop that.
  eq("whitespace-only → null", normalizeOutgoingMessage("   \n\t "), null);
  eq("empty → null", normalizeOutgoingMessage(""), null);
  eq("undefined → null", normalizeOutgoingMessage(undefined), null);
  eq("trims", normalizeOutgoingMessage("  hi  "), "hi");
  eq("accented PT survives", normalizeOutgoingMessage(" não gostei "), "não gostei");

  // No server-side maximum: 20,000 characters were accepted verbatim.
  check("a 20,000-char message passes through unchanged",
    normalizeOutgoingMessage("x".repeat(20000)).length === 20000);
}

section("🔴 The prefilled sentence — the only topic signal that survives");
{
  // `category` is honoured once per ticket and ignored on every message after,
  // so this string is what actually tells a support agent what was picked.
  eq("reproduces the one prefill a screenshot confirms",
    buildTopicPrefill(t("supportPrefillPayment"), t("unrecognizedCharge")),
    "Payment Question: Unrecognized Charge");
  eq("the order form",
    buildTopicPrefill(t("supportPrefillOrderIssue"), "#ORD-NHRJYEAID3"),
    "Order Issue: #ORD-NHRJYEAID3");

  // A dangling ": " is a sentence that reads as a bug.
  eq("missing topic drops the separator",
    buildTopicPrefill("Payment Question", ""), "Payment Question");
  eq("missing section drops the separator",
    buildTopicPrefill("  ", "Refund Status"), "Refund Status");
  eq("both missing → null, so the composer opens empty",
    buildTopicPrefill("  ", null), null);

  // Key-leak is impossible by construction here — the signature takes resolved
  // strings — so the guard belongs at the call sites, which must pass `t(key)`.
  // This asserts the ids themselves never appear in a built prefill.
  const built = PAYMENT_HELP_TOPICS.map((topic) =>
    buildTopicPrefill(t("supportPrefillPayment"), t(topic.labelKey)));
  check("no option id reaches the sent string",
    built.every((line) => !PAYMENT_HELP_TOPICS.some((o) => line.includes(o.id))),
    JSON.stringify(built));
  check("every topic label resolves to real copy, not its key",
    PAYMENT_HELP_TOPICS.every((o) => t(o.labelKey) !== o.labelKey),
    PAYMENT_HELP_TOPICS.filter((o) => t(o.labelKey) === o.labelKey).map((o) => o.labelKey).join(", "));
}

section("The payment topics, in the app's order");
{
  eq("ids match `5.jpeg`", PAYMENT_HELP_TOPICS.map((o) => o.id),
    ["REFUND_STATUS", "UNRECOGNIZED_CHARGE", "PAYMENT_METHODS", "REQUEST_INVOICE"]);
  check("four distinct ids",
    new Set(PAYMENT_HELP_TOPICS.map((o) => o.id)).size === 4);
  check("four distinct label keys",
    new Set(PAYMENT_HELP_TOPICS.map((o) => o.labelKey)).size === 4);
}

section("🔴 Reading order — the API returns newest-first");
{
  eq("reversed into reading order",
    toChronological(THREAD).map((m) => m._id), ["a", "b", "c", "d", "e"]);
  // The array handed in is React Query's cached data.
  eq("input not mutated", THREAD[0]._id, "e");
  eq("null-safe", toChronological(null), []);
  eq("undefined-safe", toChronological(undefined), []);

  // Sorted, not reversed — so concatenating a second (older) page stays right.
  eq("a timestamp-less optimistic message sorts last",
    toChronological([{ _id: "pending", createdAt: null }, ...THREAD]).map((m) => m._id),
    ["a", "b", "c", "d", "e", "pending"]);
}

section("Day dividers — calendar days, not elapsed hours");
{
  const days = groupMessagesByDay(toChronological(THREAD), NOW, t, "en");
  eq("the real thread is one day", days.length, 1);
  eq("labelled Today", days[0].label, "Today");
  eq("no message dropped", days[0].messages.length, THREAD.length);

  eq("three days label correctly", groupMessagesByDay(
    [{ createdAt: "2026-08-14T10:00:00.000Z" },
     { createdAt: "2026-08-15T10:00:00.000Z" },
     { createdAt: "2026-08-16T05:00:00.000Z" }], NOW, t, "en").map((d) => d.label),
    ["14 Aug", "Yesterday", "Today"]);

  // 23:58 and 00:02 are two days apart to a reader, whatever the four minutes say.
  const midnight = groupMessagesByDay(
    [{ createdAt: new Date(2026, 7, 15, 23, 58).toISOString() },
     { createdAt: new Date(2026, 7, 16, 0, 2).toISOString() }],
    new Date(2026, 7, 16, 7, 30), t, "en");
  eq("four minutes across midnight are two groups", midnight.length, 2);
  eq("…labelled Yesterday then Today", midnight.map((d) => d.label),
    ["Yesterday", "Today"]);

  eq("empty thread → no dividers", groupMessagesByDay([], NOW, t, "en"), []);
}

section("Bubble meta — the compact `5m • 12:17` line");
{
  const rel = (iso) => getMessageMeta({ createdAt: iso }, NOW, t, "en").relative;
  eq("under a minute", rel("2026-08-16T07:29:30.000Z"), "Just now");
  eq("minutes", rel("2026-08-16T07:25:00.000Z"), "5m");
  eq("hours", rel("2026-08-16T04:30:00.000Z"), "3h");
  eq("days", rel("2026-08-14T07:30:00.000Z"), "2d");

  // A clock skewed against the server must not render "-2m".
  eq("clock skew clamps to just now", rel("2026-08-16T07:32:00.000Z"), "Just now");
  eq("unparseable date → null",
    getMessageMeta({ createdAt: "nonsense" }, NOW, t, "en"), null);
}

section("Which side of the panel, and what the tick may claim");
{
  eq("customer message is outgoing", isOutgoing(THREAD[0]), true);
  eq("an admin reply is incoming", isOutgoing({ senderRole: "ADMIN" }), false);
  eq("no message → not outgoing", isOutgoing(null), false);

  // `readBy` on an outgoing message has only ever held the sender's own id, so
  // the tick means *sent*. This is where the stronger claim becomes true.
  eq("self-read is not read by anyone else", isReadByOthers(THREAD[0]), false);
  eq("another party's read counts", isReadByOthers(
    { senderId: "C-EP25QIN7", readBy: { "C-EP25QIN7": true, "SA-1": true } }), true);
  eq("no readBy → false", isReadByOthers({ senderId: "C-EP25QIN7" }), false);
}

section("Finding the thread — there is no single-ticket endpoint");
{
  eq("the open ticket", getActiveTicket([TICKET])?.ticketId, "TIC-2608-00003");
  eq("a closed one is not active", getActiveTicket([{ ticketId: "x", status: "CLOSED" }]), null);
  eq("nor a resolved one", getActiveTicket([{ ticketId: "x", status: "RESOLVED" }]), null);

  // A blacklist, not a whitelist of OPEN: an unknown status must not hide a live
  // ticket from the customer sitting in it.
  eq("an unknown status is still shown",
    getActiveTicket([{ ticketId: "y", status: "IN_PROGRESS" }])?.ticketId, "y");

  eq("newest by last activity", getActiveTicket([
    { ticketId: "old", status: "OPEN", lastMessageTime: "2026-08-01T00:00:00.000Z" },
    { ticketId: "new", status: "OPEN", lastMessageTime: "2026-08-16T00:00:00.000Z" },
  ])?.ticketId, "new");
  eq("no tickets → null", getActiveTicket([]), null);
  eq("not an array → null", getActiveTicket(undefined), null);
}

section("🔴 The unread badge must never read the admin's key");
{
  // `unreadCount` holds both in one object: { ADMIN_GENERAL: 16, C-EP25QIN7: 0 }.
  eq("the customer's own count", getUnreadCount(TICKET, "C-EP25QIN7"), 0);
  eq("no userId → 0, never a fallthrough", getUnreadCount(TICKET, undefined), 0);
  eq("a real count is reported",
    getUnreadCount({ unreadCount: { "C-EP25QIN7": 3 } }, "C-EP25QIN7"), 3);
  eq("no ticket → 0", getUnreadCount(null, "C-EP25QIN7"), 0);
}

section("Who the header says you are talking to");
{
  eq("AI handler", getHandlerIdentity(TICKET, t), { name: "AI Agent", initial: "A" });
  eq("a human", getHandlerIdentity({ activeHandler: "ADMIN" }, t),
    { name: "Support Team", initial: "S" });

  // An unrecognized value degrades to the generic label rather than naming the
  // wrong counterparty.
  eq("unknown handler", getHandlerIdentity({ activeHandler: "WHATEVER" }, t),
    { name: "Support Team", initial: "S" });
  eq("no ticket", getHandlerIdentity(null, t), { name: "Support Team", initial: "S" });
  eq("null handler", getHandlerIdentity({ activeHandler: null }, t),
    { name: "Support Team", initial: "S" });
}

section("Attachments — refused before the round trip");
{
  const file = (type, size) => ({ type, size, name: "x" });
  eq("the accept attribute is the server's own allowlist",
    [...ACCEPTED_ATTACHMENT_TYPES], ["image/png", "image/jpeg", "image/webp"]);

  eq("png", getAttachmentError(file("image/png", 1000)), null);
  eq("jpeg", getAttachmentError(file("image/jpeg", 1000)), null);
  eq("webp", getAttachmentError(file("image/webp", 1000)), null);

  eq("gif refused", getAttachmentError(file("image/gif", 1000)), "attachmentTypeNotSupported");
  eq("heic refused", getAttachmentError(file("image/heic", 1000)), "attachmentTypeNotSupported");
  eq("pdf refused here", getAttachmentError(file("application/pdf", 1000)), "attachmentTypeNotSupported");

  eq("exactly the cap is fine", getAttachmentError(file("image/png", MAX_ATTACHMENT_BYTES)), null);
  eq("one byte over", getAttachmentError(file("image/png", MAX_ATTACHMENT_BYTES + 1)), "attachmentTooLarge");

  // The two failures need different words — "that didn't work" for a 6 MB photo
  // is the dead end that produces a ticket about the support form.
  eq("type is checked before size",
    getAttachmentError(file("image/gif", 50 * 1024 * 1024)), "attachmentTypeNotSupported");
  eq("no file → no error", getAttachmentError(null), null);
}

section("🔴 Contact numbers — the API rejects the spacing Portugal writes");
{
  // Measured: `+351920136680`, `351920136680` and `920136680` are all accepted,
  // but `+351 920 136 680` is refused — by an error naming a format the customer
  // appears to have used.
  eq("already canonical", normalizePortugueseNumber("+351920136680"), "+351920136680");
  eq("no plus", normalizePortugueseNumber("351920136680"), "+351920136680");
  eq("bare nine digits", normalizePortugueseNumber("920136680"), "+351920136680");

  eq("Portuguese spacing repaired", normalizePortugueseNumber("+351 920 136 680"), "+351920136680");
  eq("spacing without the code", normalizePortugueseNumber("920 136 680"), "+351920136680");
  eq("dashes", normalizePortugueseNumber("920-136-680"), "+351920136680");
  eq("00351 prefix", normalizePortugueseNumber("00351920136680"), "+351920136680");
  eq("brackets and dots", normalizePortugueseNumber("(+351) 920.136.680"), "+351920136680");

  eq("eight digits", normalizePortugueseNumber("92013668"), null);
  eq("ten digits", normalizePortugueseNumber("9201366800"), null);
  eq("a UK number", normalizePortugueseNumber("+447700900123"), null);
  eq("letters", normalizePortugueseNumber("abcdefghi"), null);
  eq("empty", normalizePortugueseNumber(""), null);
  eq("undefined", normalizePortugueseNumber(undefined), null);
}

section("🔴 A wrong OTP digit must not end the session");
{
  // The API uses 401 for two different things, and the interceptor's job is to
  // act on only one of them. Keys measured against the live API.
  eq("no Authorization header logs out",
    isSessionEndedResponse(401, "AUTHENTICATION_REQUIRED"), true);
  eq("a malformed or expired token logs out",
    isSessionEndedResponse(401, "NOT_AUTHORIZED"), true);

  // The bug this exists for: four wrong digits used to destroy a live session.
  eq("a wrong OTP does NOT log out",
    isSessionEndedResponse(401, "INVALID_OTP_CODE"), false);
  eq("an expired OTP does NOT log out",
    isSessionEndedResponse(401, "OTP_EXPIRED_OR_INVALID_REQUEST_NEW"), false);

  // A denylist: a credential check the backend invents tomorrow must not log
  // people out just for being unrecognized.
  eq("an unknown credential 401 does NOT log out",
    isSessionEndedResponse(401, "SOME_FUTURE_CREDENTIAL_CHECK"), false);

  // A 401 with no key is the unexplained case — stranding someone in an app
  // where every request silently fails is worse than one trip to /login.
  eq("a 401 with no errorKey logs out", isSessionEndedResponse(401, null), true);
  eq("…and with an empty one", isSessionEndedResponse(401, ""), true);

  eq("403 never logs out", isSessionEndedResponse(403, "COMMON_ACCESS_DENIED"), false);
  eq("404 never logs out", isSessionEndedResponse(404, "TICKET_NOT_FOUND"), false);
  eq("a 400 validation error never logs out", isSessionEndedResponse(400, null), false);
  eq("no status at all (network failure)", isSessionEndedResponse(undefined, null), false);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
