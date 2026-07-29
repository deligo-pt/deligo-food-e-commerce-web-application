import type { CartItem, CartAddon } from "@/types/cart";
import { resolveLocalized, type Lang } from "./localizedField";

// Addon names arrive localized to a string, but tolerate the bilingual object
// shape so a checkout response that returns { en, pt } never renders as
// "[object Object]".
export function resolveAddonName(name: CartAddon["name"], lang: Lang): string {
  return resolveLocalized(name, lang);
}

// Add-ons carry their own quantity and are NOT multiplied by the product's
// quantity, so a line's add-on value is a flat sum of the add-on line totals.
export function getAddonsTotal(item: {
  addons?: CartAddon[] | null;
}): number {
  if (!item.addons?.length) return 0;
  return item.addons.reduce((sum, addon) => sum + (addon.lineTotal || 0), 0);
}

// The list price of a whole line, on the same basis the backend uses for
// `orderCalculation.totalOriginalPrice`: the product's pre-discount price scaled
// by quantity, plus the add-ons. Summing `originalPrice * quantity` alone omits
// the add-ons and makes "Total Price - Discount" disagree with the amount due.
export function getLineOriginalPrice(item: CartItem): number {
  return (
    item.productPricing.originalPrice * item.itemSummary.quantity +
    getAddonsTotal(item)
  );
}

// Recomputes a line's gross total for a new quantity. Derives the product's
// per-unit share from the authoritative `grandTotal` rather than from
// `productPricing.unitPrice`, whose add-on basis is ambiguous — scaling that by
// quantity either drops the add-ons or multiplies them a second time.
export function getLineTotalForQuantity(item: CartItem, newQty: number): number {
  const addonsTotal = getAddonsTotal(item);
  const currentQty = item.itemSummary.quantity;
  if (currentQty <= 0) return addonsTotal;
  const productUnit = (item.itemSummary.grandTotal - addonsTotal) / currentQty;
  return productUnit * newQty + addonsTotal;
}

// The VAT embedded in a line's add-ons. Add-ons are tax-inclusive and carry
// their own rate (a 6% drink can sit on a 23% product), so the backend's
// per-add-on `taxAmount` is preferred and `taxRate` is only a fallback.
function getAddonsTax(item: CartItem): number {
  if (!item.addons?.length) return 0;
  return item.addons.reduce((sum, addon) => {
    if (typeof addon.taxAmount === "number") return sum + addon.taxAmount;
    const gross = addon.lineTotal || 0;
    const rate = addon.taxRate ?? 0;
    return sum + (gross - gross / (1 + rate / 100));
  }, 0);
}

// Recomputes a line's embedded VAT for a new quantity. The product's share is
// extracted at the product's rate; the add-ons keep their own rates rather than
// being taxed at the product's.
export function getLineTaxForQuantity(item: CartItem, newQty: number): number {
  const addonsTotal = getAddonsTotal(item);
  const lineTotal = getLineTotalForQuantity(item, newQty);
  const productPart = lineTotal - addonsTotal;
  const rate = item.productPricing.taxRate ?? 0;
  const productTax = productPart - productPart / (1 + rate / 100);
  return productTax + getAddonsTax(item);
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

/**
 * The cart's vendors, most recent basket first.
 *
 * The cart page calls each vendor's group of items an "order", and those orders
 * are listed newest-first. There is no date to sort on: `/carts/view-cart`
 * timestamps the cart document as a whole (`createdAt`/`updatedAt`) but returns
 * no timestamp on the individual items. What it does return is an array the
 * backend appends to, so **position is insertion order** — and a vendor's first
 * appearance in it is when that basket was started.
 *
 * First appearance rather than last, deliberately: adding a second product to a
 * store you already have shouldn't make that store jump the queue. Only starting
 * a new basket does.
 *
 * This is a stand-in for a real timestamp and it inherits that array's fate — if
 * the backend ever rewrites `items` instead of appending, the order changes with
 * no error to say so. Swap in a per-item `createdAt` here the day one exists.
 */
export function getCartVendorOrder(
  items: readonly Pick<CartItem, "vendorId">[] | null | undefined,
): string[] {
  const firstSeenAt = new Map<string, number>();
  (items ?? []).forEach((item, index) => {
    const vendorId = getCartVendorId(item.vendorId);
    if (!vendorId || firstSeenAt.has(vendorId)) return;
    firstSeenAt.set(vendorId, index);
  });
  return [...firstSeenAt.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([vendorId]) => vendorId);
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
