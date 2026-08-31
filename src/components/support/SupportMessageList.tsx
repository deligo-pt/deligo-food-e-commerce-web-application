"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessagesSquare } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { useProfile } from "@/hooks/queries/useProfile";
import {
  SUPPORT_MESSAGE_PAGE_SIZE,
  useSupportMessages,
} from "@/hooks/queries/useSupport";
import { groupMessagesByDay, type SupportMessage } from "@/lib/support";
import SupportMessageBubble from "./SupportMessageBubble";
import SupportMessagesSkeleton from "./SupportMessagesSkeleton";
import { Button } from "@/components/ui/button";

interface SupportMessageListProps {
  /** `TIC-…`, or null for a customer who has never written in. */
  ticketId: string | null;
  /** Pause the poll while the panel is closed. */
  enabled: boolean;
  /** Letter for the incoming avatar, from `getHandlerIdentity`. */
  handlerInitial: string;
  /** Sent by this client, not yet returned by the server. */
  pending?: SupportMessage[];
}

interface ProfileName {
  name?: { firstName?: string | null } | null;
}

/**
 * The thread.
 *
 * Owns its own scrolling, its own window size, and the clock every bubble ages
 * against. The dialog above it stays a shell.
 */
export default function SupportMessageList({
  ticketId,
  enabled,
  handlerInitial,
  pending,
}: SupportMessageListProps) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);

  const [limit, setLimit] = useState(SUPPORT_MESSAGE_PAGE_SIZE);

  const {
    data,
    isPending,
    isError,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useSupportMessages(ticketId, { enabled, limit });

  // Already cached app-wide (the Navbar mounts it when logged in), so this is a
  // cache read rather than a second request.
  const { data: profile } = useProfile<ProfileName>({ enabled });
  const customerInitial =
    profile?.name?.firstName?.trim().charAt(0).toUpperCase() || "•";

  const serverMessages = useMemo(() => data?.messages ?? [], [data]);
  const total = data?.total ?? 0;
  const hasOlder = total > serverMessages.length;

  /**
   * The thread, with anything still in flight tacked on the end.
   *
   * A pending bubble is dropped as soon as the server's newest message is at
   * least as recent as it — which is the moment the real one arrives, since the
   * server stamps `createdAt` after the client does. The dialog also removes it
   * from its own queue on success; the two overlap deliberately, because each
   * covers a case the other misses. Removing from the queue alone would blink
   * the message out on a customer's *first* ever send, where there was no
   * thread to refetch and the id had yet to exist. This filter alone would keep
   * the bubble forever on a client whose clock runs ahead of the server's.
   */
  const messages = useMemo(() => {
    if (!pending?.length) return serverMessages;

    const newestServer = Date.parse(
      serverMessages.at(-1)?.createdAt ?? "",
    );

    const unconfirmed = pending.filter((item) => {
      const sentAt = Date.parse(item.createdAt ?? "");
      if (Number.isNaN(sentAt) || Number.isNaN(newestServer)) return true;
      return sentAt > newestServer;
    });

    return unconfirmed.length ? [...serverMessages, ...unconfirmed] : serverMessages;
  }, [serverMessages, pending]);

  const pendingIds = useMemo(
    () => new Set((pending ?? []).map((item) => item._id)),
    [pending],
  );

  /**
   * The instant every "5m" is measured against.
   *
   * Taken from the query's own `dataUpdatedAt` rather than `new Date()` per
   * render: React Query keeps the same data object when a poll returns an
   * unchanged thread, so a per-render clock would simply never advance and the
   * newest bubble would read "Just now" for as long as the panel stayed open.
   * `dataUpdatedAt` moves on every successful fetch — once per poll — which is
   * both a real re-render and the honest answer to "as of when".
   */
  const now = useMemo(() => {
    if (dataUpdatedAt > 0) return new Date(dataUpdatedAt);
    // No fetch timestamp yet — the placeholder frame while "load older" widens
    // the window. Falling back to the newest message keeps the ages plausible
    // for the one frame it lasts; `new Date(0)` would date every bubble to 1970.
    return new Date(messages.at(-1)?.createdAt ?? 0);
  }, [dataUpdatedAt, messages]);

  const days = useMemo(
    () => groupMessagesByDay(messages, now, t, lang),
    [messages, now, t, lang],
  );

  // Follow the bottom when a *new* message lands, but not when the customer
  // asks for older ones — keyed on the newest id, which "load older" leaves
  // untouched. Also fires on first paint, which is where a chat should open.
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const newestId = messages.at(-1)?._id ?? null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  if (ticketId && isPending) return <SupportMessagesSkeleton />;

  if (isError) {
    return (
      <Centered>
        <p className="text-sm font-medium text-foreground dark:text-neutral-50">
          {t("somethingWentWrong")}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => refetch()}
          className="mt-3 cursor-pointer font-semibold"
        >
          {t("tryAgain")}
        </Button>
      </Centered>
    );
  }

  // Covers both a customer with no ticket at all and one whose ticket an admin
  // has since removed — `useSupportMessages` resolves that 404 to an empty
  // thread, so the two land in the same, correct, place.
  if (messages.length === 0) {
    return (
      <Centered>
        <MessagesSquare
          className="h-10 w-10 text-primary dark:text-pink-400"
          aria-hidden
        />
        <p className="mt-3 text-sm font-semibold text-foreground dark:text-neutral-50">
          {t("noMessagesYet")}
        </p>
        <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground dark:text-neutral-400">
          {t("supportEmptyHint")}
        </p>
      </Centered>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f8f9fa] px-4 py-4 dark:bg-neutral-950">
      {hasOlder && (
        <div className="mb-4 flex justify-center">
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={isFetching}
            onClick={() => setLimit((size) => size + SUPPORT_MESSAGE_PAGE_SIZE)}
            className="cursor-pointer gap-2 rounded-full font-semibold text-primary hover:bg-pink-50 hover:text-primary dark:text-pink-400 dark:hover:bg-pink-950/30"
          >
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("loadOlderMessages")}
          </Button>
        </div>
      )}

      {days.map((day) => (
        <section key={day.key} className="mb-4 last:mb-0">
          {/* The centred pill on a hairline, per the app's TODAY divider. */}
          <div className="relative my-4 flex items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-x-0 top-1/2 h-px bg-gray-200 dark:bg-neutral-800"
            />
            <span className="relative rounded-full border border-gray-200 bg-[#f8f9fa] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
              {day.label}
            </span>
          </div>

          <div className="space-y-2.5">
            {day.messages.map((message, index) => (
              <SupportMessageBubble
                // `_id` is absent on an optimistic message (Phase 5), so the
                // index backs it up rather than collapsing two pending bubbles
                // onto one key.
                key={message._id ?? `${day.key}-${index}`}
                message={message}
                now={now}
                t={t}
                lang={lang}
                pending={pendingIds.has(message._id)}
                avatarInitial={
                  message.senderRole === "CUSTOMER"
                    ? customerInitial
                    : handlerInitial
                }
              />
            ))}
          </div>
        </section>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#f8f9fa] px-6 text-center dark:bg-neutral-950">
      {children}
    </div>
  );
}
