/**
 * Order status vocabulary, and the one place that knows the API spells
 * cancellation `CANCELED` while this app has always written `CANCELLED`.
 *
 * The API's own enum — documented on `PATCH /orders/:id/status` as
 * "One of: ACCEPTED, REJECTED, PREPARING, READY_FOR_PICKUP, CANCELED" — uses a
 * single L. Every comparison in this app uses two. Until the stored spelling is
 * confirmed with the backend, normalize instead of betting on one.
 */

/** Upper-case, and fold the API's `CANCELED` onto this app's `CANCELLED`. */
export function normalizeOrderStatus(status: string | null | undefined): string {
  const upper = (status ?? "").toUpperCase();
  return upper === "CANCELED" ? "CANCELLED" : upper;
}

/**
 * Statuses where the order is still live and the customer is waiting on food.
 *
 * A membership test, and only that. It answers "is this order definitely still
 * running" — which is the right question for deciding whether to poll, and the
 * wrong one for deciding which tab a card goes in: a status missing from this
 * set is not necessarily finished, it may simply be one this build has never
 * seen. `getOrderBucket` is what the page asks, and it is total.
 */
const ONGOING_STATUSES = new Set([
  "PENDING",
  "ACCEPTED",
  "ASSIGNED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "ON_THE_WAY",
]);

export function isOngoingStatus(status: string | null | undefined): boolean {
  return ONGOING_STATUSES.has(normalizeOrderStatus(status));
}

/**
 * The two happy endings: the courier handed the food over, or the customer
 * collected it themselves.
 *
 * `PICKED_UP_BY_CUSTOMER` is the status a self-pickup order reaches once the
 * vendor types the pickup code into their app. Note how close its name is to
 * `PICKED_UP`, which means something entirely different — a *rider* has taken
 * the order from the restaurant and is on the way to the customer. One is an
 * ending, the other is a middle. They must never be conflated.
 *
 * This exists because "finished successfully" was previously spelled
 * `=== "DELIVERED"` in several places, and every one of those reads false for a
 * collected order — leaving the tracking page polling forever, offering a
 * Cancel button for food the customer is already holding, and never asking for
 * a rating.
 */
const COMPLETED_STATUSES = new Set(["DELIVERED", "PICKED_UP_BY_CUSTOMER"]);

export function isCompletedStatus(status: string | null | undefined): boolean {
  return COMPLETED_STATUSES.has(normalizeOrderStatus(status));
}

/**
 * The two ways an order dies with the customer's money already taken: the
 * restaurant refused it, or it was called off.
 *
 * Lives here rather than in `lib/refund` — which is where it used to live and
 * which still re-exports it — because it is *vocabulary*, and the bucketing
 * below has to agree with it. Two modules each keeping their own list of
 * terminal statuses is exactly the drift that hid orders in the first place.
 *
 * `NO_SHOW` is deliberately **not** in here. It ends an order, but it is not a
 * refund case: nobody came for food that was cooked and paid for, and folding
 * it in would have `getRefundState` promise money that is not coming.
 */
const TERMINATED_STATUSES = new Set(["REJECTED", "CANCELLED"]);

export function isTerminatedStatus(status: string | null | undefined): boolean {
  return TERMINATED_STATUSES.has(normalizeOrderStatus(status));
}

/**
 * The pickup order nobody came to collect.
 *
 * Its own predicate rather than a member of either set above, because it is
 * neither: not a happy ending, not a refund. The customer is shown "Not
 * Collected" — see `getOrderStatusLabel` — and the card is amber, not the red
 * of an order that was rejected or the green of one that arrived.
 */
export function isNotCollectedStatus(status: string | null | undefined): boolean {
  return normalizeOrderStatus(status) === "NO_SHOW";
}

/** Which tab of `/orders` an order belongs to. */
export type OrderBucket = "ongoing" | "history";

/**
 * 🔴 The one rule that decides whether an order is visible at all.
 *
 * `/orders` has exactly two tabs, and this function is **total**: it returns
 * one of two values for any input, so every order the API sends lands in a tab.
 * That totality is the whole point. The page used to build its two lists from
 * two independent allowlists, and anything in neither — `NO_SHOW`, and before
 * that every collected self-pickup order — was fetched, held in memory, and
 * rendered nowhere. The customer searched their own order id and was told "no
 * results". Never split this back into two filters.
 *
 * ## Where an unrecognised status goes, and why
 *
 * **Ongoing.** A status this build has never heard of is far likelier to be a
 * new step in the middle of the journey than a new ending — endings are rare
 * and get shipped with copy. Ongoing is also the safer of the two guesses: its
 * card leads with Track Order, which renders the backend's own status timeline
 * and so cannot be wrong about what happened, whereas History's card claims the
 * order is finished and offers to re-order it.
 *
 * The card never invents a label for such a status either; it falls through to
 * `humanizeStatus`, so the customer reads the backend's own word for it.
 */
export function getOrderBucket(status: string | null | undefined): OrderBucket {
  const normalized = normalizeOrderStatus(status);
  if (
    COMPLETED_STATUSES.has(normalized) ||
    TERMINATED_STATUSES.has(normalized) ||
    normalized === "NO_SHOW"
  ) {
    return "history";
  }
  return "ongoing";
}

export interface StatusHistoryEntry {
  status?: string | null;
  note?: string | null;
  timestamp?: string | null;
  updatedBy?: string | null;
}

export interface OrderWithStatusHistory {
  orderStatus?: string | null;
  statusHistory?: StatusHistoryEntry[] | null;
}

/**
 * The note recorded against the order's *current* status — for a rejection or
 * cancellation that is the vendor's own reason ("Kitchen is overloaded"), which
 * the API makes mandatory on both of those transitions.
 *
 * Searched newest-first so a re-entered status wins, and entries whose note is
 * missing or blank are skipped rather than ending the search: a later entry
 * without a note should not hide a real reason recorded earlier.
 *
 * Returns null when there is nothing worth showing, so callers fall back to
 * their own copy rather than rendering an empty line.
 */
export function getStatusNote(
  order: OrderWithStatusHistory | null | undefined,
): string | null {
  const target = normalizeOrderStatus(order?.orderStatus);
  if (!target) return null;

  const history = order?.statusHistory;
  if (!Array.isArray(history)) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (normalizeOrderStatus(entry?.status) !== target) continue;
    const note = entry?.note?.trim();
    if (note) return note;
  }

  return null;
}
