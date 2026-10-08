/**
 * The RedUniq payment flow's one source of truth (8 Oct 2026).
 *
 * ## The rule
 *
 * The backend's own words: never decide a payment from the redirect URL or from
 * `success: true`; **only `data.code` decides**. The order is created by the
 * backend once RedUniq confirms the payment, and `POST /payment/reduniq/:id/action`
 * reports it. `/orders/create-order` is no longer part of the flow.
 *
 * ```
 * Checkout → Create payment → RedUniq → Return → /action → data.code → screen
 * ```
 *
 * ## What `/action` answers (checked against the test backend, 8 Oct 2026)
 *
 * | Situation                                   | HTTP | `data.code`                          |
 * |---------------------------------------------|------|--------------------------------------|
 * | no payment started yet                      | 409  | `PAYMENT_NOT_STARTED`                |
 * | a payment is open (also after "Cancel" on   | 200  | `REDUNIQ_PAYMENT_SESSION_RESUMED`    |
 * |   RedUniq's own page)                       |      |   + the same `redirectUrl`           |
 * | paid (test card), and again on a refresh    | 200  | `PAYMENT_COMPLETED` + `orderId`,     |
 * |                                             |      |   `displayOrderId`                   |
 * | declined card                               | 200  | `PAYMENT_FAILED` — the *message*     |
 * |                                             |      |   says "abandoned"; the code is right|
 * | `{ forceRelease: true }` on an open payment | 200  | `PAYMENT_ABANDONED`                  |
 * | `/action` again after a release             | 409  | `PAYMENT_ABANDONED`                  |
 *
 * `create-payment-intent` adds `REDUNIQ_PAYMENT_SESSION_CREATED` (200) and
 * `PAYMENT_SESSION_ACTIVE` (400, a payment is already open).
 *
 * Errors carry `data.code` too (the 409s and the 400), so the code is read from
 * the body whatever the status.
 *
 * ## Unknown is never success, and never "pay again"
 *
 * The backend mentions an "unknown" status but never named its code, and none
 * was produced in testing: `PAYMENT_COMPLETED` was already there at the instant
 * RedUniq redirected back. So any code this file doesn't know becomes
 * `VERIFYING` ("confirming your payment…"), and a response with no code at all
 * — network down, a 5xx, an HTML error page — becomes `UNREACHABLE`. Neither
 * ever shows success, and neither ever offers to start another payment: the
 * customer may already have paid.
 *
 * No imports, so `pnpm verify:payment-action` runs it directly.
 */

/** Every `data.code` this flow knows. */
export const PAYMENT_CODES = {
  SESSION_CREATED: "REDUNIQ_PAYMENT_SESSION_CREATED",
  SESSION_RESUMED: "REDUNIQ_PAYMENT_SESSION_RESUMED",
  SESSION_ACTIVE: "PAYMENT_SESSION_ACTIVE",
  COMPLETED: "PAYMENT_COMPLETED",
  FAILED: "PAYMENT_FAILED",
  ABANDONED: "PAYMENT_ABANDONED",
  NOT_STARTED: "PAYMENT_NOT_STARTED",
} as const;

/** What the customer is shown. One screen per state. */
export type PaymentState =
  /** Paid; the order exists. Go to tracking. */
  | "ORDER_PLACED"
  /** A payment is open: continue it, or deliberately cancel it and start again. */
  | "IN_PROGRESS"
  /** RedUniq declined it. Nothing was charged; try again on the same checkout. */
  | "FAILED"
  /** Cancelled/released. Nothing was charged; pay again on the same checkout. */
  | "ABANDONED"
  /** No payment yet: the normal payment page. */
  | "NOT_STARTED"
  /** A code this app doesn't know. Confirming, never success, never "pay again". */
  | "VERIFYING"
  /** No code at all (network, 5xx). Check again; never "pay again". */
  | "UNREACHABLE";

export function paymentState(code: string | null | undefined): PaymentState {
  switch (code) {
    case PAYMENT_CODES.COMPLETED:
      return "ORDER_PLACED";
    case PAYMENT_CODES.SESSION_CREATED:
    case PAYMENT_CODES.SESSION_RESUMED:
    case PAYMENT_CODES.SESSION_ACTIVE:
      return "IN_PROGRESS";
    case PAYMENT_CODES.FAILED:
      return "FAILED";
    case PAYMENT_CODES.ABANDONED:
      return "ABANDONED";
    case PAYMENT_CODES.NOT_STARTED:
      return "NOT_STARTED";
    default:
      return code ? "VERIFYING" : "UNREACHABLE";
  }
}

/**
 * Whether the customer may start a payment from this state. Only when nothing
 * is open and nothing may have been paid: not while one is in progress, and
 * never while the result is unknown.
 */
export function canStartNewPayment(state: PaymentState): boolean {
  return state === "NOT_STARTED" || state === "FAILED" || state === "ABANDONED";
}

/** What a `/action` (or `create-payment-intent`) body tells us. */
export type PaymentActionResult = {
  state: PaymentState;
  /** `null` when the body had none; see `paymentState`. */
  code: string | null;
  /** RedUniq's hosted page, to continue an open payment. */
  redirectUrl: string | null;
  paymentToken: string | null;
  /** The order's id for `/orders/track-order/<orderId>`, once paid. */
  orderId: string | null;
  /** The `ORD-…` number customers and support read. */
  displayOrderId: string | null;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * Reads a response body — a success *or* an error one — into a result.
 *
 * Deliberately ignores `success` and the HTTP status: a 409 can be a perfectly
 * good answer (`PAYMENT_NOT_STARTED`), and a 200 says nothing on its own.
 */
export function readPaymentActionResponse(body: unknown): PaymentActionResult {
  const data =
    body && typeof body === "object" && "data" in body
      ? (body as { data?: unknown }).data
      : null;
  const bag = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const code = text(bag.code);
  return {
    state: paymentState(code),
    code,
    redirectUrl: text(bag.redirectUrl),
    paymentToken: text(bag.paymentToken),
    orderId: text(bag.orderId),
    displayOrderId: text(bag.displayOrderId),
  };
}

/**
 * Where a paid order is followed. The tracking page looks orders up by the
 * `ORD-…` number: `GET /orders/ORD-WHXDW3FOQ3` answers, `GET /orders/<Mongo
 * orderId>` is a 404 (checked 8 Oct 2026). Without the number, the orders list.
 */
export function orderTrackingPath(result: Pick<PaymentActionResult, "displayOrderId">): string {
  return result.displayOrderId
    ? `/orders/track-order/${encodeURIComponent(result.displayOrderId)}`
    : "/orders";
}

/** The payment page's methods heading: "Choose another way to pay" lands there. */
export const PAYMENT_METHODS_ANCHOR = "payment-methods";

/** The payment page of a checkout, to try again or continue from. */
export function paymentPagePath(checkoutSummaryId: string, vendorId: string | null | undefined): string | null {
  if (!vendorId) return null;
  return `/cart/checkout/${encodeURIComponent(vendorId)}/payment?checkoutId=${encodeURIComponent(checkoutSummaryId)}`;
}

// ─── The pending payment, across the trip to RedUniq ────────────────────────

/** sessionStorage key. Shared with the previous flow, hence the version. */
export const PENDING_ORDER_KEY = "pendingOrder";
const PENDING_ORDER_VERSION = 2;

/**
 * What the payment page leaves behind before sending the customer to RedUniq.
 *
 * RedUniq's return URLs carry `summaryId` (checked), so this is the fallback
 * for a return without one, plus the way back to the right payment page.
 * `deliveryNotes` waits here until the backend gives it somewhere to go: no
 * payment endpoint accepts it yet (see `plan.md`).
 */
export type PendingOrder = {
  checkoutSummaryId: string;
  vendorId: string | null;
  deliveryNotes: string;
  /** ms since epoch; entries older than a day are stale. */
  createdAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function serializePendingOrder(order: Omit<PendingOrder, "createdAt">, now = Date.now()): string {
  return JSON.stringify({ v: PENDING_ORDER_VERSION, ...order, createdAt: now });
}

/**
 * The stored entry, or `null` for anything not written by this version: no
 * entry, broken JSON, the previous flow's shape (no `v`), or older than a day.
 * A wrong entry is worse than none — it could point at someone's old checkout.
 */
export function parsePendingOrder(raw: string | null | undefined, now = Date.now()): PendingOrder | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const bag = value as Record<string, unknown>;
  if (bag.v !== PENDING_ORDER_VERSION) return null;
  const checkoutSummaryId = text(bag.checkoutSummaryId);
  const createdAt = typeof bag.createdAt === "number" ? bag.createdAt : NaN;
  if (!checkoutSummaryId || !Number.isFinite(createdAt) || now - createdAt > DAY_MS || createdAt > now + 60_000) {
    return null;
  }
  return {
    checkoutSummaryId,
    vendorId: text(bag.vendorId),
    deliveryNotes: typeof bag.deliveryNotes === "string" ? bag.deliveryNotes : "",
    createdAt,
  };
}

// ─── One call at a time ─────────────────────────────────────────────────────

/**
 * Shares one in-flight promise per key. React StrictMode runs effects twice, a
 * customer double-taps, a refresh lands mid-call: each would otherwise send its
 * own `/action` — and a second `forceRelease` could release a payment the
 * customer just started. Once the call settles, the next one goes out fresh.
 */
export function createSingleFlight<T>() {
  const inFlight = new Map<string, Promise<T>>();
  return (key: string, run: () => Promise<T>): Promise<T> => {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const promise = run().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
