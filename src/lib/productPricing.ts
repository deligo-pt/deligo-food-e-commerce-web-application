/**
 * How a product's discount applies to a price the backend didn't pre-compute.
 *
 * ## Why this exists
 *
 * `GET /products` hands us `pricing.finalPrice` for the **base** price, and
 * wherever that's all we need, use it — it's the backend's own arithmetic and
 * nothing here should second-guess it.
 *
 * Variations are the gap. A product's `variations[].options[]` each carry their
 * own `price`, and the API publishes no discounted counterpart for them, so the
 * client has to apply the discount itself to show a size picker. That's the one
 * calculation on this path we're obliged to get right, and until now it was
 * wrong: the code read `pricing.discount` as a percentage unconditionally and
 * `pricing.discountType` was referenced nowhere in the project.
 *
 * For `discountType: "FLAT"` — where `discount` is an amount in euros, not a
 * percentage — that turned €0.60 off into 0.6% off. On Chocolate Salami
 * (`PROD-W61R90`, `price 1, discount 0.6, FLAT`) the Large option rendered
 * €1.99 against a real charge of €1.40.
 *
 * ## The rule, measured rather than assumed
 *
 * Both lines below are the live cart's own response for that product on
 * 2026-08-17, one per variation, verbatim from `GET /carts/view-cart`:
 *
 * | option | `originalPrice` | `productDiscountAmount` | `discountType` | `unitPrice` |
 * |---|---|---|---|---|
 * | Medium | 1 | 0.6 | FLAT | **0.4** |
 * | Large  | 2 | 0.6 | FLAT | **1.4** |
 *
 * So the flat amount comes off the *option's* price, once per unit — it is not
 * scaled by how much dearer the option is, and it is not derived from the base
 * price's `finalPrice`. That is what `applyProductDiscount` implements, and the
 * Large row is the case that distinguishes it from every plausible alternative.
 */

/** The two the API sends. Anything else is treated as "no usable discount". */
export type DiscountType = "FLAT" | "PERCENTAGE";

export type ProductDiscount = {
  /** Percent when `discountType` is PERCENTAGE, currency amount when FLAT. */
  discount?: number | null;
  discountType?: string | null;
};

/**
 * The unit price of one `basePrice` option after the product's discount.
 *
 * Clamped at zero. A flat discount worth more than the option it applies to has
 * no example in the current catalogue, so this is an assumption rather than a
 * measurement — but a negative price on screen is never the better guess, and
 * the cart's total comes from the backend regardless.
 *
 * An unrecognized `discountType` returns `basePrice` unchanged. Silently
 * treating an unknown type as a percentage is how this bug started; showing the
 * undiscounted price is visibly conservative and never overstates a saving.
 */
export function applyProductDiscount(
  basePrice: number,
  pricing: ProductDiscount | null | undefined,
): number {
  const discount = pricing?.discount ?? 0;
  if (!(discount > 0)) return basePrice;

  switch (pricing?.discountType) {
    case "FLAT":
      return Math.max(0, basePrice - discount);
    case "PERCENTAGE":
      return basePrice * (1 - discount / 100);
    default:
      return basePrice;
  }
}

/** Is there a discount worth drawing a badge and a struck-through price for? */
export function hasProductDiscount(
  pricing: ProductDiscount | null | undefined,
): boolean {
  const discount = pricing?.discount ?? 0;
  return (
    discount > 0 &&
    (pricing?.discountType === "FLAT" || pricing?.discountType === "PERCENTAGE")
  );
}

/**
 * The magnitude of the discount, formatted for a badge — `"10%"` or `"€0.60"`.
 *
 * Returns `null` when there's nothing to show, so callers can drop the badge
 * rather than render an empty one. The caller supplies the word ("OFF" /
 * "DESCONTO") because `t()` takes no interpolation.
 *
 * The amount is formatted to two decimals like every other money figure in the
 * app; the percentage is printed exactly as the backend sent it, so a `12.5`
 * stays `12.5%` instead of being rounded into a different claim.
 */
export function formatDiscountValue(
  pricing: ProductDiscount | null | undefined,
  currency: string,
): string | null {
  if (!hasProductDiscount(pricing)) return null;

  const discount = pricing?.discount ?? 0;

  return pricing?.discountType === "FLAT"
    ? `${currency}${discount.toFixed(2)}`
    : `${discount}%`;
}
