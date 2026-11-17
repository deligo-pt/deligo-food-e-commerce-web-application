"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Bike, Loader2, MessagesSquare, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { useOrderChat } from "@/hooks/queries/useOrderChat";
import type { useOrderChatSocket } from "@/hooks/useOrderChatSocket";
import {
  canSend,
  chatErrorMessageKey,
  isMine,
  lockedMessageKey,
  type OrderChatError,
} from "@/lib/orderChat";
import { groupMessagesByDay, type SupportMessage } from "@/lib/support";
import { toTelHref } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import SupportMessagesSkeleton from "@/components/support/SupportMessagesSkeleton";
import RiderChatBubble, { type RiderChatBubbleMessage } from "./RiderChatBubble";
import RiderChatComposer from "./RiderChatComposer";

/** How often the open chat re-reads its thread while the socket is down. */
const OFFLINE_POLL_MS = 10_000;
/** How long the room may stay unjoined before the header says so. */
const OFFLINE_LABEL_DELAY_MS = 3_000;

export interface RiderChatRider {
  name: string;
  photo?: string | null;
  phone?: string | null;
}

interface RiderChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The order's Mongo `_id`. */
  orderId: string;
  rider: RiderChatRider;
  /** Where focus goes back on close (the button that opened it is not a Radix trigger). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** The room connection, owned by `RiderChatButton` so it outlives the panel. */
  live: ReturnType<typeof useOrderChatSocket>;
  pageVisible: boolean;
}

/**
 * The rider chat window (`plan.md` Phase 4): a side panel on desktop, full
 * screen below `md` — the same shell as the support chat, so customers meet
 * one chat design.
 *
 * Data comes from `useOrderChat` (history, pending sends, read state) and the
 * live events from `useOrderChatSocket` (join/leave, new messages, typing, ✓✓,
 * a new rider's room), which `RiderChatButton` runs and passes in as `live`.
 * Whether the box can send is the backend's call
 * (`room.isActive`); `order-chat:closed` locks it the moment it arrives.
 *
 * Reading is what marks the rider's messages read: on open, when the tab comes
 * back into view, and for each message that arrives while it is visible.
 */
export default function RiderChatPanel({ open, onOpenChange, orderId, rider, returnFocusRef, live, pageVisible }: RiderChatPanelProps) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);

  const onSendError = useCallback(
    (error: OrderChatError) => {
      const key = chatErrorMessageKey(error.code);
      if (key) toast.error(t(key));
    },
    [t],
  );

  // Without the room joined (socket down, reconnecting), re-read every 10 s.
  const chat = useOrderChat(orderId, { enabled: open, onSendError, pollMs: OFFLINE_POLL_MS, live: live.joined });
  const sendable = canSend(chat.room);

  // "Reconnecting…" once the room has been unjoined for a moment, not for the
  // blink of the first join.
  const offline = open && sendable && !live.joined;
  const [offlineShown, setOfflineShown] = useState(false);
  useEffect(() => {
    if (!offline) return;
    const timer = setTimeout(() => setOfflineShown(true), OFFLINE_LABEL_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setOfflineShown(false);
    };
  }, [offline]);
  const reconnecting = offline && offlineShown;
  const lockedKey = lockedMessageKey(chat.room);

  // Opening the chat, or coming back to the tab, reads what is there.
  const { markRead, unread } = chat;
  useEffect(() => {
    if (open && pageVisible && unread > 0) void markRead();
  }, [open, pageVisible, unread, markRead]);

  // One clock for the day labels ("Today", "Yesterday").
  const [now] = useState(() => new Date());

  const items: RiderChatBubbleMessage[] = useMemo(
    () => [
      ...chat.messages.map((m) => ({
        key: m._id,
        message: m.message,
        createdAt: m.createdAt,
        mine: isMine(m),
        attachments: m.attachments,
        isRead: m.isRead,
      })),
      ...chat.pending.map((p) => ({
        key: p.localId,
        message: p.message,
        createdAt: p.createdAt,
        mine: true,
        status: p.status,
      })),
    ],
    [chat.messages, chat.pending],
  );

  const days = useMemo(
    () => groupMessagesByDay(items as unknown as SupportMessage[], now, t, lang),
    [items, now, t, lang],
  );

  // Follow the bottom when a new message lands or "typing…" appears — not
  // when older messages are loaded above.
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const newestKey = items.at(-1)?.key ?? null;
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, newestKey, live.riderTyping]);

  const phoneHref = rider.phone ? toTelHref(rider.phone) : null;
  const initial = rider.name.trim().charAt(0).toUpperCase() || "•";

  const send = (text: string) => {
    live.stopTyping();
    void chat.send(text);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-card text-gray-900 outline-none duration-200 dark:text-neutral-100
            data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom
            data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom
            md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l md:border-gray-200 md:shadow-2xl dark:md:border-neutral-800
            md:data-open:slide-in-from-right md:data-closed:slide-out-to-right"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <span
              aria-hidden
              className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#008080] bg-[#e0f2f1] text-base font-bold text-[#008080] dark:bg-teal-950/30"
            >
              {rider.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rider.photo} alt="" className="h-full w-full object-cover" />
              ) : rider.name ? (
                initial
              ) : (
                <Bike className="h-5 w-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-bold text-foreground dark:text-neutral-50">
                {rider.name || t("yourRider")}
              </Dialog.Title>
              <Dialog.Description
                aria-live="polite"
                className={`truncate text-sm font-medium ${
                  live.riderTyping
                    ? "text-green-600 dark:text-green-400"
                    : reconnecting
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground dark:text-neutral-400"
                }`}
              >
                {live.riderTyping
                  ? t("riderTyping")
                  : reconnecting
                    ? t("riderChatReconnecting")
                    : sendable
                      ? t("yourRider")
                      : t("chatHistory")}
              </Dialog.Description>
            </div>

            {phoneHref && sendable && (
              <a
                href={phoneHref}
                aria-label={`${t("callRider")} (${rider.phone})`}
                className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#008080] text-white transition-colors hover:bg-[#006666] dark:bg-teal-600 dark:hover:bg-teal-700"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}

            <Dialog.Close
              aria-label={t("close")}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary/30 text-primary transition-colors hover:bg-primary/5 dark:border-pink-500/30 dark:text-pink-400 dark:hover:bg-pink-950/30"
            >
              <X className="h-4.5 w-4.5" />
            </Dialog.Close>
          </header>

          {chat.isLoading ? (
            <SupportMessagesSkeleton />
          ) : chat.error && items.length === 0 ? (
            <Centered>
              <p className="text-sm font-medium text-foreground dark:text-neutral-50">{t("somethingWentWrong")}</p>
              <Button type="button" size="sm" onClick={chat.refetch} className="mt-3 cursor-pointer font-semibold">
                {t("tryAgain")}
              </Button>
            </Centered>
          ) : items.length === 0 && !live.riderTyping ? (
            <Centered>
              <MessagesSquare className="h-10 w-10 text-primary dark:text-pink-400" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-foreground dark:text-neutral-50">
                {sendable ? t("riderChatEmptyTitle") : t("noMessagesYet")}
              </p>
              {sendable && (
                <p className="mt-1 max-w-[17rem] text-sm text-muted-foreground dark:text-neutral-400">
                  {t("riderChatEmptyHint")}
                </p>
              )}
            </Centered>
          ) : (
            <div
              role="log"
              aria-live="polite"
              aria-label={rider.name || t("yourRider")}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f8f9fa] px-4 py-4 dark:bg-neutral-950"
            >
              {chat.hasOlder && (
                <div className="mb-4 flex justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={chat.isLoadingOlder}
                    onClick={chat.loadOlder}
                    className="cursor-pointer gap-2 rounded-full font-semibold text-primary hover:bg-primary/5 hover:text-primary dark:text-pink-400 dark:hover:bg-pink-950/30"
                  >
                    {chat.isLoadingOlder && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {t("loadOlderMessages")}
                  </Button>
                </div>
              )}

              {days.map((day) => (
                <section key={day.key} className="mb-4 last:mb-0">
                  <div className="relative my-4 flex items-center justify-center">
                    <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-neutral-800" />
                    <span className="relative rounded-full border border-border bg-[#f8f9fa] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-neutral-950 dark:text-neutral-400">
                      {day.label}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {(day.messages as unknown as RiderChatBubbleMessage[]).map((item) => (
                      <RiderChatBubble
                        key={item.key}
                        item={item}
                        now={now}
                        t={t}
                        lang={lang}
                        onRetry={item.status === "failed" && sendable ? () => chat.retry(item.key) : undefined}
                        onDiscard={item.status === "failed" ? () => chat.discard(item.key) : undefined}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {live.riderTyping && (
                <div className="mt-3 flex items-start" aria-hidden>
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 rounded-full bg-gray-400 motion-safe:animate-bounce dark:bg-neutral-500"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          <RiderChatComposer
            t={t}
            enabled={sendable}
            lockedText={lockedKey ? t(lockedKey) : null}
            onTyping={live.onTyping}
            onSend={send}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#f8f9fa] px-6 text-center dark:bg-neutral-950">
      {children}
    </div>
  );
}
