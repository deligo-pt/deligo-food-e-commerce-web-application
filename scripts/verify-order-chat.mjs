// `pnpm verify:order-chat` — rider chat (customer ↔ rider), `plan.md` Phase 2.
// Runs `src/lib/orderChat.ts` with no browser and checks the request layer is
// wired the way the guide and the test server (16 Nov 2026) require.
import { readFileSync } from "node:fs";
const chat = await import("../src/lib/orderChat.ts");
const {
  channelOf, isOurChannel, isMine, toChronological, mergeMessages, unconfirmedPending,
  countUnread, markMineRead, markTheirsRead, checkOutgoingMessage, parseThread,
  closedReasonKind, chatButtonState, canSend, chatErrorAction, OrderChatError,
  isChatActiveStatus, ORDER_CHAT_MESSAGE_MAX, isEventForThread, isOtherSideTyping,
  TYPING_SHOW_MS, TYPING_IDLE_MS, chatErrorMessageKey, lockedMessageKey,
} = chat;

let pass = 0, fail = 0;
const check = (name, ok) => { if (ok) pass++; else fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`); };

const msg = (id, role, at, extra = {}) => ({
  _id: id, roomId: "R1", orderId: "O1", channel: "CUSTOMER_RIDER", senderRole: role,
  message: `m${id}`, isRead: false, createdAt: `2026-11-16T10:00:${String(at).padStart(2, "0")}.000Z`, ...extra,
});

console.log("Channel and side");
check("a message with no channel is customer–rider (older messages)", channelOf({}) === "CUSTOMER_RIDER" && isOurChannel({ channel: undefined }));
check("🔴 a VENDOR_RIDER message is never ours", !isOurChannel({ channel: "VENDOR_RIDER" }));
check("mine is decided by senderRole CUSTOMER", isMine({ senderRole: "CUSTOMER" }) && !isMine({ senderRole: "DELIVERY_PARTNER" }));
check("a VENDOR sender is not mine", !isMine({ senderRole: "VENDOR" }));

console.log("\nOrdering and de-duplication");
const newestFirst = [msg("c", "CUSTOMER", 3), msg("b", "DELIVERY_PARTNER", 2), msg("a", "CUSTOMER", 1)];
check("the API's newest-first list reads oldest first", toChronological(newestFirst).map((m) => m._id).join("") === "abc");
check("same timestamp keeps the order it came in", toChronological([msg("x", "CUSTOMER", 5), msg("y", "CUSTOMER", 5)]).map((m) => m._id).join("") === "xy");
check("a bad date sorts last instead of throwing", toChronological([msg("z", "CUSTOMER", 1, { createdAt: "nope" }), msg("a", "CUSTOMER", 1)])[1]._id === "z");
check("nulls and id-less entries are dropped", toChronological([null, undefined, { foo: 1 }, msg("a", "CUSTOMER", 1)]).length === 1);
const merged = mergeMessages([msg("a", "CUSTOMER", 1), msg("b", "DELIVERY_PARTNER", 2)], [msg("b", "DELIVERY_PARTNER", 2), msg("c", "CUSTOMER", 3)]);
check("🔴 the same _id from REST and socket shows once", merged.length === 3 && merged.map((m) => m._id).join("") === "abc");
check("a read receipt is not lost when an older copy arrives", mergeMessages([msg("a", "CUSTOMER", 1, { isRead: true })], [msg("a", "CUSTOMER", 1)])[0].isRead === true);
check("🔴 merging drops another channel's messages", mergeMessages([], [msg("v", "VENDOR", 1, { channel: "VENDOR_RIDER" })]).length === 0);
const pend = [{ localId: "l1", serverId: "b", status: "sending" }, { localId: "l2", serverId: "q", status: "sending" }, { localId: "l3", status: "failed" }];
check("a pending message goes once its server copy is in the thread", unconfirmedPending(pend, merged).map((p) => p.localId).join(",") === "l2,l3");

console.log("\nUnread and read receipts");
const thread = [msg("a", "CUSTOMER", 1), msg("b", "DELIVERY_PARTNER", 2), msg("c", "DELIVERY_PARTNER", 3, { isRead: true }), msg("d", "DELIVERY_PARTNER", 4)];
check("unread counts only the rider's unread messages", countUnread(thread) === 2);
check("my own unread messages are not 'unread' for me", countUnread([msg("a", "CUSTOMER", 1)]) === 0);
check("unread ignores another channel", countUnread([msg("v", "DELIVERY_PARTNER", 1, { channel: "VENDOR_RIDER" })]) === 0);
check("I read: the rider's messages become read", countUnread(markTheirsRead(thread)) === 0);
const afterRider = markMineRead(thread, "R1");
check("the rider read: my messages in that room get ✓✓", afterRider[0].isRead === true && afterRider[1].isRead === false);
check("a read receipt for another room changes nothing", markMineRead(thread, "R2")[0].isRead === false);

console.log("\nWhat may be sent (server: trimmed, 1–2000)");
check("blank is refused", checkOutgoingMessage("   \n ").ok === false && checkOutgoingMessage("  ").reason === "empty");
check("null is refused", checkOutgoingMessage(null).ok === false);
check("text is trimmed", checkOutgoingMessage("  hi there \n").message === "hi there");
check("exactly 2000 characters is allowed", checkOutgoingMessage("x".repeat(ORDER_CHAT_MESSAGE_MAX)).ok === true);
check("2001 characters is refused as too long", checkOutgoingMessage("x".repeat(2001)).reason === "tooLong");
check("2000 + surrounding spaces is allowed (trimmed first)", checkOutgoingMessage(`  ${"x".repeat(2000)}  `).ok === true);

console.log("\nReading the history response");
const live = { success: true, meta: { page: 1, limit: 30, total: 0, totalPage: 0 }, data: { room: null, messages: [] } };
const p0 = parseThread(live);
check("🔴 measured on ORD-5KRN1L5D6B: no room, no messages", p0.room === null && p0.messages.length === 0 && p0.total === 0);
const p1 = parseThread({ meta: { total: 42 }, data: { room: { _id: "R1", channel: "CUSTOMER_RIDER", isActive: true, closedAt: null, closedReason: null }, messages: newestFirst } });
check("an active room is read, messages oldest first, total from meta", p1.room?.isActive === true && p1.messages[0]._id === "a" && p1.total === 42);
check("a locked room keeps its reason", parseThread({ data: { room: { _id: "R1", isActive: false, closedReason: "ORDER_DELIVERED", closedAt: "x" } } }).room?.closedReason === "ORDER_DELIVERED");
check("isActive must be literally true", parseThread({ data: { room: { _id: "R1", isActive: "yes" } } }).room?.isActive === false);
check("garbage reads as no chat instead of throwing", parseThread(null).room === null && parseThread("x").messages.length === 0 && parseThread({ data: { messages: "nope" } }).total === 0);

console.log("\nThe button follows the backend's room");
check("no room → hidden (no rider yet / pickup / pre-feature order)", chatButtonState({ room: null, total: 0 }) === "hidden" && chatButtonState(undefined) === "hidden");
check("active room → open", chatButtonState({ room: { _id: "R", isActive: true }, total: 0 }) === "open");
check("finished order with messages → history", chatButtonState({ room: { _id: "R", isActive: false, closedReason: "ORDER_DELIVERED" }, total: 3 }) === "history");
check("finished order with no messages → hidden (nothing to read)", chatButtonState({ room: { _id: "R", isActive: false, closedReason: "ORDER_CANCELED" }, total: 0 }) === "hidden");
check("🔴 rider changed → hidden until the new rider's room opens", chatButtonState({ room: { _id: "R", isActive: false, closedReason: "RIDER_REASSIGNED" }, total: 5 }) === "hidden" && chatButtonState({ room: { _id: "R", isActive: false, closedReason: "RIDER_UNASSIGNED" }, total: 5 }) === "hidden");
check("only an active room can send", canSend({ isActive: true }) && !canSend({ isActive: false }) && !canSend(null));
for (const r of ["ORDER_DELIVERED", "ORDER_PICKED_UP_BY_CUSTOMER", "ORDER_CANCELED", "ORDER_REJECTED", "ORDER_NO_SHOW"]) check(`${r} → "order finished"`, closedReasonKind(r) === "finished");
check("RIDER_REASSIGNED / RIDER_UNASSIGNED → \"rider changed\"", closedReasonKind("RIDER_REASSIGNED") === "riderChanged" && closedReasonKind("RIDER_UNASSIGNED") === "riderChanged");
check("no reason → none", closedReasonKind(null) === null);
check("active delivery statuses", ["ASSIGNED", "READY_FOR_PICKUP", "PICKED_UP", "ON_THE_WAY"].every(isChatActiveStatus) && !isChatActiveStatus("AWAITING_PARTNER") && !isChatActiveStatus("DELIVERED") && !isChatActiveStatus(null));

console.log("\nErrors are decided by code, never by message");
const expect = {
  ORDER_CHAT_CLOSED: "lock", ORDER_CHAT_ROOM_INACTIVE: "refetch", ORDER_CHAT_NO_RIDER_ASSIGNED: "hide",
  ORDER_CHAT_NOT_AVAILABLE_YET: "hide", ORDER_CHAT_NOT_PARTICIPANT: "leave", NOT_FOUND_MESSAGE: "notFound",
  NOT_AUTHORIZED: "signOut", VALIDATION_ERROR: "invalid", TIMEOUT: "retry", INTERNAL_ERROR: "retry", HTTP_500: "retry",
};
for (const [code, action] of Object.entries(expect)) check(`${code} → ${action}`, chatErrorAction(code) === action);
const e = new OrderChatError("ORDER_CHAT_CLOSED", "closed", 403);
check("OrderChatError carries code, status and action", e instanceof Error && e.code === "ORDER_CHAT_CLOSED" && e.status === 403 && e.action === "lock");

console.log("\nThe request layer");
const api = readFileSync(new URL("../src/services/orderChatApi.ts", import.meta.url), "utf8");
const hook = readFileSync(new URL("../src/hooks/queries/useOrderChat.ts", import.meta.url), "utf8");
check("🔴 the app never asks for VENDOR_RIDER", !/VENDOR_RIDER/.test(api) && !/VENDOR_RIDER/.test(hook));
check("every send and read names the channel explicitly", (api.match(/channel: CUSTOMER_RIDER/g) || []).length >= 4);
check("sends use the socket when connected (send-order-message)", /socket\?\.connected[\s\S]*?"send-order-message"/.test(api));
check("…and REST otherwise (POST /order-chats/:id/messages)", /apiClient\.post\(`\/order-chats\/\$\{encodeURIComponent\(orderId\)\}\/messages`/.test(api));
check("mark-read: socket, else PATCH /read", /"mark-order-chat-read"/.test(api) && /apiClient\.patch\(`\/order-chats\/\$\{encodeURIComponent\(orderId\)\}\/read`/.test(api));
check("socket calls time out instead of hanging", /socket\.timeout\(ACK_TIMEOUT_MS\)\.emitWithAck/.test(api));
check("history asks for the documented params only (page, limit, sortBy)", /params: \{ page, limit, sortBy: "-createdAt" \}/.test(api));
check("REST validation without errorKey becomes VALIDATION_ERROR", /status === 400\) return new OrderChatError\("VALIDATION_ERROR"/.test(api));
check("the cache is keyed by the order, not by language", /thread: \(orderId: string\) => \["orderChat", "thread", orderId\]/.test(hook));
check("a message for another room is not mixed into this one", /first\.room\._id !== message\.roomId\) return data/.test(hook));

console.log("\nLive events (Phase 3)");
check("an event for this order and channel is ours", isEventForThread({ orderId: "O1", channel: "CUSTOMER_RIDER" }, "O1"));
check("an event with no channel counts as ours", isEventForThread({ orderId: "O1" }, "O1"));
check("🔴 another order's event is ignored", !isEventForThread({ orderId: "O2", channel: "CUSTOMER_RIDER" }, "O1"));
check("🔴 a VENDOR_RIDER event is ignored", !isEventForThread({ orderId: "O1", channel: "VENDOR_RIDER" }, "O1"));
check("🔴 an event by ORD-… id never matches (events carry the _id)", !isEventForThread({ orderId: "ORD-5KRN1L5D6B" }, "6af953e62ac111d796185eb8"));
check("no order / no event → ignored", !isEventForThread(null, "O1") && !isEventForThread({ orderId: "O1" }, null));
check("the rider typing shows", isOtherSideTyping({ role: "DELIVERY_PARTNER", isTyping: true }));
check("my own typing never shows", !isOtherSideTyping({ role: "CUSTOMER", isTyping: true }));
check("isTyping false hides it", !isOtherSideTyping({ role: "DELIVERY_PARTNER", isTyping: false }));
check("typing timings follow the guide (show 5 s, idle 3 s)", TYPING_SHOW_MS === 5000 && TYPING_IDLE_MS === 3000);

const sock = readFileSync(new URL("../src/hooks/useOrderChatSocket.ts", import.meta.url), "utf8");
const prov = readFileSync(new URL("../src/providers/SocketProvider.tsx", import.meta.url), "utf8");
check("joins with the channel, and leaves on close", /"join-order-chat", payload/.test(sock) && /"leave-order-chat", payload/.test(sock) && /const payload = \{ orderId, channel: CUSTOMER_RIDER \}/.test(sock));
check("🔴 re-joins and reloads after a reconnect", /const onConnect = \(\) => \{[\s\S]*?join\(\);[\s\S]*?refetch\(\);/.test(sock) && /socket\.on\("connect", onConnect\)/.test(sock));
check("re-joins and reloads on order-chat:activated", /const onActivated[\s\S]*?join\(\);[\s\S]*?refetch\(\);/.test(sock));
check("new-message, typing, read are filtered by order + channel", (sock.match(/isEventForThread\(event, orderId\)/g) || []).length >= 4);
check("a rider message on a visible chat is marked read", /if \(visibleRef\.current\) markReadNow\(\)/.test(sock));
check("🔴 typing is sent once per burst, not per key", /if \(!iAmTyping\.current\) \{[\s\S]*?isTyping: true/.test(sock));
check("every listener is removed on close", ["connect", "disconnect", "order-chat:new-message", "order-chat:typing", "order-chat:read", "order-chat:activated"].every((e) => sock.includes(`socket.off("${e}"`)));
check("activated / closed are handled app-wide, with no chat open", /socket\.on\("order-chat:activated", onActivated\)/.test(prov) && /socket\.on\("order-chat:closed", onClosed\)/.test(prov));
check("🔴 closed locks the cached room at once", /applyRoomClosed\(queryClient, event\.orderId, event\)/.test(prov));
check("a socket send that never echoes falls back to the history", /SOCKET_ECHO_GRACE_MS/.test(hook) && /threadHasMessage\(queryClient, orderId, messageId\)/.test(hook));

console.log("\nPhase 4 — chat UI");
check("error code → message: closed → 'finished'", chatErrorMessageKey("ORDER_CHAT_CLOSED") === "riderChatClosedFinished");
check("error code → message: room inactive → 'updated, try again'", chatErrorMessageKey("ORDER_CHAT_ROOM_INACTIVE") === "riderChatErrorRoomChanged");
check("error code → message: no rider → 'not available'", chatErrorMessageKey("ORDER_CHAT_NO_RIDER_ASSIGNED") === "riderChatErrorUnavailable");
check("error code → message: dead session says nothing (sign-out handles it)", chatErrorMessageKey("NOT_AUTHORIZED") === null);
check("error code → message: unknown → generic 'not sent'", chatErrorMessageKey("WHATEVER") === "messageSendFailed");
check("locked banner: active room → none", lockedMessageKey({ _id: "r", isActive: true }) === null);
check("locked banner: delivered → 'finished'", lockedMessageKey({ _id: "r", isActive: false, closedReason: "ORDER_DELIVERED" }) === "riderChatClosedFinished");
check("locked banner: reassigned → 'rider changed'", lockedMessageKey({ _id: "r", isActive: false, closedReason: "RIDER_REASSIGNED" }) === "riderChatClosedRiderChanged");
check("locked banner: no room → 'not available'", lockedMessageKey(null) === "riderChatErrorUnavailable");
const ui = (f) => readFileSync(new URL(`../src/components/orders/RiderChat/${f}`, import.meta.url), "utf8");
const btn = ui("RiderChatButton.tsx"), panel = ui("RiderChatPanel.tsx"), comp = ui("RiderChatComposer.tsx"), lazy = ui("RiderChatPanelLazy.tsx");
const track = readFileSync(new URL("../src/components/orders/TrackOrder/TrackOrder.tsx", import.meta.url), "utf8");
check("button follows the backend room (chatButtonState), not the order status", /chatButtonState\(\{ room: chat\.room, total: chat\.total \}\)/.test(btn));
check("🔴 an open panel survives the button hiding (rider change)", /\{showButton && \(/.test(btn) && /\{mounted && <RiderChatPanelLazy/.test(btn));
check("panel is lazy-loaded (own chunk)", /dynamic\(\(\) => import\("\.\/RiderChatPanel"\), \{ ssr: false \}\)/.test(lazy));
check("button sits in the rider card on Track Order", /<RiderChatButton\s+orderId=\{order\._id\}/.test(track));
check("🔴 focus goes back to the button on close", /onCloseAutoFocus/.test(panel) && /returnFocusRef=\{buttonRef\}/.test(btn));
check("send box is locked by room.isActive (canSend)", /const sendable = canSend\(chat\.room\)/.test(panel) && /enabled=\{sendable\}/.test(panel));
check("Enter sends, Shift+Enter breaks, IME-safe", /event\.key === "Enter" && !event\.shiftKey && !event\.nativeEvent\.isComposing/.test(comp));
check("message rules checked before sending (checkOutgoingMessage)", /checkOutgoingMessage\(value\)/.test(comp));
check("🔴 one mark-read request per order at a time", /readsInFlight/.test(api));
for (const lang of ["en", "pt"]) {
  const dict = readFileSync(new URL(`../src/assets/translations/${lang}.ts`, import.meta.url), "utf8");
  const keys = ["chatWithRider", "chatHistory", "riderTyping", "riderChatClosedFinished", "riderChatClosedRiderChanged", "riderChatEmptyTitle", "riderChatEmptyHint", "riderChatNotSent", "riderChatDiscard", "riderChatRead", "riderChatSent", "riderChatSending", "riderChatTooLong", "riderChatErrorRoomChanged", "riderChatErrorUnavailable", "riderChatErrorNotParticipant", "riderChatErrorNotFound", "riderChatUnread"];
  check(`${lang}: all ${keys.length} rider chat labels exist`, keys.every((k) => new RegExp(`^  ${k}: "`, "m").test(dict)));
}

console.log("\nPhase 5 — unread outside the panel");
const pill = ui("RiderChatUnreadPill.tsx");
const card = readFileSync(new URL("../src/components/orders/OrderCard.tsx", import.meta.url), "utf8");
const ordersPage = readFileSync(new URL("../src/components/orders/OrdersPage.tsx", import.meta.url), "utf8");
check("🔴 the button (not the panel) joins the room, so the badge is live with the panel closed", /useOrderChatSocket\(orderId, \{\s*active: authed && \(state === "open" \|\| open\)/.test(btn) && !/useOrderChatSocket\(/.test(panel));
check("🔴 read only while the panel is open and the tab visible", /visible: open && pageVisible/.test(btn));
check("the panel gets the live state from the button", /live=\{live\}/.test(btn) && /live: ReturnType<typeof useOrderChatSocket>/.test(panel));
check("🔴 My Orders never marks read", /visible: false/.test(pill) && !/markRead/.test(pill));
check("My Orders joins only an active room", /active: authed && !!chat\.room\?\.isActive/.test(pill));
check("🔴 only a delivery order with a rider in a live status asks for chat history", /!isPickup && order\.deliveryPartnerId && isChatActiveStatus\(order\.orderStatus\)/.test(ordersPage));
check("the pill sits on the order card, not on finished orders", /riderChatOrderId && !isFinishedCardStatus\(status\)/.test(card));
for (const lang of ["en", "pt"]) {
  const dict = readFileSync(new URL(`../src/assets/translations/${lang}.ts`, import.meta.url), "utf8");
  check(`${lang}: singular + plural unread wording`, ["riderChatNewMessages", "riderChatNewMessageOne", "riderChatUnreadOne"].every((k) => new RegExp(`^  ${k}: "`, "m").test(dict)));
}

console.log("\nPhase 6 — hardening");
const socketLib = readFileSync(new URL("../src/lib/socket.ts", import.meta.url), "utf8");
const hook6 = readFileSync(new URL("../src/hooks/queries/useOrderChat.ts", import.meta.url), "utf8");
const sock6 = readFileSync(new URL("../src/hooks/useOrderChatSocket.ts", import.meta.url), "utf8");
check("🔴 socket down → the open chat re-reads every 10 s, only for an active room", /OFFLINE_POLL_MS = 10_000/.test(panel) && /pollMs: OFFLINE_POLL_MS, live: live\.joined/.test(panel) && /pollMs && !live && latestRoom\(q\.state\.data\)\?\.isActive \? pollMs : false/.test(hook6));
check("badge and pill fall back to a 30 s re-read while the socket is down", [btn, pill].every((f) => /BADGE_POLL_MS = 30_000/.test(f) && /pollMs: BADGE_POLL_MS/.test(f)));
check("'Reconnecting…' only after the room was unjoined for a moment", /OFFLINE_LABEL_DELAY_MS = 3_000/.test(panel) && /t\("riderChatReconnecting"\)/.test(panel));
check("sending falls back to REST when the socket is not connected", /if \(socket\?\.connected\)/.test(api) && /apiClient\.post\(`\/order-chats\//.test(api));
check("🔴 an ack saying NOT_AUTHORIZED signs out like a refused connect", /ack\?\.code === "NOT_AUTHORIZED"\) reportSessionRejected\(\)/.test(api) && /export function reportSessionRejected/.test(socketLib));
check("🔴 my read in another tab clears this tab's unread", /event\.readerRole === MY_ROLE\) \{\s*updateThreadMessages\(queryClient, orderId, markTheirsRead\)/.test(sock6));
check("order-chat:closed clears 'typing…'", /socket\.on\("order-chat:closed", onClosed\)/.test(sock6) && /socket\.off\("order-chat:closed", onClosed\)/.test(sock6));
check("🔴 a send refused as closed locks the box before the refetch", /chatError\.action === "lock"\) applyRoomClosed\(queryClient, orderId, \{\}\)/.test(hook6));
for (const lang of ["en", "pt"]) {
  const dict = readFileSync(new URL(`../src/assets/translations/${lang}.ts`, import.meta.url), "utf8");
  check(`${lang}: 'Reconnecting…' label`, /^  riderChatReconnecting: "/m.test(dict));
}

console.log("\nTrack Order rider card");
check("🔴 the chat opening or closing re-reads the order at once (timeline + card move with the chat)", /socket\.on\("order-chat:closed", onChatChanged\)/.test(track) && /fetchNowRef\.current\?\.\(\)/.test(track));
check("call button: phone icon, one line, number on the card", /<Phone className="h-4 w-4" aria-hidden \/>/.test(track) && /whitespace-nowrap rounded-full bg-\[#008080\]/.test(track) && /tabular-nums/.test(track));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
