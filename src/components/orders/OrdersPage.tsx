/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/lib/apiClient";
import OrderCard from "./OrderCard";
import CancelOrderDialog from "./CancelOrderDialog";
import OrdersPageSkeleton from "./OrdersPageSkeleton";
import OrderSearchBar from "./OrderSearchBar";
import { useTranslation } from "@/hooks/useTranslation";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useOrderSearch } from "@/hooks/useOrderSearch";
import { useOrders, useInvalidateOrders } from "@/hooks/queries/useOrders";
import { getRatingStatus, hasUnratedParts } from "@/lib/ratingStatus";
import { createRating } from "@/lib/ratings";
import { resolveLocalized } from "@/lib/localizedField";
import type { ProductRatingItem, RateableOrderItem } from "@/types/rating";
import { Star, UtensilsCrossed, X } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { toast } from "sonner";
import { canCancelOrder, getRefundState } from "@/lib/refund";
import { isPickupOrder } from "@/lib/orderTimeline";
import { useOrderRatingStore } from "@/stores/orderRatingStore";
import { getVendorDisplayName } from "@/lib/vendorName";
import { formatOrderPrice } from "@/lib/currency";
import { getOrderBucket } from "@/lib/orderStatus";
import { getOrderCardStatus } from "@/lib/orderCardStatus";
import { getOrderStatusLabel } from "@/lib/orderStatusLabel";
import { Button } from "@/components/ui/button";

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

export default function OrdersPage() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<"ongoing" | "history">("ongoing");
  // Local, not synced to the URL. An order history is private and single-user,
  // so a shareable `?search=` buys nothing — and reading search params here
  // would opt this route out of static rendering for the privilege.
  const [searchTerm, setSearchTerm] = useState("");
  // Cached + deduped. Keyed on language, so a switch refetches while React
  // Query keeps the current list on screen — no manual silent-refetch needed.
  const { data: orders = [], isLoading: loading } = useOrders<any>();
  const invalidateOrders = useInvalidateOrders();
  const [activeRatingOrder, setActiveRatingOrder] = useState<any | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

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
    if (!activeRatingOrder) return null;
    const status = getRatingStatus(activeRatingOrder);
    const items: RateableOrderItem[] = activeRatingOrder.items ?? [];
    return {
      items,
      showProducts: !status.isProductRated && items.length > 0,
      showDelivery:
        !status.isDeliveryRated && Boolean(activeRatingOrder.deliveryPartnerId),
      productsAlreadyRated: status.isProductRated,
      deliveryAlreadyRated:
        status.isDeliveryRated && Boolean(activeRatingOrder.deliveryPartnerId),
    };
  }, [activeRatingOrder]);

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
    if (!activeRatingOrder || !ratingSubject) return;

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
        orderId: activeRatingOrder._id,
        productRatings: someProductsScored ? scoredProducts : undefined,
        deliveryRating: deliveryScored
          ? {
              rating: deliveryRating,
              ...(deliveryReview.trim() ? { review: deliveryReview.trim() } : {}),
            }
          : undefined,
      });

      toast.success(t("ratingsSubmitted"));
      setActiveRatingOrder(null);
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

  /**
   * Opens the rating modal on a clean slate.
   *
   * Shared by the order card and the deep link below, because the six stars
   * are page state: without the reset, rating a second order starts on the
   * first one's scores.
   */
  // Escape is the rating sheet's Cancel — and, like Cancel, does nothing while
  // the rating is being sent.
  useEscapeToClose(Boolean(activeRatingOrder), () => setActiveRatingOrder(null), {
    disabled: submittingRating,
  });

  const openRatingModal = useCallback((order: any) => {
    setProductScores({});
    setProductReviews({});
    setDeliveryRating(0);
    setDeliveryReview("");
    setActiveRatingOrder(order);
  }, []);

  // Somewhere else asked to rate a specific order — today the Rate Order button
  // on a delivered notification. See `stores/orderRatingStore` for why the
  // request travels in a store rather than in the URL.
  const pendingRatingOrderId = useOrderRatingStore(
    (state) => state.pendingRatingOrderId,
  );
  const clearOrderRatingRequest = useOrderRatingStore(
    (state) => state.clearOrderRatingRequest,
  );

  useEffect(() => {
    if (!pendingRatingOrderId) return;
    // The orders are needed before answering — both to find the one to rate
    // and to know what is left to rate on it. Acting on a half-loaded page
    // would reopen the modal for an order already fully reviewed.
    //
    // One list, not two. This used to wait on a separate ratings request as
    // well; the answer now travels on the order.
    if (loading) return;

    const target = orders.find(
      (order: any) => order.orderId === pendingRatingOrderId,
    );
    // Consumed either way. A request that cannot be honoured — an order older
    // than the hundred this page fetches — must not sit in the store waiting to
    // fire the next time the list changes.
    clearOrderRatingRequest();
    if (!target) return;

    // A finished order lives in History, and Ongoing is the default tab.
    //
    // Not derived state: this reacts to an external store written by another
    // page, the case the rule's own docs carve out. Nor can it be a
    // subscription — the request is usually made *before* this page mounts, so
    // the value has to be read rather than awaited.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab("history");
    // Nothing left to rate: no modal. The card carries the same answer in
    // place — "Feedback Submitted", disabled — which is more honest than a
    // dialog that would submit a second review.
    if (!hasUnratedParts(target)) return;
    openRatingModal(target);
  }, [
    pendingRatingOrderId,
    loading,
    orders,
    openRatingModal,
    clearOrderRatingRequest,
  ]);

  // Split once per orders change — not on every rating-modal keystroke (this
  // page holds a lot of rating state that would otherwise re-filter each time).
  const { ongoingOrders, historyOrders } = useMemo(() => {
    // 🔴 ONE call, partitioning the list — never two independent filters.
    //
    // Two filters is what this was, and each carried its own allowlist of
    // statuses. Anything in neither list was fetched, held in memory and
    // rendered nowhere: first every collected self-pickup order, then every
    // `NO_SHOW`. The failure is silent and total — the customer searches their
    // own order id and the page says "no results found", which is
    // indistinguishable from the order not existing.
    //
    // `getOrderBucket` is a total function over one input, so the two lists
    // below are a partition by construction: nothing can be in both, and
    // nothing can be in neither. See its doc for where an unrecognised status
    // goes and why.
    const ongoing: any[] = [];
    const history: any[] = [];
    for (const order of orders) {
      (getOrderBucket(order.orderStatus) === "ongoing" ? ongoing : history).push(
        order,
      );
    }
    return { ongoingOrders: ongoing, historyOrders: history };
  }, [orders]);

  // Search runs over BOTH buckets, never just the visible one. The customer is
  // searching their orders, not the tab they happen to be on — and on an
  // account whose orders have all finished, Ongoing is empty, so a search
  // confined to the active tab would return nothing for every term they could
  // type on the page's default tab. See `useOrderSearch` for why one index
  // serves both lists, and `lib/orderSearch.ts` for why none of this is a
  // request.
  const { filter, isSearching } = useOrderSearch(orders, searchTerm);
  const visibleOngoing = useMemo(
    () => filter(ongoingOrders),
    [filter, ongoingOrders],
  );
  const visibleHistory = useMemo(
    () => filter(historyOrders),
    [filter, historyOrders],
  );

  /**
   * What fills a tab that has nothing to show, in priority order:
   *
   *  1. not searching  → the page's normal copy, exactly as before;
   *  2. searching, but the OTHER tab has matches → say so, and offer to go
   *     there. Without this, searching for a delivered order from the Ongoing
   *     tab is a dead end that reads as "no such order";
   *  3. searching, nothing anywhere → no results.
   *
   * The tab is never switched automatically. Being moved to another tab
   * mid-keystroke feels like a bug; a button the customer chooses does not.
   */
  const renderEmptyState = (tab: "ongoing" | "history") => {
    if (!isSearching) {
      return (
        <p className="text-muted-foreground dark:text-neutral-400">
          {tab === "ongoing" ? t("noOngoingOrders") : t("previousOrdersMessage")}
        </p>
      );
    }

    const otherTab = tab === "ongoing" ? "history" : "ongoing";
    const otherCount =
      tab === "ongoing" ? visibleHistory.length : visibleOngoing.length;

    if (otherCount === 0) {
      return (
        <>
          <p className="text-muted-foreground dark:text-neutral-400">
            {t("noResultsFound")}
          </p>
          <p className="text-sm text-gray-400 dark:text-neutral-500">
            {t("noResultsHint")}
          </p>
        </>
      );
    }

    return (
      <>
        <p className="text-muted-foreground dark:text-neutral-400">
          {t("noMatchingOrders")}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => setActiveTab(otherTab)}
          className="rounded-full font-semibold"
        >
          {/* Composed here rather than interpolated: `t()` takes one argument
              and does not substitute. */}
          {otherCount} {t(tab === "ongoing" ? "inHistory" : "inOngoing")}
        </Button>
      </>
    );
  };

  if (loading) {
    return <OrdersPageSkeleton />;
  }

  // How far along the bar sits, and the line of copy under it. Which *face* the
  // card wears is `getOrderCardStatus`'s answer, not this one — this used to
  // return that too, which meant a status it did not recognise was drawn as
  // "Pending" while the tab it sat in said the order was over.
  //
  // `isPickup` only affects wording and how far along the bar sits. A pickup
  // order's journey ends two steps earlier than a delivery's — there is no
  // rider leg — so `READY_FOR_PICKUP` is nearly done for one and merely
  // three-quarters done for the other.
  const getOrderProgress = (status: string, isPickup: boolean) => {
    switch (status) {
      case "PENDING":
        return { progress: 15, text: t("waitingRestaurantConfirmation") };
      case "ACCEPTED":
      case "ASSIGNED":
        return { progress: 40, text: t("orderAccepted") || t("accepted") };
      case "PREPARING":
        return { progress: 60, text: t("chefPreparingMeal") || t("preparing") };
      case "READY_FOR_PICKUP":
        return {
          // The last thing that happens before the customer walks in, so the
          // bar is nearly full — not the 75% of a delivery order that still has
          // a rider leg to run.
          progress: isPickup ? 95 : 75,
          text: isPickup ? t("readyForPickupSelf") : t("readyForPickup"),
        };
      case "PICKED_UP":
      case "ON_THE_WAY":
        return { progress: 90, text: t("onTheWay") || t("riderHeadingLocation") };
      default:
        // Only reachable for a status this build has never seen — every known
        // live one has a case above. Repeat the backend's own word for it
        // rather than claiming the restaurant has not answered yet, and leave
        // the bar near the start, where a claim about progress is cheapest.
        return {
          progress: 15,
          text:
            getOrderStatusLabel(status, t) ?? t("waitingRestaurantConfirmation"),
        };
    }
  };

  return (
    <section className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-display font-bold text-foreground dark:text-neutral-50">
            {t("myOrders")}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground dark:text-neutral-400">
            {t("trackOrdersDescription")}
          </p>
        </div>

        <OrderSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          // Both tabs, so this never contradicts the per-tab counts below it.
          resultCount={
            isSearching ? visibleOngoing.length + visibleHistory.length : null
          }
        />

        <div className="mb-8 flex border-b border-border">
          <button
            onClick={() => setActiveTab("ongoing")}
            className={`focus-ring relative flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === "ongoing" ? "text-primary dark:text-pink-500" : "text-muted-foreground dark:text-neutral-400"
            }`}
          >
            {/* Counts appear only while searching, so an idle page looks
                exactly as it always has. They are what makes searching both
                tabs legible: the customer can see where their match landed
                without opening the other tab to find out. */}
            {t("ongoing")}
            {isSearching && ` (${visibleOngoing.length})`}
            {activeTab === "ongoing" && (
              <div className="absolute bottom-0 left-0 h-1 w-full rounded-t bg-primary dark:bg-pink-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`focus-ring relative flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === "history" ? "text-primary dark:text-pink-500" : "text-muted-foreground dark:text-neutral-400"
            }`}
          >
            {t("history")}
            {isSearching && ` (${visibleHistory.length})`}
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 h-1 w-full rounded-t bg-primary dark:bg-pink-500" />
            )}
          </button>
        </div>

        {activeTab === "ongoing" ? (
          <div className="space-y-6">
            {visibleOngoing.length === 0 ? (
              <div className="flex h-75 flex-col items-center justify-center gap-3 rounded-xl bg-card border border-border shadow-xs px-4 text-center">
                {renderEmptyState("ongoing")}
              </div>
            ) : (
              visibleOngoing.map((order) => {
                const isPickup = isPickupOrder(order);
                const { progress, text } = getOrderProgress(
                  order.orderStatus,
                  isPickup,
                );
                return (
                  <OrderCard
                    key={order._id}
                    dbId={order._id}
                    isPickup={isPickup}
                    image={order.items?.[0]?.image}
                    restaurant={
                      getVendorDisplayName(order.vendorId) ?? t("restaurant")
                    }
                    orderId={order.orderId}
                    date={new Date(order.createdAt).toLocaleString()}
                    price={formatOrderPrice(order.payoutSummary?.grandTotal)}
                    // Same mapper as the History tab below. One derivation for
                    // both, so the two tabs cannot disagree about what a status
                    // means, and neither can invent a face for a status the
                    // backend added yesterday.
                    status={getOrderCardStatus(order.orderStatus)}
                    statusLabel={getOrderStatusLabel(order.orderStatus, t) ?? ""}
                    items={order.items
                      ?.map(
                        (item: any) =>
                          `${item.itemSummary?.quantity}x ${item.name}`,
                      )
                      .join(", ")}
                    progress={progress}
                    progressText={text}
                    canCancel={canCancelOrder(order)}
                    onCancelOrder={setOrderToCancel}
                  />
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {visibleHistory.length === 0 ? (
              <div className="flex h-75 flex-col items-center justify-center gap-3 rounded-xl bg-card border border-border shadow-xs px-4 text-center">
                {renderEmptyState("history")}
              </div>
            ) : (
              visibleHistory.map((order) => {
                // One derivation, used for both the chip and the label under
                // the progress bar. They used to be worked out separately and
                // disagreed: a REJECTED order was chipped "Cancelled" while the
                // label right below it read "Rejected".
                //
                // And it used to end in `: "cancelled"` — a catch-all that told
                // the customer their order was cancelled whenever it was
                // anything the ternary had not been taught. `NO_SHOW` now has
                // its own face; anything genuinely new gets `unknown` and the
                // backend's own word for it, never someone else's ending.
                const cardStatus = getOrderCardStatus(order.orderStatus);
                const statusLabel =
                  getOrderStatusLabel(order.orderStatus, t) ?? "";
                return (
                  <OrderCard
                    key={order._id}
                    dbId={order._id}
                    isPickup={isPickupOrder(order)}
                    image={order.items?.[0]?.image}
                    restaurant={
                      getVendorDisplayName(order.vendorId) ?? t("restaurant")
                    }
                    orderId={order.orderId}
                    date={new Date(order.createdAt).toLocaleString()}
                    price={formatOrderPrice(order.payoutSummary?.grandTotal)}
                    status={cardStatus}
                    statusLabel={statusLabel}
                    refundState={getRefundState(order)}
                    items={order.items
                      ?.map(
                        (item: any) =>
                          `${item.itemSummary?.quantity}x ${item.name}`,
                      )
                      .join(", ")}
                    progress={100}
                    // The same string the chip shows, so the two cannot drift
                    // again — and for a collected self-pickup order it now
                    // reads "Collected" here too, rather than the "Delivered"
                    // it used to print under a chip saying otherwise.
                    progressText={statusLabel}
                    // The order's own answer, not one derived from a
                    // separate ratings list. That derivation treated any
                    // rating on an order as "done", so an order whose
                    // products were rated but whose rider was not showed
                    // "Feedback Submitted", disabled, with no way to finish
                    // it — there is a live order in exactly that state.
                    isRated={!hasUnratedParts(order)}
                    onRateOrder={() => openRatingModal(order)}
                  />
                );
              })
            )}
          </div>
        )}
      </div>      {/* Rating Modal */}
      {activeRatingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/60 p-4 backdrop-blur-xs transition-all duration-300">
          <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-card border border-transparent dark:border-neutral-800 shadow-2xl transition-all duration-300 max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-foreground dark:text-neutral-50">
                  {t("rateYourOrder")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  {t("order")} #{activeRatingOrder.orderId}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label={t("close")}
                onClick={() => setActiveRatingOrder(null)}
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
                            <SafeImage
                              src={item.image}
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
                onClick={() => setActiveRatingOrder(null)}
                disabled={submittingRating}
                className="text-gray-600 dark:text-neutral-400"
              >
                {t("cancel")}
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
      )}

      {/* A cancelled order stops being ongoing, so the refetch also moves the
          card into History rather than just restyling it in place. */}
      <CancelOrderDialog
        orderId={orderToCancel}
        onClose={() => setOrderToCancel(null)}
        onCancelled={async () => {
          await invalidateOrders();
        }}
      />
    </section>
  );
}
