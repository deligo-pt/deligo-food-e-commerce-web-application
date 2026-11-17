"use client";

import { useRef, useState } from "react";
import { ArrowUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkOutgoingMessage, ORDER_CHAT_MESSAGE_MAX } from "@/lib/orderChat";

/** Roughly five rows, then the box scrolls. */
const MAX_TEXTAREA_HEIGHT = 120;
/** The counter appears this close to the limit. */
const COUNTER_FROM = ORDER_CHAT_MESSAGE_MAX - 200;

interface RiderChatComposerProps {
  t: (key: string) => string;
  /** False when the room is locked: the box is replaced by `lockedText`. */
  enabled: boolean;
  lockedText: string | null;
  /** Every keystroke; `useOrderChatSocket` turns it into one "typing" per burst. */
  onTyping: () => void;
  /** Sends. The box is cleared first; a failure stays in the thread as "Not sent". */
  onSend: (text: string) => void;
}

/**
 * The box at the bottom of the rider chat (`plan.md` Phase 4). Text only:
 * the guide names no upload endpoint for chat attachments.
 *
 * Enter sends, Shift+Enter breaks the line (not while an IME is composing).
 * The server's rule — trimmed, 1–2000 characters — is checked here first, with
 * a counter from 1800 characters, so a refused message never leaves.
 */
export default function RiderChatComposer({ t, enabled, lockedText, onTyping, onSend }: RiderChatComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const checked = checkOutgoingMessage(value);
  const length = value.trim().length;
  const tooLong = !checked.ok && checked.reason === "tooLong";

  const resize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const submit = () => {
    if (!enabled || !checked.ok) return;
    setValue("");
    requestAnimationFrame(() => resize(ref.current));
    onSend(checked.message);
    ref.current?.focus();
  };

  if (!enabled) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-3 text-sm text-muted-foreground dark:text-neutral-400">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        <span>{lockedText}</span>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-3">
      {length >= COUNTER_FROM && (
        <p
          className={`mb-1 text-right text-xs ${tooLong ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {tooLong ? `${t("riderChatTooLong")} ` : ""}
          {length}/{ORDER_CHAT_MESSAGE_MAX}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          aria-label={t("typeAMessage")}
          aria-invalid={tooLong || undefined}
          onChange={(event) => {
            setValue(event.target.value);
            resize(event.target);
            if (event.target.value) onTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("typeAMessage")}
          className="max-h-30 min-h-9 w-full resize-none self-center bg-transparent px-1 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-neutral-100 dark:placeholder:text-neutral-600"
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={!checked.ok}
          aria-label={t("send")}
          className="shrink-0 cursor-pointer rounded-full bg-linear-to-br from-primary to-primary-hover hover:opacity-90"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
