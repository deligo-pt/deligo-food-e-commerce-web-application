import { DATE_LOCALES } from "./dateFormat";
import {
  addDays,
  getStoreToday,
  slotToIso,
  type CalendarDate,
  type TimeOfDay,
} from "./pickupTime";

/**
 * When a claimed reward can be collected at the DeliGo office.
 *
 * The API only checks that `scheduledPickupDate` is in the future; office
 * hours are the app's to enforce. Not confirmed yet (30 Oct 2026), so these are
 * the plan's defaults — weekdays, 10:00 to 18:00 Lisbon time, from tomorrow —
 * kept here in one place so the real hours are a one-line change.
 */
export const REWARD_PICKUP = {
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: [1, 2, 3, 4, 5],
  openHour: 10,
  /** The office closes at 18:00, so the last slot starts at 17:00. */
  closeHour: 18,
  slotMinutes: 60,
  /** Days from today to the first bookable one (1 = tomorrow). */
  firstDayOffset: 1,
  /** How many bookable days the picker offers. */
  dayCount: 10,
} as const;

function weekdayOf(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12)).getUTCDay();
}

/** The next `dayCount` office days, counted in Lisbon, never the browser. */
export function rewardPickupDays(now: Date = new Date()): CalendarDate[] {
  const today = getStoreToday(now);
  const days: CalendarDate[] = [];
  const weekdays: readonly number[] = REWARD_PICKUP.weekdays;
  for (let offset = REWARD_PICKUP.firstDayOffset; days.length < REWARD_PICKUP.dayCount; offset++) {
    const date = addDays(today, offset);
    if (weekdays.includes(weekdayOf(date))) days.push(date);
  }
  return days;
}

/** Every slot start in a day: 10:00, 11:00 … 17:00. */
export function rewardPickupTimes(): TimeOfDay[] {
  const times: TimeOfDay[] = [];
  for (
    let minutes = REWARD_PICKUP.openHour * 60;
    minutes < REWARD_PICKUP.closeHour * 60;
    minutes += REWARD_PICKUP.slotMinutes
  ) {
    times.push({ hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  }
  return times;
}

/** The UTC ISO string the claim call takes, from a Lisbon date and time. */
export function rewardPickupIso(date: CalendarDate, time: TimeOfDay, now: Date = new Date()): string {
  return slotToIso({ date, time }, now);
}

export function sameDay(a: CalendarDate | null, b: CalendarDate): boolean {
  return !!a && a.year === b.year && a.month === b.month && a.day === b.day;
}

/** A day chip: `{ weekday: "Mon", date: "2 Nov" }`, in the page's language. */
export function formatPickupDay(date: CalendarDate, lang: "en" | "pt") {
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(DATE_LOCALES[lang], { timeZone: "UTC", ...options })
      .format(instant)
      .replace(".", "");
  // Built from parts: pt-PT's own short forms are "segunda" and "2/11", too
  // long for a chip and not the "seg" / "2 nov" a Portuguese reader expects.
  return {
    weekday: fmt({ weekday: "short" }).slice(0, 3),
    date: `${date.day} ${fmt({ month: "short" })}`,
  };
}

/**
 * The pickup as the confirmation shows it: "Monday, 2 November 2026, 10:00",
 * read on a Lisbon clock whatever the browser's zone is.
 */
export function formatPickupInstant(iso: string, lang: "en" | "pt"): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    timeZone: "Europe/Lisbon",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

