"use client";

import { AlertCircle, Check, CheckCheck, Clock, ImageIcon } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { getMessageMeta } from "@/lib/support";

/** What a bubble needs, for a server message and a pending one alike. */
export interface RiderChatBubbleMessage {
  key: string;
  message: string;
  createdAt: string;
  mine: boolean;
  attachments?: string[];
  /** Server messages: read by the other side. */
  isRead?: boolean;
  /** Pending messages only. */
  status?: "sending" | "failed";
}

interface RiderChatBubbleProps {
  item: RiderChatBubbleMessage;
  now: Date;
  t: (key: string) => string;
  lang: "en" | "pt";
  onRetry?: () => void;
  onDiscard?: () => void;
}

/**
 * One message in the rider chat (`plan.md` Phase 4). The same geometry as the
 * support chat's bubble (`SupportMessageBubble`): mine on the right in the pink
 * gradient, the rider's on the left in the card palette, time inside the
 * bubble.
 *
 * Unlike support, this chat has real read receipts (`order-chat:read`), so my
 * messages show the full ladder: clock (sending) → ✓ (sent) → ✓✓ (read by the
 * rider). A refused message stays, marked "Not sent", with Retry and Delete.
 */
export default function RiderChatBubble({ item, now, t, lang, onRetry, onDiscard }: RiderChatBubbleProps) {
  const meta = getMessageMeta({ createdAt: item.createdAt }, now, t, lang);
  const failed = item.status === "failed";
  const attachments = (item.attachments ?? []).filter((url) => typeof url === "string" && url.length > 0);

  const tick = !item.mine ? null : item.status === "sending" ? (
    <Clock className="h-3.5 w-3.5" aria-label={t("riderChatSending")} />
  ) : failed ? null : item.isRead ? (
    <CheckCheck className="h-3.5 w-3.5" aria-label={t("riderChatRead")} />
  ) : (
    <Check className="h-3.5 w-3.5" aria-label={t("riderChatSent")} />
  );

  return (
    <div className={`flex flex-col ${item.mine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] min-w-0 px-4 py-2 text-sm leading-relaxed shadow-sm ${
          item.mine
            ? `rounded-2xl rounded-br-md bg-linear-to-br from-primary to-primary-hover text-white ${
                item.status === "sending" ? "opacity-70" : ""
              } ${failed ? "opacity-60" : ""}`
            : "rounded-2xl rounded-bl-md border border-border bg-card text-foreground dark:text-neutral-200"
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {attachments.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block h-40 w-56 max-w-full overflow-hidden rounded-xl bg-black/10"
              >
                <SafeImage src={url} alt={t("attachment")} sizes="224px" fallbackIcon={<ImageIcon className="h-6 w-6" />} />
              </a>
            ))}
          </div>
        )}

        {/* `break-words`: one 2000-character word must not widen the panel. */}
        <p className="whitespace-pre-wrap break-words">{item.message}</p>

        {meta && (
          <span
            className={`mt-1 flex items-center justify-end gap-1 text-xs ${
              item.mine ? "text-white/80" : "text-gray-400 dark:text-neutral-500"
            }`}
          >
            {meta.absolute}
            {tick}
          </span>
        )}
      </div>

      {failed && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {t("riderChatNotSent")}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring cursor-pointer rounded-sm font-semibold text-primary-hover hover:underline dark:text-pink-400"
            >
              {t("retry")}
            </button>
          )}
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="focus-ring cursor-pointer rounded-sm text-muted-foreground hover:underline dark:text-neutral-400"
            >
              {t("riderChatDiscard")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
