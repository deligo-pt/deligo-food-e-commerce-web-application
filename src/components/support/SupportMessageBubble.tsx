"use client";

import { Check, Clock, ImageIcon } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { getMessageMeta, isOutgoing, type SupportMessage } from "@/lib/support";

interface SupportMessageBubbleProps {
  message: SupportMessage;
  /** Pinned by the list so every bubble ages against the same instant. */
  now: Date;
  t: (key: string) => string;
  lang: "en" | "pt";
  /** Letter in the avatar beside the bubble — the customer's, or the handler's. */
  avatarInitial: string;
  /** Sent, not yet acknowledged by the server. */
  pending?: boolean;
}

/**
 * One message.
 *
 * Outgoing is copied from the app (`2.jpeg`): pink gradient, white text, the
 * meta line *inside* the bubble at the bottom-right, and the sender's initial in
 * a circle beside it.
 *
 * Incoming is **designed, not copied**. Nothing has ever replied on the test
 * account — 15 messages, all `senderRole: "CUSTOMER"` — so no screenshot of an
 * inbound bubble exists. It mirrors the outgoing geometry in the repo's card
 * palette, and is flagged for a browser pass rather than claimed as a match.
 */
export default function SupportMessageBubble({
  message,
  now,
  t,
  lang,
  avatarInitial,
  pending,
}: SupportMessageBubbleProps) {
  const outgoing = isOutgoing(message);
  const meta = getMessageMeta(message, now, t, lang);
  const attachments = (message.attachments ?? []).filter(
    (url): url is string => typeof url === "string" && url.length > 0,
  );

  return (
    <div
      className={`flex items-end gap-2 ${outgoing ? "justify-end" : "justify-start"} ${
        pending ? "opacity-70" : ""
      }`}
    >
      {!outgoing && <Avatar initial={avatarInitial} muted />}

      <div
        className={`max-w-[78%] min-w-0 px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
          outgoing
            ? "rounded-2xl rounded-br-md bg-linear-to-br from-primary to-primary-hover text-white"
            : "rounded-2xl rounded-bl-md border border-border bg-card text-muted-foreground dark:text-neutral-300"
        }`}
      >
        {/* Above the text, as a chat draws it. `SafeImage` falls back to an
            icon box rather than raw alt text when a URL 404s — which matters
            here because attachment URLs outlive nothing and cannot be
            re-uploaded from the thread. */}
        {attachments.length > 0 && (
          <div className="mb-1.5 space-y-1.5">
            {attachments.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="relative block h-40 w-full overflow-hidden rounded-xl bg-black/10"
              >
                <SafeImage
                  src={url}
                  alt={t("attachment")}
                  sizes="320px"
                  fallbackIcon={<ImageIcon className="h-6 w-6" />}
                />
              </a>
            ))}
          </div>
        )}

        {/* `break-words` is correctness, not polish: the thread already
            contains a 20,000-character unbroken string, and without it that one
            message stretches the panel and pushes every other bubble off-screen.
            `whitespace-pre-wrap` keeps the newlines the API accepts. */}
        <p className="whitespace-pre-wrap break-words">{message.message}</p>

        {meta && (
          <span
            className={`mt-1 flex items-center justify-end gap-1 text-xs ${
              outgoing ? "text-white/75" : "text-gray-400 dark:text-neutral-500"
            }`}
          >
            {meta.relative} • {meta.absolute}
            {/* Sent, not read. `readBy` on an outgoing message has only ever
                contained the sender's own id, so a second tick — or any
                "seen" wording — would be a claim the data cannot support. The
                clock is the step before that: on its way, not yet acknowledged. */}
            {outgoing &&
              (pending ? (
                <Clock className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ))}
          </span>
        )}
      </div>

      {outgoing && <Avatar initial={avatarInitial} />}
    </div>
  );
}

function Avatar({ initial, muted }: { initial: string; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        muted
          ? "border border-border bg-card text-primary dark:text-pink-400"
          : "bg-linear-to-br from-primary to-primary-hover text-white"
      }`}
    >
      {initial}
    </span>
  );
}
