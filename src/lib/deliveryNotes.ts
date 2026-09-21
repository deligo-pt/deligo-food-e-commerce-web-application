/**
 * The rider instructions: where they are kept between two screens, and what
 * counts as an instruction at all.
 *
 * No React and no `apiClient`, so `pnpm verify:rider-instructions` can assert
 * the rules with no token and no network — the same arrangement as
 * `cancelReason.ts` and `vendorKind.ts`.
 *
 * ## Why they travel in sessionStorage
 *
 * The customer types them on the cart page; the order that carries them is
 * created two screens later. `POST /checkout` has **no field for them** — the
 * summary it returns knows nothing about a note — while `POST
 * /orders/create-order` has taken `deliveryNotes` since this app was written
 * and has been sent `""` every time. So the text has to survive the hop, and
 * the hop includes a full page load back from the payment gateway, which rules
 * out React state. `sessionStorage` is where the pending order already waits
 * for the same reason.
 *
 * The payment page is the one that shows them back, under the delivery
 * address, because that is where the mobile app puts them and because it is
 * the last screen before the money moves.
 */

/** The one key both screens use. The return page clears it once the order exists. */
export const DELIVERY_NOTES_KEY = "deliveryNotes";

/**
 * A client-side cap. The server's own limit, if it has one, is unknown: this is
 * a line for a courier to read at a door, not a message.
 */
export const MAX_RIDER_INSTRUCTIONS = 200;

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
