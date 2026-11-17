"use client";

import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthed } from "@/hooks/useAuthed";
import { useOrderChat } from "@/hooks/queries/useOrderChat";
import { useOrderChatSocket } from "@/hooks/useOrderChatSocket";

/** While the socket is down, the unread count is re-read this often. */
const BADGE_POLL_MS = 30_000;

interface RiderChatUnreadPillProps {
  /** The order's Mongo `_id`; only passed for a delivery order with a rider on it. */
  orderId: string;
}

/**
 * "2 new messages" on an ongoing order's card in My Orders (`plan.md` Phase 5).
 *
 * Reads the same cached history as Track Order's chat button, so opening the
 * order shows the same count, and reading it there clears it here. Joins the
 * room without ever marking read (`visible: false`), so a rider message
 * raises it live while the list is open. Nothing at all when there are no
 * unread messages — including when the order has no chat room.
 */
export default function RiderChatUnreadPill({ orderId }: RiderChatUnreadPillProps) {
  const { t } = useTranslation();
  const authed = useAuthed();
  const chat = useOrderChat(orderId, { enabled: authed, pollMs: BADGE_POLL_MS });
  useOrderChatSocket(orderId, { active: authed && !!chat.room?.isActive, visible: false });

  if (chat.unread <= 0) return null;

  const text =
    chat.unread === 1
      ? t("riderChatNewMessageOne")
      : t("riderChatNewMessages").replace("{count}", chat.unread > 99 ? "99+" : String(chat.unread));
  return (
    <span
      role="status"
      className="flex h-5 items-center gap-1 whitespace-nowrap rounded-full bg-[#e0f2f1] px-2 font-semibold text-[#006666] dark:bg-teal-950/40 dark:text-teal-300"
    >
      <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />
      <MessageCircle size={11} aria-hidden />
      {text}
      <span className="sr-only"> · {t("chatWithRider")}</span>
    </span>
  );
}
