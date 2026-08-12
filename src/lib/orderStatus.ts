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
 * Everything else — `DELIVERED`, plus the terminated pair — belongs to history.
 *
 * Lives here rather than inline in the orders page because two places need the
 * same answer: which tab a card belongs in, and whether the list is worth
 * polling at all.
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
