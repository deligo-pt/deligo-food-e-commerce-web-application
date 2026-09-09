import type { LocalizedField } from "@/lib/localizedField";

/**
 * The rating contract, as the backend actually enforces it.
 *
 * Two halves, and they have different authorities.
 *
 * **What we send** is the doc's (`rating-system-doc.md` §2/§7), and it is not
 * taken on trust — every rule below was confirmed by the server rejecting a
 * probe that broke it: unknown keys are named individually, `orderId` is
 * required, at least one of `productRatings`/`deliveryRating` must be present,
 * and a score above 5 is refused by path. The schema is **strict**: one extra
 * key fails the whole body, which is why `createRating` builds the payload
 * rather than forwarding whatever a caller assembled.
 *
 * **What comes back** is the wire's, not the doc's, because on the deployed
 * test API the two disagree in three places and the doc loses all three:
 *
 *  - `sentiment` is documented as a required union and arrives `null` on
 *    existing `PRODUCT` rows;
 *  - `productId` and `orderId` are documented as strings and arrive
 *    **populated** — `{_id, name:{en,pt}}` and `{_id, orderId}`;
 *  - `subRatings` and `ratingStatus.isVendorRated` are documented as removed
 *    and are still returned.
 *
 * The last of those is why neither appears anywhere here. Nothing reads them,
 * and nothing asserts they are gone — a type that insisted on their absence
 * would be a claim about a deployment we do not control.
 */

// ─────────────────────────────────────────────────────────────────────────────
// What we send
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One product's score. **One entry per product** — never one score for the
 * whole order, which is what the previous implementation sent and what the
 * schema now has no field for.
 *
 * `productId` is the Mongo `_id`, read straight off `order.items[].productId`.
 * It must be a product in the order; the server checks.
 */
export interface ProductRatingItem {
  productId: string;
  /** 1–5. The server refuses anything outside that, by path. */
  rating: number;
  review?: string;
  tags?: string[];
}

/**
 * The rider's score.
 *
 * **No rider id.** The backend takes the rider from the order, and sending one
 * is an unknown key that fails the whole request. An order with no
 * `deliveryPartnerId` — every self-pickup order — has nothing to rate here.
 */
export interface DeliveryRatingInput {
  rating: number;
  review?: string;
  tags?: string[];
}

export interface CreateRatingRequest {
  /** The order's Mongo `_id`, not the human `ORD-…`. */
  orderId: string;
  /** Omitted, never `[]`: an empty array is not "no products submitted", it is
   *  a body that fails the "provide at least one" rule. `createRating` strips
   *  it so no caller has to remember. */
  productRatings?: ProductRatingItem[];
  deliveryRating?: DeliveryRatingInput;
}

// ─────────────────────────────────────────────────────────────────────────────
// What comes back
// ─────────────────────────────────────────────────────────────────────────────

export type RatingType = "PRODUCT" | "DELIVERY_PARTNER";

/** Server-set, and **nullable** — see the note at the top of this file. */
export type RatingSentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface Rating {
  _id: string;
  ratingType: RatingType;
  rating: number;
  sentiment?: RatingSentiment | null;
  review?: string;
  tags?: string[];
  /** Absent on a `DELIVERY_PARTNER` rating. Populated on reads; the create
   *  response is expected to echo the id, but both shapes are tolerated
   *  because the create response has not been observed — see the plan's §1.1
   *  on why the happy path is unverified. */
  productId?: string | { _id?: string; name?: LocalizedField } | null;
  orderId?: string | { _id?: string; orderId?: string } | null;
  createdAt?: string;
}

export interface CreateRatingResponseData {
  /** One entry per submitted product; `[]` when none were submitted. */
  productRatings: Rating[];
  /** The rider rating, or `null` when none was submitted. */
  deliveryRating: Rating | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The order, as the rating flow reads it
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether this customer has rated each half of the order.
 *
 * Both flags only ever flip to `true`. `isVendorRated` is deliberately **not**
 * declared: the doc says it is gone, the deployment still sends it, and the
 * only safe position is to read neither.
 */
export interface RatingStatus {
  /** `true` once every product in the order carries a rating from this customer. */
  isProductRated: boolean;
  /** `true` once this customer has rated the order's rider. */
  isDeliveryRated: boolean;
}

/** What the modal needs to draw one product row. All three are already on
 *  `/orders`, so rating an order costs no extra request. */
export interface RateableOrderItem {
  /** Mongo `_id`, and exactly what `ProductRatingItem.productId` wants. */
  productId: string;
  name: LocalizedField;
  image?: string | null;
}

/**
 * The slice of an order the rating flow reads — the same narrowing
 * `OrderStatusEntry` does for the notification header, and for the same
 * reason: the full order is 30-odd fields and declaring the ones we do not
 * touch invites a `?.` that silently reads `undefined` forever.
 *
 * Every field is optional or nullable where the API allows it to be. Orders
 * placed before the rating system existed carry no `ratingStatus`, and
 * `isRated` is top-level rather than nested — a distinction worth keeping in
 * the type, because reading `ratingStatus.isRated` would be `undefined`
 * forever and would read as "never rated".
 */
export interface RateableOrder {
  _id: string;
  orderId: string;
  orderStatus?: string | null;
  items?: RateableOrderItem[] | null;
  /** Populated, a bare id, or absent. Only its truthiness is ever read: it is
   *  what decides whether there is a rider to rate at all. */
  deliveryPartnerId?: string | { _id?: string } | null;
  ratingStatus?: RatingStatus | null;
  /** `true` only when both halves of `ratingStatus` are true. */
  isRated?: boolean;
}
