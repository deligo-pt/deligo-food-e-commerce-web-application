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
      className="closing-banner relative mb-6 flex items-center gap-3 overflow-hidden rounded-2xl bg-[#f9186b] px-4 py-3 text-white shadow-lg sm:px-5 sm:py-3.5"
      role="status"
      aria-live="polite"
    >
      {/* Sweeping light column */}
      <span className="closing-shimmer" aria-hidden="true" />

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
        <Clock size={18} className="closing-clock" />
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-sm font-bold uppercase tracking-wide sm:text-base">
          {t("closingSoon")}
        </span>
        <span
          suppressHydrationWarning
          className="flex items-center gap-1 text-sm font-medium text-white/90 sm:text-[15px]"
        >
          <span className="text-white/80">{t("orderWithin")}</span>
          <span className="tabular-nums">
            <span className="font-bold text-white">{pad(minutes)}</span>{" "}
            {t("minShort")}{" "}
            {/* `key` re-triggers the pop animation on every new second */}
            <span key={seconds} className="closing-sec-pop font-bold text-white">
              {pad(seconds)}
            </span>{" "}
            {t("secShort")}
          </span>
        </span>
      </div>
    </div>
  );
}
