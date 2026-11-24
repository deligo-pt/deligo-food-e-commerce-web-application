/**
 * `promoBadge` on a product from `GET /products` and `/products/open` — the
 * best offer the product is part of. Seen on the test API on 24 Nov 2026:
 *
 *   { offerId, type: "BUY_AND_REWARD", title: "2×1 — Extra Cheese Burger",
 *     badgeText: "Buy 1 Get 1", totalOffersCount: 1, isAutoApply: true,
 *     buyQuantity: 1, rewardQuantity: 1 }
 *
 * `title` and `badgeText` follow Accept-Language ("Compre 1 Ganhe 1" in pt).
 * `PERCENT` badges ("10% OFF") also arrive here; the card already shows the
 * product's own discount, so only buy-and-reward offers get a mark.
 */
export interface ProductPromoBadge {
  offerId?: string;
  type: "BUY_AND_REWARD" | "PERCENT" | "FLAT" | string;
  title?: string;
  badgeText?: string;
  totalOffersCount?: number;
  isAutoApply?: boolean;
  buyQuantity?: number;
  rewardQuantity?: number;
}

export interface BuyAndRewardMark {
  /** "2×1" — how many you take × how many you pay for. */
  short: string;
  /** "Buy 1 Get 1", already in the customer's language. */
  text?: string;
  /** The offer's own name, for screen readers. */
  title?: string;
}

const count = (n: unknown) =>
  typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;

/**
 * The card mark for a buy-and-reward offer, or null for anything else.
 * Buy 1 get 1 → "2×1", buy 3 get 1 → "4×3". Without usable quantities the
 * API's own text stands alone.
 */
export function buyAndRewardMark(badge?: ProductPromoBadge | null): BuyAndRewardMark | null {
  if (badge?.type !== "BUY_AND_REWARD") return null;
  const buy = count(badge.buyQuantity);
  const reward = count(badge.rewardQuantity);
  const text = badge.badgeText?.trim() || undefined;
  const title = badge.title?.trim() || text;
  if (buy && reward) return { short: `${buy + reward}×${buy}`, text, title };
  return text ? { short: text, title } : null;
}
