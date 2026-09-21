"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { shareOrCopy, type ShareData } from "@/lib/share";
import { cn } from "@/lib/utils";

/**
 * The round share button on a dish card.
 *
 * It sits inside cards that are themselves clickable — the menu card opens the
 * dish, a search card navigates to it — so it stops its own click **and** its
 * own Enter/Space from reaching the card: sharing a dish must never also open
 * it. (A search card answers Enter on `keydown`, which a click handler alone
 * would not stop.)
 *
 * `getShareData` may be async: a search result knows its dish but not its
 * store, and looks the store up first. `onPrepare` lets such a card start that
 * lookup on press-down, so it is usually cached by the time the click lands —
 * a share sheet opened after a slow lookup can be refused by Safari, and then
 * the link is copied instead (see `shareOrCopy`).
 */
export default function ShareButton({
  getShareData,
  label,
  onPrepare,
  className,
}: {
  getShareData: () => ShareData | Promise<ShareData>;
  /** Accessible name — "Share Beef Tehari", not just "Share". */
  label: string;
  onPrepare?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      // A touch screen gets the system share sheet; a mouse gets the link
      // copied. Asked at the moment of the tap, so a laptop with a touch
      // screen answers for how it is being used.
      const sheet =
        typeof window !== "undefined" &&
        window.matchMedia?.("(pointer: coarse)").matches === true;
      const outcome = await shareOrCopy(await getShareData(), { sheet });
      if (outcome === "copied") toast.success(t("linkCopied"));
      if (outcome === "failed") toast.error(t("shareFailed"));
    } catch {
      // The lookup itself failed — there is no link to hand over.
      toast.error(t("shareFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy}
      title={label}
      onPointerDown={() => onPrepare?.()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleShare();
      }}
      onKeyDown={(event) => {
        // Enter and Space activate this button; they must not also reach a
        // card that listens for them.
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      }}
      className={cn(
        "focus-ring flex size-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-primary dark:bg-neutral-900/85 dark:text-neutral-200 dark:hover:text-pink-400",
        busy && "opacity-60",
        className,
      )}
    >
      <Share2 size={15} aria-hidden="true" />
    </button>
  );
}
