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
