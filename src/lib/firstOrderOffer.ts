/**
 * First-Order (welcome) offer helpers (`first-order-offers.md` §6).
 *
 * Every amount is the backend's. The cart figure is an estimate; the real one
 * is `orderCalculation.totalOfferDiscount` on the checkout summary.
 */

import type {
  CartFirstOrderOffer,
  FirstOrderAppliedFields,
  OfferEligibility,
} from "@/types/offer";

/** An available offer, or anything else carrying `eligibility`. */
export function isFirstOrderOffer(
  offer: { eligibility?: OfferEligibility | null } | null | undefined,
): boolean {
  return offer?.eligibility?.type === "FIRST_ORDER";
}

/** The offer applied on a checkout summary is a welcome offer. */
export function isFirstOrderApplied(
  applied: FirstOrderAppliedFields | null | undefined,
): boolean {
  return applied?.isFirstOrder === true;
}

/**
 * What the cart shows for the store's welcome offer:
 * - `hidden`: no offer, already used, or a reason we don't know;
 * - `estimate`: auto-applied at checkout, about `discount` off;
 * - `code`: a code offer, prefill `code` at checkout (`discount` when known);
 * - `locked`: eligible, but the minimum order isn't met yet (no estimate);
 * - `verifyPhone`: verify the phone number to unlock it.
 */
export type FirstOrderTeaser =
  | { kind: "hidden" }
  | { kind: "estimate"; discount: number }
  | { kind: "code"; code: string; discount?: number }
  | { kind: "locked"; code?: string }
  | { kind: "verifyPhone" };

const positive = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

export function firstOrderTeaser(
  offer: CartFirstOrderOffer | null | undefined,
): FirstOrderTeaser {
  if (!offer) return { kind: "hidden" };
  if (!offer.eligible) {
    return offer.reason === "PHONE_UNVERIFIED" ? { kind: "verifyPhone" } : { kind: "hidden" };
  }
  const discount = positive(offer.estimatedDiscount);
  const code = offer.promoCode?.trim() || undefined;
  if (code) return discount ? { kind: "code", code, discount } : { kind: "locked", code };
  return discount ? { kind: "estimate", discount } : { kind: "locked" };
}

/**
 * A store's welcome offer as the store cards advertise it, from
 * `GET /offers?eligibility.type=FIRST_ORDER` (customer token; 401 without one).
 *
 * That list is **not** personalised — it reports `isEligible: true` to every
 * customer, verified phone or not, used or not (checked 9 Nov 2026) — so the
 * card says "for new customers" and never "for you". The cart teaser is the
 * personalised one.
 */
export interface StoreWelcomeOffer {
  offerType: "PERCENT" | "FLAT" | "BUY_AND_REWARD" | string;
  discountValue: number;
  minOrderAmount: number;
}

interface RawOffer {
  vendorId?: string | { _id?: string } | null;
  isActive?: boolean;
  isDeleted?: boolean;
  offerType?: string;
  discountValue?: number;
  minOrderAmount?: number;
  validFrom?: string;
  expiresAt?: string;
  eligibility?: OfferEligibility | null;
}

/**
 * Store id → its welcome offer. Only `scope: "VENDOR"` offers are kept: a
 * GLOBAL one applies everywhere, so a badge on every card would say nothing.
 */
export function storeWelcomeOffers(
  offers: RawOffer[] | null | undefined,
  now: number = Date.now(),
): Map<string, StoreWelcomeOffer> {
  const byStore = new Map<string, StoreWelcomeOffer>();
  for (const offer of offers ?? []) {
    if (offer.eligibility?.type !== "FIRST_ORDER" || offer.eligibility.scope !== "VENDOR") continue;
    if (offer.isActive === false || offer.isDeleted === true) continue;
    if (offer.validFrom && Date.parse(offer.validFrom) > now) continue;
    if (offer.expiresAt && Date.parse(offer.expiresAt) <= now) continue;
    const vendorId = typeof offer.vendorId === "string" ? offer.vendorId : offer.vendorId?._id;
    if (!vendorId || byStore.has(vendorId)) continue;
    byStore.set(vendorId, {
      offerType: offer.offerType ?? "",
      discountValue: typeof offer.discountValue === "number" ? offer.discountValue : 0,
      minOrderAmount: typeof offer.minOrderAmount === "number" ? offer.minOrderAmount : 0,
    });
  }
  return byStore;
}
