"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthed } from "@/hooks/useAuthed";
import { useOrderChat } from "@/hooks/queries/useOrderChat";
import { useOrderChatSocket } from "@/hooks/useOrderChatSocket";
import { pageIsVisible, subscribeVisibility } from "@/lib/pageVisibility";
import { chatButtonState } from "@/lib/orderChat";
import RiderChatPanelLazy from "./RiderChatPanelLazy";
import type { RiderChatRider } from "./RiderChatPanel";

/** While the socket is down, the unread count is re-read this often. */
const BADGE_POLL_MS = 30_000;

interface RiderChatButtonProps {
  /** The order's Mongo `_id`. */
  orderId: string | null | undefined;
  rider: RiderChatRider;
  className?: string;
}

/**
 * "Chat with rider" on the Track Order page's rider card (`plan.md` Phase 4).
 *
 * Shown from the backend's room, never from a guess about the order status
 * (`chatButtonState`): an active room → "Chat with rider"; a room locked
 * because the order finished, with messages → "Chat history"; no room (no
 * rider yet, a pickup order, an order from before the feature) or a rider
 * change → nothing.
 *
 * The badge counts the rider's unread messages from the same cached history
 * the panel reads. Phase 5: the button — not the panel — joins the chat room,
 * for as long as the chat is open on the backend or the panel is showing, so a
 * rider message raises the badge live with the panel closed. One join per
 * page; the panel gets the live state (`live`) from here. Marking read happens
 * only while the panel is open and the tab is visible.
 */
export default function RiderChatButton({ orderId, rider, className = "" }: RiderChatButtonProps) {
  const { t } = useTranslation();
  const authed = useAuthed();
  const chat = useOrderChat(orderId, { enabled: authed && !!orderId, pollMs: BADGE_POLL_MS });
  const state = chatButtonState({ room: chat.room, total: chat.total });
  // Mounted on the first tap and kept, so the close animation can play.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const pageVisible = useSyncExternalStore(subscribeVisibility, pageIsVisible, () => true);
  const live = useOrderChatSocket(orderId, {
    active: authed && (state === "open" || open),
    visible: open && pageVisible,
  });

  if (!orderId) return null;
  // A rider change hides the button, but an open panel stays (it says why)
  // until the customer closes it.
  const showButton = state !== "hidden";

  const label = state === "open" ? t("chatWithRider") : t("chatHistory");
  const unread = chat.unread;

  return (
    <>
      {showButton && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
          aria-label={unread > 0 ? `${label}, ${unread === 1 ? t("riderChatUnreadOne") : t("riderChatUnread").replace("{count}", String(unread))}` : label}
          className={`focus-ring relative flex items-center justify-center gap-2 rounded-full border-2 border-[#008080] px-6 py-3 font-extrabold text-[#008080] transition-all hover:bg-[#e0f2f1] active:scale-95 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950/30 ${className}`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {label}
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-white shadow-md"
            >
              {unread > 99 ? "99+" : unread}
            </span>
        )}
      </button>
      )}
      {mounted && <RiderChatPanelLazy open={open} onOpenChange={setOpen} orderId={orderId} rider={rider} returnFocusRef={buttonRef} live={live} pageVisible={pageVisible} />}
    </>
  );
}
