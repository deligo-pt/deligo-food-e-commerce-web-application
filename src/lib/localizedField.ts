/**
 * A text field that the backend may return either already resolved to a string
 * (most endpoints honour the `Accept-Language` header apiClient sends) or as
 * the raw bilingual document. The offers endpoints return the raw object, and
 * rendering one directly throws "Objects are not valid as a React child".
 *
 * Type any API text field as this rather than `string` unless you've confirmed
 * the endpoint resolves it — a `string` type the API doesn't honour compiles
 * cleanly and crashes at render.
 */
export type LocalizedField = string | { en?: string; pt?: string } | null | undefined;

export type Lang = "en" | "pt";

/**
 * Narrows a possibly-bilingual field to a plain string for display, preferring
 * the active language and falling back to the other rather than rendering
 * nothing when only one translation exists.
 */
export function resolveLocalized(value: LocalizedField, lang: Lang): string {
  if (typeof value === "string") return value;
  if (!value) return "";
  return value[lang] ?? value.en ?? value.pt ?? "";
}
