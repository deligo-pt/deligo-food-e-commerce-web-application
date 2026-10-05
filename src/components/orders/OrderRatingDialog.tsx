/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useInvalidateOrders } from "@/hooks/queries/useOrders";
import { getRatingStatus } from "@/lib/ratingStatus";
import { createRating } from "@/lib/ratings";
import { resolveLocalized } from "@/lib/localizedField";
import type { ProductRatingItem, RateableOrderItem } from "@/types/rating";
import { Star, UtensilsCrossed, X } from "lucide-react";
import ProductImage from "@/components/shared/ProductImage";
import { vendorRouteId } from "@/lib/vendorId";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/*
 * The rating dialog, used in two places (4 Oct 2026):
 * - **Orders page**, from an order card's Rate button or a notification;
 * - **`OrderRatingPrompt`**, which opens it by itself right after an order
 *   completes (`prompt`). It then says why it appeared, and its dismiss button
 *   reads "Not now" instead of "Cancel".
 *
 * Moved out of `OrdersPage` and otherwise unchanged. The caller mounts it with
 * `key={order._id}`, so every order starts with empty stars. That replaces the
 * manual reset the page used to do before opening.
 */

interface StarRatingProps {
  value: number;
  onChange: (val: number) => void;
  size?: number;
  /**
   * What is being scored — a dish's name, or "the rider".
   *
   * Required, because these buttons had no accessible name at all: five
   * identical icon buttons announced as nothing, and with a row of them per
   * product there would now be no way to tell which order they belong to.
   * The group carries the subject; each button carries its own value.
   */
  label: string;
  /** `t("rateStars")` — "Rate {count} out of 5", already looked up. */
  starLabel: string;
}

function StarRating({
  value,
  onChange,
  size = 28,
  label,
  starLabel,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  return (
    <div className="flex gap-1.5" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = hoverValue !== null ? star <= hoverValue : star <= value;
        return (
          <button
            key={star}
            type="button"
            aria-label={starLabel.replace("{count}", String(star))}
            aria-pressed={star === value}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            className="focus-ring rounded-sm transition-transform duration-100 hover:scale-110 active:scale-95"
          >
            <Star
              size={size}
              className={`transition-all duration-100 ${
                active
                  ? "fill-warning text-warning drop-shadow-[0_2px_4px_rgba(246,195,68,0.2)]"
                  : "text-gray-300 dark:text-neutral-700 hover:text-gray-400 dark:hover:text-neutral-600"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

interface OrderRatingDialogProps {
  /** The order to rate: a full order with `items`, `ratingStatus` and `deliveryPartnerId`. */
  order: any;
  onClose: () => void;
  /** Opened by the app after the order completed, not by the customer. */
  prompt?: boolean;
}

export default function OrderRatingDialog({ order, onClose, prompt = false }: OrderRatingDialogProps) {
  const { t, i18n } = useTranslation();
  const invalidateOrders = useInvalidateOrders();

  // One score and one note per product, keyed by the product's `_id` — which
  // is both what `order.items[].productId` holds and what the payload wants.
  // The previous shape was a single score for the whole order; the endpoint
  // has no field for that any more.
  const [productScores, setProductScores] = useState<Record<string, number>>({});
  const [productReviews, setProductReviews] = useState<Record<string, string>>({});

  // The rider. One score, one note, and never a rider id — the backend takes
  // that from the order, and sending one fails the whole request.
  const [deliveryRating, setDeliveryRating] = useState<number>(0);
  const [deliveryReview, setDeliveryReview] = useState<string>("");

  const [submittingRating, setSubmittingRating] = useState<boolean>(false);

  /**
   * What the open modal is asking about, derived rather than stored.
   *
   * A half-rated order opens with only the outstanding half on screen: an
   * order whose products are rated but whose rider is not shows the rider
   * block alone, and says why the other is missing. That state is real — there
   * is a live order in it — and it is the state the previous single boolean
   * could not express.
   */
  const ratingSubject = useMemo(() => {
    if (!order) return null;
    const status = getRatingStatus(order);
    const items: RateableOrderItem[] = order.items ?? [];
    return {
      items,
      showProducts: !status.isProductRated && items.length > 0,
      showDelivery:
        !status.isDeliveryRated && Boolean(order.deliveryPartnerId),
      productsAlreadyRated: status.isProductRated,
      deliveryAlreadyRated:
        status.isDeliveryRated && Boolean(order.deliveryPartnerId),
    };
  }, [order]);

  /**
   * The products the customer has scored, and whether that is all of them.
   *
   * **All or none, and the reason is that ratings are immutable.**
   * `isProductRated` only turns true once *every* product in the order is
   * rated, so a partial submission leaves the block on screen next time —
   * showing the already-rated items again, with no per-product flag to hide
   * them. Submitting one of those a second time is a duplicate, the request is
   * rejected whole, and the item the customer actually meant to rate is lost
   * with it. Requiring the full set costs a 2-item order one extra tap and
   * makes that dead end unreachable.
   */
  const scoredProducts = useMemo<ProductRatingItem[]>(() => {
    if (!ratingSubject?.showProducts) return [];
    return ratingSubject.items
      .filter((item) => (productScores[item.productId] ?? 0) > 0)
      .map((item) => {
        const review = productReviews[item.productId]?.trim();
        return {
          productId: item.productId,
          rating: productScores[item.productId],
          // Omitted rather than sent empty. The server defaults it to "".
          ...(review ? { review } : {}),
        };
      });
  }, [ratingSubject, productScores, productReviews]);

  const allProductsScored =
    !ratingSubject?.showProducts ||
    scoredProducts.length === ratingSubject.items.length;
  const someProductsScored = scoredProducts.length > 0;
  const deliveryScored = Boolean(ratingSubject?.showDelivery) && deliveryRating > 0;

  // Submittable when the rider alone is scored, or when every product is.
  // Anything in between is the dead end above.
  const canSubmitRating =
    (deliveryScored || someProductsScored) &&
    (allProductsScored || !someProductsScored);

  const handleSubmitReview = async () => {
    if (!order || !ratingSubject) return;

    if (someProductsScored && !allProductsScored) {
      toast.error(t("rateEveryItem"));
      return;
    }
    if (!deliveryScored && !someProductsScored) {
      toast.error(t("provideAtLeastOneRating"));
      return;
    }

    setSubmittingRating(true);
    try {
      // One request. The previous implementation posted twice and reconciled
      // the outcomes by hand, including a check that string-matched "already
      // rated" against the server's English prose — which never fired for a
      // customer reading Portuguese.
      await createRating({
        orderId: order._id,
        productRatings: someProductsScored ? scoredProducts : undefined,
        deliveryRating: deliveryScored
          ? {
              rating: deliveryRating,
              ...(deliveryReview.trim() ? { review: deliveryReview.trim() } : {}),
            }
          : undefined,
      });

      toast.success(t("ratingsSubmitted"));
      onClose();
      // Refreshes `ratingStatus` and `isRated`, which is what restyles the
      // card — there is no second ratings list to invalidate any more.
      await invalidateOrders();
    } catch (error) {
      // The server names the offending field in `errorSources`, and
      // `getApiErrorMessage` already prefers that over the generic validation
      // wrapper and already resolves a bilingual message. That matters more
      // than usual here: ratings are immutable with no delete endpoint, so the
      // success path could never be rehearsed against the live API — the first
      // real submission is the test, and a failure has to name its field.
      console.error("Failed to submit rating", error);
      toast.error(getApiErrorMessage(error, t("failedToSubmitRating")));
    } finally {
      setSubmittingRating(false);
    }
  };

  // Escape is the dialog's Cancel and, like Cancel, does nothing while the
  // rating is being sent.
  useEscapeToClose(true, onClose, { disabled: submittingRating });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/60 p-4 backdrop-blur-xs transition-all duration-300">
      <div role="dialog" aria-modal="true" aria-label={t("rateYourOrder")} className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card border border-transparent dark:border-neutral-800 shadow-2xl transition-all duration-300 max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-foreground dark:text-neutral-50">
              {t("rateYourOrder")}
            </h3>
            {prompt ? (
              <p className="text-sm text-gray-600 dark:text-neutral-300">
                {t("ratePromptSubtitle")}
              </p>
            ) : null}
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              {t("order")} #{order.orderId}
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="secondary"
            aria-label={t("close")}
            onClick={() => onClose()}
            className="rounded-full"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-card">
          {/* One block per product. The endpoint takes one score per
              product and has no field for a single order-wide score, so
              this is the shape of the request rendered. */}
          {ratingSubject?.showProducts && (
            <div className="rounded-2xl border border-primary/10 dark:border-neutral-800 bg-linear-to-b from-[#fafbfc] to-[#f4f6f8] dark:from-neutral-950/60 dark:to-neutral-950/30 p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="rounded-full bg-primary/5 dark:bg-pink-950/30 px-2.5 py-0.5 text-xs font-semibold text-primary dark:text-pink-400 uppercase tracking-wider">
                  {t("foodReview")}
                </span>
              </div>

              {ratingSubject.items.map((item) => {
                const name = resolveLocalized(item.name, i18n.language);
                return (
                  <div
                    key={item.productId}
                    className="space-y-3 border-t border-gray-100/80 dark:border-neutral-800 pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center gap-3">
                      {/* The name beside it is the accessible one, so the
                          picture is decorative — an empty `alt`, not the
                          dish's name announced twice. */}
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                        <ProductImage
                          src={item.image}
                          productIds={[item.productId]}
                          vendorId={vendorRouteId(
                            typeof order?.vendorId === "object"
                              ? order.vendorId
                              : { id: order?.vendorId },
                          )}
                          alt=""
                          sizes="40px"
                          fallbackIcon={<UtensilsCrossed className="h-4 w-4" />}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                        {name}
                      </span>
                    </div>
                    <StarRating
                      value={productScores[item.productId] ?? 0}
                      onChange={(val) =>
                        setProductScores((prev) => ({
                          ...prev,
                          [item.productId]: val,
                        }))
                      }
                      size={26}
                      label={name}
                      starLabel={t("rateStars")}
                    />
                    <textarea
                      rows={2}
                      value={productReviews[item.productId] ?? ""}
                      onChange={(e) =>
                        setProductReviews((prev) => ({
                          ...prev,
                          [item.productId]: e.target.value,
                        }))
                      }
                      aria-label={t("productReviewLabel").replace(
                        "{product}",
                        name,
                      )}
                      placeholder={t("reviewPlaceholder")}
                      className="focus-ring w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-gray-400 dark:placeholder:text-neutral-500"
                    />
                  </div>
                );
              })}

              {/* All-or-none, and the customer is told before they press
                  rather than by a rejected request. See `scoredProducts`. */}
              {someProductsScored && !allProductsScored ? (
                <p className="text-xs font-medium text-primary dark:text-pink-400">
                  {t("rateEveryItem")}
                </p>
              ) : null}
            </div>
          )}

          {/* Why the block above is missing, rather than a silent gap. */}
          {ratingSubject?.productsAlreadyRated ? (
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              {t("productsAlreadyRated")}
            </p>
          ) : null}

          {/* The rider. Absent on every self-pickup order, because there
              is no rider on one — the condition is the order's own
              `deliveryPartnerId`, never a guess from the status. */}
          {ratingSubject?.showDelivery && (
            <div className="rounded-2xl border border-primary/10 dark:border-neutral-800 bg-linear-to-b from-[#fafbfc] to-[#f4f6f8] dark:from-neutral-950/60 dark:to-neutral-950/30 p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="rounded-full bg-primary/5 dark:bg-pink-950/30 px-2.5 py-0.5 text-xs font-semibold text-primary dark:text-pink-400 uppercase tracking-wider">
                  {t("deliveryReview")}
                </span>
              </div>

              <div className="flex flex-col items-center justify-center py-2 space-y-2">
                <span className="text-xs font-medium text-gray-400 dark:text-neutral-500 uppercase tracking-wide">
                  {t("overallRating")}
                </span>
                <StarRating
                  value={deliveryRating}
                  onChange={setDeliveryRating}
                  size={32}
                  label={t("yourRider")}
                  starLabel={t("rateStars")}
                />
              </div>

              <textarea
                rows={2}
                value={deliveryReview}
                onChange={(e) => setDeliveryReview(e.target.value)}
                aria-label={t("deliveryReviewLabel")}
                placeholder={t("reviewPlaceholder")}
                className="focus-ring w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-gray-400 dark:placeholder:text-neutral-500"
              />
            </div>
          )}

          {ratingSubject?.deliveryAlreadyRated ? (
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              {t("deliveryAlreadyRated")}
            </p>
          ) : null}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-gray-50 dark:bg-neutral-950 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onClose()}
            disabled={submittingRating}
            className="text-gray-600 dark:text-neutral-400"
          >
            {prompt ? t("notNow") : t("cancel")}
          </Button>

          <Button
            type="button"
            onClick={handleSubmitReview}
            disabled={submittingRating || !canSubmitRating}
            className="min-w-30 gap-2 font-semibold"
          >
            {submittingRating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{t("submitting")}</span>
              </>
            ) : (
              <span>{t("submitReview")}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
