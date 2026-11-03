/**
 * The words for a store's state — "Closed · opens at 11:00", "Paused · back at
 * 15:00" — built from `lib/availability.ts`. Shared by the listing cards, the
 * vendor page banner and the popups, so every screen says the same thing.
 *
 * Times are shown in the store's timezone (the API sends ISO UTC). The vendor
 * lists do not send `timezone`, so Lisbon is the default; the single-vendor
 * route does send it.
 */
import type { Availability } from "@/lib/availability";
import {
  DEFAULT_STORE_TIME_ZONE,
  describeZonedDay,
  formatInZone,
  formatSlotWindow,
} from "@/lib/dateFormat";
import { serverNow } from "@/lib/serverClock";

type T = (key: string) => string;
type Lang = "en" | "pt";

/**
 * "at 11:00" / "tomorrow at 09:00" / "qui., 5 de nov. at 09:00", via one of three
 * keys per phrase so each language can place its own prepositions.
 * Null for a missing or unparseable time.
 */
function whenPhrase(
  iso: string | null,
  keys: { today: string; tomorrow: string; other: string },
  t: T,
  lang: Lang,
  timeZone: string,
): string | null {
  const day = describeZonedDay(iso, timeZone, lang, serverNow());
  const time = formatInZone(iso, timeZone, lang);
  if (!day || !time) return null;
  // A time already behind us (a stale list) still reads as today.
  const key = day.offset <= 0 ? keys.today : day.offset === 1 ? keys.tomorrow : keys.other;
  return t(key).replace("{time}", time).replace("{day}", day.label);
}

/** "opens at 11:00" — lower case, for the middle of a line. Null when unknown. */
export function opensText(
  availability: Pick<Availability, "nextOpenAt"> | null | undefined,
  t: T,
  lang: Lang,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
): string | null {
  return whenPhrase(
    availability?.nextOpenAt ?? null,
    { today: "opensAtTime", tomorrow: "opensTomorrowAt", other: "opensOnDayAt" },
    t,
    lang,
    timeZone,
  );
}

/** "back at 15:00" — lower case. Null when unknown. */
export function backText(
  availability: Pick<Availability, "resumeAt"> | null | undefined,
  t: T,
  lang: Lang,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
): string | null {
  return whenPhrase(
    availability?.resumeAt ?? null,
    { today: "backAtTime", tomorrow: "backTomorrowAt", other: "backOnDayAt" },
    t,
    lang,
    timeZone,
  );
}

/** First letter upper-cased, for a phrase that starts a sentence. */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

/**
 * The short status line on a listing card: "Open Now", "Closed · opens at
 * 11:00", "Paused · back at 15:00". Falls back to the bare word when the time
 * is not known.
 */
export function cardStatusLabel(
  availability: Availability | null,
  t: T,
  lang: Lang,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
): string {
  if (!availability || availability.state === "OPEN") return t("openNow");
  if (availability.state === "PAUSED") {
    const back = backText(availability, t, lang, timeZone);
    return back ? `${t("paused")} · ${back}` : t("paused");
  }
  const opens = opensText(availability, t, lang, timeZone);
  return opens ? `${t("closed")} · ${opens}` : t("closed");
}

/** `65 min 05 s` style remaining time; hours appear once there are any. */
export function formatRemaining(ms: number, t: T): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours} ${t("hourShort")} ${pad(minutes)} ${t("minShort")}`
    : `${pad(minutes)} ${t("minShort")} ${pad(seconds)} ${t("secShort")}`;
}

/**
 * A scheduled slot as the customer reads it: "Hoje 15:00–15:30",
 * "Amanhã 09:00–09:30", "qui., 5 de nov. 11:00–11:30". Used by checkout, the
 * payment page and the order screens, so the promise reads the same everywhere.
 * Empty string when the window is missing or unparseable.
 */
export function formatScheduledWindow(
  window: { start?: string | null; end?: string | null } | null | undefined,
  t: T,
  lang: Lang,
  timeZone: string = DEFAULT_STORE_TIME_ZONE,
): string {
  const time = formatSlotWindow(window?.start, window?.end, timeZone, lang);
  const day = describeZonedDay(window?.start, timeZone, lang, serverNow());
  if (!time || !day) return "";
  const dayName = day.offset === 0 ? t("today") : day.offset === 1 ? t("tomorrow") : day.label;
  return `${dayName} ${time}`;
}
