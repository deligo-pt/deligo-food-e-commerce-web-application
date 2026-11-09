/**
 * First-Order (welcome) offer shapes the customer app reads
 * (`first-order-offers.md` §6). Shapes marked "seen" were observed on the test
 * API on 9 Nov 2026; the rest follow the guide.
 */

export type FirstOrderScope = "VENDOR" | "GLOBAL";

/** `eligibility` on an offer document (seen on `available-offers`). */
export interface OfferEligibility {
  type: "FIRST_ORDER" | string;
  scope?: FirstOrderScope;
  requireVerifiedPhone?: boolean;
  maxRestores?: number;
}

/** `offerApplied.firstOrderPolicy` on a checkout summary (seen). */
export interface FirstOrderPolicy {
  requireVerifiedPhone?: boolean;
  maxRestores?: number;
}

/** The first-order fields `offerApplied` carries when a welcome offer won (seen). */
export interface FirstOrderAppliedFields {
  isFirstOrder?: boolean;
  firstOrderScope?: FirstOrderScope;
  firstOrderPolicy?: FirstOrderPolicy;
  /** `"VENDOR"` on store offers; the platform pays on GLOBAL ones. */
  fundedBy?: "VENDOR" | "PLATFORM" | string;
}

/** Why the cart teaser says the customer can't have the offer (guide §6.1). */
export type FirstOrderIneligibleReason = "PHONE_UNVERIFIED" | "ALREADY_USED";

/**
 * `firstOrderOffer` on `GET /carts/view-cart`. Absent when the store has no
 * first-order offer (seen in all four shapes).
 */
export interface CartFirstOrderOffer {
  eligible: boolean;
  reason?: FirstOrderIneligibleReason | string;
  /** Only for a code offer: prefill the code field with it. */
  promoCode?: string;
  /** An estimate; absent while the minimum order isn't met. */
  estimatedDiscount?: number;
}

/** `offerStatus` on a `200` from `POST /checkout/summary/:id/refresh`. */
export type CheckoutOfferStatus = "REAPPLIED" | "DROPPED" | "NONE";

/** `staleReasons` on `GET /checkout/summary/:id`. */
export type CheckoutStaleReason = "EXPIRED" | "ADDRESS_CHANGED" | "ADDRESS_MISSING" | string;
