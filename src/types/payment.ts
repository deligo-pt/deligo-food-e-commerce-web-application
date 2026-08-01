/** Card brands the API can report. Used to pick an icon — nothing else. */
export type CardBrand = "VISA" | "MASTERCARD" | "AMEX" | "OTHER";

/**
 * A card the customer has saved, as returned by `GET /payment-tokens`.
 *
 * There is no card number here and there never will be: the customer types
 * their card on REDUNIQ's hosted page, and all this app ever holds is `id` —
 * an opaque handle it passes back to our own backend. That is what keeps the
 * frontend out of PCI scope.
 *
 * `label` and `expiryDate` arrive display-ready. Render them as they are; do
 * not rebuild the label out of `brand` + `last4`.
 */
export interface SavedCard {
  /** Our id, not REDUNIQ's — that one never leaves the backend. */
  id: string;
  brand: CardBrand;
  last4: string;
  /** Pre-formatted "MM/YY". */
  expiryDate: string;
  /**
   * Which card gets used when the customer doesn't pick one. Read-only: there
   * is no "set as default" endpoint, and it only ever changes on its own, when
   * the current default is removed and the backend promotes another card.
   */
  isDefault: boolean;
  /** Pre-formatted, e.g. "Visa ending in 4242". */
  label: string;
  createdAt: string;
}

/** Request body for `POST /payment/reduniq/pay-with-saved-token`. */
export interface PayWithSavedCardPayload {
  checkoutSummaryId: string;
  /** `SavedCard["id"]` — NOT the one-shot `paymentToken` of the redirect flow. */
  paymentTokenId: string;
}
