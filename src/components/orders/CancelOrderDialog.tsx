"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { getApiErrorMessage } from "@/lib/apiClient";
import { cancelOrder } from "@/services/orderApi";
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
 * has to type one. On failure the dialog deliberately stays open with the text
 * intact — closing it would throw away what they wrote to tell them that the
 * request they just made did not go through.
 */
export default function CancelOrderDialog({
  orderId,
  onClose,
  onCancelled,
}: CancelOrderDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setReason("");
    onClose();
  };

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (!orderId || !trimmed || submitting) return;

    setSubmitting(true);
    try {
      const updated = await cancelOrder(orderId, trimmed);
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

        <div className="space-y-1.5">
          <label
            htmlFor="cancel-order-reason"
            className="text-sm font-semibold text-gray-700 dark:text-neutral-300"
          >
            {t("cancelReason")}
          </label>
          <textarea
            id="cancel-order-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={submitting}
            rows={3}
            autoFocus
            placeholder={t("cancelReasonPlaceholder")}
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#f9186b] disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-pink-500"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>
            {t("keepOrder")}
          </AlertDialogCancel>
          {/* preventDefault keeps Radix from closing the dialog on click, so a
              failed request leaves the typed reason where the customer put it. */}
          <AlertDialogAction
            disabled={submitting || reason.trim().length === 0}
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
