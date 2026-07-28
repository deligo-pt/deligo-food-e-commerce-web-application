"use client";

import { Check } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import {
  refundStateDescriptionKey,
  refundStateLabelKey,
  type RefundState,
} from "@/lib/refund";
import RefundIllustration from "./RefundIllustration";

/**
 * What happened to the customer's money after their paid order was rejected or
 * cancelled. Renders nothing when there is no refund to announce, so callers
 * can mount it unconditionally.
 *
 * The two states are deliberately coloured apart: pink reads as "we're working
 * on it", green as "done, the money is back". A refund that is still pending
 * must never look finished.
 */
export default function RefundBanner({ state }: { state: RefundState }) {
  const { t } = useTranslation();

  const labelKey = refundStateLabelKey(state);
  const descriptionKey = refundStateDescriptionKey(state);
  if (!labelKey || !descriptionKey) return null;

  const isCompleted = state === "completed";

  return (
    // role="status" + aria-live: once polling is kept alive through the refund
    // (Phase 5) this heading changes under the user without any navigation, and
    // a screen reader would otherwise never announce it.
    <div
      role="status"
      aria-live="polite"
      data-refund-state={state}
      className={`flex flex-col items-center gap-4 rounded-3xl border border-transparent bg-white p-6 text-center shadow-md transition-colors duration-200 md:flex-row md:gap-6 md:p-8 md:text-left dark:bg-neutral-900 dark:border-neutral-800 border-l-4 dark:border-l-4 ${
        isCompleted
          ? "border-l-green-600 dark:border-l-green-500"
          : "border-l-[#f9186b] dark:border-l-[#f9186b]"
      }`}
    >
      {/* Completed is a solid green disc and in-progress the money bag, the
          same pairing the app uses — the two states must not be
          distinguishable only by colour. */}
      {isCompleted ? (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-green-600 dark:bg-green-500">
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </div>
      ) : (
        <RefundIllustration className="h-20" />
      )}

      <div className="space-y-1">
        <h2
          className={`text-2xl font-extrabold ${
            isCompleted
              ? "text-green-600 dark:text-green-400"
              : "text-[#f9186b] dark:text-pink-400"
          }`}
        >
          {t(labelKey)}
        </h2>
        <p className="text-sm font-semibold leading-relaxed text-[#5a4044] dark:text-neutral-400">
          {t(descriptionKey)}
        </p>
      </div>
    </div>
  );
}
