"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Gift, SlidersHorizontal } from "lucide-react";
import type { BuyAndRewardMark } from "@/lib/promoBadge";

/**
 * The marks along the bottom of a product card's photo (24 Nov 2026): a
 * buy-and-reward offer ("2×1") on the left, "Add-ons" on the right.
 *
 * The offer is the same sign in every language (27 Nov 2026): a green pill,
 * a red gift in a white circle, a yellow "2×1" — no "Buy 1 Get 1" /
 * "Compre 1 Ganhe 1" words; screen readers still hear the offer's title.
 *
 * One flex row, so the two never overlap. If "2×1" and the full "Add-ons"
 * don't fit (a 320px phone in Portuguese, "Com extras"), Add-ons drops to its
 * icon — measured, not guessed from a breakpoint; screen readers still hear
 * the label.
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
const OFFER = `${PILL} bg-green-700 font-extrabold`;

function OfferContent({ mark }: { mark: BuyAndRewardMark }) {
  return (
    <>
      {/* White circle: a red gift alone is barely visible on green. */}
      <span className="-ml-1 grid size-4 shrink-0 place-items-center rounded-full bg-white @max-[10rem]:-ml-0.5 @max-[10rem]:size-3.5">
        <Gift size={10} strokeWidth={2.75} className="text-red-600" aria-hidden="true" />
      </span>
      <span className="shrink-0 text-yellow-300">{mark.short}</span>
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
  const shortRef = useRef<HTMLSpanElement>(null);
  const addonsRef = useRef<HTMLSpanElement>(null);
  const both = Boolean(offer && addonsLabel);
  // Room for "2×1" and the full Add-ons, or only for the Add-ons icon.
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !both) return;
    const check = () => {
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const addons = addonsRef.current ? addonsRef.current.offsetWidth + gap : 0;
      setCompact(Boolean(shortRef.current && shortRef.current.offsetWidth + addons > row.clientWidth));
    };
    check();
    // The row follows the card's width; the hidden measuring pills change
    // with the language and once the web font has loaded.
    const observer = new ResizeObserver(check);
    for (const el of [row, shortRef.current, addonsRef.current]) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [both]);

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
            <OfferContent mark={offer} />
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
          <span className={compact ? "sr-only" : undefined}>{addonsLabel}</span>
        </span>
      )}
      {/* Never seen: the pills at the sizes being considered, measured so
          the row only shows what it has room for. */}
      {both && offer && (
        <span ref={shortRef} aria-hidden="true" className={`${OFFER} ${hidden}`}>
          <OfferContent mark={offer} />
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
