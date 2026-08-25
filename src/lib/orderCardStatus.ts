/**
 * What an order card *is* — the small vocabulary `OrderCard` renders against.
 *
 * Between the backend's twelve-and-growing `orderStatus` values and the four
 * things a card can look like, something has to do the mapping. It used to be
 * two ternaries inside the orders page, one per tab, and they were the source
 * of the worst class of bug this page has had: a status neither ternary
 * anticipated did not fall through to something neutral, it fell through to
 * `"cancelled"`. A collected pickup order was labelled cancelled. A `NO_SHOW`
 * order was labelled cancelled. Both were lies told confidently, in red.
 *
 * So this function is **total** — every input returns a member of the union,
 * and the last member is `"unknown"`, which the card draws in grey with the
 * backend's own word for the status (see `getOrderStatusLabel`). A status
 * nobody has written copy for is then visible and honest rather than misfiled.
 *
 * ## Why the names are translation keys
 *
 * `pending`, `accepted`, `delivered`, `rejected`, `cancelled` and `notCollected`
 * are all keys that exist in both dictionaries. That is deliberate: the chip and
 * the label under the progress bar used to be derived separately and disagreed
 * — a rejected order was chipped "Cancelled" while the line below it read
 * "Rejected". One derivation, one name, no drift.
 */

import { normalizeOrderStatus } from "./orderStatus";

export type OrderCardStatus =
  | "pending"
  | "accepted"
  | "delivered"
  | "rejected"
  | "cancelled"
  | "notCollected"
  | "unknown";

/**
 * Every status this build knows, and the card face it wears.
 *
 * `ASSIGNED` folds onto `accepted` for the same reason the tracking timeline
 * folds it: a rider being attached is a dispatch detail, not a stage the
 * customer waits through.
 *
 * `PICKED_UP` (a *rider* has the food) and `PICKED_UP_BY_CUSTOMER` (the
 * customer has it, and the order is over) sit two lines apart here on purpose.
 * They read alike and mean opposite things; conflating them is what once put a
 * finished order back on the Ongoing tab with a Cancel button.
 */
const CARD_STATUS_BY_ORDER_STATUS: Record<string, OrderCardStatus> = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  ASSIGNED: "accepted",
  PREPARING: "accepted",
  READY_FOR_PICKUP: "accepted",
  PICKED_UP: "accepted",
  ON_THE_WAY: "accepted",
  DELIVERED: "delivered",
  PICKED_UP_BY_CUSTOMER: "delivered",
  REJECTED: "rejected",
  // `normalizeOrderStatus` folds the API's one-L `CANCELED` onto this spelling.
  CANCELLED: "cancelled",
  NO_SHOW: "notCollected",
};

/**
 * The card face for a status — `"unknown"` for anything this build has no copy
 * for, never a guess at which known status it resembles.
 */
export function getOrderCardStatus(
  status: string | null | undefined,
): OrderCardStatus {
  return CARD_STATUS_BY_ORDER_STATUS[normalizeOrderStatus(status)] ?? "unknown";
}

/**
 * Faces where the order is over: no more food is coming, and the customer may
 * usefully be offered the same order again.
 *
 * `unknown` is not here. An unrecognised status has not been established to be
 * finished — see `getOrderBucket` — so the card keeps offering Track Order and
 * says nothing about the order being done.
 */
const FINISHED_CARD_STATUSES = new Set<OrderCardStatus>([
  "delivered",
  "rejected",
  "cancelled",
  "notCollected",
]);

export function isFinishedCardStatus(status: OrderCardStatus): boolean {
  return FINISHED_CARD_STATUSES.has(status);
}
