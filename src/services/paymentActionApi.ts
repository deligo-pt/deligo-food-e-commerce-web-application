import { apiClient } from "@/lib/apiClient";
import {
  createSingleFlight,
  parsePendingOrder,
  PENDING_ORDER_KEY,
  readPaymentActionResponse,
  serializePendingOrder,
  type PaymentActionResult,
  type PendingOrder,
} from "@/lib/paymentAction";
import axios from "axios";

/**
 * The RedUniq payment calls, read through `lib/paymentAction.ts`.
 *
 * Neither function throws for a payment outcome: a 409 `PAYMENT_NOT_STARTED`
 * or a 400 `PAYMENT_SESSION_ACTIVE` is an answer, not a failure. They resolve to
 * a `PaymentActionResult` whose `state` decides the screen. Only a response
 * with no body at all (network down, timeout) becomes `UNREACHABLE`.
 *
 * A 401 still goes through `apiClient`'s session handling as everywhere else.
 */

/** A response body, whatever the HTTP status; `null` when there was none. */
function bodyOf(error: unknown): unknown {
  return axios.isAxiosError(error) ? (error.response?.data ?? null) : null;
}

const actionFlight = createSingleFlight<PaymentActionResult>();

/**
 * `POST /payment/reduniq/:checkoutSummaryId/action`.
 *
 * Without options it only asks: where is this checkout's payment? It never
 * starts or cancels anything, so it is safe on every page load and refresh.
 *
 * `forceRelease` cancels the open payment (→ `PAYMENT_ABANDONED`). Only the
 * customer's confirmed "Cancel and start a new payment" may pass it — the
 * `verify:payment-action` guard holds that.
 *
 * Calls for the same checkout and the same intent share one request.
 */
export function callPaymentAction(
  checkoutSummaryId: string,
  options: { forceRelease?: boolean } = {},
): Promise<PaymentActionResult> {
  const release = options.forceRelease === true;
  return actionFlight(`${checkoutSummaryId}|${release ? "release" : "check"}`, async () => {
    try {
      const res = await apiClient.post(
        `/payment/reduniq/${encodeURIComponent(checkoutSummaryId)}/action`,
        release ? { forceRelease: true } : {},
      );
      return readPaymentActionResponse(res.data);
    } catch (error) {
      return readPaymentActionResponse(bodyOf(error));
    }
  });
}

const createFlight = createSingleFlight<PaymentActionResult>();

/**
 * `POST /payment/reduniq/create-payment-intent` — opens a RedUniq payment.
 *
 * `REDUNIQ_PAYMENT_SESSION_CREATED` comes with the `redirectUrl` to send the
 * customer to. `PAYMENT_SESSION_ACTIVE` (400) means one is already open: the
 * caller asks `callPaymentAction` for it and offers to continue it, rather than
 * showing an error. A second tap while the first is still on its way shares the
 * first request.
 */
export function createPaymentSession(payload: {
  checkoutSummaryId: string;
  paymentMethod: string;
  saveCard?: boolean;
}): Promise<PaymentActionResult> {
  return createFlight(payload.checkoutSummaryId, async () => {
    try {
      const res = await apiClient.post("/payment/reduniq/create-payment-intent", payload);
      return readPaymentActionResponse(res.data);
    } catch (error) {
      return readPaymentActionResponse(bodyOf(error));
    }
  });
}

// ─── The pending payment in sessionStorage ──────────────────────────────────
// Every access is guarded: storage can be unavailable (private mode, blocked
// site data), and a payment must never fail because a note couldn't be saved.

export function savePendingOrder(order: Omit<PendingOrder, "createdAt">): void {
  try {
    sessionStorage.setItem(PENDING_ORDER_KEY, serializePendingOrder(order));
  } catch {
    // The return URL carries the checkout id anyway.
  }
}

export function readPendingOrder(): PendingOrder | null {
  try {
    return parsePendingOrder(sessionStorage.getItem(PENDING_ORDER_KEY));
  } catch {
    return null;
  }
}

/** After the order is confirmed or the payment is abandoned. */
export function clearPendingOrder(): void {
  try {
    sessionStorage.removeItem(PENDING_ORDER_KEY);
  } catch {
    // Nothing to do.
  }
}
