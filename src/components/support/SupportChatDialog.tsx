"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthed } from "@/hooks/useAuthed";
import { getApiErrorMessage } from "@/lib/apiClient";
import { getHandlerIdentity, type SupportMessage } from "@/lib/support";
import {
  useActiveSupportTicket,
  useInvalidateSupport,
} from "@/hooks/queries/useSupport";
import {
  markSupportTicketRead,
  sendSupportMessage,
} from "@/services/supportApi";
import { useSupportChatStore } from "@/stores/supportChatStore";
import SupportMessageList from "./SupportMessageList";
import SupportComposer from "./SupportComposer";

/**
 * The support chat window.
 *
 * A side panel on desktop and a full screen below `md`, opened from anywhere
 * through `supportChatStore` and mounted once in the `(main)` layout.
 *
 * It owns the send — the composer below it holds only a draft, and the list
 * above it only renders — because sending is the one action that touches both:
 * a message has to appear in the thread before the server has confirmed it.
 *
 * ## Radix primitives directly, rather than a `components/ui/dialog.tsx`
 *
 * `components/ui/` holds shadcn wrappers for things used in several places.
 * This panel's geometry is bespoke — edge-anchored, full-height, no max-width —
 * and has exactly one consumer, so a generic wrapper would be an abstraction
 * over a single case. The overlay copies `alert-dialog.tsx`'s classes so the
 * two dim the page identically.
 */
export default function SupportChatDialog() {
  const { t } = useTranslation();

  const isOpen = useSupportChatStore((state) => state.isOpen);
  const close = useSupportChatStore((state) => state.close);
  const prefill = useSupportChatStore((state) => state.prefill);
  const category = useSupportChatStore((state) => state.category);
  const referenceOrderId = useSupportChatStore(
    (state) => state.referenceOrderId,
  );

  const authed = useAuthed();

  // Only while the panel is open: `GET /support/tickets` answers 401 for a
  // guest, and the response interceptor turns that into a redirect to /login —
  // so an ungated query would throw a browsing visitor off whatever page they
  // were on. Closing it also stops the 60s poll rather than leaving it running
  // behind every route for the rest of the session.
  const { data: ticket } = useActiveSupportTicket({
    enabled: authed && isOpen,
  });

  const { name, initial } = getHandlerIdentity(ticket, t);
  const ticketId = ticket?.ticketId ?? null;

  const { invalidateThread, invalidateTickets } = useInvalidateSupport();

  /**
   * Reading the thread is what marks it read.
   *
   * Fires once per opening, on `[isOpen, ticketId]` only: the ticket's own
   * unread count is deliberately not a dependency, because clearing it is this
   * effect's own result and depending on it would be a loop. A failure is
   * swallowed — the customer came here to read a reply, not to be told a
   * bookkeeping call did not land.
   *
   * There is nothing to see yet. `unreadCount[myUserId]` has only ever been
   * `0`, because nothing has ever replied on the test account.
   */
  useEffect(() => {
    if (!isOpen || !ticketId) return;

    let cancelled = false;
    markSupportTicketRead(ticketId)
      .then(() => {
        if (!cancelled) invalidateTickets();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, ticketId, invalidateTickets]);

  /**
   * Messages this client has sent but not yet seen come back from the server.
   *
   * An array rather than a single "submitting" flag, because a chat should let
   * you fire off two lines without waiting for the first — unlike the cancel
   * dialog, where blocking on one request is the point.
   */
  const [pending, setPending] = useState<SupportMessage[]>([]);
  const localIdRef = useRef(0);

  const handleSend = async (
    message: string,
    attachments?: string[],
  ): Promise<boolean> => {
    localIdRef.current += 1;
    const localId = `pending-${localIdRef.current}`;

    const optimistic: SupportMessage = {
      _id: localId,
      ticketId,
      senderRole: "CUSTOMER",
      message,
      // The enum has no "FILE": an image rides as IMAGE, everything else as
      // TEXT. The attachment URLs are what actually carry the file either way.
      messageType: attachments?.length ? "IMAGE" : "TEXT",
      attachments: attachments ?? [],
      createdAt: new Date().toISOString(),
    };
    setPending((queue) => [...queue, optimistic]);

    try {
      const sent = await sendSupportMessage({
        message,
        ...(attachments?.length
          ? { messageType: "IMAGE" as const, attachments }
          : {}),
        // Both are best-effort. The API honours them only on a ticket that has
        // never been classified, and ignores them silently otherwise — which is
        // expected, and must never surface as an error. The topic the customer
        // picked reaches support through the message text instead.
        ...(category ? { category } : {}),
        ...(referenceOrderId ? { referenceOrderId } : {}),
      });

      // Awaited before the bubble is retired so the confirmed message is on
      // screen before the optimistic one leaves it. On a customer's very first
      // message there was no thread to refetch, so `SupportMessageList` also
      // drops any pending bubble the server has since caught up with — the two
      // together are what stop the message blinking out of existence.
      await invalidateThread(sent?.ticketId ?? ticketId ?? "");
      setPending((queue) => queue.filter((item) => item._id !== localId));
      return true;
    } catch (error) {
      setPending((queue) => queue.filter((item) => item._id !== localId));
      toast.error(getApiErrorMessage(error, t("messageSendFailed")));
      return false;
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />

        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-white text-gray-900 outline-none duration-200 dark:bg-neutral-900 dark:text-neutral-100
            data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom
            data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom
            md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l md:border-gray-200 md:shadow-2xl dark:md:border-neutral-800
            md:data-open:slide-in-from-right md:data-closed:slide-out-to-right"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
            {/* The gradient and the letter are the app's, but who they stand
                for is a guess the model makes carefully: `activeHandler` is the
                only field that plausibly drives the header, and anything it
                does not recognize falls back to "Support Team" rather than
                naming the wrong counterparty. */}
            <span
              aria-hidden
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#f9186b] to-[#d4145b] text-base font-bold text-white"
            >
              {initial}
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-neutral-900" />
            </span>

            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-bold text-[#191c1d] dark:text-neutral-50">
                {name}
              </Dialog.Title>
              <Dialog.Description className="truncate text-sm font-medium text-green-600 dark:text-green-400">
                {t("activeNow")}
              </Dialog.Description>
            </div>

            {/* 🔴 Closes the panel, and only the panel. `PATCH …/close` is 403
                for customers — a customer cannot close their own ticket — so
                there is deliberately no code path here that tries, and no copy
                ("End chat", "Resolve") that suggests this did. */}
            <Dialog.Close
              aria-label={t("close")}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#f9186b]/30 text-[#f9186b] transition-colors hover:bg-pink-50 dark:border-pink-500/30 dark:text-pink-400 dark:hover:bg-pink-950/30"
            >
              <X className="h-4.5 w-4.5" />
            </Dialog.Close>
          </header>

          {/* Owns its own scrolling and window size — see `SupportMessageList`. */}
          <SupportMessageList
            ticketId={ticketId}
            enabled={authed && isOpen}
            handlerInitial={initial}
            pending={pending}
          />

          {/* Keyed on the prefill so opening from a different topic reseeds the
              box. Without it the composer would keep the draft state it was
              first mounted with, and "Refund Status" would open showing the
              previous screen's sentence. */}
          <SupportComposer
            key={prefill ?? ""}
            initialValue={prefill ?? ""}
            onSend={handleSend}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
