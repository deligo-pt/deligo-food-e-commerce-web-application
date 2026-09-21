/**
 * What kind of business a vendor is — and therefore what to call it on screen.
 *
 * ## The bug this exists to end
 *
 * Every "closed" message in the app was written for restaurants. A customer
 * looking at a bottle of shampoo in a cosmetics store was told **"This
 * restaurant is closed — you can browse the menu"**: two wrong nouns in one
 * sentence, in both languages.
 *
 * The vendor's own record says which it is, and it has for as long as the
 * endpoints have populated `businessDetails`. Nothing here is guessed from the
 * screen the customer happens to be on.
 *
 * ## `businessType` has two shapes, both real
 *
 * Measured on the live API, 19 Sep 2026:
 *
 *   `/vendors/nearby/open`      → `businessType: "STORE"`           (a string)
 *   `/products/open/:productId` → `businessType: { slug: "store",
 *                                    name: { en: "STORE", pt: "LOJA" } }`
 *
 * so both are read here, once, rather than at each call site.
 *
 * ## Unknown is its own answer, not a default to "restaurant"
 *
 * Some endpoints populate only four fields of `businessDetails` (the cart's
 * `view-cart` among them). Calling such a vendor a restaurant is exactly the
 * bug above with better odds; calling it a store is the same bug pointed the
 * other way. `"partner"` is DeliGo's own word for its vendors — it is what the
 * vendor details dialog's compliance line already calls them — and it is right
 * for both.
 */

export type VendorKind = "restaurant" | "store" | "partner";

type BusinessTypeValue =
  | string
  | { slug?: string | null; name?: { en?: string | null } | string | null }
  | null
  | undefined;

/** The business type as text, whichever of the two shapes arrived. */
function readType(value: BusinessTypeValue): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.slug === "string" && value.slug) return value.slug;
  const name = value.name;
  if (typeof name === "string") return name;
  if (name && typeof name.en === "string") return name.en;
  return "";
}

export function getVendorKind(value: BusinessTypeValue): VendorKind {
  const text = readType(value).trim().toUpperCase();
  if (!text) return "partner";
  if (text.includes("RESTAURANT")) return "restaurant";
  if (text.includes("STORE") || text.includes("GROCER") || text.includes("SHOP")) {
    return "store";
  }
  // A type we have not seen before is still a vendor; it is not a restaurant
  // because it did not say so.
  return "partner";
}

/**
 * The suffix the per-kind translation keys carry: `storeClosedTitleRestaurant`,
 * `storeClosedTitleStore`, `storeClosedTitlePartner`.
 *
 * Keys are built by suffix rather than by a `{vendor}` slot in the sentence
 * because Portuguese will not have it: *o restaurante* is masculine and *a
 * loja* is feminine, so the article and the adjective both change — "Este
 * restaurante está fechado" against "Esta loja está fechada". A slot would
 * produce "Este loja está fechado" for half the vendors on the platform.
 */
export function vendorCopySuffix(kind: VendorKind): string {
  return kind === "restaurant" ? "Restaurant" : kind === "store" ? "Store" : "Partner";
}

/** The key a per-kind message uses, from its base name. */
export function vendorCopyKey(base: string, kind: VendorKind): string {
  return `${base}${vendorCopySuffix(kind)}`;
}
