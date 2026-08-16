/**
 * Turning the app's two languages into BCP-47 locales, in one place.
 *
 * `Intl` needs a locale tag; the store holds `"en" | "pt"`. Every formatter in
 * this repo has to make the same translation, and three of them had made their
 * own copy of this table before it was pulled out here.
 */
export const DATE_LOCALES: Record<"en" | "pt", string> = {
  en: "en-GB",
  pt: "pt-PT",
};

/**
 * An order's date, as it appears on an order card: `15/08/2026`.
 *
 * Date only, no time — which is what the mobile app's Report an Issue list
 * shows, and enough to tell two orders apart at a glance.
 *
 * The app's screenshot reads `8/15/2026` because that phone was in US English;
 * `en-GB` and `pt-PT` both put the day first. Locale-correct beats
 * pixel-identical here, the same trade `formatDayShort` in `pickupTime.ts`
 * already documents — forcing month-first onto a Portuguese reader to match one
 * screenshot would be a localisation bug dressed as fidelity.
 *
 * Returns an empty string for an unparseable date rather than "Invalid Date".
 */
export function formatOrderDate(
  iso: string | null | undefined,
  lang: "en" | "pt" = "pt",
): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(DATE_LOCALES[lang], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}
