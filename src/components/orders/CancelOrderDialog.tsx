"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cancelOrder } from "@/services/orderApi";
import {
  CANCEL_REASON_OPTIONS,
  OTHER_CANCEL_REASON,
  resolveCancelReason,
} from "@/lib/cancelReason";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CancelOrderDialogProps {
  /** The order to cancel (`ORD-…`), or null when the dialog is closed. */
  orderId: string | null;
  onClose: () => void;
  /** Handed the updated order the API returns, so callers can repaint. */
  onCancelled: (updatedOrder: unknown) => void | Promise<void>;
}

/**
 * Confirmation for calling off an order.
 *
 * More than a yes/no: the API requires a non-empty `reason`, so the customer
 * has to give one. Four common ones are offered as a choice — matching the
 * mobile app — with `Other` revealing a free-text box, because most people are
 * cancelling for one of the same few reasons and asking them to type it is
 * friction that gets answered with "test" or "asd".
 *
 * On failure the dialog deliberately stays open with the selection and any
 * typed text intact — closing it would throw away what they wrote in order to
 * tell them that the request they just made did not go through.
 */
export default function CancelOrderDialog({
  orderId,
  onClose,
  onCancelled,
}: CancelOrderDialogProps) {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derived, not a third piece of state: the submit button is enabled exactly
  // when there is something to send, so the two cannot disagree.
  const reason = resolveCancelReason(selectedReason, otherText, t);
  const isOtherSelected = selectedReason === OTHER_CANCEL_REASON;

  const close = () => {
    setSelectedReason(null);
    setOtherText("");
    onClose();
  };

  const handleConfirm = async () => {
    if (!orderId || !reason || submitting) return;

    setSubmitting(true);
    try {
      const updated = await cancelOrder(orderId, reason);
      // Closed before the callback: `onCancelled` may invalidate queries and
      // re-render the list underneath this dialog.
      close();
      toast.success(t("orderCanceled"));
      await onCancelled(updated);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("cancelOrderFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={orderId !== null}
      // A request is in flight — an outside click or Escape must not abandon it.
      onOpenChange={(open) => {
        if (!open && !submitting) close();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
            <XCircle />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("cancelOrderTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("cancelOrderDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <p
            id="cancel-reason-question"
            className="text-sm font-semibold text-gray-700 dark:text-neutral-300"
          >
            {t("cancelReasonQuestion")}
          </p>

          {/* Real radio inputs rather than styled divs: this gets arrow-key
              navigation, a single tab stop for the whole group and correct
              screen-reader announcement for free. The input is visually
              hidden — `sr-only`, not `hidden` — so it stays focusable, and the
              ring is drawn on the circle beside it via `peer-focus-visible`. */}
          <div
            role="radiogroup"
            aria-labelledby="cancel-reason-question"
            className="divide-y divide-gray-100 dark:divide-neutral-800 border-y border-border"
          >
            {CANCEL_REASON_OPTIONS.map((option) => {
              const isSelected = selectedReason === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center justify-between gap-4 py-3.5 text-sm transition-colors ${
                    submitting ? "cursor-not-allowed opacity-60" : ""
                  } ${
                    isSelected
                      ? "text-foreground dark:text-neutral-50 font-semibold"
                      : "text-muted-foreground dark:text-neutral-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-order-reason"
                    value={option.id}
                    checked={isSelected}
                    disabled={submitting}
                    onChange={() => setSelectedReason(option.id)}
                    className="peer sr-only"
                  />
                  <span className="min-w-0">{t(option.labelKey)}</span>
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-neutral-900 ${
                      isSelected
                        ? "border-primary dark:border-pink-500"
                        : "border-gray-300 dark:border-neutral-600"
                    }`}
                  >
                    {isSelected && (
                      <span className="h-2.5 w-2.5 rounded-full bg-primary dark:bg-pink-500" />
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Only "Other" needs words. Mounting the textarea on selection means
              `autoFocus` fires exactly when it appears, so the customer can
              start typing without reaching for the mouse. */}
          {isOtherSelected && (
            <textarea
              id="cancel-order-other-reason"
              aria-label={t("cancelReasonOther")}
              value={otherText}
              onChange={(event) => setOtherText(event.target.value)}
              disabled={submitting}
              rows={3}
              autoFocus
              placeholder={t("cancelReasonPlaceholder")}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-pink-500"
            />
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>
            {t("keepOrder")}
          </AlertDialogCancel>
          {/* preventDefault keeps Radix from closing the dialog on click, so a
              failed request leaves the typed reason where the customer put it. */}
          <AlertDialogAction
            disabled={submitting || reason === null}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
            className="gap-2 bg-red-600 hover:bg-red-700"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("confirmCancelOrder")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
