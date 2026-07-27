/**
 * How to render the backend's `paymentStatus` as a badge.
 *
 * Two rules this module exists to enforce:
 *
 * 1. **Never invent a status.** An absent `paymentStatus` yields `null` and the
 *    badge is not drawn — the previous code defaulted the label to "PAID",
 *    which fabricated the single most consequential value in the response.
 * 2. **Never colour a status wrongly.** The badge used to be hardcoded green,
 *    so `REFUNDED`, `FAILED` and `PENDING` all read as paid.
 *
 * An unrecognised status is shown verbatim in neutral colours rather than
 * guessed at, so a value the API adds later degrades instead of lying.
 */

export interface PaymentStatusDisplay {
  /** Translation key, when this is a status we have copy for. */
  labelKey: string | null;
  /** The backend's own value, used only when `labelKey` is null. */
  rawLabel: string | null;
  /** Tailwind classes for the badge. */
  className: string;
}

const KNOWN: Record<string, { labelKey: string; className: string }> = {
  PAID: {
    labelKey: "paid",
    className:
      "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30",
  },
  REFUNDED: {
    labelKey: "refunded",
    className:
      "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/30",
  },
  PENDING: {
    labelKey: "paymentPending",
    className:
      "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30",
  },
  FAILED: {
    labelKey: "failed",
    className:
      "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30",
  },
};

const UNKNOWN_CLASS =
  "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700";

export function getPaymentStatusDisplay(
  paymentStatus: string | null | undefined,
): PaymentStatusDisplay | null {
  const raw = (paymentStatus ?? "").trim();
  if (!raw) return null;

  const known = KNOWN[raw.toUpperCase()];
  if (known) return { labelKey: known.labelKey, rawLabel: null, className: known.className };

  // Shown exactly as the backend sent it — no case change, no guessing.
  return { labelKey: null, rawLabel: raw, className: UNKNOWN_CLASS };
}
