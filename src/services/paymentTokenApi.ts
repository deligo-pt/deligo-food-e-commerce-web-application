import { apiClient, getApiErrorKey } from "@/lib/apiClient";
import type { PayWithSavedCardPayload, SavedCard } from "@/types/payment";

/**
 * Saved cards (payment tokenization).
 *
 * The frontend's whole job here is CRUD. Tokenizing the card, charging the
 * token and revoking it at REDUNIQ all happen on the backend; these functions
 * only move ids around.
 */

/**
 * `GET /payment-tokens` — the customer's saved cards.
 *
 * Already sorted (default first, then newest) and already filtered to active
 * cards, so callers render the array as-is.
 */
export async function listSavedCards(signal?: AbortSignal): Promise<SavedCard[]> {
  const res = await apiClient.get("/payment-tokens", { signal });
  return (res.data?.data ?? []) as SavedCard[];
}

/**
 * `PATCH /payment-tokens/:id/disable` — removes a card.
 *
 * A card that was already removed resolves instead of throwing: the API answers
 * `SAVED_CARD_ALREADY_DISABLED`, but from the customer's side the card is gone
 * either way, and reporting that as a failure would be a lie. Every other error
 * propagates.
 *
 * Note this is DB-only for now — our sandbox merchant account can't revoke
 * tokens gateway-side (`00100067`). No frontend impact; the card disappears
 * from the list regardless.
 */
export async function disableSavedCard(paymentTokenId: string): Promise<void> {
  try {
    await apiClient.patch(`/payment-tokens/${paymentTokenId}/disable`);
  } catch (error) {
    if (getApiErrorKey(error) === "SAVED_CARD_ALREADY_DISABLED") return;
    throw error;
  }
}

/**
 * `POST /payment/reduniq/pay-with-saved-token` — one-click checkout.
 *
 * Unlike the redirect flow there is no hosted page and no return trip: when
 * this resolves, the order already exists. Returns the response envelope's
 * `data` untyped — the Order shape isn't modelled in this app yet, and Phase 4
 * still has to confirm against a real response whether the id comes back as
 * `orderId` or `_id`.
 */
export async function payWithSavedCard(
  payload: PayWithSavedCardPayload,
): Promise<unknown> {
  const res = await apiClient.post(
    "/payment/reduniq/pay-with-saved-token",
    payload,
  );
  return res.data?.data;
}
