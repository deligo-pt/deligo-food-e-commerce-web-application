/**
 * The fixed lists of things a customer can ask support about.
 *
 * Ids and label keys only — no icons, no JSX — so the lists stay assertable
 * with no network and no React, the same arrangement as `cancelReason.ts`. The
 * screens map an id to an icon; nothing else depends on the order.
 *
 * ## The ids never travel
 *
 * `category` on the ticket is an API enum (`PAYMENT` here) and is honoured only
 * on a ticket that has never been classified. What actually reaches a support
 * agent is the prefilled sentence — `Payment Question: Unrecognized Charge` —
 * so these ids exist to pick an icon and a label key, and sending one would put
 * a machine token in front of a person.
 */

export interface SupportTopic {
  /** Local to this build. Never sent. */
  id: string;
  labelKey: string;
}

/**
 * Payments & Refunds, in the order the mobile app lists them.
 *
 * "Payment Methods" and "Request Invoice" both have real destinations in this
 * app already (`/payment-methods`, and `invoice.ts` builds invoices
 * client-side). The app still routes all four to the chat, and this follows the
 * app — see Q18.
 */
export const PAYMENT_HELP_TOPICS: readonly SupportTopic[] = [
  { id: "REFUND_STATUS", labelKey: "refundStatus" },
  { id: "UNRECOGNIZED_CHARGE", labelKey: "unrecognizedCharge" },
  { id: "PAYMENT_METHODS", labelKey: "paymentMethods" },
  { id: "REQUEST_INVOICE", labelKey: "requestInvoice" },
];
