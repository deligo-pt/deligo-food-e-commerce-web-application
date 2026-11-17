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

/**
 * Which welcome offers this customer has already used, worked out from their
 * own orders.
 *
 * Needed because `GET /offers` is not personalised (see `StoreWelcomeOffer`):
 * it says `isEligible: true` and `usageCount: 0` to a customer who has just
 * used the offer, so the store cards, the Vouchers page and the checkout's
 * offer list kept inviting them to a welcome offer they could no longer have.
 * Only the cart says `ALREADY_USED`, and only for the store in the cart.
 *
 * The backend counts **use of the offer**, not orders at the store: a
 * customer with earlier orders there still gets it (measured 17 Nov 2026).
 * `vendors` holds the stores whose welcome offer is used up; `global` is the
 * platform-wide one.
 */
export interface WelcomeOfferUsage {
  vendors: ReadonlySet<string>;
  global: boolean;
}

export const NO_WELCOME_OFFER_USAGE: WelcomeOfferUsage = { vendors: new Set(), global: false };

/** The slice of an order `welcomeOfferUsage` reads. */
export interface WelcomeOfferUsageOrder {
  orderStatus?: string | null;
  statusHistory?: ({ status?: string | null } | null)[] | null;
  offer?: {
    isApplied?: boolean;
    offerApplied?: FirstOrderAppliedFields | null;
  } | null;
}

/** `?fields=` for `GET /orders` that returns exactly the slice above. */
export const WELCOME_OFFER_USAGE_FIELDS = [
  "orderStatus",
  "statusHistory.status",
  "offer.isApplied",
  "offer.offerApplied.isFirstOrder",
  "offer.offerApplied.firstOrderScope",
  "offer.offerApplied.firstOrderVendorId",
  "offer.offerApplied.firstOrderPolicy",
].join(",");

/** The vendor panel's default for "times it can be given back". */
const DEFAULT_MAX_RESTORES = 2;

/**
 * The order gave the offer back: the store rejected it, or it was cancelled
 * before the store accepted it. That is the rule the vendor sets up
 * ("If an order with this offer is cancelled before you accept it, or you
 * reject it, the customer gets the offer back"). Anything else — delivered,
 * collected, a no-show, still in progress — keeps it used.
 */
function gaveOfferBack(order: WelcomeOfferUsageOrder): boolean {
  const status = (order.orderStatus ?? "").toUpperCase();
  if (status === "REJECTED") return true;
  if (status !== "CANCELED" && status !== "CANCELLED") return false;
  return !(order.statusHistory ?? []).some((entry) => entry?.status?.toUpperCase() === "ACCEPTED");
}

export function welcomeOfferUsage(
  orders: (WelcomeOfferUsageOrder | null)[] | null | undefined,
): WelcomeOfferUsage {
  const vendors = new Set<string>();
  let global = false;
  // Given-back orders per offer, against the offer's own limit.
  const restores = new Map<string, number>();

  for (const order of orders ?? []) {
    const applied = order?.offer?.offerApplied;
    if (!order || order.offer?.isApplied !== true || !isFirstOrderApplied(applied)) continue;
    const isGlobal = applied?.firstOrderScope === "GLOBAL";
    const key = isGlobal ? "GLOBAL" : applied?.firstOrderVendorId;
    // A store offer with no store on it can't be matched to a card; skip it
    // rather than hide every store's offer.
    if (!key) continue;

    let used = !gaveOfferBack(order);
    if (!used) {
      const count = (restores.get(key) ?? 0) + 1;
      restores.set(key, count);
      used = count > (applied?.firstOrderPolicy?.maxRestores ?? DEFAULT_MAX_RESTORES);
    }
    if (!used) continue;
    if (isGlobal) global = true;
    else vendors.add(key);
  }
  return { vendors, global };
}

/**
 * The customer has already used this welcome offer. `false` for any offer that
 * isn't a welcome offer, so it can filter a mixed list.
 */
export function isUsedWelcomeOffer(
  offer: {
    eligibility?: OfferEligibility | null;
    vendorId?: string | { _id?: string } | null;
  } | null | undefined,
  usage: WelcomeOfferUsage,
): boolean {
  if (!offer || !isFirstOrderOffer(offer)) return false;
  if (offer.eligibility?.scope === "GLOBAL") return usage.global;
  const vendorId = typeof offer.vendorId === "string" ? offer.vendorId : offer.vendorId?._id;
  return !!vendorId && usage.vendors.has(vendorId);
}
