"use client";

import { useEffect, useRef } from "react";
import type { Availability } from "@/lib/availability";
import { calibrateServerClock, msUntil } from "@/lib/serverClock";

/**
 * A little after the backend's own switch: its cron runs about once a minute,
 * so asking exactly at `resumeAt` would usually get the old state back.
 */
const AFTER_SWITCH_MS = 5_000;
/** Then once more, in case the first answer was still the old state. */
const SECOND_TRY_MS = 65_000;
/** setTimeout cannot wait longer than ~24.8 days; a closed-for-the-week store is fine. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Calls `onChange` when a paused store's `resumeAt` or a closed store's
 * `nextOpenAt` arrives, so the page refetches and the banner goes away.
 *
 * There is no socket yet (Phase 7), and a pause that ends while the store is
 * closed by schedule sends no event at all, so the guide asks for this timer
 * anyway. Times are measured on `serverNow()`.
 */
export function useAvailabilityRefresh(
  availability: Pick<Availability, "state" | "resumeAt" | "nextOpenAt"> | null | undefined,
  onChange: () => void,
) {
  // The latest callback, without re-arming the timers when its identity changes.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const target =
    availability?.state === "PAUSED"
      ? availability.resumeAt
      : availability?.state === "CLOSED"
        ? availability.nextOpenAt
        : null;

  useEffect(() => {
    if (!target) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    void calibrateServerClock().then(() => {
      if (cancelled) return;
      const wait = msUntil(target);
      if (wait === null) return;
      const first = Math.min(MAX_TIMEOUT_MS, Math.max(0, wait) + AFTER_SWITCH_MS);
      timers = [
        setTimeout(() => onChangeRef.current(), first),
        setTimeout(() => onChangeRef.current(), Math.min(MAX_TIMEOUT_MS, first + SECOND_TRY_MS)),
      ];
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [target]);
}
