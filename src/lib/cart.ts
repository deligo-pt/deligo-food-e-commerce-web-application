import type { CartItem, CartAddon } from "@/types/cart";

// Addon names arrive localized to a string, but tolerate the bilingual object
// shape so a checkout response that returns { en, pt } never renders as
// "[object Object]".
export function resolveAddonName(
  name: CartAddon["name"],
  lang: "en" | "pt",
): string {
  if (typeof name === "string") return name;
  if (!name) return "";
  return name[lang] ?? name.en ?? name.pt ?? "";
}

// /carts/view-cart doesn't reliably populate the vendor: `vendorId` comes back
// sometimes as a full object ({ _id, name, ... }) and sometimes as a bare id
// string. Normalize both to the vendor's id string so routing and filtering
// have a stable value to key on.
export function getCartVendorId(vendorRef: CartItem["vendorId"]): string {
  if (!vendorRef) return "";
  if (typeof vendorRef === "string") return vendorRef;
  return vendorRef._id ?? vendorRef.id ?? "";
}

// The vendor's display name is only available when `vendorId` is populated as an
// object; returns null when it's a bare id (caller falls back to a placeholder).
export function getCartVendorName(
  vendorRef: CartItem["vendorId"],
): string | null {
  if (!vendorRef || typeof vendorRef === "string") return null;
  const name = vendorRef.name;
  if (!name) return null;
  return `${name.firstName} ${name.lastName}`.trim() || null;
}
