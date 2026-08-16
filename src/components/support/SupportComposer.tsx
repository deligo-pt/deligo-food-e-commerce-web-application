"use client";

import { useRef, useState } from "react";
import { ArrowUp, ImageIcon, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { getApiErrorMessage } from "@/lib/apiClient";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  getAttachmentError,
  normalizeOutgoingMessage,
} from "@/lib/support";
import { uploadSupportAttachment } from "@/services/supportApi";

/** Roughly five rows of the textarea's own line-height. */
const MAX_TEXTAREA_HEIGHT = 120;

interface Attachment {
  name: string;
  /** `null` while the upload is in flight. */
  url: string | null;
}

interface SupportComposerProps {
  /**
   * Seeded into the box and left editable — the way the app opens with
   * `Payment Question: Unrecognized Charge` already typed.
   */
  initialValue: string;
  /**
   * Performs the send. Resolves `true` when it went, `false` when it did not —
   * on `false` the composer puts the text back so nothing the customer wrote is
   * lost to a failed request.
   */
  onSend: (message: string, attachments?: string[]) => Promise<boolean>;
}

/**
 * The box at the bottom of the chat.
 *
 * Holds the draft and the attachment waiting to go with it, and nothing else:
 * the pending bubble, the send call and the rollback all live in
 * `SupportChatDialog`, which is where the thread is.
 */
export default function SupportComposer({
  initialValue,
  onSend,
}: SupportComposerProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploading = attachment !== null && attachment.url === null;

  // Derived, not a third piece of state: the send button is live exactly when
  // there is something to send. The trim matters — the API accepts three spaces
  // with a 201 and drops an empty bubble into the thread.
  const typed = normalizeOutgoingMessage(value);

  /**
   * `message` is required and must be at least one character, so an image on
   * its own has nothing to send. The file's name stands in — it is true, it is
   * the customer's own word for the thing, and a support agent reading
   * "receipt.jpg" above a receipt is better served than by a placeholder.
   */
  const sendable = typed ?? (attachment?.url ? attachment.name : null);
  const canSend = sendable !== null && !uploading;

  /**
   * Grow with the text, up to five rows or so, then scroll.
   *
   * Done in the change handler rather than an effect: this repo forbids
   * state-syncing effects, and measuring is a side effect of typing anyway.
   * `height = "auto"` first so the box can *shrink* again on delete —
   * `scrollHeight` never reports less than the current height.
   */
  const resize = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const pickFile = async (file: File | null | undefined) => {
    if (!file) return;

    // Checked before the round trip. The server refuses the same things with a
    // 400, but telling someone their 8 MB photo is too large before uploading
    // it over a phone connection is the difference between a hint and a waste.
    const problem = getAttachmentError(file);
    if (problem) {
      toast.error(t(problem));
      return;
    }

    setAttachment({ name: file.name, url: null });
    try {
      const url = await uploadSupportAttachment(file);
      setAttachment({ name: file.name, url });
    } catch (error) {
      // Cleared, not left half-attached: a chip with no URL behind it is a
      // message the customer thinks carries a photo and does not.
      setAttachment(null);
      toast.error(getApiErrorMessage(error, t("attachmentUploadFailed")));
    }
  };

  const submit = async () => {
    if (!canSend || sendable === null) return;

    const outgoing = sendable;
    const urls = attachment?.url ? [attachment.url] : undefined;

    // Cleared before the await, not after: a chat that leaves the sent text
    // sitting in the box until the network answers feels broken. `onSend` hands
    // it back if the request fails.
    setValue("");
    setAttachment(null);
    resize(textareaRef.current);

    const sent = await onSend(outgoing, urls);
    if (!sent) {
      setValue(typed ?? "");
      if (attachment?.url) setAttachment(attachment);
      // Next frame, once the textarea has the restored value to measure.
      requestAnimationFrame(() => resize(textareaRef.current));
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-[#f8f9fa] px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950">
          {uploading ? (
            <Loader2
              aria-hidden
              className="h-4 w-4 shrink-0 animate-spin text-[#f9186b] dark:text-pink-400"
            />
          ) : (
            <ImageIcon
              aria-hidden
              className="h-4 w-4 shrink-0 text-[#f9186b] dark:text-pink-400"
            />
          )}

          <span className="min-w-0 flex-1 truncate text-xs text-[#5a4044] dark:text-neutral-400">
            {attachment.name}
          </span>

          <button
            type="button"
            onClick={() => setAttachment(null)}
            aria-label={t("removeAttachment")}
            className="shrink-0 cursor-pointer text-gray-400 transition-colors hover:text-[#f9186b] dark:text-neutral-500 dark:hover:text-pink-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* The allowlist is the server's own, not `image/*`: the picker must not
            offer a HEIC the upload endpoint will refuse. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_ATTACHMENT_TYPES.join(",")}
          className="hidden"
          onChange={(event) => {
            pickFile(event.target.files?.[0]);
            // Reset so choosing the same file twice in a row still fires.
            event.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachment !== null}
          aria-label={t("attachFile")}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#f9186b]/30 text-[#f9186b] transition-colors hover:bg-pink-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:border-pink-500/30 dark:text-pink-400 dark:hover:bg-pink-950/30"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            resize(event.target);
          }}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line. `isComposing` guards the
            // IME: committing a candidate with Enter must not fire the message.
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("typeAMessage")}
          className="max-h-30 min-h-9 w-full resize-none self-center bg-transparent py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-neutral-100 dark:placeholder:text-neutral-600"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label={t("send")}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-linear-to-br from-[#f9186b] to-[#d4145b] text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
