/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Bike,
  Check,
  CheckCheck,
  CheckCircle,
  CheckSquare,
  Clock,
  Download,
  Headphones,
  Loader2,
  MapPin,
  Navigation,
  Receipt,
  ShoppingBag,
  Utensils,
  XCircle,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { downloadInvoice, extractBlobErrorMessage } from "@/lib/invoice";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { getServiceChargeGross, getDeliveryTax } from "@/lib/tax";
import {
  canCancelOrder,
  getRefundState,
  isOrderFinished,
  isTerminatedStatus,
} from "@/lib/refund";
import {
  getTerminalReason,
  getTimelineStepIndex,
  getTimelineStepKeys,
  isPickupOrder,
} from "@/lib/orderTimeline";
import { getPaymentStatusDisplay } from "@/lib/paymentStatus";
import { isCompletedStatus } from "@/lib/orderStatus";
import { useInvalidateOrders } from "@/hooks/queries/useOrders";
import { useVendor, useVendorsCustomer } from "@/hooks/queries/useVendors";
import { formatAddressFull } from "@/lib/addressFormat";
import { toTelHref } from "@/lib/phone";
import { getVendorDisplayName } from "@/lib/vendorName";
import { formatPickupMoment } from "@/lib/pickupTime";
import OrderMap from "./OrderMap/OrderMap";
import PickupCodeCard from "./PickupCodeCard";
import PickupLocationCard from "./PickupLocationCard";
import RefundBanner from "./RefundBanner";
import CancelOrderDialog from "../CancelOrderDialog";


// A live order changes minute to minute, so it is worth watching closely. A
// pending refund settles over days — polling that at 5s would be thousands of
// requests to catch one field flip, so it drops to a background cadence.
const LIVE_POLL_MS = 5000;
const REFUND_POLL_MS = 30000;

// Caption above a single field inside a card — smaller and fainter than the
// card's own heading caption, so the two read as a hierarchy rather than
// competing for the same line.
const FIELD_LABEL_CLASS =
  "text-[11px] font-bold uppercase tracking-wider text-[#8e6f74] dark:text-neutral-500";

// Copy and icon for every step the timeline can show. Which of these actually
// appear — and in what order — is `getTimelineStepKeys`'s call, so that a
// rejected order does not display the steps it never reached.
const STEP_PRESENTATION: Record<
  string,
  { labelKey: string; descriptionKey: string; icon: typeof Check }
> = {
  PENDING: {
    labelKey: "orderPending",
    descriptionKey: "waitingRestaurantResponse",
    icon: Check,
  },
  ACCEPTED: {
    labelKey: "orderAccepted",
    descriptionKey: "restaurantAcceptedOrder",
    icon: CheckCircle,
  },
  PREPARING: {
    labelKey: "preparing",
    descriptionKey: "restaurantPreparingMeal",
    icon: Utensils,
  },
  READY_FOR_PICKUP: {
    labelKey: "readyForPickup",
    descriptionKey: "orderReadyForPickup",
    icon: CheckSquare,
  },
  PICKED_UP: {
    labelKey: "pickedUp",
    descriptionKey: "riderPickedUpOrder",
    icon: Bike,
  },
  ON_THE_WAY: {
    labelKey: "onTheWay",
    descriptionKey: "riderHeadingLocation",
    icon: Navigation,
  },
  DELIVERED: {
    labelKey: "delivered",
    descriptionKey: "orderDelivered",
    icon: CheckCheck,
  },
  // The self-pickup ending, set when the vendor verifies the code at the
  // counter. Distinct from `PICKED_UP` above, which is a rider leaving the
  // restaurant.
  PICKED_UP_BY_CUSTOMER: {
    labelKey: "orderCollected",
    descriptionKey: "orderCollectedDescription",
    icon: CheckCheck,
  },
  REJECTED: {
    labelKey: "rejected",
    descriptionKey: "orderWasRejected",
    icon: XCircle,
  },
  CANCELLED: {
    labelKey: "cancelled",
    descriptionKey: "orderWasCancelled",
    icon: XCircle,
  },
};

/**
 * Last-resort label for a status this build has no copy for.
 *
 * `getTimelineStepKeys` appends a pickup order's own status when it falls
 * outside the known progression, because the status a collected order reaches
 * has not been confirmed yet. Without this, `STEP_PRESENTATION[key]` would be
 * undefined and the page would crash on the customer whose order just
 * completed — the worst possible moment.
 *
 * Turning `NOT_COLLECTED` into "Not Collected" is presentation of a value the
 * backend sent, not copy invented here. It is deliberately plain, and it should
 * stop appearing the moment the real status is known and given proper keys.
 */
function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// `terminalNote` is the vendor's own reason for a rejection/cancellation, which
// the API requires them to give — it replaces the generic description on the
// terminal step, the way the app shows it.
function getOrderStep(
  order: any,
  t: (key: string) => string,
  terminalNote: string | null,
  isPickup: boolean,
) {
  return getTimelineStepKeys(order).map((key) => {
    const presentation = STEP_PRESENTATION[key];
    const isTerminal = isTerminatedStatus(key);

    if (!presentation) {
      return {
        key,
        label: humanizeStatus(key),
        description: isTerminal && terminalNote ? terminalNote : "",
        icon: Check,
      };
    }

    // `READY_FOR_PICKUP` means two different things depending on who is
    // collecting. For a delivery order it is about the rider; for a pickup
    // order it is the customer's cue to walk in, so it gets its own line.
    const descriptionKey =
      isPickup && key === "READY_FOR_PICKUP"
        ? "readyForPickupSelf"
        : presentation.descriptionKey;

    return {
      key,
      label: t(presentation.labelKey),
      description: isTerminal && terminalNote ? terminalNote : t(descriptionKey),
      icon: presentation.icon,
    };
  });
}

export default function TrackOrder() {
  const { t, i18n, langVersion } = useTranslation();
  const lang = i18n.language;
  const { orderId } = useParams<{ orderId: string }>();

  /**
   * The vendor list, read here only for a pickup order's store address.
   *
   * It has to come from this list rather than the order: a pickup order carries
   * no `deliveryAddress`, no `pickupAddress`, and its embedded `vendorId` has
   * `businessDetails` but no `businessLocation`. Without this lookup every
   * coordinate on the page is undefined — which is how the map ended up
   * centring pickup orders on a hardcoded point in rural Bangladesh.
   *
   * Called unconditionally and up here with the other hooks, not beside the
   * pickup branch further down: this component returns early while the order is
   * loading, and a hook after that return would change hook order between
   * renders. It is the same cached query the cart and checkout already use, so
   * for a delivery order it costs a cache read and nothing else.
   */
  const { data: vendorList = [] } = useVendorsCustomer<any>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxStatusIndex, setMaxStatusIndex] = useState(0);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const invalidateOrders = useInvalidateOrders();

  /**
   * The vendor's own record, read for the one thing no other source carries:
   * their phone number.
   *
   * `GET /orders/:id` populates `vendorId` with the name and `businessDetails`
   * and stops there — no `contactNumber`. The vendor *list* above has the
   * store's location but omits the number too; only the per-vendor detail route
   * returns it. So a customer who needed to reach the shop about their own
   * order had nothing to call, while the rider's number has been one tap away
   * further down this page all along.
   *
   * Keyed on `userId` ("V-…"), NOT the Mongo `_id` — the detail route 404s on
   * the latter. Undefined until the order lands, which leaves the query
   * disabled, and React Query caches the result, so this costs one request per
   * order viewed.
   */
  const { data: vendorDetail } = useVendor<any>(order?.vendorId?.userId);

  const handleDownloadInvoice = async () => {
    if (downloadingInvoice || !order?.orderId) return;
    setDownloadingInvoice(true);
    try {
      await downloadInvoice(order.orderId, t);
      toast.success(t("invoiceDownloaded"));
    } catch (error) {
      toast.error(await extractBlobErrorMessage(error, t("invoiceDownloadFailed")));
    } finally {
      setDownloadingInvoice(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async (isInitial = false) => {
      try {
        const res = await apiClient.get(`/orders/${orderId}`);
        const orderData = res.data.data;
        setOrder(orderData);

        if (orderData) {
          const idx = getTimelineStepIndex(orderData);
          // The timeline shortens the moment an order is rejected, so a max
          // carried over from the live path can point past the last step —
          // clamp, or nothing renders as current.
          const lastIdx = getTimelineStepKeys(orderData).length - 1;
          if (isInitial) {
            setMaxStatusIndex(idx);
          } else {
            setMaxStatusIndex((prevMax) => Math.min(Math.max(prevMax, idx), lastIdx));
          }
        }

        // An order is finished only when no money is still owed back. A
        // rejected order mid-refund is NOT finished: `orderStatus` has stopped
        // moving, but `paymentStatus` has not — stopping here would freeze the
        // banner on "Refund In Progress" until the customer reloaded the page.
        if (orderData) {
          if (isOrderFinished(orderData)) {
            stopped = true;
            stopPolling();
          } else {
            const refundPending = getRefundState(orderData) === "in_progress";
            setPollDelay(refundPending ? REFUND_POLL_MS : LIVE_POLL_MS);
          }
        }
      } catch (err: any) {
        if (isInitial) {
          setError(getApiErrorMessage(err, "Failed to load order"));
        }
      } finally {
        if (isInitial) {
          setLoading(false);
        }
      }
    };

    // Poll for live updates, but ONLY while the tab is visible (a backgrounded
    // tracking tab makes zero requests), and stop entirely once the order is
    // finished — which now includes "and the refund has settled".
    let stopped = false;
    let currentDelay = LIVE_POLL_MS;

    const startPolling = () => {
      if (stopped || intervalRef.current) return;
      intervalRef.current = setInterval(() => fetchOrder(false), currentDelay);
    };
    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    /** Change cadence, re-arming the timer only if it is currently running —
     *  a hidden tab must stay silent. */
    const setPollDelay = (delay: number) => {
      if (delay === currentDelay) return;
      currentDelay = delay;
      if (intervalRef.current) {
        stopPolling();
        startPolling();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !stopped) {
        fetchOrder(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Initial fetch to load page content immediately
    fetchOrder(true);
    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // langVersion: re-fetch the order in the new language (keeps the current
    // order on screen since loading only toggles on the initial load).
  }, [orderId, langVersion]);

  // Animation observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("opacity-100", "translate-y-0");
            entry.target.classList.remove("opacity-0", "translate-y-10");
          }
        });
      },
      { threshold: 0.1 },
    );
    document.querySelectorAll(".bento-card").forEach((card) => {
      card.classList.add(
        "transition-all",
        "duration-700",
        "opacity-0",
        "translate-y-10",
      );
      observer.observe(card);
    });
    return () => observer.disconnect();
  }, [order]);

  if (loading) {
    return (
      <main className="bg-[#f8f9fa] dark:bg-neutral-950 text-[#191c1d] dark:text-neutral-100 min-h-screen font-sans overflow-x-hidden transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24">
          <div className="animate-pulse space-y-6">
            <div className="h-100 bg-gray-200 dark:bg-neutral-800 rounded-4xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-gray-200 dark:bg-neutral-800 rounded-3xl" />
              <div className="h-32 bg-gray-200 dark:bg-neutral-800 rounded-3xl" />
            </div>
            <div className="h-64 bg-gray-200 dark:bg-neutral-800 rounded-3xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="bg-[#f8f9fa] dark:bg-neutral-950 text-[#191c1d] dark:text-neutral-100 min-h-screen font-sans overflow-x-hidden transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24 text-center">
          <p className="text-red-500 dark:text-red-400">{error || "Order not found"}</p>
        </div>
      </main>
    );
  }

  // The shop's name, falling back to the owner's only if it has none — see
  // `getVendorDisplayName`. This read `name` directly, which is the *owner*, so
  // the Restaurant card below headed a Leopold order with the person who runs
  // it. The pickup card a few lines down already had the priority right.
  const vendorName = getVendorDisplayName(order.vendorId);

  const isPickup = isPickupOrder(order);

  const storeVendor = isPickup
    ? vendorList.find(
        (v: any) =>
          v._id === order.vendorId?._id || v.userId === order.vendorId?.userId,
      ) ?? null
    : null;
  /* `useVendor` holds the previous vendor's record while a new one loads, so it
     is trusted only once it is demonstrably about THIS order's vendor. Without
     the check, moving between two orders could print one shop's phone number
     under another shop's name for a frame — and a customer calls the wrong
     restaurant about their order. */
  const orderVendor =
    vendorDetail && vendorDetail.userId === order.vendorId?.userId
      ? vendorDetail
      : null;

  /* The list is the preferred source for the address because it is already
     cached — it paints with the rest of the page rather than after a second
     round trip. The detail record backs it up: the list is capped at 100
     vendors, and one falling off the end left a collecting customer with no
     address at all. */
  const storeLocation =
    storeVendor?.businessLocation ?? orderVendor?.businessLocation ?? null;

  // Shown beneath the store's address, below. Trimmed because the field is free
  // text; `toTelHref` decides separately whether it can actually be dialled.
  const vendorPhone: string | null = orderVendor?.contactNumber?.trim() || null;
  const vendorPhoneHref = toTelHref(vendorPhone);

  // Delivery address
  const deliveryAddress = order.deliveryAddress;
  const addressString = [
    deliveryAddress?.street,
    deliveryAddress?.city,
    deliveryAddress?.state,
    deliveryAddress?.country,
    deliveryAddress?.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  // Restaurant address – dynamic based on pickupAddress or order status
  const pickupAddress = order.pickupAddress;
  const restaurantAddress = pickupAddress
    ? [
      pickupAddress.street,
      pickupAddress.city,
      pickupAddress.state,
      pickupAddress.country,
      pickupAddress.postalCode,
    ]
      .filter(Boolean)
      .join(", ")
    : order.orderStatus === "PENDING"
      ? t("restaurantAddressPending")
      : t("restaurantAddressComingSoon");

  // Order items and calculations
  const items = order.items || [];
  const totalItems = items.reduce(
    (sum: number, item: any) => sum + (item.itemSummary?.quantity || 0),
    0,
  );
  const payout = order.payoutSummary || {};
  const calc = order.orderCalculation || {};
  const grandTotal = payout.grandTotal || 0;
  // What the customer paid for the items — NOT payoutSummary.vendor.earnings*,
  // which is the restaurant's net take after commission and would neither
  // reconcile with the total nor be any of the customer's business.
  const totalOriginalPrice = calc.totalOriginalPrice || 0;
  const productDiscount = calc.totalProductDiscount || 0;
  const subtotal = totalOriginalPrice - productDiscount;
  // `serviceCharge` arrives net; the total charges it with VAT, which the
  // backend reports as `serviceChargeVatAmount`.
  const serviceCharge = getServiceChargeGross(calc);
  const serviceChargeTax = calc.serviceChargeVatAmount || 0;
  const offerDiscount = calc.totalOfferDiscount || 0;
  const deliveryFee = order.delivery?.totalDeliveryCharge || 0;
  const deliveryTax = getDeliveryTax(order.delivery || {});
  // Tax embedded in the items subtotal — shown inline on the subtotal row,
  // matching the app, rather than as a standalone line.
  const subtotalTax = calc.totalTaxAmount || 0;

  const steps = getOrderStep(order, t, getTerminalReason(order), isPickup);

  // Derived from the payment fields, not `orderStatus` — a refund moves
  // `paymentStatus`/`isPaid` while the order stays REJECTED/CANCELED.
  const refundState = getRefundState(order);
  const paymentStatusDisplay = getPaymentStatusDisplay(order.paymentStatus);

  return (
    <main className="bg-[#f8f9fa] dark:bg-neutral-950 text-[#191c1d] dark:text-neutral-100 min-h-screen font-sans overflow-x-hidden transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 md:px-16 py-8 mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Above the map, not instead of it: the right column is a fixed
                min-h-175 timeline, so dropping the map would leave the grid
                badly lopsided on desktop. Renders nothing unless a refund is
                actually owed. */}
            <RefundBanner state={refundState} />

            {/* The map draws a restaurant→customer route and follows a rider
                along it — neither of which a self-pickup order has. Fed the
                undefined coordinates such an order carries, it silently fell
                back to a hardcoded default and centred the view on the wrong
                continent. Pickup gets the code and the shop's location
                instead: the two things a collecting customer needs. */}
            {isPickup ? (
              <>
                {order.pickup?.code && (
                  <PickupCodeCard
                    code={order.pickup.code}
                    isReady={order.orderStatus === "READY_FOR_PICKUP"}
                  />
                )}
                <PickupLocationCard
                  storeName={vendorName || t("restaurant")}
                  location={storeLocation}
                />
              </>
            ) : (
              <OrderMap
                orderStatus={order.orderStatus}
                pickupLatitude={order.pickupAddress?.latitude}
                pickupLongitude={order.pickupAddress?.longitude}
                pickupAddress={restaurantAddress}
                deliveryLatitude={deliveryAddress?.latitude}
                deliveryLongitude={deliveryAddress?.longitude}
                deliveryAddress={addressString}
                riderLatitude={order.deliveryPartnerId?.currentSessionLocation?.coordinates?.[1]}
                riderLongitude={order.deliveryPartnerId?.currentSessionLocation?.coordinates?.[0]}
                riderName={order.deliveryPartnerId ? `${order.deliveryPartnerId.name?.firstName || ""} ${order.deliveryPartnerId.name?.lastName || ""}` : ""}
                etaMinutes={order.delivery?.estimatedTime}
              />
            )}

            {/* Rider Details Card (Dynamic Live view) */}
            {order.deliveryPartnerId && (
              <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-md p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-transparent dark:border-neutral-800 border-l-4 dark:border-l-4 border-[#008080] animate-fadeIn transition-all duration-500 hover:shadow-lg">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-[#008080] bg-gray-100 dark:bg-neutral-950 shrink-0">
                    {order.deliveryPartnerId.profilePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.deliveryPartnerId.profilePhoto}
                        alt="Rider"
                        className="w-full h-full object-cover animate-scaleIn"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#e0f2f1] dark:bg-teal-950/20 text-[#008080]">
                        <Bike className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#5a4044] dark:text-neutral-400 tracking-wide uppercase">
                      {t("yourRider") || "Your Rider"}
                    </p>
                    <h3 className="text-xl font-extrabold text-[#191c1d] dark:text-neutral-50">
                      {`${order.deliveryPartnerId.name?.firstName || ""} ${order.deliveryPartnerId.name?.lastName || ""}`.trim()}
                    </h3>
                    <p className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      {order.orderStatus === "DELIVERED"
                        ? t("orderHasBeenDelivered")
                        : order.orderStatus === "ON_THE_WAY" || order.orderStatus === "PICKED_UP"
                        ? t("riderIsHeadingToYourLocation")
                        : t("riderAssigned")}
                    </p>
                  </div>
                </div>
                {order.deliveryPartnerId.contactNumber && (
                  <a
                    href={`tel:${order.deliveryPartnerId.contactNumber}`}
                    className="w-full md:w-auto text-center bg-[#008080] hover:bg-[#006666] dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-extrabold px-6 py-3.5 rounded-full transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 hover:shadow-lg"
                  >
                    <Navigation className="w-4 h-4 rotate-45" />
                    {t("callRider") || "Call Rider"} ({order.deliveryPartnerId.contactNumber})
                  </a>
                )}
              </div>
            )}

            {/* Restaurant & Delivery Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-md p-6 flex gap-4 border border-transparent dark:border-neutral-800">
                <div className="h-12 w-12 rounded-full bg-[#ffd9de] dark:bg-pink-950/30 flex items-center justify-center shrink-0">
                  <Utensils className="w-6 h-6 text-[#f9186b] dark:text-pink-400" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold text-[#5a4044] dark:text-neutral-400 tracking-wide">
                    {t("restaurant")}
                  </p>
                  <h3 className="text-xl font-bold text-[#191c1d] dark:text-neutral-50 break-words">
                    {vendorName || t("restaurant")}
                  </h3>
                  {/* Two facts about the same shop, so each is captioned rather
                      than left as a run of grey lines the customer has to tell
                      apart by shape. `FIELD_LABEL_CLASS` is quieter than
                      the card's own "Restaurant" caption — these sit a level
                      below it. */}
                  <div className="pt-2 space-y-2.5">
                    <div>
                      <p className={FIELD_LABEL_CLASS}>{t("address")}</p>
                      {/* `restaurantAddress` resolves to "address pending" when
                          the order carries no `pickupAddress` — which is always,
                          on a pickup order. The store's real address is the one
                          thing the customer has to have, so it comes from the
                          vendor lookup instead. */}
                      <p className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400 leading-relaxed break-words">
                        {isPickup && storeLocation
                          ? formatAddressFull(storeLocation)
                          : restaurantAddress}
                      </p>
                    </div>
                    {/* Beneath the address, because the two answer the same
                        question — how do I reach this shop — and a customer
                        standing outside one that looks shut needs the second
                        answer as much as the first. Rendered as `tel:` so it
                        dials on the device most of them are holding, and left
                        as plain text when the stored value has nothing
                        dialable in it. */}
                    {vendorPhone && (
                      <div>
                        <p className={FIELD_LABEL_CLASS}>{t("phone")}</p>
                        {vendorPhoneHref ? (
                          <a
                            href={vendorPhoneHref}
                            aria-label={`${t("phone")}: ${vendorPhone}`}
                            className="text-sm font-semibold break-all text-[#f9186b] dark:text-pink-400 hover:underline"
                          >
                            {vendorPhone}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold break-all text-[#5a4044] dark:text-neutral-400">
                            {vendorPhone}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Where the order ends up: an address for delivery, a time and a
                  counter for pickup. */}
              <div className="bg-white dark:bg-neutral-900 rounded-3xl shadow-md p-6 flex gap-4 border border-transparent dark:border-neutral-800 border-l-4 dark:border-l-4 border-l-[#f9186b] dark:border-l-[#f9186b]">
                <div className="h-12 w-12 rounded-full bg-[#ffd9df] dark:bg-pink-950/30 flex items-center justify-center shrink-0">
                  {isPickup ? (
                    <Clock className="w-6 h-6 text-[#f9186b] dark:text-pink-400" />
                  ) : (
                    <MapPin className="w-6 h-6 text-[#f9186b] dark:text-pink-400" />
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold text-[#5a4044] dark:text-neutral-400">
                    {isPickup ? t("pickupTime") : t("deliveryTo")}
                  </p>
                  <h3 className="text-xl font-bold text-[#191c1d] dark:text-neutral-50 break-words">
                    {isPickup
                      ? order.pickup?.pickupTime
                        ? formatPickupMoment(order.pickup.pickupTime, lang, {
                            today: t("today"),
                            tomorrow: t("tomorrow"),
                          })
                        : "—"
                      : deliveryAddress?.city || t("location")}
                  </h3>
                  <p className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400 break-words">
                    {isPickup
                      ? t("collectAtCounter")
                      : addressString || t("addressNotProvided")}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items & Bill Summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-5 bg-white dark:bg-neutral-900 rounded-3xl border border-transparent dark:border-neutral-800 shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#ffd9de] dark:bg-pink-950/30 rounded-xl">
                    <ShoppingBag className="w-5 h-5 text-[#f9186b] dark:text-pink-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400">
                    {t("items")} ({totalItems})
                  </h4>
                </div>
                <div className="space-y-2">
                  {items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#f9186b] dark:text-pink-400 font-bold">
                          {item.itemSummary?.quantity}x
                        </span>
                        <span className="text-[#191c1d] dark:text-neutral-300 font-semibold">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[#191c1d] dark:text-neutral-250 font-bold">
                        €{item.itemSummary?.grandTotal?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="md:col-span-7 bg-white dark:bg-neutral-900 rounded-3xl border border-transparent dark:border-neutral-800 shadow-md p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#ffd9df] dark:bg-pink-950/30 rounded-xl">
                    <Receipt className="w-5 h-5 text-[#f9186b] dark:text-pink-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#5a4044] dark:text-neutral-400 uppercase tracking-wider">
                    {t("billSummary")}
                  </h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-3 text-[#5a4044] dark:text-neutral-400">
                    <span className="min-w-0">
                      {t("totalPrice")}
                      <span className="ml-1 whitespace-nowrap text-xs text-[#8e6f74] dark:text-neutral-500">
                        ({t("withoutDiscount")})
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap">€{totalOriginalPrice.toFixed(2)}</span>
                  </div>
                  {productDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>{t("discount")}</span>
                      <span>-€{productDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3 text-[#5a4044] dark:text-neutral-400">
                    <span className="min-w-0">
                      {t("subtotal")}
                      <span className="ml-1 whitespace-nowrap text-xs text-[#8e6f74] dark:text-neutral-500">
                        ({t("inclTax")}&nbsp;€{subtotalTax.toFixed(2)})
                      </span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap">€{subtotal.toFixed(2)}</span>
                  </div>
                  {/* Dropped on pickup rather than shown as €0.00: there was no
                      delivery to charge for, which is a different statement
                      from a delivery that happened to be free. Matches the
                      payment page. */}
                  {!isPickup && (
                    <div className="flex items-baseline justify-between gap-3 text-[#5a4044] dark:text-neutral-400">
                      <span className="min-w-0">
                        {t("deliveryFee")}
                        {deliveryFee > 0 && (
                          <span className="ml-1 whitespace-nowrap text-xs text-[#8e6f74] dark:text-neutral-500">
                            ({t("inclTax")}&nbsp;€{deliveryTax.toFixed(2)})
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 whitespace-nowrap">€{deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  {serviceCharge > 0 && (
                    <div className="flex items-baseline justify-between gap-3 text-[#5a4044] dark:text-neutral-400">
                      <span className="min-w-0">
                        {t("serviceCharge")}
                        {serviceChargeTax > 0 && (
                          <span className="ml-1 whitespace-nowrap text-xs text-[#8e6f74] dark:text-neutral-500">
                            ({t("inclTax")}&nbsp;€{serviceChargeTax.toFixed(2)})
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 whitespace-nowrap">€{serviceCharge.toFixed(2)}</span>
                    </div>
                  )}
                  {offerDiscount > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>{t("offerDiscount")}</span>
                      <span>-€{offerDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-4 mt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                    <span className="text-2xl font-extrabold text-[#191c1d] dark:text-neutral-50">
                      {t("totalAmount")}
                    </span>
                    <span className="text-2xl font-extrabold text-[#f9186b] dark:text-pink-400">
                      €{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="mt-6 bg-[#edeeef] dark:bg-neutral-950 p-4 rounded-2xl flex items-center justify-between transition-colors duration-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#5a4044] dark:text-neutral-400">
                      {t("paymentMethod")}
                    </span>
                    <span className="text-[#191c1d] dark:text-neutral-300 font-extrabold">
                      {order.paymentMethod || t("notAvailable")}
                    </span>
                  </div>
                  {/* No status from the backend means no badge. It used to
                      fall back to the word "PAID", which invented the answer to
                      the one question this badge exists to answer. */}
                  {paymentStatusDisplay && (
                    <span
                      className={`px-3 py-1 text-[10px] font-bold rounded-full border ${paymentStatusDisplay.className}`}
                    >
                      {paymentStatusDisplay.labelKey
                        ? t(paymentStatusDisplay.labelKey)
                        : paymentStatusDisplay.rawLabel}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleDownloadInvoice}
                  disabled={downloadingInvoice}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-3 font-bold text-[#191c1d] dark:text-neutral-100 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingInvoice ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{t("downloadInvoice")}</span>
                </button>
                {/* Below the invoice, and outlined rather than filled: this is
                    the only destructive action on the page. */}
                {canCancelOrder(order) && (
                  <button
                    onClick={() => setCancelDialogOpen(true)}
                    className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-neutral-950 px-6 py-3 font-bold text-red-600 dark:text-red-400 transition-all hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t("cancelOrder")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Timeline */}
          <aside className="lg:col-span-5 bg-white dark:bg-neutral-900 rounded-3xl border border-transparent dark:border-neutral-800 shadow-md p-6 h-full min-h-175 transition-colors duration-200">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-extrabold text-[#191c1d] dark:text-neutral-50">
                  {t("orderStatus")}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-[#5a4044] dark:text-neutral-400 text-xs font-semibold">
                  <span className="font-bold">{order.orderId}</span>
                  <span>•</span>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <Link href="/help-center">
                <button className="bg-[#f9186b] dark:bg-pink-600 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-95">
                  <Headphones className="w-4 h-4" />
                  <span className="font-bold">{t("support")}</span>
                </button>
              </Link>
            </div>

            <div className="relative space-y-0 px-2">
              {steps.map((step: any, idx: number) => {
                const isCompleted = idx < maxStatusIndex;
                const isCurrent = idx === maxStatusIndex;
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className="relative flex gap-6 pb-10 last:pb-0"
                  >
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute left-5 top-10 bottom-0 w-0.5 ${isCompleted ? "bg-[#f9186b] dark:bg-pink-600" : "bg-[#e3bdc3] dark:bg-neutral-800"
                          } ${isCurrent && idx !== steps.length - 1 ? "border-l-2 border-dashed border-[#e3bdc3] dark:border-neutral-800" : ""}`}
                      />
                    )}
                    <div
                      className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${isCompleted || isCurrent
                        ? "bg-[#f9186b] dark:bg-pink-600 text-white"
                        : "bg-[#f3f4f5] dark:bg-neutral-950 text-[#8e6f74] dark:text-neutral-500 border border-[#e3bdc3] dark:border-neutral-800"
                        } ${isCurrent ? "border-4 border-[#ffd9de] dark:border-pink-950/40" : ""}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4
                        className={`text-xl font-bold ${isCompleted || isCurrent
                          ? "text-[#191c1d] dark:text-neutral-50"
                          : "text-[#8e6f74] dark:text-neutral-500"
                          } ${isCurrent ? "text-[#f9186b] dark:text-pink-400" : ""}`}
                      >
                        {step.label}
                      </h4>
                      <p
                        className={`text-base ${isCompleted || isCurrent ? "text-[#5a4044] dark:text-neutral-400" : "text-[#e3bdc3] dark:text-neutral-600"}`}
                      >
                        {step.description}
                      </p>
                      {/* The pulsing "in progress" chip belongs only on a step
                          the order is still working through. It used to test
                          `!== "DELIVERED"`, which left it pulsing on a
                          collected pickup order — telling a customer holding
                          their food that something was still happening. */}
                      {isCurrent && !isCompletedStatus(step.key) && !isTerminatedStatus(step.key) && (
                        <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-[#ffd9de] dark:bg-pink-950/40 text-[#f9186b] dark:text-pink-400 rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 bg-[#f9186b] dark:bg-pink-500 rounded-full animate-pulse" />
                          {t("inProgress")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* The response carries the new status, refundStatus and cancelReason, so
          the timeline, banner and payment badge all repaint from it — no need
          to wait for the next poll tick, which then stops the polling itself. */}
      <CancelOrderDialog
        orderId={cancelDialogOpen ? order.orderId : null}
        onClose={() => setCancelDialogOpen(false)}
        onCancelled={async (updated) => {
          if (updated) {
            setOrder(updated);
            // The timeline shortens to end on CANCELED, so a max index carried
            // over from the live path would point past the last step and
            // nothing would render as current. Set, not max: the terminal step
            // is always the last one, so it is the furthest this order will
            // ever get.
            setMaxStatusIndex(getTimelineStepIndex(updated as any));
          }
          // This page owns its order in local state; /orders keeps its own
          // cached list. Without this the customer cancels here, navigates
          // back, and finds the order still in Ongoing offering to cancel it
          // again. Outside the `if`: the list is wrong whether or not the
          // response carried a body.
          await invalidateOrders();
        }}
      />
    </main>
  );
}
