import { isCompletedStatus } from "./orderStatus";
import { hasUnratedParts } from "./ratingStatus";
import type { RateableOrder } from "@/types/rating";

/**
 * Which order, if any, the rating pop-up should ask about (4 Oct 2026).
 *
 * Feedback could only be given from Order history, after the customer went
 * looking for it, so almost nobody did. The pop-up asks once, right after an
 * order completes: on the tracking page the moment it turns delivered or
 * collected, or on the customer's next visit if they weren't watching.
 *
 * No React and no network, so `pnpm verify:rating-prompt` runs it directly.
 *
 * ## The rules
 *
 * - **Completed only.** `DELIVERED` or `PICKED_UP_BY_CUSTOMER`
 *   (`isCompletedStatus`). Never cancelled, rejected or no-show.
 * - **Something left to rate.** `hasUnratedParts`, the Rate button's own
 *   question, so the pop-up and the order card always agree. A self-pickup
 *   order has no rider, so only its products count.
 * - **Recent.** Completed within `RATING_PROMPT_WINDOW_MS`, read from
 *   `statusHistory`. `deliveredAt` is never filled (75 live orders,
 *   4 Oct 2026). Asking about last month's dinner is noise, and the Rate button
 *   stays for that.
 * - **Once per order.** An order that was shown is remembered in this browser
 *   (`markRatingPromptSeen`) whether the customer rated, closed or chose "Not
 *   now". Another device may ask once more, which is acceptable for a prompt.
 * - **Newest first.** With several candidates, the most recently completed.
 */
export const RATING_PROMPT_WINDOW_MS = 48 * 60 * 60 * 1000;

export type RatingPromptOrder = RateableOrder & {
  statusHistory?: ({ status?: string | null; timestamp?: string | null } | null)[] | null;
};

/** When the order reached a completed status, in ms, or `null` if unknown. */
export function orderCompletedAt(order: RatingPromptOrder | null | undefined): number | null {
  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];
  let latest: number | null = null;
  for (const entry of history) {
    if (!entry || !isCompletedStatus(entry.status)) continue;
    const at = Date.parse(String(entry.timestamp ?? ""));
    if (Number.isFinite(at) && (latest === null || at > latest)) latest = at;
  }
  return latest;
}

/** The order to ask about now, or `null`. */
export function pickRatingPromptOrder<O extends RatingPromptOrder>(
  orders: readonly (O | null | undefined)[] | null | undefined,
  { now, seen }: { now: number; seen: ReadonlySet<string> },
): O | null {
  let best: O | null = null;
  let bestAt = -Infinity;
  for (const order of orders ?? []) {
    if (!order?.orderId || seen.has(order.orderId)) continue;
    if (!isCompletedStatus(order.orderStatus) || !hasUnratedParts(order)) continue;
    const at = orderCompletedAt(order);
    if (at === null || now - at > RATING_PROMPT_WINDOW_MS || at > now + 60_000) continue;
    if (at > bestAt) {
      best = order;
      bestAt = at;
    }
  }
  return best;
}

const SEEN_KEY = "deligo-rating-prompt-seen";
const SEEN_MAX = 50;

/**
 * Orders already prompted in this browser. Storage can be missing or throw
 * (private window, blocked site data); then nothing is remembered and the
 * worst case is one repeat prompt.
 */
export function readSeenRatingPrompts(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function markRatingPromptSeen(orderId: string): void {
  try {
    const ids = [...readSeenRatingPrompts()].filter((id) => id !== orderId);
    ids.push(orderId);
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-SEEN_MAX)));
  } catch {
    // See `readSeenRatingPrompts`.
  }
}
