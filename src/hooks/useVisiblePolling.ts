"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `callback` every `intervalMs`, but ONLY while the browser tab is
 * visible. Pauses on hidden/background tabs (so idle tabs make zero requests)
 * and fires once immediately when the tab becomes visible again.
 *
 * Phase 2 helper — used to tame the 5s polling on the notifications and
 * order-tracking screens. Pass `enabled: false` to stop polling entirely
 * (e.g. once an order reaches a terminal state).
 */
export function useVisiblePolling(
  callback: () => void,
  intervalMs: number,
  options?: { enabled?: boolean; fireOnVisible?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const fireOnVisible = options?.fireOnVisible ?? true;

  // Keep the latest callback without restarting the interval when it changes.
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const tick = () => savedCallback.current();

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (fireOnVisible) tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, fireOnVisible]);
}
