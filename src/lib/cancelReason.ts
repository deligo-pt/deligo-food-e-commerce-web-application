/**
 * The reasons a customer may give for cancelling, and what actually gets sent.
 *
 * `PATCH /orders/:orderId/cancel` takes one field — `reason`, a free-text
 * string. There is no enum on the server: it accepts anything non-empty
 * (verified live against lengths 1–5000, emoji, newlines and accented text).
 * So this list is a **frontend affordance**, not a contract, and the ids below
 * never travel anywhere.
 *
 * ## Why the id is never sent
 *
 * The string handed to the API is stored twice: on the order as `cancelReason`,
 * and as the note on the `CANCELED` entry in `statusHistory` — which is what
 * `getTerminalReason` renders back to the customer under the terminal step of
 * the tracking timeline, and what the vendor reads in their app. Sending
 * `TAKING_TOO_LONG` would print a machine token on both of those surfaces.
 * The customer's own words go, exactly as a typed reason always has.
 *
 * ## Which language those words are in
 *
 * The customer's current one, because the reason is theirs — a typed reason has
 * always been in whatever language they typed. The trade-off is real and worth
 * stating: the stored string is a plain string, so an English-speaking customer
 * cancelling from a Portuguese vendor leaves an English note, and nothing
 * downstream can translate it later. Fixing that properly needs the backend to
 * accept a code alongside the text; until then, favouring the person who wrote
 * it is the better of the two wrong answers.
 */

/** The option that reveals a free-text field instead of standing for copy. */
export const OTHER_CANCEL_REASON = "OTHER";

export interface CancelReasonOption {
  /** Local to this build. Never sent — see the note above. */
  id: string;
  labelKey: string;
}

/** In the order the mobile app lists them, with `Other` last. */
export const CANCEL_REASON_OPTIONS: readonly CancelReasonOption[] = [
  { id: "CHANGED_MY_MIND", labelKey: "cancelReasonChangedMind" },
  { id: "ORDERED_BY_MISTAKE", labelKey: "cancelReasonMistake" },
  { id: "TAKING_TOO_LONG", labelKey: "cancelReasonTooLong" },
  { id: OTHER_CANCEL_REASON, labelKey: "cancelReasonOther" },
];

/**
 * The `reason` string this selection should send, or `null` when the customer
 * has not given a usable one yet.
 *
 * `null` drives the disabled state of the submit button, so the two can never
 * disagree — the button is enabled exactly when there is something to send.
 * That matters more than it looks: the API rejects an empty or whitespace-only
 * reason with a Zod error, and a form that can submit one is a form that shows
 * customers a validation error the UI should have prevented.
 */
export function resolveCancelReason(
  selectedId: string | null | undefined,
  freeText: string,
  t: (key: string) => string,
): string | null {
  if (!selectedId) return null;

  // "Other" means the customer writes it themselves; an unticked or
  // whitespace-only box is not an answer.
  if (selectedId === OTHER_CANCEL_REASON) return freeText.trim() || null;

  const option = CANCEL_REASON_OPTIONS.find((item) => item.id === selectedId);
  if (!option) return null;

  // `|| null` rather than `?? null`: a key with no copy resolves to something
  // blank in some dictionaries, and a blank reason is one the API rejects.
  return t(option.labelKey).trim() || null;
}
