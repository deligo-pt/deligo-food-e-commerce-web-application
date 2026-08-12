"use client";

import { CheckCircle, Clock3, Download, HandCoins, Info, Loader2, RotateCcw, Store, UtensilsCrossed, Star, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import SafeImage from "@/components/shared/SafeImage";
import { getApiErrorMessage } from "@/lib/apiClient";
import { downloadInvoice, extractBlobErrorMessage } from "@/lib/invoice";
import { useReorder } from "@/hooks/queries/useOrders";
import { refundStateLabelKey, type RefundState } from "@/lib/refund";

/**
 * How each refund state is chipped. `not_eligible` is amber and neutral on
 * purpose: it is not a failure worth red, and it must not be mistaken for
 * either of the two states where money is actually moving.
 */
const REFUND_CHIP: Record<
  Exclude<RefundState, "none">,
  { className: string; icon: typeof CheckCircle }
> = {
  completed: {
    className: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400",
    icon: CheckCircle,
  },
  in_progress: {
    className: "bg-pink-50 dark:bg-pink-950/30 text-[#f9186b] dark:text-pink-400",
    icon: HandCoins,
  },
  not_eligible: {
    className: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400",
    icon: Info,
  },
};

interface OrderCardProps {
  dbId: string;
  restaurant: string;
  orderId: string;
  date: string;
  price: string;
  /**
   * `rejected` and `cancelled` are kept apart because the backend keeps them
   * apart — a restaurant refusing the order and an order being called off are
   * different events, and the customer is told which one happened.
   */
  status: "accepted" | "pending" | "delivered" | "cancelled" | "rejected";
  /**
   * Whether money is owed back on this order. Kept separate from `status`
   * rather than folded into it: `status` also decides which actions the card
   * offers, and a refund does not change what the customer can do here.
   */
  refundState?: RefundState;
  items: string;
  progress: number;
  progressText: string;
  image?: string;
  isRated?: boolean;
  onRateOrder?: (dbId: string) => void;
  /**
   * Whether this order may still be called off. Decided by the caller with
   * `canCancelOrder`, since it reads fields (`isPaid`) this card never needs.
   */
  canCancel?: boolean;
  onCancelOrder?: (orderId: string) => void;
  /**
   * Whether the customer collects this order themselves.
   *
   * Passed in rather than derived here so the card never has to know about
   * `fulfillmentType` and its legacy `null` — the list already makes that call
   * once, with `isPickupOrder`.
   *
   * It changes wording, not layout: a self-pickup order that reached its happy
   * ending was "collected", not "delivered", and `READY_FOR_PICKUP` means the
   * customer should set off rather than that a rider is on their way.
   */
  isPickup?: boolean;
}

export default function OrderCard({
  dbId,
  restaurant,
  orderId,
  date,
  price,
  status,
  refundState = "none",
  items,
  progress,
  progressText,
  image,
  isRated = false,
  onRateOrder,
  canCancel = false,
  onCancelOrder,
  isPickup = false,
}: OrderCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const reorder = useReorder();
  const [downloading, setDownloading] = useState(false);
  const [reordering, setReordering] = useState(false);

  // The two terminal statuses are labelled differently but behave identically:
  // no food is coming, so the same actions make sense for both.
  const isTerminated = status === "cancelled" || status === "rejected";

  const handleReorder = async () => {
    if (reordering) return;
    setReordering(true);
    try {
      await reorder(orderId);
      toast.success(t("reorderAddedToCart"));
      router.push("/cart");
    } catch (error) {
      // A restaurant closing between the original order and this click is the
      // likeliest failure; that message is translated centrally by errorKey.
      toast.error(getApiErrorMessage(error, t("reorderFailed")));
    } finally {
      setReordering(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadInvoice(orderId, t);
      toast.success(t("invoiceDownloaded"));
    } catch (error) {
      toast.error(await extractBlobErrorMessage(error, t("invoiceDownloadFailed")));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-colors duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-gray-100 dark:border-neutral-800">
            <SafeImage
              src={image}
              alt={restaurant}
              sizes="48px"
              fallbackIcon={<UtensilsCrossed className="h-5 w-5" />}
            />
          </div>

          <div>
            <h3 className="font-semibold text-[#191c1d] dark:text-neutral-50">{restaurant}</h3>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5a4044] dark:text-neutral-400">
              <span>
                {t("order")} #{orderId}
              </span>
              <span>•</span>
              <span>{date}</span>
              {/* The one thing this card cannot otherwise convey: a pickup
                  order has no rider and no address, so two cards that look
                  alike can mean very different things to the customer. */}
              {isPickup && (
                <span className="flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 font-semibold text-[#f9186b] dark:bg-pink-950/30 dark:text-pink-400">
                  <Store size={11} />
                  {t("selfPickup")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="font-semibold text-[#f9186b] dark:text-pink-400">{price}</span>

          {status === "accepted" ? (
            <div className="flex items-center gap-1 rounded-full bg-pink-50 dark:bg-pink-950/30 px-2 py-1 text-xs text-[#f9186b] dark:text-pink-400">
              <CheckCircle size={12} />
              {t("accepted")}
            </div>
          ) : status === "delivered" ? (
            <div className="flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-950/20 px-2 py-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle size={12} />
              {/* Same chip, honest wording: nobody delivered a self-pickup
                  order — the customer went and got it. */}
              {isPickup ? t("orderCollected") : t("delivered")}
            </div>
          ) : isTerminated ? (
            // Whichever of the two the backend actually reported — this used to
            // say "Cancelled" for both, contradicting the label under the
            // progress bar on every rejected order.
            <div className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/20 px-2 py-1 text-xs text-red-600 dark:text-red-400">
              <XCircle size={12} />
              {t(status)}
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-1 text-xs text-gray-600 dark:text-neutral-400">
              <Clock3 size={12} />
              {t("pending")}
            </div>
          )}

          {/* A cancelled order the customer paid for says nothing about their
              money without this — the red chip above only reports that the
              food is not coming. */}
          {refundState !== "none" && (() => {
            const { className, icon: RefundIcon } = REFUND_CHIP[refundState];
            return (
              <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${className}`}>
                <RefundIcon size={12} />
                {t(refundStateLabelKey(refundState)!)}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 rounded-lg bg-[#f3f4f5] dark:bg-neutral-950 px-3 py-3 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <UtensilsCrossed size={15} className="text-[#f9186b] dark:text-pink-400" />
          <p className="text-sm text-[#191c1d] dark:text-neutral-300">{items}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-2 text-xs">
          <span
            className={
              status === "accepted"
                ? "font-medium text-[#f9186b] dark:text-pink-400"
                : "text-[#5a4044] dark:text-neutral-400"
            }
          >
            {progressText}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-neutral-800">
          {/* A full brand-pink bar reads as "completed successfully". On an
              order that was rejected or cancelled it is the same claim the
              track-order timeline used to make, so the terminal bar is red. */}
          <div
            className={`h-full rounded-full ${
              isTerminated
                ? "bg-red-600 dark:bg-red-500"
                : "bg-[#f9186b] dark:bg-pink-600"
            }`}
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5">
        {status === "delivered" ? (
          <button
            onClick={() => onRateOrder?.(dbId)}
            disabled={isRated}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-center text-sm transition ${
              isRated
                ? "bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 cursor-default"
                : "bg-[#f9186b] dark:bg-pink-600 text-white font-semibold hover:opacity-90"
            }`}
          >
            <Star size={16} className={isRated ? "fill-[#f6c344] text-[#f6c344]" : "fill-white text-white"} />
            {isRated ? t("alreadySubmitted") || "Already Submitted" : t("rateOrder") || "Rate Order"}
          </button>
        ) : (
          <Link
            href={`/orders/track-order/${orderId}`}
            className="block w-full rounded-lg bg-[#f9186b] dark:bg-pink-600 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t("trackOrder")}
          </Link>
        )}

        {/* Re-order only makes sense once an order is finished — an in-flight
            one is already on its way. */}
        {(status === "delivered" || isTerminated) && (
          <button
            onClick={handleReorder}
            disabled={reordering}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-neutral-700 py-3 text-sm font-semibold text-[#191c1d] dark:text-neutral-100 transition hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reordering ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RotateCcw size={16} />
            )}
            {t("reorder")}
          </button>
        )}

        {!isTerminated && (
          <button
            onClick={handleDownloadInvoice}
            disabled={downloading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-neutral-700 py-3 text-sm font-semibold text-[#191c1d] dark:text-neutral-100 transition hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {t("downloadInvoice")}
          </button>
        )}

        {/* Last, and the only destructive action here — kept away from Track
            Order so it is never the button a customer reaches for by habit. */}
        {canCancel && onCancelOrder && (
          <button
            onClick={() => onCancelOrder(orderId)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-900/40 py-3 text-sm font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <XCircle size={16} />
            {t("cancelOrder")}
          </button>
        )}
      </div>
    </div>
  );
}