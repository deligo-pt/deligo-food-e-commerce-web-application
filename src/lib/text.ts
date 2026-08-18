/**
 * Text folding — the one way this app flattens a string before comparing it.
 *
 * "Folding" means throwing away everything a customer cannot reasonably be
 * expected to reproduce when typing: accents, case, stray punctuation, and
 * accidental whitespace. What survives is a canonical form suitable for
 * matching — and *only* for matching. Never render a folded string.
 *
 * This started life as `normalizeCuisine` in `cuisine.ts`, serving the
 * homepage's cuisine filter. Order search needs exactly the same operation on
 * dish and restaurant names, so it lives here now and `normalizeCuisine`
 * delegates. One implementation, one set of edge cases, one place to fix them.
 *
 * ## Why accents are not optional
 *
 * Item names come back localized — the same order reads "Bread pasta" under
 * `Accept-Language: en` and "Massa de pão" under `pt`. A Portuguese customer
 * searching their history will type `pao` and `medio`, not `pão` and `médio`,
 * because the accented characters are two taps away on most phone keyboards.
 * A plain `toLowerCase().includes()` finds neither.
 *
 * NFD decomposition splits "ã" into "a" + a combining tilde, which the next
 * step deletes. Composed characters that have no decomposition (ß, ł) are left
 * alone — correct, since neither has an unaccented form a customer would type
 * instead.
 */

/**
 * Combining diacritical marks, U+0300–U+036F — what NFD leaves behind once it
 * has separated the accents from their base letters.
 *
 * Written as escapes on purpose. The original in `cuisine.ts` spelled this
 * range with two literal combining characters, which render as marks floating
 * on the preceding bracket and are one careless editor away from being
 * silently mangled. Same range, same behaviour, legible in a diff.
 */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Punctuation dropped rather than kept.
 *
 * Only `#` for now, and it earns its place: order ids are rendered as
 * "Order #ORD-ZCPTS79UFJ", so a customer copying one off the screen brings the
 * `#` along. Dropping it means the pasted string folds to the same thing as
 * the id itself, with no special-casing anywhere downstream.
 *
 * Hyphens are deliberately *not* here — they are load-bearing inside both
 * order ids (`ORD-…`) and item names ("Chocolate Salami - Large").
 */
const DROPPED_PUNCTUATION = /#/g;

/** Any run of whitespace, including the tabs and newlines a paste can carry. */
const WHITESPACE_RUN = /\s+/g;

/**
 * Fold a value for matching: decompose, strip accents, drop `#`, collapse
 * whitespace, trim, lowercase.
 *
 * Takes `unknown` rather than `string` because the API is not reliably typed at
 * the call sites this serves — `restaurantCuisineType` arrives as a string, an
 * array or absent, and order fields can be `null`. `String(value ?? "")` makes
 * every one of those a defined string, so this can never throw on
 * `value.toLowerCase()`. `null` and `undefined` fold to `""`.
 *
 * Collapsing whitespace matters more than it looks: at least one product in the
 * live catalogue is named "Octopus with Olive and Roasted Potatos - Medium "
 * with a trailing space. Folding hides that from every consumer.
 */
export function foldText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(DROPPED_PUNCTUATION, "")
    .replace(WHITESPACE_RUN, " ")
    .trim()
    .toLowerCase();
}
