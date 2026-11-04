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
  /**
   * The asked-for day's slots. Filled in by `useCheckoutSlots` from `days`
   * (see `normalizeSlotsResponse`), so screens read one list either way.
   */
  slots: CheckoutSlot[];
  /** Every day in `allowedDates` with its own slots (backend shape since 4 Nov 2026). */
  days?: CheckoutSlotDay[];
}

/** One day of `days[]`: closed days come with `isOpen: false` and no slots. */
export interface CheckoutSlotDay {
  /** `YYYY-MM-DD` in the store's timezone. */
  date: string;
  isOpen: boolean;
  reason: string | null;
  slots: CheckoutSlot[];
}

/**
 * The slots endpoint changed shape on 4 Nov 2026 without a guide update: the
 * top-level `slots` list became `days[]` (every allowed date, each with its
 * own `slots`), and `date` is no longer used to pick the day. This reads both
 * shapes into one: `slots` is the asked-for day's list (`date`, or
 * `allowedDates.from` for today), and an unknown shape gives no slots rather
 * than a crash.
 */
export function normalizeSlotsResponse(
  raw: CheckoutSlotsResponse | null | undefined,
  date: string | null,
): CheckoutSlotsResponse | undefined {
  if (!raw) return undefined;
  const wanted = date ?? raw.allowedDates?.from ?? raw.date;
  if (Array.isArray(raw.days)) {
    const day = raw.days.find((d) => d.date === wanted);
    return { ...raw, date: wanted, slots: Array.isArray(day?.slots) ? day.slots : [] };
  }
  return { ...raw, slots: Array.isArray(raw.slots) ? raw.slots : [] };
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
