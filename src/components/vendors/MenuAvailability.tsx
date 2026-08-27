"use client";

import { Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { buildAvailabilityView, type DayCode } from "@/lib/menuModel";

interface MenuAvailabilityProps {
  /** The selected menu's `availability`, straight from the API. */
  availability: unknown;
}

/** `t()` keys for the weekday abbreviations, indexed by the API's day codes. */
const DAY_KEYS: Record<DayCode, string> = {
  MON: "mon",
  TUE: "tue",
  WED: "wed",
  THU: "thu",
  FRI: "fri",
  SAT: "sat",
  SUN: "sun",
};

/**
 * The one muted line under the menu selector: when this menu is on.
 *
 * ## 🔴 It says something; it does not do anything
 *
 * The backend stores `availability` and returns it, and does **not** evaluate it
 * against the clock — a menu whose window closed hours ago still comes back from
 * the public endpoint and its products are still orderable. So this component
 * renders a sentence and stops. It never hides a menu, never disables a product,
 * never reorders a tab. If the backend ever starts enforcing the window, that
 * becomes a real feature with real rules, and this file is where the decision
 * to build it would begin — not somewhere a reading of the current clock quietly
 * appeared. Nothing in this component or in `buildAvailabilityView` asks what
 * time it is, and a guard asserts that stays true.
 *
 * ## Why the times are not converted
 *
 * `"10:00"` is wall-clock at the restaurant. There is no instant behind it and
 * no date to anchor one to, so it is printed as sent, with the vendor's own zone
 * named beside it. A vendor in the Azores keeps their own hours, and a customer
 * reading the page from anywhere sees the restaurant's clock, not their own.
 *
 * ## Why the sentence is assembled here rather than translated whole
 *
 * `t()` takes one key and does no interpolation, so there is no template to fill
 * — the label, the day runs and the times are separate lookups joined with
 * separators. That is also why `buildAvailabilityView` returns structure rather
 * than a string: the model decides what the window *is*, this decides how to
 * say it in the current language.
 */
export default function MenuAvailability({
  availability,
}: MenuAvailabilityProps) {
  const { t } = useTranslation();
  // The zone is deliberately not passed and not shown — see the note above the
  // return. `buildAvailabilityView` still carries the field for whoever wants it
  // back.
  const view = buildAvailabilityView(availability, null);

  // A menu with no window renders no caption — not an empty placeholder.
  if (!view) return null;

  // 🔴 Every selected day, listed. Not `Mon–Thu, Sun` — a range is a computed
  // summary of a set, and it makes the reader work out whether Tuesday is in it.
  // The only exception is all seven days, where one word loses nothing.
  const days = view.everyDay
    ? t("everyDay")
    : view.days.map((day) => t(DAY_KEYS[day])).join(", ");

  const hours =
    view.startTime && view.endTime
      ? `${view.startTime}–${view.endTime}`
      : view.startTime || view.endTime;

  // The zone is not printed. It is still the zone these times are in — that has
  // not changed, and `startTime`/`endTime` are still passed through unconverted
  // for exactly that reason. Naming it beside every menu was simply noise on a
  // single-country storefront, where the restaurant's clock and the customer's
  // are the same one. If DeliGo launches somewhere with a second zone (the
  // Azores are an hour behind mainland Portugal), this is the line to restore:
  // `view.timezone` already carries it, falling back to `STORE_TIMEZONE`.
  return (
    <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-neutral-400">
      <Clock size={14} className="shrink-0" />
      <span className="font-medium text-gray-700 dark:text-neutral-300">
        {t("menuAvailable")}
      </span>
      {days && <span>{days}</span>}
      {days && hours && <span aria-hidden="true">·</span>}
      {hours && <span>{hours}</span>}
    </p>
  );
}
