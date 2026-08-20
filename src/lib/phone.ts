/**
 * A dialable `tel:` href from a stored contact number.
 *
 * Contact numbers are typed by hand on the vendor side, so the API returns them
 * exactly as entered — live data has both "+351258 966 555" and
 * "+351211234567". Spaces are not valid in a `tel:` URI; browsers mostly
 * forgive them, which is a thin thing to rely on when the link's whole job is
 * to start a phone call.
 *
 * So the href gets a normalized number while the label keeps the vendor's own
 * spacing — that formatting is what makes the number readable, and it is the
 * half a human actually uses.
 *
 * Separators are dropped rather than escaped: a dialer ignores spaces, dashes,
 * dots and brackets anyway. A leading `+` is kept, because it is the difference
 * between an international number that connects and one that does not.
 *
 * Returns null when nothing dialable survives, so callers can render plain text
 * instead of a link that goes nowhere.
 */
export function toTelHref(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Portuguese numbers, for the profile's OTP flow
 * ──────────────────────────────────────────────────────────────────────────── */

/** The only country `PATCH /profile/send-otp` accepts. */
export const PORTUGAL_DIAL_CODE = "+351";

/**
 * A contact number in the one shape `PATCH /profile/send-otp` accepts, or
 * `null` if it cannot be made into one.
 *
 * The endpoint takes Portuguese numbers only — `+351` plus nine digits — and
 * rejects anything else with *"Only valid Portugal contact numbers are allowed
 * (+351xxxxxxxxx)."*
 *
 * ## What the API actually accepts, measured
 *
 * Looser than that message in one direction and stricter in another:
 *
 * | sent | result |
 * |---|---|
 * | `+351920136680` | accepted |
 * | `351920136680` (no `+`) | accepted |
 * | `920136680` (bare nine digits) | accepted |
 * | `+351 920 136 680` | **rejected** |
 * | eight or ten digits | rejected |
 *
 * ## Why this is stricter than the API
 *
 * The country code is the customer's to state, not ours to assume. This used to
 * infer it — nine bare digits became `+351` silently — which meant a number
 * typed without a code was sent as Portuguese whether or not it was one, and
 * the customer never saw the assumption being made. Now the `+351` has to be
 * there, and its absence is a message rather than a guess. Nothing without a
 * country code reaches the backend.
 *
 * Separators are still repaired, because that half was never an assumption: the
 * API rejects `+351 920 136 680` for the spacing alone, which refuses a
 * customer's own number in an error naming the format they appear to have used.
 * So spaces, dashes, dots and brackets are dropped, and what leaves is always
 * the canonical `+351XXXXXXXXX`.
 *
 * | typed | result |
 * |---|---|
 * | `+351920136680` | `+351920136680` |
 * | `+351 920 136 680` | `+351920136680` |
 * | `(+351) 920.136.680` | `+351920136680` |
 * | `920136680` | `null` — no country code |
 * | `351920136680` | `null` — no `+` |
 * | `00351920136680` | `null` — not `+351` |
 */
export function normalizePortugueseNumber(raw?: string | null): string | null {
  if (!raw) return null;

  // Everything a person writes a number with, and nothing that carries meaning:
  // the `+` and the digits are left alone.
  const compact = raw.replace(/[\s().\-‐-―]/g, "");

  if (!compact.startsWith(PORTUGAL_DIAL_CODE)) return null;

  const national = compact.slice(PORTUGAL_DIAL_CODE.length);
  if (!/^\d{9}$/.test(national)) return null;

  return `${PORTUGAL_DIAL_CODE}${national}`;
}
