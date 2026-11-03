"use client";

import { vendorCopyKey, type VendorKind } from "@/lib/vendorKind";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useStore } from "@/stores/translationStore";
import { useCheckoutSlots } from "@/hooks/queries/useCheckoutSlots";
import { getApiErrorKey } from "@/lib/apiClient";
import { formatDayShort } from "@/lib/pickupTime";
import { DEFAULT_STORE_TIME_ZONE, formatInZone } from "@/lib/dateFormat";
import { backText, capitalize, opensText } from "@/lib/storeStatusText";
import {
  SLOT_DATE_WINDOW_ERRORS,
  type CheckoutSlot,
  type ChosenSlot,
  type FulfillmentType,
} from "@/types/slots";
import { Button } from "@/components/ui/button";

interface SlotPickerProps {
  /** The vendor's Mongo `_id`. */
  vendorId: string;
  /** Restaurant, store or neither — names it in "not taking orders". */
  vendorKind?: VendorKind;
  fulfillmentType: FulfillmentType;
  /** The current choice, so reopening resumes on it. */
  value: ChosenSlot | null;
  onConfirm: (choice: ChosenSlot) => void;
  onClose: () => void;
  /** Sheet heading, e.g. "Pick-up time". */
  title: string;
  /** Confirm button, e.g. "Confirm Pickup Time". */
  confirmLabel: string;
}

/** `"2026-11-05"` → `{ year, month, day }`, for `formatDayShort`. */
function toCalendarDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

/** Every `YYYY-MM-DD` from `from` to `to`, inclusive. At most a few days. */
function dateKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  for (let i = 0; cursor <= end && i < 7; i++) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/**
 * The bottom sheet for choosing a 30-minute slot, for pickup or delivery.
 *
 * Every row comes from `GET /checkout/pickup-slots`, which lists exactly what
 * `POST /checkout` accepts — past, too-soon, closed, paused and after-cutoff
 * slots are already removed, so nothing is filtered here (guide §2). This
 * replaced `PickupTimePicker`, which generated the half-hours on the client by
 * re-implementing the backend's rules.
 *
 * - Day chips come from `allowedDates`: one for a restaurant, three for a store.
 * - A chosen slot keeps the server's `startTime`/`endTime` unchanged.
 * - A date outside the window resets to today (`allowedDates.from`).
 * - The list refetches on open, every 3 minutes, and on window focus.
 */
export default function SlotPicker({
  vendorId,
  vendorKind = "partner",
  fulfillmentType,
  value,
  onConfirm,
  onClose,
  title,
  confirmLabel,
}: SlotPickerProps) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang) as "en" | "pt";
  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  /** The open day: null is today (asked without `date`), else `YYYY-MM-DD`. */
  const [date, setDate] = useState<string | null>(value?.date ?? null);
  /** The pending choice; Confirm commits it. Nothing is preselected. */
  const [draft, setDraft] = useState<ChosenSlot | null>(value);

  const { data, error, isLoading, isFetching, refetch } = useCheckoutSlots({
    vendorId,
    fulfillmentType,
    date,
  });

  // The window and timezone from the last answer, kept while another day loads
  // so the chips do not disappear and reappear.
  const [slotWindow, setSlotWindow] = useState<{ from: string; to: string; tz: string } | null>(null);
  const answerWindow = data
    ? { from: data.allowedDates.from, to: data.allowedDates.to, tz: data.timezone }
    : null;
  if (
    answerWindow &&
    (answerWindow.from !== slotWindow?.from || answerWindow.to !== slotWindow?.to || answerWindow.tz !== slotWindow?.tz)
  ) {
    setSlotWindow(answerWindow);
  }
  const timeZone = slotWindow?.tz ?? DEFAULT_STORE_TIME_ZONE;

  const errorKey = getApiErrorKey(error);
  const dateOutOfWindow = !!errorKey && SLOT_DATE_WINDOW_ERRORS.has(errorKey);
  // A day that is no longer allowed (midnight passed, or the window shrank):
  // back to today, as the guide says. Today itself cannot be out of window.
  if (dateOutOfWindow && date !== null) setDate(null);

  const dayKeys = useMemo(() => (slotWindow ? dateKeysBetween(slotWindow.from, slotWindow.to) : []), [slotWindow]);
  const activeKey = date ?? slotWindow?.from ?? null;

  useEscapeToClose(true, onClose, { layer: 9999 });

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  // Reopening on a choice scrolls it into view once its row exists.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || !selectedRowRef.current) return;
    selectedRowRef.current.scrollIntoView({ block: "center" });
    scrolledRef.current = true;
  });

  const slots: CheckoutSlot[] = data?.slots ?? [];
  const isDraftOnThisDay = !!draft && draft.date === date;
  const selected =
    isDraftOnThisDay && slots.some((slot) => slot.startTime === draft.slot.startTime)
      ? draft
      : null;

  const dayLabel = (key: string, index: number) =>
    index === 0 ? t("today") : index === 1 ? t("tomorrow") : formatDayShort(toCalendarDate(key), lang);

  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const openDay = (index: number) => setDate(index === 0 ? null : dayKeys[index]);
  const handleChipKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = index + step;
    if (next < 0 || next >= dayKeys.length) return;
    openDay(next);
    chipRefs.current[next]?.focus();
  };

  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const handleSlotKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    slotRefs.current[index + step]?.focus();
  };

  const activeIndex = activeKey ? dayKeys.indexOf(activeKey) : -1;
  const nextDayIndex = activeIndex >= 0 && activeIndex + 1 < dayKeys.length ? activeIndex + 1 : -1;

  /** Why a loaded day has no rows, and when the store is back if we know. */
  const emptyMessage = () => {
    if (date !== null) return t("noSlotsOnDay");
    const store = data?.store;
    const when =
      store?.state === "PAUSED"
        ? backText(store, t, lang, timeZone)
        : store?.state === "CLOSED"
          ? opensText(store, t, lang, timeZone)
          : null;
    return when ? `${t("noSlotsToday")}. ${capitalize(when)}.` : t("noSlotsToday");
  };

  const renderBody = () => {
    if (errorKey === "VENDOR_NOT_ACCEPTING_ORDERS") {
      return <p className="py-8 text-center text-sm text-gray-500 dark:text-neutral-400">{t(vendorCopyKey("vendorNotAcceptingOrders", vendorKind))}</p>;
    }
    if (error && !dateOutOfWindow) {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-neutral-400">{t("slotsLoadFailed")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} className="rounded-xl">
            <RefreshCw size={14} />
            {t("retry")}
          </Button>
        </div>
      );
    }
    if (isLoading || dateOutOfWindow || !data) {
      return (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-13 animate-pulse rounded-2xl bg-gray-100 dark:bg-neutral-800/60" />
          ))}
        </div>
      );
    }
    if (slots.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-neutral-400">{emptyMessage()}</p>
          {nextDayIndex > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => openDay(nextDayIndex)} className="rounded-xl">
              {t("seeDay").replace("{day}", dayLabel(dayKeys[nextDayIndex], nextDayIndex))}
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {slots.map((slot, index) => {
          const isSelected = selected?.slot.startTime === slot.startTime;
          return (
            <button
              key={slot.startTime}
              ref={(node) => {
                slotRefs.current[index] = node;
                if (isSelected) selectedRowRef.current = node;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => setDraft({ slot, date, timezone: timeZone })}
              onKeyDown={(event) => handleSlotKeyDown(event, index)}
              className={`focus-ring flex items-center justify-between rounded-2xl px-4 py-4 text-left text-sm font-medium transition ${
                isSelected
                  ? "bg-primary/5 text-gray-900 ring-1 ring-primary dark:bg-pink-950/25 dark:text-neutral-50 dark:ring-pink-400"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-neutral-800/60 dark:text-neutral-200 dark:hover:bg-neutral-800"
              }`}
            >
              {/* The server's own label for the start; the end in the same zone. */}
              <span className="tabular-nums">
                {slot.label} – {formatInZone(slot.endTime, timeZone, lang)}
              </span>
              {isSelected && (
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-primary dark:bg-pink-500">
                  <Check size={13} strokeWidth={3} className="text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
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
        aria-labelledby="slot-picker-heading"
        tabIndex={-1}
        className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl outline-none sm:max-h-[80vh] sm:rounded-3xl"
      >
        <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-700" />

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
          <h2 id="slot-picker-heading" className="min-w-0 flex-1 text-xl font-bold text-gray-900 dark:text-neutral-50">
            {title}
          </h2>
          {isFetching && !isLoading && (
            <RefreshCw size={16} aria-hidden="true" className="shrink-0 animate-spin text-gray-400" />
          )}
        </div>

        {/* Day chips, from `allowedDates`. Scrolls sideways on a narrow phone. */}
        {dayKeys.length > 1 && (
          <div
            role="tablist"
            aria-label={t("selectPickupDay")}
            className="flex shrink-0 gap-2 overflow-x-auto px-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {dayKeys.map((key, index) => {
              const isOpen = key === activeKey;
              return (
                <button
                  key={key}
                  ref={(node) => {
                    chipRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isOpen}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => openDay(index)}
                  onKeyDown={(event) => handleChipKeyDown(event, index)}
                  className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                    isOpen
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  }`}
                >
                  {dayLabel(key, index)}
                </button>
              );
            })}
          </div>
        )}

        <div className="shrink-0 px-6 pt-4">
          <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-neutral-500">
            {t("timeSlot")}
          </p>
          <p className="pt-1 text-xs text-gray-500 dark:text-neutral-400">
            {timeZone === DEFAULT_STORE_TIME_ZONE ? t("pickupTimesInLisbon") : t("timesInStoreZone")}
            {data && data.leadTimeMinutes > 0 && (
              <> {t("orderAheadMinutes").replace("{n}", String(data.leadTimeMinutes))}</>
            )}
          </p>
        </div>

        {/* The only scrolling region: the chips and Confirm stay put. */}
        <div role="listbox" aria-label={t("timeSlot")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3">
          {renderBody()}
        </div>

        <div className="shrink-0 border-t border-border p-6">
          <Button
            type="button"
            size="lg"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            className="w-full rounded-2xl font-semibold"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
