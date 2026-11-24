"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Gift, SlidersHorizontal } from "lucide-react";
import type { BuyAndRewardMark } from "@/lib/promoBadge";

/**
 * The marks along the bottom of a product card's photo (24 Nov 2026): a
 * buy-and-reward offer ("2×1") on the left, "Add-ons" on the right.
 *
 * One flex row, so the two never overlap: Add-ons keeps its size and the
 * offer gives way. The offer's words ("· Buy 1 Get 1") show only when the row
 * has room for the whole pill beside Add-ons — measured, not guessed from a
 * breakpoint, because "Compre 1 Ganhe 1" needs ~45px more than the English
 * and a card without Add-ons has room to spare. Otherwise the pill keeps
 * "2×1" and the words stay for the dish's details. If even "2×1" and the
 * full "Add-ons" don't fit (a 320px phone in Portuguese, "Com extras"),
 * Add-ons drops to its icon; screen readers still hear the label.
 *
 * Where the row sits:
 * - From `md`: on the photo's bottom edge.
 * - Phones: the add control is on the photo's bottom-right corner
 *   (`top: 75cqw - 2.75rem` in the card), so the row stands 6px above it —
 *   but never higher than the share button's bottom (2.5rem), which on a
 *   320px phone leaves only 18px; there (cards under 10rem) the pills are
 *   16px tall instead of 20px so they fit between the two.
 *
 * `cqw` is the card's width: the card is the size container.
 */
const PILL =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shadow-sm @max-[10rem]:gap-0.5 @max-[10rem]:px-1.5 @max-[10rem]:py-0 @max-[10rem]:text-[10px]/4";
const OFFER = `${PILL} bg-amber-400 font-extrabold text-amber-950`;

function OfferContent({ mark, words }: { mark: BuyAndRewardMark; words: boolean }) {
  return (
    <>
      <Gift size={12} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
      <span className="shrink-0">{mark.short}</span>
      {words && <span className="whitespace-nowrap font-medium">· {mark.text}</span>}
    </>
  );
}

export default function ProductPhotoMarks({
  offer,
  addonsLabel,
}: {
  offer: BuyAndRewardMark | null;
  /** The "Add-ons" text; null when the dish has no add-on groups. */
  addonsLabel: string | null;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLSpanElement>(null);
  const shortRef = useRef<HTMLSpanElement>(null);
  const addonsRef = useRef<HTMLSpanElement>(null);
  const hasWords = Boolean(offer?.text && offer.text !== offer.short);
  const both = Boolean(offer && addonsLabel);
  // What the row has room for, widest first: the offer with its words and
  // full Add-ons; "2×1" and full Add-ons; "2×1" and the Add-ons icon alone.
  const [room, setRoom] = useState<"words" | "short" | "compact">("short");

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || (!hasWords && !both)) return;
    const check = () => {
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const addons = addonsRef.current ? addonsRef.current.offsetWidth + gap : 0;
      const width = row.clientWidth;
      if (fullRef.current && fullRef.current.offsetWidth + addons <= width) setRoom("words");
      else if (!shortRef.current || shortRef.current.offsetWidth + addons <= width) setRoom("short");
      else setRoom("compact");
    };
    check();
    // The row follows the card's width; the hidden measuring pills change
    // with the language and once the web font has loaded.
    const observer = new ResizeObserver(check);
    for (const el of [row, fullRef.current, shortRef.current, addonsRef.current]) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [hasWords, both]);

  if (!offer && !addonsLabel) return null;
  const hidden = "invisible absolute left-0 top-0";

  return (
    <div
      ref={rowRef}
      className="pointer-events-none absolute inset-x-2 top-[max(2.5625rem,calc(75cqw-4.375rem))] flex items-center justify-between gap-1.5 @max-[10rem]:top-[max(2.5625rem,calc(75cqw-4.125rem))] md:top-auto md:bottom-2"
    >
      {offer ? (
        <span className={`${OFFER} min-w-0`}>
          <span aria-hidden="true" className="contents">
            <OfferContent mark={offer} words={room === "words"} />
          </span>
          <span className="sr-only">{offer.title ?? offer.short}</span>
        </span>
      ) : (
        <span />
      )}
      {addonsLabel && (
        <span
          className={`${PILL} shrink-0 bg-white/95 font-semibold text-primary dark:bg-neutral-900/90 dark:text-pink-300`}
        >
          <SlidersHorizontal size={12} strokeWidth={2.5} aria-hidden="true" />
          <span className={room === "compact" ? "sr-only" : undefined}>{addonsLabel}</span>
        </span>
      )}
      {/* Never seen: the pills at the sizes being considered, measured so
          the row only shows what it has room for. */}
      {hasWords && offer && (
        <span ref={fullRef} aria-hidden="true" className={`${OFFER} ${hidden}`}>
          <OfferContent mark={offer} words />
        </span>
      )}
      {both && offer && (
        <span ref={shortRef} aria-hidden="true" className={`${OFFER} ${hidden}`}>
          <OfferContent mark={offer} words={false} />
        </span>
      )}
      {addonsLabel && (
        <span ref={addonsRef} aria-hidden="true" className={`${PILL} ${hidden} font-semibold`}>
          <SlidersHorizontal size={12} strokeWidth={2.5} />
          {addonsLabel}
        </span>
      )}
    </div>
  );
}
