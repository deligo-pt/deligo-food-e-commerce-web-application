/**
 * Delivery address types.
 *
 * This is the backend's `deliveryAddress.addressType` enum, verified against the
 * API's own Zod error:
 *   "Expected 'HOME' | 'OFFICE' | 'OTHER' | 'CURRENT_LOCATION'"
 *
 * `CURRENT_LOCATION` is written by the server for `update-live-location` (the
 * GPS "where am I now" flow), not by the address form — the form only ever
 * offers the three types a customer can actually pick.
 */
export const ADDRESS_TYPES = [
  "HOME",
  "OFFICE",
  "OTHER",
  "CURRENT_LOCATION",
] as const;

export type AddressType = (typeof ADDRESS_TYPES)[number];

/** The three types a customer chooses between in the address form. */
export type SelectableAddressType = "home" | "work" | "other";

/**
 * Values that predate the current enum and still exist on older records.
 * `PRIMARY` was how the first address used to be stamped; it can no longer be
 * created (the API rejects it), but saved profiles still carry it.
 */
const LEGACY_ALIASES: Record<string, AddressType> = {
  PRIMARY: "HOME",
};

function isAddressType(value: string): value is AddressType {
  return (ADDRESS_TYPES as readonly string[]).includes(value);
}

/** Coerce any stored value — current, legacy, or junk — into a known type. */
export function normalizeAddressType(value: string | null | undefined): AddressType {
  const upper = (value ?? "").toUpperCase();
  if (isAddressType(upper)) return upper;
  return LEGACY_ALIASES[upper] ?? "OTHER";
}

const LABEL_KEYS: Record<AddressType, string> = {
  HOME: "addressTypeHome",
  OFFICE: "addressTypeWork",
  OTHER: "addressTypeOther",
  CURRENT_LOCATION: "addressTypeCurrentLocation",
};

/**
 * Translation key for an address type. Never render `addressType` directly —
 * the raw enum leaks internal values like `CURRENT_LOCATION` to the customer.
 */
export function addressTypeLabelKey(value: string | null | undefined): string {
  return LABEL_KEYS[normalizeAddressType(value)];
}

/** Form selection -> backend enum. */
export function toBackendAddressType(type: SelectableAddressType): AddressType {
  if (type === "home") return "HOME";
  if (type === "work") return "OFFICE";
  return "OTHER";
}

/** Backend enum -> form selection. `CURRENT_LOCATION` has no button, so editing
 * one lets the customer give it a real type. */
export function toSelectableAddressType(
  value: string | null | undefined,
): SelectableAddressType {
  const normalized = normalizeAddressType(value);
  if (normalized === "OFFICE") return "work";
  if (normalized === "OTHER") return "other";
  return "home";
}
