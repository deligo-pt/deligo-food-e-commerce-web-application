"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import {
  clampToWindow,
  formatTimeOfDay,
  getStoreToday,
  STORE_TIME_ZONE,
  toMinutes,
  type PickupWindow,
  type TimeOfDay,
} from "@/lib/pickupTime";

/** Granularity of the minute wheel. */
const MINUTE_STEP = 5;

/** Row height in px. Mirrored in the wheel's inline sizing — keep them in step. */
const ROW_H = 40;

/** Rows visible at once. Odd, so exactly one sits on the centre line. */
const VISIBLE_ROWS = 5;

interface PickupTimePickerProps {
  /**
   * The band of selectable times. The caller guarantees it is non-null, and
   * recomputes it as the clock moves — so this prop changes underneath the
   * sheet while it is open, and the draft is re-clamped when it does.
   */
  window: PickupWindow;
  /** Currently chosen time, so reopening the sheet resumes where it left off. */
  value: TimeOfDay | null;
  /**
   * Reports the store-local wall-clock time, not an ISO string. Serialisation
   * happens once, at submit, so there is a single place where a timezone is
   * applied — see `toPickupIso`.
   */
  onConfirm: (time: TimeOfDay) => void;
  onClose: () => void;
}

/**
 * The bottom sheet for choosing a self-pickup time.
 *
 * ## Why there is no calendar
 *
 * The mobile app shows a full month grid here. The backend does not support it:
 * any date other than the store's today is rejected with
 * `PICKUP_TIME_MUST_BE_TODAY`. Rendering thirty tappable days when twenty-nine
 * of them fail is worse than not offering them, so the date is shown as a fixed
 * row instead.
 *
 * If scheduled pickup ships later, this is where the grid goes; nothing else in
 * the flow assumes today.
 *
 * ## Why the wheels cannot reach an invalid time
 *
 * The columns are not 0-23 and 0-59 with validation on top. They are built from
 * `window`, which has already intersected the store's opening hours with
 * now-plus-lead-time — so every row that exists is a time the backend accepts,
 * and there is nothing to reject. The minute column is rebuilt whenever the
 * hour changes, because the first and last hour of the window are partial: at
 * 22:30 closing, hour 22 offers only :00 through :30.
 */
export default function PickupTimePicker({
  window: pickupWindow,
  value,
  onConfirm,
  onClose,
}: PickupTimePickerProps) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);

  // What the wheels were last *told*. Never rendered directly — see below.
  const [rawDraft, setRawDraft] = useState<TimeOfDay>(() => value ?? pickupWindow.earliest);

  const confirmRef = useRef<HTMLButtonElement>(null);

  const earliest = toMinutes(pickupWindow.earliest);
  const latest = toMinutes(pickupWindow.latest);

  /**
   * The time actually shown, plus the rows each wheel offers.
   *
   * Derived in one pass rather than stored and corrected afterwards. Two things
   * can invalidate a selection, and both are outside this component's control:
   *
   *  - `pickupWindow` advances on the caller's clock, so a sheet left open long
   *    enough sees `earliest` move past whatever is selected;
   *  - changing the hour rebuilds the minute column, and the minute that was
   *    selected may not exist in the new one (22:45 is fine at 21:00, not at
   *    22:30 closing).
   *
   * Correcting either in an effect would mean rendering the invalid value once
   * and then re-rendering — a visible flicker on the wheel, and a cascade React
   * rightly warns about. Normalising on the way out means the invalid state is
   * never rendered at all.
   */
  const { draft, hourOptions, minuteOptions } = useMemo(() => {
    const clamped = clampToWindow(rawDraft, pickupWindow);

    const firstHour = Math.floor(earliest / 60);
    const lastHour = Math.floor(latest / 60);
    const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);

    // Partial at both ends: the opening hour starts at the lead time rather
    // than :00, and the closing hour stops at the store's closing minute.
    const base = clamped.hours * 60;
    const from = Math.max(earliest, base);
    const to = Math.min(latest, base + 59);
    const minutes: number[] = [];
    for (
      let m = Math.ceil((from - base) / MINUTE_STEP) * MINUTE_STEP;
      base + m <= to;
      m += MINUTE_STEP
    ) {
      minutes.push(m);
    }
    // A window narrower than one step leaves this empty (22:28–22:30, say).
    // The exact boundary minute beats an empty column.
    if (!minutes.length) minutes.push(to - base);

    const minute = minutes.includes(clamped.minutes)
      ? clamped.minutes
      : minutes.reduce((best, m) =>
          Math.abs(m - clamped.minutes) < Math.abs(best - clamped.minutes) ? m : best,
        );

    return {
      draft: { hours: clamped.hours, minutes: minute },
      hourOptions: hours,
      minuteOptions: minutes,
    };
  }, [rawDraft, pickupWindow, earliest, latest]);

  // Escape closes without choosing — the sheet is a detour, not a trap.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // The confirm button is the sheet's purpose, so it takes focus on open. That
  // also moves the keyboard out of the page behind the backdrop.
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const todayLabel = useMemo(() => {
    const today = getStoreToday();
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-PT", {
      timeZone: STORE_TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(today.year, today.month - 1, today.day, 12)));
  }, [lang]);

  // Both write the raw value; the memo above decides what that means.
  const setHours = useCallback((hours: number) => {
    setRawDraft((current) => ({ ...current, hours }));
  }, []);
  const setMinutes = useCallback((minutes: number) => {
    setRawDraft((current) => ({ ...current, minutes }));
  }, []);

  return (
    <div className="fixed inset-0 z-9999 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#191c1d]/60 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-time-heading"
        className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-neutral-900 sm:rounded-3xl"
      >
        {/* Decorative on the web, but it is what makes the sheet read as the
            same component the mobile app shows. */}
        <div
          aria-hidden="true"
          className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-gray-200 dark:bg-neutral-700"
        />

        <h2
          id="pickup-time-heading"
          className="text-center text-lg font-bold text-gray-900 dark:text-neutral-50"
        >
          {t("estimatedPickupTime")}
        </h2>

        {/* The date, stated rather than chosen — see the component comment. */}
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-neutral-800/60">
          <Clock size={16} className="shrink-0 text-[#f9186b] dark:text-pink-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-neutral-50">
            {t("today")} — {todayLabel}
          </span>
        </div>

        <p className="mt-2 text-center text-xs text-gray-500 dark:text-neutral-400">
          {t("pickupAvailableToday")} {formatTimeOfDay(pickupWindow.earliest)} –{" "}
          {formatTimeOfDay(pickupWindow.latest)}
        </p>

        {/* Wheels. The centre band is a single absolutely-positioned element
            behind both columns rather than a highlight per column, so the two
            always agree on where "selected" is. */}
        <div
          className="relative mt-5 flex items-stretch justify-center gap-3"
          style={{ height: ROW_H * VISIBLE_ROWS }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 rounded-xl bg-pink-50 dark:bg-pink-950/25"
            style={{ height: ROW_H, top: ROW_H * Math.floor(VISIBLE_ROWS / 2) }}
          />

          <Wheel
            label={t("pickupHour")}
            options={hourOptions}
            selected={draft.hours}
            onSelect={setHours}
          />
          <span className="z-10 self-center pb-1 text-2xl font-bold text-gray-300 dark:text-neutral-600">
            :
          </span>
          <Wheel
            label={t("pickupMinute")}
            options={minuteOptions}
            selected={draft.minutes}
            onSelect={setMinutes}
          />

          {/* Fades top and bottom, so rows read as leaving the wheel rather
              than being clipped. `to-transparent` on both ends keeps the
              middle untouched. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 bg-linear-to-b from-white to-transparent dark:from-neutral-900"
            style={{ height: ROW_H * 1.6 }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-white to-transparent dark:from-neutral-900"
            style={{ height: ROW_H * 1.6 }}
          />
        </div>

        {/* The chosen time in full, because the wheels show two numbers in
            isolation and this is what the customer is agreeing to. */}
        <p
          aria-live="polite"
          className="mt-4 text-center text-sm font-semibold text-gray-900 dark:text-neutral-50"
        >
          {formatTimeOfDay(draft)}
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onConfirm(draft)}
            className="w-full rounded-2xl bg-[#f9186b] py-4 text-base font-semibold text-white transition hover:bg-[#d4145b]"
          >
            {t("confirmPickupTime")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl py-2 text-sm font-medium text-gray-500 transition hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-50"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}


interface WheelProps {
  label: string;
  options: number[];
  selected: number;
  onSelect: (value: number) => void;
}

/**
 * One column of the time wheel.
 *
 * ## Why this is not just an overflow container
 *
 * The first version relied purely on native scrolling. That works with a
 * trackpad, a mouse wheel and a touchscreen — but a plain mouse has none of
 * those gestures, and dragging a scroll container with the cursor is not
 * something browsers do. On a desktop with a mouse the wheel simply did not
 * move, which is the one input a checkout page cannot afford to miss.
 *
 * So the column keeps native scrolling *and* adds a pointer drag on top of it.
 * `setPointerCapture` means the drag survives the cursor leaving the column;
 * `touch-action: pan-y` leaves touch to the browser, which already does it
 * better than any handler could — momentum included.
 *
 * ## Snapping
 *
 * CSS snap is disabled for the duration of a drag. Left on, it fights every
 * pixel of the movement, and the column feels like it is stuck to a grid rather
 * than being pulled. It comes back on release, which is also when the final
 * position is animated to the nearest row and the selection is reported.
 */
function Wheel({ label, options, selected, onSelect }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Suppresses the scroll handler while the column is being positioned in code.
   * Without it, scrolling to reflect a prop change fires the handler, which
   * reports a selection, which moves the column — a loop that fights the user.
   */
  const programmaticRef = useRef(false);
  const dragRef = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const index = Math.max(0, options.indexOf(selected));

  /** Reports whichever row is nearest the centre line. */
  const commitNearest = useCallback(
    (smooth: boolean) => {
      const el = ref.current;
      if (!el) return;
      const nearest = Math.min(
        options.length - 1,
        Math.max(0, Math.round(el.scrollTop / ROW_H)),
      );
      const next = options[nearest];
      if (next === undefined) return;

      if (next === selected) {
        // Same row, but the column may be resting between two of them: settle
        // it without a state change, which would not re-run the sync effect.
        programmaticRef.current = true;
        el.scrollTo({ top: nearest * ROW_H, behavior: smooth ? "smooth" : "auto" });
        setTimeout(() => {
          programmaticRef.current = false;
        }, 260);
        return;
      }
      onSelect(next);
    },
    [options, selected, onSelect],
  );

  // Keep the column aligned with the value it is showing. Runs on mount
  // (jumping straight to the seeded time) and whenever the value or the option
  // list changes from outside — a window that has moved on, or an hour change
  // that rebuilt the minutes.
  useEffect(() => {
    const el = ref.current;
    if (!el || dragRef.current) return;
    const target = index * ROW_H;
    if (Math.abs(el.scrollTop - target) < 1) return;

    programmaticRef.current = true;
    el.scrollTo({ top: target, behavior: "smooth" });
    const id = setTimeout(() => {
      programmaticRef.current = false;
    }, 260);
    return () => clearTimeout(id);
  }, [index, options.length]);

  useEffect(
    () => () => {
      if (settleRef.current) clearTimeout(settleRef.current);
    },
    [],
  );

  /**
   * Native scrolling — wheel, trackpad, touch, keyboard.
   *
   * `scrollend` would be the exact signal for "motion has stopped" but is not
   * available everywhere, so a short debounce stands in. 110ms rides out
   * trackpad momentum without the value feeling like it lags the gesture.
   */
  const handleScroll = () => {
    if (programmaticRef.current || dragRef.current) return;
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => commitNearest(true), 110);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Touch is left to the browser: it already scrolls this container with
    // momentum, and hijacking it would be a downgrade.
    if (event.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;

    dragRef.current = { startY: event.clientY, startTop: el.scrollTop, moved: false };
    setIsDragging(true);
    el.setPointerCapture(event.pointerId);
    if (settleRef.current) clearTimeout(settleRef.current);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = ref.current;
    if (!drag || !el) return;

    const delta = event.clientY - drag.startY;
    // A few pixels of slop, so a click that wobbles is still a click.
    if (Math.abs(delta) > 3) drag.moved = true;
    el.scrollTop = drag.startTop - delta;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const el = ref.current;
    el?.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
    if (drag.moved) commitNearest(true);
  };

  /** Arrow keys move one row, so the column is operable without a pointer. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = options[Math.min(options.length - 1, Math.max(0, index + step))];
    if (next !== undefined && next !== selected) onSelect(next);
  };

  const pad = ROW_H * Math.floor(VISIBLE_ROWS / 2);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={`z-10 w-20 overflow-y-auto overscroll-contain rounded-xl outline-none select-none [touch-action:pan-y] focus-visible:ring-2 focus-visible:ring-[#f9186b] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        isDragging ? "cursor-grabbing snap-none" : "cursor-grab snap-y snap-mandatory"
      }`}
    >
      {/* Spacers let the first and last option reach the centre band. */}
      <div style={{ height: pad }} aria-hidden="true" />
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            // A drag that ends over a row must not also select that row — the
            // gesture was a scroll, and the centre line decides the value.
            onClick={() => {
              if (dragRef.current?.moved) return;
              onSelect(option);
            }}
            style={{ height: ROW_H }}
            className={`flex w-full snap-center items-center justify-center text-2xl font-bold tabular-nums transition-colors ${
              isSelected
                ? "text-[#f9186b] dark:text-pink-400"
                : "text-gray-400 dark:text-neutral-600"
            }`}
          >
            {String(option).padStart(2, "0")}
          </button>
        );
      })}
      <div style={{ height: pad }} aria-hidden="true" />
    </div>
  );
}
