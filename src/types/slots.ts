import type { StoreStatus } from "@/lib/availability";

/**
 * `GET /checkout/pickup-slots` (role CUSTOMER), for pickup and delivery alike.
 * See `SCHEDULED_ORDERS_AND_AVAILABILITY_FRONTEND_GUIDE.md` §2.
 */

export type FulfillmentType = "DELIVERY" | "PICKUP";

/** One bookable 30-minute window. Send `startTime` / `endTime` back unchanged. */
export interface CheckoutSlot {
  startTime: string;
  endTime: string;
  /** Start time in the store's timezone, e.g. `"13:30"`. */
  label: string;
}

export interface CheckoutSlotsResponse {
  /** The vendor's Mongo `_id`. */
  vendorId: string;
  /** IANA timezone the labels and `date` are in. */
  timezone: string;
  /** `YYYY-MM-DD` in the store's timezone. */
  date: string;
  /** The only dates that may be asked for: a restaurant gets today, a store today + 2. */
  allowedDates: { from: string; to: string };
  fulfillmentType: FulfillmentType;
  prepTimeMinutes: number;
  /** `0` for pickup. */
  deliveryBufferMinutes: number;
  /** Earliest slot is at least this far from now: "Order at least N min ahead". */
  leadTimeMinutes: number;
  slotDurationMinutes: number;
  /** Store state, for the empty state (`resumeAt` when paused, `nextOpenAt` when closed). */
  store: StoreStatus;
  slots: CheckoutSlot[];
}

/** What `POST /checkout` takes as `scheduledFor`, copied from a `CheckoutSlot`. */
export interface ScheduledWindow {
  start: string;
  end: string;
}

export function toScheduledWindow(slot: CheckoutSlot): ScheduledWindow {
  return { start: slot.startTime, end: slot.endTime };
}

/**
 * Error keys meaning "that date is outside `allowedDates`". The guide's rule
 * for all of them: reset the date to `allowedDates.from`.
 */
export const SLOT_DATE_WINDOW_ERRORS: ReadonlySet<string> = new Set([
  "SCHEDULED_TIME_MUST_BE_TODAY",
  "SCHEDULED_DATE_EXCEEDS_MAX_ADVANCE_WINDOW",
  "PICKUP_TIME_MUST_BE_TODAY",
  "PICKUP_DATE_EXCEEDS_MAX_ADVANCE_WINDOW",
  "PICKUP_TIME_MUST_BE_IN_FUTURE",
]);

/**
 * A slot the customer confirmed, with the day it was listed under. `date` is
 * null for today, so it shares the cache of the "today" query (which is asked
 * without a `date`), and a store-local `YYYY-MM-DD` for a later day.
 */
export interface ChosenSlot {
  slot: CheckoutSlot;
  date: string | null;
  /** The store's IANA zone, from the slots response. */
  timezone: string;
}
