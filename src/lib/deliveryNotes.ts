/**
 * The two notes a customer can leave on an order, and what counts as a note.
 *
 * - `deliveryNotes` — for the rider ("ring the bell, 2nd floor"). Delivery
 *   only: a collected order has no rider.
 * - `vendorInstructions` — for the restaurant or store ("no onions"). Both
 *   delivery and pickup.
 *
 * No React and no `apiClient`, so `pnpm verify:rider-instructions` can assert
 * the rules with no token and no network — the same arrangement as
 * `cancelReason.ts` and `vendorKind.ts`.
 *
 * ## Where they go
 *
 * Since 15 Oct 2026 `POST /checkout` takes both and stores them on the
 * checkout (checked on Tasca do Bairro and Anchor; the summary returns them).
 * The cart page sends them when it creates the checkout; the payment page only
 * shows them back. There is no call that changes the notes on an existing
 * checkout, and rebuilding one from the payment page would drop an applied
 * voucher — so editing happens on the cart page.
 *
 * The payment calls (`pay-with-saved-token`, `create-payment-intent`) still
 * reject a `deliveryNotes` key outright (400 "Unrecognized key(s)"), so the
 * notes must never ride on them.
 *
 * The backend sets no length limit (600 characters were accepted) and stores
 * spaces as typed, so the cap and the trim are ours.
 */

/**
 * The old sessionStorage key the notes travelled in before `/checkout` took
 * them. Nothing writes it any more; the return page still clears it, so a
 * value left by an older build cannot linger.
 */
export const DELIVERY_NOTES_KEY = "deliveryNotes";

/** A line for a courier to read at a door, not a message. */
export const MAX_RIDER_INSTRUCTIONS = 200;

/** Same cap for the kitchen or the shop floor. */
export const MAX_VENDOR_INSTRUCTIONS = 200;

/**
 * What to send as `deliveryNotes`, or `""` for nothing to say.
 *
 * Trimmed, because a box holding three spaces is not an instruction and would
 * reach a courier as a blank line. Capped, because `maxLength` on the textarea
 * stops typing and not pasting. Pickup always sends `""`: there is no rider to
 * instruct, and a note left over from a delivery the customer switched away
 * from must not follow them to a counter.
 */
export function outgoingDeliveryNotes(
  raw: string | null | undefined,
  options?: { isPickup?: boolean },
): string {
  if (options?.isPickup) return "";
  return (raw ?? "").trim().slice(0, MAX_RIDER_INSTRUCTIONS);
}

/** What to send as `vendorInstructions`, or `""`. Pickup keeps it. */
export function outgoingVendorInstructions(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, MAX_VENDOR_INSTRUCTIONS);
}

/**
 * The notes part of a `POST /checkout` body. A key is present only when there
 * is something to say, so a customer who types nothing makes the request the
 * endpoint has always received.
 */
export function checkoutNotesBody(notes: {
  deliveryNotes?: string | null;
  vendorInstructions?: string | null;
  isPickup?: boolean;
}): { deliveryNotes?: string; vendorInstructions?: string } {
  const deliveryNotes = outgoingDeliveryNotes(notes.deliveryNotes, { isPickup: notes.isPickup });
  const vendorInstructions = outgoingVendorInstructions(notes.vendorInstructions);
  return {
    ...(deliveryNotes ? { deliveryNotes } : {}),
    ...(vendorInstructions ? { vendorInstructions } : {}),
  };
}
