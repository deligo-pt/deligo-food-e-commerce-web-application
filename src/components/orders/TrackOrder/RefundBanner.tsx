"use client";

import { Check, Info } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  refundStateDescriptionKey,
  refundStateLabelKey,
  type RefundState,
} from "@/lib/refund";
import RefundIllustration from "./RefundIllustration";

/**
 * Colour and accent per state. Deliberately three different readings: pink is
 * "we're working on it", green "done, the money is back", amber "no money is
 * coming". A refund that is still pending must never look finished, and an
 * order with no refund due must never look like either.
 */
const PRESENTATION: Record<
  Exclude<RefundState, "none">,
  { accent: string; heading: string }
> = {
  in_progress: {
    accent: "border-l-primary dark:border-l-primary",
    heading: "text-primary dark:text-pink-400",
  },
  completed: {
    accent: "border-l-green-600 dark:border-l-green-500",
    heading: "text-green-600 dark:text-green-400",
  },
  not_eligible: {
    accent: "border-l-amber-500 dark:border-l-amber-500",
    heading: "text-amber-600 dark:text-amber-400",
  },
};

/**
 * What happened to the customer's money after their paid order was rejected or
 * cancelled. Renders nothing when there is nothing to announce, so callers can
 * mount it unconditionally.
 *
 * Note `not_eligible` *is* something to announce: a customer who cancelled
 * after the restaurant accepted needs telling that no refund is coming. Only
 * `none` — an order that was never paid for — stays silent.
 */
export default function RefundBanner({ state }: { state: RefundState }) {
  const { t } = useTranslation();

  const labelKey = refundStateLabelKey(state);
  const descriptionKey = refundStateDescriptionKey(state);
  if (!labelKey || !descriptionKey || state === "none") return null;

  const { accent, heading } = PRESENTATION[state];

  return (
    // role="status" + aria-live: once polling is kept alive through the refund
    // (Phase 5) this heading changes under the user without any navigation, and
    // a screen reader would otherwise never announce it.
    <div
      role="status"
      aria-live="polite"
      data-refund-state={state}
      className={`flex flex-col items-center gap-4 rounded-3xl border border-transparent bg-white p-6 text-center shadow-md transition-colors duration-200 md:flex-row md:gap-6 md:p-8 md:text-left dark:bg-neutral-900 dark:border-neutral-800 border-l-4 dark:border-l-4 ${accent}`}
    >
      {/* Completed is a solid green disc and in-progress the money bag, the
          same pairing the app uses — the two states must not be
          distinguishable only by colour. "No refund" gets neither: showing the
          money bag next to copy saying no money is coming would contradict it. */}
      {state === "completed" ? (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-green-600 dark:bg-green-500">
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </div>
      ) : state === "not_eligible" ? (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
          <Info className="h-10 w-10 text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
        </div>
      ) : (
        <RefundIllustration className="h-20" />
      )}

      <div className="space-y-1">
        <h2 className={`text-xl font-extrabold ${heading}`}>{t(labelKey)}</h2>
        <p className="text-sm font-semibold leading-relaxed text-muted-foreground dark:text-neutral-400">
          {t(descriptionKey)}
        </p>
      </div>
    </div>
  );
}
