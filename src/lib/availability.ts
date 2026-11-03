/**
 * A store's ordering state, as the backend computes it.
 *
 * Since Nov 2026 every vendor response (`GET /vendors/customer`,
 * `/vendors/customer/:id`, `/vendors/nearby/open`) carries
 * `businessDetails.availability`. It is the weekly schedule combined with at
 * most one temporary override (a vendor pause, an admin pause, or extended
 * hours), so it is the only thing the UI should decide "open or not" from.
 * See `SCHEDULED_ORDERS_AND_AVAILABILITY_FRONTEND_GUIDE.md` §1.
 *
 * Rules taken from the guide:
 * - Branch on `state`, never on `overrideType` or `reason`.
 * - `EXTENDED` hours are just `OPEN`: no badge, no warning.
 * - `reason` is free text for a pause (the literal `"PAUSED"` means "no reason
 *   given"), and one of two codes for `CLOSED`, which we translate ourselves.
 */

export type StoreState = "OPEN" | "CLOSED" | "PAUSED";

/** `businessDetails.availability` on a vendor. */
export interface Availability {
  state: StoreState;
  isOpen: boolean;
  /** PAUSED: vendor's text or `"PAUSED"`. CLOSED: `CLOSED_DAY` / `OUTSIDE_HOURS`. OPEN: null. */
  reason: string | null;
  /** Informational only — never branch on it. */
  overrideType: "PAUSED" | "EXTENDED" | null;
  /** PAUSED only: when ordering resumes (ISO UTC). */
  resumeAt: string | null;
  /** CLOSED only: the next scheduled opening (ISO UTC). */
  nextOpenAt: string | null;
}

/** The slimmer shape `GET /checkout/pickup-slots` returns as `store`. */
export type StoreStatus = Pick<Availability, "state" | "reason" | "resumeAt" | "nextOpenAt">;

/** The literal the backend sends as a pause `reason` when none was given. */
const NO_PAUSE_REASON = "PAUSED";

const STORE_STATES: readonly StoreState[] = ["OPEN", "CLOSED", "PAUSED"];

export function isStoreState(value: unknown): value is StoreState {
  return typeof value === "string" && (STORE_STATES as readonly string[]).includes(value);
}

const asIso = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;

/** Anything that may carry the vendor's business details. */
export interface VendorWithAvailability {
  businessDetails?: {
    availability?: Partial<Availability> | null;
    isStoreOpen?: boolean | null;
  } | null;
}

/**
 * The vendor's availability, normalized.
 *
 * Falls back to the legacy `isStoreOpen` when a response predates the field
 * (an old cached page, or an endpoint the backend has not updated): that gives
 * `OPEN` or `CLOSED` with no times, which is all the old field could say.
 * Returns `null` when neither is present, meaning "unknown" — callers should
 * not show a closed badge for a vendor they know nothing about.
 */
export function getAvailability(
  vendor: VendorWithAvailability | null | undefined,
): Availability | null {
  const details = vendor?.businessDetails;
  if (!details) return null;

  const raw = details.availability;
  if (raw) {
    // An unknown `state` value is read through `isOpen`, so a new state the
    // backend adds later degrades to open/closed rather than breaking.
    const state: StoreState = isStoreState(raw.state)
      ? raw.state
      : raw.isOpen
        ? "OPEN"
        : "CLOSED";

    return {
      state,
      isOpen: state === "OPEN",
      reason: typeof raw.reason === "string" && raw.reason ? raw.reason : null,
      overrideType:
        raw.overrideType === "PAUSED" || raw.overrideType === "EXTENDED"
          ? raw.overrideType
          : null,
      resumeAt: state === "PAUSED" ? asIso(raw.resumeAt) : null,
      nextOpenAt: state === "CLOSED" ? asIso(raw.nextOpenAt) : null,
    };
  }

  if (typeof details.isStoreOpen === "boolean") {
    const state: StoreState = details.isStoreOpen ? "OPEN" : "CLOSED";
    return {
      state,
      isOpen: details.isStoreOpen,
      reason: null,
      overrideType: null,
      resumeAt: null,
      nextOpenAt: null,
    };
  }

  return null;
}

/** Whether an ASAP order can be placed right now. Scheduling may still be possible. */
export function isOrderableNow(availability: Pick<Availability, "state"> | null | undefined): boolean {
  return availability?.state === "OPEN";
}

/**
 * The vendor's own pause message, to show beside the banner — or null.
 *
 * Only for `PAUSED`, and never the `"PAUSED"` placeholder (an admin pause always
 * sends that, so an admin's internal reason never reaches customers).
 */
export function pauseReasonText(
  availability: Pick<Availability, "state" | "reason"> | null | undefined,
): string | null {
  if (availability?.state !== "PAUSED") return null;
  const reason = availability.reason?.trim();
  return reason && reason !== NO_PAUSE_REASON ? reason : null;
}

/**
 * The translation key for why a store is closed: `closedToday` on one of its
 * closing days, `closedNow` outside hours, plain `closed` otherwise.
 * Null when the store is not `CLOSED`.
 */
export function closedReasonKey(
  availability: Pick<Availability, "state" | "reason"> | null | undefined,
): "closedToday" | "closedNow" | "closed" | null {
  if (availability?.state !== "CLOSED") return null;
  if (availability.reason === "CLOSED_DAY") return "closedToday";
  if (availability.reason === "OUTSIDE_HOURS") return "closedNow";
  return "closed";
}
