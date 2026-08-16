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
 * ## What it actually accepts, measured
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
 * The spaces are the trap. A customer writing their own number the way it is
 * written in Portugal — `920 136 680` — is refused for the spacing alone, by an
 * error that names a format they appear to have used. So this normalizes rather
 * than merely validating: separators go, a missing country code is added, and
 * what leaves is always the canonical `+351XXXXXXXXX`.
 */
export function normalizePortugueseNumber(raw?: string | null): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");

  // `00351…` is how the country code is dialled from abroad, and how plenty of
  // people store it.
  const national = digits.startsWith("00351")
    ? digits.slice(5)
    : digits.startsWith("351")
      ? digits.slice(3)
      : digits;

  if (!/^\d{9}$/.test(national)) return null;

  return `${PORTUGAL_DIAL_CODE}${national}`;
}
