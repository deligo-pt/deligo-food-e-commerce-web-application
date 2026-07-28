/**
 * The single place that decides how a saved address reads.
 *
 * Postal format, two lines:
 *
 *   [Street Address], [House / Apartment / Floor]
 *   [Postal Code] [City], [Country]
 *
 * The field names map to the add/edit form's own labels — `street` is "Street
 * Address" and `detailedAddress` is "House / Apartment / Floor". They belong on
 * the same line: showing the apartment *instead of* the street whenever both
 * are filled in loses the half of an address a courier can least afford.
 *
 * Separators matter for reading: distinct components are comma-separated, while
 * postal code and city are one unit and stay space-joined ("1229 Dhaka").
 *
 * `state` is deliberately omitted — it is not part of the agreed display
 * format, and on the stored data it mostly repeats the city ("Dhaka" /
 * "Dhaka Division").
 *
 * Every field is optional. `postalCode` is not enforced by the form and
 * `detailedAddress` rarely is, so parts are filtered rather than joined
 * blindly: a blank one must never leave a dangling comma or a leading space.
 */
export type DisplayAddress = {
  street?: string;
  detailedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};

const joinParts = (separator: string, ...parts: (string | undefined)[]) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(separator);

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * Addresses captured from the device's location store Google's *whole*
 * formatted address in `street` ("Ka-74/5 Progati Sarani Rd, Dhaka 1229,
 * Bangladesh"), while ones typed into the form store only the route. The
 * formatted ones carry the locality in Google's order — city before postal
 * code — so the same rule as line 2 is applied to them: postal code first.
 *
 * The swap is anchored on this address's own `city` value rather than a loose
 * pattern, so it can only fire where the city genuinely precedes a postal code
 * and can never reorder part of a street name.
 */
const postalBeforeCity = (line: string, city?: string) => {
  const trimmedCity = city?.trim();
  if (!trimmedCity) return line;
  // Portuguese (1750-126) and 4-digit formats such as Bangladesh's (1229).
  const pattern = new RegExp(
    `\\b${escapeRegExp(trimmedCity)}\\s+(\\d{3,5}(?:-\\d{3,4})?)\\b`,
    "gi",
  );
  return line.replace(pattern, (_match, code: string) => `${code} ${trimmedCity}`);
};

/** Street and apartment — the part that identifies the door. */
export function formatAddressLine1(address: DisplayAddress): string {
  return postalBeforeCity(
    joinParts(", ", address.street, address.detailedAddress),
    address.city,
  );
}

/** Postal code, city and country — the part that identifies the place. */
export function formatAddressLine2(address: DisplayAddress): string {
  return joinParts(
    ", ",
    joinParts(" ", address.postalCode, address.city),
    address.country,
  );
}

/**
 * Both lines on one line. For `title` tooltips and any single-line slot that
 * still wants the whole address behind an ellipsis.
 */
export function formatAddressFull(address: DisplayAddress): string {
  return joinParts(", ", formatAddressLine1(address), formatAddressLine2(address));
}

/**
 * Deliberately short: street and city only. For the navbar's collapsed
 * location button, which is a fixed-width trigger — the full address there
 * would be ellipsised down to roughly this anyway, only less predictably.
 */
export function formatAddressSummary(address: DisplayAddress): string {
  return joinParts(", ", address.street || address.detailedAddress, address.city);
}
