"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { getMsUntilClosing } from "@/lib/storeHours";
import type { Availability } from "@/lib/availability";

// Only surface the countdown inside the final hour before closing (user spec).
const COUNTDOWN_WINDOW_MS = 60 * 60 * 1000;

interface ClosingCountdownProps {
  closingHours: string | null | undefined;
  openingHours?: string | null;
  closingDays?: string[] | null;
  isStoreOpen: boolean;
  /**
   * The backend's state (Phase 2). When given, it decides: nothing unless the
   * store is `OPEN`, and nothing during extended hours, whose end time is not
   * sent to customers — the normal closing time would be wrong.
   */
  availability?: Pick<Availability, "state" | "overrideType"> | null;
  /** Called once when the countdown reaches zero, to refetch the vendor. */
  onClosed?: () => void;
}

// Live "closing soon" badge shown under the vendor name. Renders nothing unless
// the store is open and within the final hour of its closing time; then it ticks
// `Order within MM min SS sec` down to zero, once per second.
export default function ClosingCountdown({
  closingHours,
  openingHours,
  closingDays,
  isStoreOpen,
  availability,
  onClosed,
}: ClosingCountdownProps) {
  const { t } = useTranslation();
  // `null` until the client computes it (keeps SSR output empty — no hydration
  // mismatch from a server/client clock difference).
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const applies = availability
    ? availability.state === "OPEN" && availability.overrideType !== "EXTENDED"
    : isStoreOpen;

  // The latest callback, without restarting the ticker when it changes.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    // Recompute from the real store-local clock each tick (cheap) — inherently
    // drift-free and self-correcting after a backgrounded/throttled tab.
    const tick = () => {
      const ms = getMsUntilClosing(closingHours, {
        openingHours,
        closingDays,
        isStoreOpen: applies,
      });
      setRemainingMs(ms === null ? null : Math.max(0, ms));
      // `getMsUntilClosing` rolls a passed closing time over to tomorrow, so
      // closing shows up as the remaining time jumping from ~0 back up.
      if (previous !== null && previous <= 3000 && (ms === null || ms > previous)) {
        onClosedRef.current?.();
      }
      previous = ms;
      if (ms === null) clearInterval(interval);
    };
    let previous: number | null = null;

    const interval = setInterval(tick, 1000);
    tick();
    return () => clearInterval(interval);
  }, [closingHours, openingHours, closingDays, applies]);

  // Outside the final hour, already closed, or not applicable → render nothing.
  if (remainingMs === null || remainingMs <= 0 || remainingMs > COUNTDOWN_WINDOW_MS) {
    return null;
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="closing-banner mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 dark:border-pink-900/40 dark:bg-pink-950/20"
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary dark:text-pink-400">
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
