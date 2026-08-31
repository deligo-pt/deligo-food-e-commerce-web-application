"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import {
  findFirstAvailableDay,
  formatDayShort,
  formatSlotRange,
  formatTimeOfDay,
  isSameDate,
  isSlotOnDay,
  resolveActiveDay,
  type PickupDay,
  type PickupSlot,
  type TimeOfDay,
} from "@/lib/pickupTime";
import { Button } from "@/components/ui/button";

interface PickupTimePickerProps {
  /**
   * The bookable days, in order, today first. Recomputed on the caller's clock,
   * so the list changes underneath an open sheet — including going empty, if
   * the store closes while the customer is choosing. That case renders a reason
   * and a disabled Confirm rather than an empty box.
   */
  days: PickupDay[];
  /** The store's closing time, so the last slot's label can be clamped to it. */
  closingHours?: string | null;
  /** The current choice, so reopening resumes on it. */
  value: PickupSlot | null;
  onConfirm: (slot: PickupSlot) => void;
  onClose: () => void;
}

/**
 * The bottom sheet for choosing a self-pickup slot.
 *
 * ## Why this is a list and not the wheels it replaces
 *
 * The previous version was two scroll wheels reaching an exact minute, which is
 * what the backend used to accept. It now takes only `:00` and `:30` — ten of
 * the twelve minutes those wheels offered are rejected outright — so the wheels
 * were not merely unfashionable, they were producing invalid times.
 *
 * Replacing them with a list deletes the entire apparatus that made them work:
 * the minute column rebuilt per hour, the programmatic-scroll suppression, the
 * settle debounce, `setPointerCapture`, the drag-versus-click slop test, and the
 * snap-disable dance — **including the mouse-drag bug this feature shipped once
 * and had to fix**. A list of rows scrolls natively, with a mouse, a trackpad, a
 * finger or a keyboard, and needs no handler at all.
 *
 * ## Nothing invalid is reachable
 *
 * The rows are not "all half hours, validated". They are `PickupDay.slots`,
 * which `getPickupDays` built from the store's hours and the backend's rules —
 * so every row that exists is a slot the API has been proven to accept, and
 * there is nothing to reject. Days the vendor cannot be booked on are not
 * generated at all: a restaurant produces one chip, a store three.
 */
export default function PickupTimePicker({
  days,
  closingHours,
  value,
  onConfirm,
  onClose,
}: PickupTimePickerProps) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);

  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement>(null);

  /**
   * Which chip is open. Seeded once — from the existing choice if there is one,
   * otherwise the first day that has anything to offer, which is how a store
   * that has closed for today opens on tomorrow instead of on a dead list.
   */
  const [openDayOffset, setOpenDayOffset] = useState<number>(() => {
    const chosen = value && days.find((day) => isSameDate(day.date, value.date));
    return chosen?.offset ?? findFirstAvailableDay(days)?.offset ?? days[0]?.offset ?? 0;
  });

  /**
   * The chip actually rendered as open.
   *
   * Derived rather than corrected: the day list is rebuilt on the caller's
   * clock, and a seeded offset can stop existing (midnight rolls the window
   * forward). Falling back on the way out means the invalid state is never
   * rendered — the lesson from the wheels, where correcting afterwards showed a
   * visible flicker.
   */
  const activeDay = useMemo(
    () => resolveActiveDay(days, openDayOffset),
    [days, openDayOffset],
  );

  /** The pending choice. Confirm is what commits it to the page. */
  const [draft, setDraft] = useState<PickupSlot | null>(value);

  /**
   * The draft, if it is still real *and* belongs to the day on screen.
   *
   * Two things can invalidate it, both from outside: the slot can pass while
   * the sheet sits open, and the customer can switch chips. A time without its
   * date is not a booking, so a draft made on Saturday is not shown as selected
   * while Friday is open — but it is kept, so coming back to Saturday resumes
   * rather than punishing the detour.
   */
  const selected = useMemo(
    () => (isSlotOnDay(draft, activeDay) ? draft : null),
    [draft, activeDay],
  );

  // Escape closes without choosing — the sheet is a detour, not a trap.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus moves into the sheet on open, so the page behind it is out of the
  // keyboard's reach. The sheet itself rather than Confirm, which starts
  // disabled when nothing is chosen yet.
  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  // Reopening on an existing choice should show it, not make the customer hunt
  // down a list of twenty-four rows for the one they already picked.
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: "center" });
    // Mount only: re-running on every selection would yank the list while the
    // customer is reading it.
  }, []);

  const dayLabel = (day: PickupDay) => {
    if (day.offset === 0) return t("today");
    if (day.offset === 1) return t("tomorrow");
    return formatDayShort(day.date, lang);
  };

  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /** Left/right move between chips, skipping the ones that cannot be opened. */
  const handleChipKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();

    for (let i = index + step; i >= 0 && i < days.length; i += step) {
      if (days[i].slots.length === 0) continue;
      setOpenDayOffset(days[i].offset);
      chipRefs.current[i]?.focus();
      return;
    }
  };

  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /** Up/down move between slots, so the list is operable without a pointer. */
  const handleSlotKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step || !activeDay) return;
    event.preventDefault();

    const next = index + step;
    if (next < 0 || next >= activeDay.slots.length) return;
    slotRefs.current[next]?.focus();
  };

  const selectSlot = (time: TimeOfDay) => {
    if (!activeDay) return;
    setDraft({ date: activeDay.date, time });
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#191c1d]/60 backdrop-blur-md"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-time-heading"
        tabIndex={-1}
        className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-neutral-900 sm:max-h-[80vh] sm:rounded-3xl"
      >
        {/* Decorative on the web, but it is what makes the sheet read as the
            same component the mobile app shows. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-700"
        />

        <div className="flex shrink-0 items-center gap-3 px-6 pt-4">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label={t("close")}
            className="-ml-2 rounded-full text-gray-500 dark:text-neutral-400"
          >
            <ArrowLeft size={20} />
          </Button>
          <h2
            id="pickup-time-heading"
            className="text-xl font-bold text-gray-900 dark:text-neutral-50"
          >
            {t("pickupSheetTitle")}
          </h2>
        </div>

        {/* Day chips. Horizontally scrollable because three of them plus a
            weekday name does not fit a 320px screen. */}
        <div
          role="tablist"
          aria-label={t("selectPickupDay")}
          className="flex shrink-0 gap-2 overflow-x-auto px-6 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {days.map((day, index) => {
            const isOpen = activeDay?.offset === day.offset;
            const isEmpty = day.slots.length === 0;

            return (
              <button
                key={day.offset}
                ref={(node) => {
                  chipRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                aria-selected={isOpen}
                // A day the store cannot be booked on stays visible and goes
                // quiet. Dropping the chip would read as "that day is not
                // supported"; a disabled one reads as "not that day".
                disabled={isEmpty}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => setOpenDayOffset(day.offset)}
                onKeyDown={(event) => handleChipKeyDown(event, index)}
                className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  isOpen
                    ? "bg-primary text-white"
                    : isEmpty
                      ? "bg-gray-50 text-gray-300 line-through dark:bg-neutral-800/40 dark:text-neutral-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {dayLabel(day)}
              </button>
            );
          })}
        </div>

        {/* Why a chip is struck through, said once rather than per chip. */}
        {days.some((day) => day.slots.length === 0) && (
          <p className="shrink-0 px-6 pb-3 text-xs text-gray-500 dark:text-neutral-400">
            {days[0]?.slots.length === 0 ? t("noSlotsToday") : t("noSlotsThisDay")}
          </p>
        )}

        <p className="shrink-0 px-6 text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-neutral-500">
          {t("timeSlot")}
        </p>

        {/* The only scrolling region: the day row and the confirm button stay
            put, so the customer never scrolls past the thing they came to
            press. */}
        <div
          role="listbox"
          aria-label={t("timeSlot")}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3"
        >
          {activeDay && activeDay.slots.length > 0 ? (
            <div className="flex flex-col gap-2">
              {activeDay.slots.map((time, index) => {
                const isSelected =
                  !!selected &&
                  selected.time.hours === time.hours &&
                  selected.time.minutes === time.minutes;

                return (
                  <button
                    key={formatTimeOfDay(time)}
                    ref={(node) => {
                      slotRefs.current[index] = node;
                      if (isSelected) selectedRowRef.current = node;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectSlot(time)}
                    onKeyDown={(event) => handleSlotKeyDown(event, index)}
                    className={`focus-ring flex items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-medium transition ${
                      isSelected
                        ? "bg-pink-50 text-gray-900 ring-1 ring-primary dark:bg-pink-950/25 dark:text-neutral-50 dark:ring-pink-400"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-neutral-800/60 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="tabular-nums">
                      {formatSlotRange(time, closingHours)}
                    </span>
                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-primary dark:bg-pink-500"
                      >
                        <Check size={13} strokeWidth={3} className="text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-neutral-400">
              {activeDay?.offset === 0 ? t("noSlotsToday") : t("noSlotsThisDay")}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 p-6 dark:border-neutral-800">
          <Button
            type="button"
            size="lg"
            // Nothing is preselected on a first visit: a slot the customer
            // never read is not a choice they made.
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            className="w-full rounded-2xl font-semibold"
          >
            {t("confirmPickupTime")}
          </Button>
        </div>
      </div>
    </div>
  );
}
