"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { getMsUntilClosing } from "@/lib/storeHours";

// Only surface the countdown inside the final hour before closing (user spec).
const COUNTDOWN_WINDOW_MS = 60 * 60 * 1000;

interface ClosingCountdownProps {
  closingHours: string | null | undefined;
  openingHours?: string | null;
  closingDays?: string[] | null;
  isStoreOpen: boolean;
}

// Live "closing soon" badge shown under the vendor name. Renders nothing unless
// the store is open and within the final hour of its closing time; then it ticks
// `Order within MM min SS sec` down to zero, once per second.
export default function ClosingCountdown({
  closingHours,
  openingHours,
  closingDays,
  isStoreOpen,
}: ClosingCountdownProps) {
  const { t } = useTranslation();
  // `null` until the client computes it (keeps SSR output empty — no hydration
  // mismatch from a server/client clock difference).
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    // Recompute from the real store-local clock each tick (cheap) — inherently
    // drift-free and self-correcting after a backgrounded/throttled tab.
    const tick = () => {
      const ms = getMsUntilClosing(closingHours, {
        openingHours,
        closingDays,
        isStoreOpen,
      });
      setRemainingMs(ms === null ? null : Math.max(0, ms));
      if (ms === null || ms <= 0) clearInterval(interval);
    };

    const interval = setInterval(tick, 1000);
    tick();
    return () => clearInterval(interval);
  }, [closingHours, openingHours, closingDays, isStoreOpen]);

  // Outside the final hour, already closed, or not applicable → render nothing.
  if (remainingMs === null || remainingMs <= 0 || remainingMs > COUNTDOWN_WINDOW_MS) {
    return null;
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="closing-banner mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 dark:border-pink-900/40 dark:bg-pink-950/20"
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#f9186b] dark:text-pink-400">
        <Clock size={16} className="closing-clock shrink-0" />
        {t("closingSoon")}
      </span>

      <span
        suppressHydrationWarning
        className="text-sm text-gray-600 dark:text-neutral-400"
      >
        {t("orderWithin")}{" "}
        <span className="font-semibold tabular-nums text-gray-900 dark:text-neutral-100">
          {pad(minutes)} {t("minShort")} {pad(seconds)} {t("secShort")}
        </span>
      </span>
    </div>
  );
}
