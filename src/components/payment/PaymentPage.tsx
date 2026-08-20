/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  Home,
  Store,
  MapPinned,
  Ticket,
  CreditCard,
  Smartphone,
  Wallet,
  ArrowRight,
  Lock,
  AlertCircle,
  Star,
  X,
  CheckCircle,
  Tag,
  ChevronRight,
  Percent,
  UtensilsCrossed,
  Briefcase,
  MapPin,
  Loader2,
  Plus,
  Navigation,
  Zap,
  Clock,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import SafeImage from "@/components/shared/SafeImage";
import Loader from "@/components/shared/Loader";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { resolveAddonName } from "@/lib/cart";
import { resolveLocalized, type LocalizedField } from "@/lib/localizedField";
import {
  getDeliveryTax,
  getServiceChargeGross,
  getServiceChargeTax,
} from "@/lib/tax";
import { addressTypeLabel, normalizeAddressType } from "@/lib/addressType";
import {
  formatAddressFull,
  formatAddressLine1,
  formatAddressLine2,
} from "@/lib/addressFormat";
import { formatPickupMoment } from "@/lib/pickupTime";
import type { CartAddon } from "@/types/cart";
import { useSavedCards } from "@/hooks/queries/usePaymentTokens";
import { payWithSavedCard } from "@/services/paymentTokenApi";
import Link from "next/link";

interface CheckoutItem {
  productId: string;
  // `GET /checkout/summary` resolves this via Accept-Language, but the summary
  // returned by `POST /offers/validate-apply-offer` carries the raw bilingual
  // document — so this field's shape depends on which call produced the summary.
  name: LocalizedField;
  image: string;
  itemSummary: { quantity: number; grandTotal: number };
  productPricing: { priceAfterProductDiscount: number };
  addons?: CartAddon[];
}

interface OrderCalculation {
  totalOriginalPrice: number;
  totalProductDiscount: number;
  totalOfferDiscount: number;
  totalTaxAmount: number;
  // Net, with its VAT reported alongside.
  serviceCharge?: number;
  serviceChargeVatRate?: number;
  serviceChargeVatAmount?: number;
}

interface Delivery {
  // `totalDeliveryCharge` is gross (charge + vatAmount).
  charge?: number;
  vatRate?: number;
  vatAmount?: number;
  totalDeliveryCharge: number;
  distance: number;
  estimatedTime: number;
}

interface PayoutSummary {
  grandTotal: number;
}

interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  // The checkout summary echoes the selected address's coordinates, used to
  // compute the delivery distance/ETA on the client.
  latitude?: number;
  longitude?: number;
}

// A saved address from the customer profile (GET /profile → deliveryAddresses).
// `isActive` marks the one checkout binds to; `_id` is what
// toggle-delivery-address-status keys on.
interface SavedAddress {
  _id: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  addressType: string;
  /** The customer's own name for an `OTHER` address; "" on older records. */
  customAddressType?: string;
  isActive: boolean;
  detailedAddress?: string;
}

interface OfferApplied {
  promoId: string;
  title: LocalizedField;
  discountValue: number;
  code: string;
}

interface CheckoutSummary {
  _id: string;
  /**
   * A bare Mongo id on older checkouts, the populated vendor sub-document on
   * current ones — the backend started populating it and the string-only
   * assumption here silently blanked the whole "Delivery From" card. Resolve
   * it through `getVendorLookupIds`, never by interpolating it into a URL.
   *
   * The populated shape is not a substitute for the vendor fetch below: its
   * `businessLocation` carries **only** `latitude`/`longitude`, no street.
   */
  vendorId: VendorRef;
  items: CheckoutItem[];
  orderCalculation: OrderCalculation;
  delivery: Delivery;
  payoutSummary: PayoutSummary;
  /**
   * Absent on self-pickup — the backend omits the key entirely rather than
   * sending an empty object, so this must stay optional. It was previously
   * declared required, and the address formatters below read `.street` off it
   * with no guard: the first pickup checkout would have thrown here.
   */
  deliveryAddress?: DeliveryAddress;
  /** Omitted by the backend on delivery orders; only ever `"PICKUP"` when set. */
  fulfillmentType?: "DELIVERY" | "PICKUP";
  /** ISO instant, present only on pickup. */
  pickupTime?: string;
  paymentStatus: string;
  offer: {
    isApplied: boolean;
    offerApplied: OfferApplied | null;
  };
}

interface Vendor {
  id: string;
  userId: string;
  name: { firstName: string; lastName: string };
  businessDetails: {
    businessName: string;
    businessType: string;
    openingHours: string;
    closingHours: string;
    closingDays: string[];
    isStoreOpen: boolean;
  };
  businessLocation: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  };
  storePhoto: string[];
  rating: { average: number; totalReviews: number };
}

/**
 * A vendor as either vendor endpoint actually returns it.
 *
 * The two disagree about where the store photo lives: `/vendors/customer`
 * (the list) sends `storePhoto`, `/vendors/customer/:userId` (the detail)
 * sends `documents.storePhoto`. `normalizeVendor` reconciles them so the card
 * shows the same picture whichever request answered.
 */
type VendorApiResponse = Omit<Vendor, "storePhoto"> & {
  _id?: string;
  storePhoto?: string[];
  documents?: { storePhoto?: string[] };
};

/** What `checkout.vendorId` can be — see `CheckoutSummary.vendorId`. */
type VendorRef =
  | string
  | { _id?: string; userId?: string; [key: string]: unknown }
  | null;

interface VendorLookupIds {
  /** The `V-…`/`SV-…` id, the only one `/vendors/customer/:id` accepts. */
  userId?: string;
  /** The Mongo `_id`, which matches `id` in the customer-facing vendor list. */
  mongoId?: string;
}

const MONGO_ID = /^[0-9a-f]{24}$/i;

function normalizeVendor(raw: VendorApiResponse): Vendor {
  return {
    ...raw,
    storePhoto: raw.storePhoto ?? raw.documents?.storePhoto ?? [],
  };
}

/**
 * Splits whatever the checkout summary called `vendorId` into the two ids the
 * vendor endpoints key on, because they key on different ones.
 *
 * A bare string is classified by shape rather than assumed: 24 hex characters
 * is a Mongo id, anything else is a userId. The populated document carries an
 * `_id` and (today) no `userId` at all, which is why the direct-by-userId call
 * cannot be the only path.
 */
function getVendorLookupIds(ref: VendorRef): VendorLookupIds {
  if (typeof ref === "string") {
    if (ref.length === 0) return {};
    return MONGO_ID.test(ref) ? { mongoId: ref } : { userId: ref };
  }
  if (ref && typeof ref === "object") {
    return {
      userId: typeof ref.userId === "string" ? ref.userId : undefined,
      mongoId: typeof ref._id === "string" ? ref._id : undefined,
    };
  }
  return {};
}

/**
 * Resolves the store shown in "Delivery From" / "Collect From".
 *
 * Deliberately two-step, and deliberately in this order:
 *
 * 1. `/vendors/customer/:userId` — only when a userId is actually in hand.
 *    Called with a Mongo id it 404s every single time, which is what the old
 *    code did on every page load.
 * 2. the customer-facing list, whose `id` is the Mongo `_id` the checkout
 *    summary hands us. It is the only route from that id to a street address.
 *
 * Returns `null` rather than throwing when the store cannot be found: a
 * missing store name must not take down the payment page around it.
 */
async function resolveVendor({
  userId,
  mongoId,
}: VendorLookupIds): Promise<Vendor | null> {
  if (!userId && !mongoId) return null;

  if (userId) {
    try {
      const res = await apiClient.get(`/vendors/customer/${userId}`);
      if (res.data?.data) return normalizeVendor(res.data.data);
    } catch (err) {
      console.warn(
        "Vendor lookup by userId failed, falling back to the list:",
        err,
      );
    }
  }

  const res = await apiClient.get("/vendors/customer", {
    params: { page: 1, limit: 100 },
  });
  const vendors: VendorApiResponse[] = res.data?.data ?? [];
  const match = vendors.find(
    (v) =>
      (mongoId !== undefined && (v.id === mongoId || v._id === mongoId)) ||
      (userId !== undefined && v.userId === userId),
  );
  return match ? normalizeVendor(match) : null;
}

interface AvailableOffer {
  _id: string;
  // The offers endpoints ignore the Accept-Language header and return the raw
  // bilingual document — resolve before rendering.
  title: LocalizedField;
  description: LocalizedField;
  offerType: "PERCENT" | "FLAT";
  isAutoApply: boolean;
  code: string;
  discountValue: number;
  maxDiscountAmount: number;
  minOrderAmount: number;
  expiresAt: string;
  isEligible: boolean;
  message: LocalizedField;
}

export default function PaymentPage() {
  const { t } = useTranslation();
  const lang = useStore((s) => s.lang);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const checkoutId = searchParams.get("checkoutId");

  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Default to Google Pay: CARD is currently rejected by the REDUNIQ sandbox
  // (PAYMENT_INITIATION_FAILED_BY_GATEWAY), while the wallet methods work.
  const [paymentMethod, setPaymentMethod] = useState<string>("GOOGLE_PAY");
  // A saved card is a sub-choice OF Card, not a peer of the four methods —
  // it's still a card payment, just with a token instead of the hosted page.
  // So it hangs off `paymentMethod === "CARD"` and is cleared with it.
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // Tokenization is CARD-only — the API accepts `saveCard` on any method but
  // silently ignores it elsewhere, so the toggle is only offered under CARD
  // and is cleared whenever the method moves away from it.
  const [saveCard, setSaveCard] = useState(false);

  // The customer's saved cards. Read-only here: this list exists to be paid
  // with, and managing it (removing a card) lives on /payment-methods, away
  // from the pay button.
  const { data: savedCards = [] } = useSavedCards();
  // Only under Card, matching the app. Elsewhere the section is hidden.
  const showSavedCards = paymentMethod === "CARD" && savedCards.length > 0;
  // Selecting a card switches the whole flow: one call, no redirect.
  const isInstantPayment = showSavedCards && selectedCardId !== null;
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [availableOffers, setAvailableOffers] = useState<AvailableOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [applyingOfferId, setApplyingOfferId] = useState<string | null>(null);
  const [offerApplyError, setOfferApplyError] = useState("");
  const [isRemovingOffer, setIsRemovingOffer] = useState(false);
  // Separate from `offerApplyError`, which only renders inside the offer modal —
  // removal happens with that modal closed, so its error needs its own slot.
  const [removeOfferError, setRemoveOfferError] = useState("");
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Saved-address picker.
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [switchingAddressId, setSwitchingAddressId] = useState<string | null>(null);
  const [addressError, setAddressError] = useState("");

  useEffect(() => {
    if (!checkoutId) {
      setError(t("noCheckoutIdProvided"));
      setLoading(false);
      return;
    }

    // A new checkoutId means any voucher removal that navigated here is done.
    // Swapping the query string re-runs this effect without remounting, so
    // these don't reset themselves.
    setIsRemovingOffer(false);
    setRemoveOfferError("");

    const fetchData = async () => {
      try {
        setLoading(true);

        const summaryResponse = await apiClient.get(
          `/checkout/summary/${checkoutId}`,
        );
        const summaryData = summaryResponse.data.data;
        console.log("Fetched checkout summary:", summaryData);
        setSummary(summaryData);

        // Isolated from the summary's own try/catch on purpose: an
        // unresolvable store leaves the card empty, it does not turn the whole
        // payment page into an error screen.
        const lookupIds = getVendorLookupIds(summaryData.vendorId);
        try {
          const resolved = await resolveVendor(lookupIds);
          if (resolved) {
            setVendor(resolved);
          } else {
            console.warn(
              "Could not resolve the checkout vendor:",
              summaryData.vendorId,
            );
          }
        } catch (vendorErr) {
          console.warn("Failed to load the checkout vendor:", vendorErr);
        }
      } catch (err) {
        setError(
          getApiErrorMessage(err, "Failed to load checkout information"),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [checkoutId, t]);

  // Saved addresses for the "Change" picker — independent of the checkoutId, so
  // fetched once on mount and refreshed after a switch.
  const loadAddresses = async () => {
    try {
      const res = await apiClient.get("/profile");
      const list = res.data?.data?.deliveryAddresses;
      setAddresses(Array.isArray(list) ? list : []);
    } catch {
      // Non-fatal: the page still works without the picker.
      setAddresses([]);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const handleOpenOfferModal = async () => {
    if (!summary) return;
    setShowOfferModal(true);
    setOffersError("");
    setOfferApplyError("");
    setManualCode("");

    try {
      setOffersLoading(true);
      const res = await apiClient.get(
        `/offers/available-offers/${summary._id}`,
      );
      // The list is mapped during render, where a try/catch can't reach — so a
      // non-array payload has to be rejected here, not there.
      const payload = res.data?.data;
      setAvailableOffers(Array.isArray(payload) ? payload : []);
    } catch (err) {
      setOffersError(getApiErrorMessage(err, "Failed to load offers"));
    } finally {
      setOffersLoading(false);
    }
  };

  const applyOffer = async (offer?: AvailableOffer, codeOverride?: string) => {
    if (!summary) return;

    let identifier: string;
    if (codeOverride) {
      identifier = codeOverride.trim();
    } else if (offer) {
      identifier = offer.isAutoApply ? offer._id : offer.code;
    } else {
      return;
    }

    const key = offer ? offer._id : "manual";
    setApplyingOfferId(key);
    setOfferApplyError("");

    try {
      const res = await apiClient.post("/offers/validate-apply-offer", {
        checkoutId: summary._id,
        offerIdentifier: identifier,
      });

      setSummary(res.data.data);
      setShowOfferModal(false);
      setManualCode("");
    } catch (err) {
      setOfferApplyError(getApiErrorMessage(err, "Failed to apply offer"));
    } finally {
      setApplyingOfferId(null);
    }
  };

  /**
   * Removes the applied voucher.
   *
   * WORKAROUND: the API has no way to un-apply an offer — `validate-apply-offer`
   * only ever sets one, and the delete/toggle-status routes act on the offer
   * itself in admin scope (they'd disable the voucher for every customer, not
   * just this checkout). So the only lever is rebuilding the checkout from the
   * cart, which yields a fresh, offer-free checkout.
   *
   * The cost is a new checkoutId and an abandoned old checkout. Replace this
   * with a single call once the backend exposes a proper remove endpoint.
   */
  const removeOffer = async () => {
    if (!summary || isRemovingOffer) return;

    setIsRemovingOffer(true);
    setRemoveOfferError("");

    try {
      const res = await apiClient.post("/checkout", { useCart: true });
      const newCheckoutId = res.data?.data?._id;
      if (!newCheckoutId) {
        throw new Error("Checkout response did not include an id");
      }

      // `replace`, not `push`: the old checkoutId still carries the offer, so
      // leaving it in history would let Back silently restore the discount.
      router.replace(`${pathname}?checkoutId=${newCheckoutId}`);
    } catch (err) {
      setRemoveOfferError(getApiErrorMessage(err, t("failedToRemoveVoucher")));
      setIsRemovingOffer(false);
    }
    // On success the flag stays set through the navigation and is cleared by the
    // fetch effect when the new checkoutId lands — otherwise the button would
    // flicker back to enabled while the old summary is still on screen.
  };

  /**
   * Switches the delivery address. The checkout has no per-order address param
   * and always binds to the customer's ACTIVE address, so we make the chosen
   * address active, then rebuild the checkout from the cart (same pattern as
   * removeOffer) and navigate to the fresh checkoutId — which reloads the
   * summary with the new address and delivery fee.
   *
   * NOTE: toggling the active address changes the customer's primary address
   * account-wide, not just for this order.
   */
  const selectAddress = async (addr: SavedAddress) => {
    if (switchingAddressId) return;
    if (addr.isActive) {
      setShowAddressModal(false);
      return;
    }

    setSwitchingAddressId(addr._id);
    setAddressError("");

    try {
      await apiClient.patch(
        `/customers/toggle-delivery-address-status/${addr._id}`,
      );
      const res = await apiClient.post("/checkout", { useCart: true });
      const newCheckoutId = res.data?.data?._id;
      if (!newCheckoutId) {
        throw new Error("Checkout response did not include an id");
      }

      await loadAddresses();
      setShowAddressModal(false);
      // `replace`, not `push`: the old checkoutId is bound to the old address —
      // leaving it in history would let Back silently restore it.
      router.replace(`${pathname}?checkoutId=${newCheckoutId}`);
    } catch (err) {
      setAddressError(getApiErrorMessage(err, t("failedToChangeAddress")));
    } finally {
      setSwitchingAddressId(null);
    }
  };

  const handlePlaceOrder = async () => {
    if (!summary) return;
    try {
      setIsPlacingOrder(true);
      setPaymentError("");

      // One-click: no hosted page, no redirect, no return trip. The order
      // already exists once this resolves, so none of the redirect bookkeeping
      // below applies — writing `pendingOrder` here would leave a stale entry
      // for a later redirect flow to pick up.
      if (isInstantPayment && selectedCardId) {
        await payWithSavedCard({
          checkoutSummaryId: summary._id,
          paymentTokenId: selectedCardId,
        });

        // Straight to the orders list, not the tracking page. Nothing is read
        // out of the response, which also sidesteps its undocumented shape —
        // the spec never says whether the id comes back as `orderId` or `_id`.
        router.replace("/orders");
        return;
      }

      const response = await apiClient.post(
        "/payment/reduniq/create-payment-intent",
        {
          checkoutSummaryId: summary._id,
          paymentMethod,
          // Only sent for CARD. The field is ignored server-side for the other
          // methods, but omitting it keeps the wallet request — the one path
          // that currently works end to end — byte-identical to before.
          ...(paymentMethod === "CARD" && { saveCard }),
        },
      );

      const { redirectUrl, paymentToken, cardWillBeSaved } = response.data.data;

      // The gateway gets the final say on whether the card can be tokenized.
      // If it says no while the customer ticked the box, that divergence is
      // silent everywhere else — leave a trace so it's findable.
      if (saveCard && cardWillBeSaved === false) {
        console.warn(
          "[payment] saveCard was requested but the gateway returned cardWillBeSaved: false",
        );
      }

      // The post-payment return page finalizes the order via /orders/create-order,
      // but REDUNIQ's return URL does NOT carry our internal checkoutSummaryId or
      // paymentToken. Persist them here so the return page can read them back from
      // sessionStorage — without this the order never completes after payment.
      if (!redirectUrl) {
        throw new Error("Payment could not be initiated. Please try again.");
      }

      sessionStorage.setItem(
        "pendingOrder",
        JSON.stringify({
          checkoutSummaryId: summary._id,
          paymentToken,
          deliveryNotes: "",
        }),
      );
      window.location.href = redirectUrl;
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, "Failed to process payment");
      setPaymentError(errorMsg);

      // Also runs for a declined saved-card payment. Whether the backend
      // already unwinds the summary's payment status in that case is unknown —
      // TO CONFIRM. Calling it is the failure-safe side of that unknown: if the
      // backend does unwind, this is a redundant reset whose own errors are
      // already swallowed below; if it doesn't, skipping it would leave the
      // summary stuck and the customer unable to retry.
      try {
        await apiClient.post(
          `/payment/reduniq/handle-payment-failure/${summary._id}`,
        );
      } catch (failureErr) {
        console.error("Failed to reset payment status", failureErr);
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 flex items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-6 text-red-650 dark:text-red-400">
          {error || "Checkout summary not available"}
        </div>
      </div>
    );
  }

  const { items, orderCalculation, delivery, payoutSummary, deliveryAddress } =
    summary;

  const subtotal =
    orderCalculation.totalOriginalPrice - orderCalculation.totalProductDiscount;

  const offerDiscount = orderCalculation.totalOfferDiscount ?? 0;
  // `serviceCharge` arrives NET while the grand total charges it with VAT, so
  // the row has to show net + the reported VAT or it falls short by the tax.
  const serviceCharge = getServiceChargeGross(orderCalculation);
  // Captioned like the subtotal and delivery rows — the fee is charged with VAT,
  // so the breakdown should say how much of it is tax.
  const serviceChargeTax = getServiceChargeTax(orderCalculation);
  const orderTotal = payoutSummary.grandTotal;

  // Both taxes are the backend's own figures: `totalTaxAmount` for the items,
  // `delivery.vatAmount` for the (gross) delivery charge.
  const subtotalTax = orderCalculation.totalTaxAmount;
  const deliveryTax = getDeliveryTax(delivery);

  /**
   * Whether this order is collected by the customer rather than delivered.
   *
   * Read from the summary the backend returned, not from anything carried
   * through the URL: this page can be reached by reload, back-navigation or a
   * shared link, and the checkout document is the only thing that knows what
   * was actually booked.
   */
  const isPickup = summary.fulfillmentType === "PICKUP";

  // Guarded rather than assumed: these are typed as required, but an order the
  // backend has not priced a route for would report 0, and "0 km • 0 min" is
  // worse than saying nothing. Each half is shown only if it has a value.
  // Pickup reports 0 for both by construction, so the guard already hides them;
  // `!isPickup` states the intent rather than relying on that coincidence.
  const hasDeliveryDistance =
    !isPickup && typeof delivery.distance === "number" && delivery.distance > 0;
  const hasDeliveryEta =
    !isPickup &&
    typeof delivery.estimatedTime === "number" &&
    delivery.estimatedTime > 0;

  const vendorRating = vendor?.rating.average ?? 0;
  const vendorReviewCount = vendor?.rating.totalReviews ?? 0;

  const appliedOffer = summary.offer?.isApplied
    ? summary.offer.offerApplied
    : null;

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-6">
            <div className="rounded-lg border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-neutral-50">
                  {isPickup ? t("pickupDetails") : t("deliveryDetails")}
                </h2>
                {isPickup && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-[#f9186b] dark:bg-pink-950/40 dark:text-pink-400">
                    <Store className="h-3.5 w-3.5" />
                    {t("selfPickup")}
                  </span>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Delivery From — the collection point on a pickup order, so
                    it keeps its place and only its label changes. */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                    {isPickup ? t("collectFrom") : t("deliveryFrom")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-pink-100 dark:bg-pink-950/40">
                      <SafeImage
                        src={vendor?.storePhoto?.[0]}
                        alt={vendor?.businessDetails?.businessName || "Store"}
                        sizes="48px"
                        fallbackIcon={<Store className="h-5 w-5" />}
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-neutral-50">
                        {vendor?.businessDetails.businessName}
                      </p>
                      {vendor && (
                        <>
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                vendor.businessDetails.isStoreOpen
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                            />
                            <span className="text-xs font-medium text-gray-650 dark:text-neutral-400">
                              {vendor.businessDetails.isStoreOpen
                                ? t("open")
                                : t("closed")}
                            </span>
                            {vendorRating > 0 && (
                              <div className="flex items-center gap-1 ml-2 text-gray-900 dark:text-neutral-200">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-medium">
                                  {vendorRating.toFixed(1)} ({vendorReviewCount}
                                  )
                                </span>
                              </div>
                            )}
                          </div>
                          {/* On pickup this is the address the customer has to
                              travel to, so it shows in full rather than the
                              street-and-city summary a delivery order needs. */}
                          {vendor.businessLocation && (
                            <p className="mt-1 text-sm break-words text-gray-550 dark:text-neutral-400">
                              {isPickup
                                ? formatAddressFull(vendor.businessLocation)
                                : `${vendor.businessLocation.street}, ${vendor.businessLocation.city}`}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Where the order is going — an address for delivery, a time
                    for pickup. A pickup summary carries no `deliveryAddress`
                    at all, so this is a branch and not a relabel: the address
                    formatters read `.street` unguarded and would throw. */}
                {isPickup ? (
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-455">
                      {t("pickupTime")}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/40">
                        <Clock className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold break-words text-gray-900 dark:text-neutral-50">
                          {summary.pickupTime
                            ? formatPickupMoment(summary.pickupTime, lang, {
                                today: t("today"),
                                tomorrow: t("tomorrow"),
                              })
                            : "—"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-neutral-400">
                          {t("collectAtCounter")}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-455">
                        {t("deliveryTo")}
                      </p>
                      {addresses.length > 0 && (
                        <button
                          onClick={() => {
                            setAddressError("");
                            setShowAddressModal(true);
                          }}
                          className="text-xs font-semibold text-[#f9186b] dark:text-pink-400 underline transition hover:text-[#d4145b] dark:hover:text-pink-300"
                        >
                          {t("change")}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/40">
                        <Home className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                      </div>
                      {/* The address the order is actually going to, so it shows
                          in full. It used to headline the city and drop the
                          apartment and country entirely. */}
                      <div className="min-w-0">
                        <p className="font-semibold break-words text-gray-900 dark:text-neutral-50">
                          {deliveryAddress ? formatAddressLine1(deliveryAddress) : ""}
                        </p>
                        <p className="text-sm break-words text-gray-500 dark:text-neutral-400">
                          {deliveryAddress ? formatAddressLine2(deliveryAddress) : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Distance and ETA come straight from `delivery` — the same
                  object whose `totalDeliveryCharge` is billed in the summary
                  opposite, so the fee and the distance it was priced from
                  always agree. This used to be recomputed client-side from the
                  two sets of coordinates, which showed the customer a distance
                  that did not match what they were charged for. Rendered
                  exactly as returned: no rounding, no unit conversion. */}
              {(hasDeliveryDistance || hasDeliveryEta) && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-pink-200 dark:border-pink-900/30 bg-gray-50 dark:bg-neutral-950/50 p-4">
                  <MapPinned className="h-5 w-5 shrink-0 text-[#f9186b] dark:text-pink-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-neutral-100">{t("distanceAndTime")}</p>
                    <p className="text-sm text-gray-500 dark:text-neutral-400">
                      {hasDeliveryDistance && (
                        <>
                          {t("deliveryDistance")}: {delivery.distance} km
                        </>
                      )}
                      {hasDeliveryDistance && hasDeliveryEta && " • "}
                      {hasDeliveryEta && (
                        <>
                          {t("estimatedTime")}: {delivery.estimatedTime} min
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Your Order */}
            <div className="rounded-lg border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-neutral-50">{t("yourOrder")}</h2>
                <Link href={vendor?.userId ? `/vendors/${vendor.userId}` : "/vendors"}>
                  <button className="text-sm font-semibold text-[#f9186b] dark:text-pink-400 hover:text-[#d4145b] dark:hover:text-pink-300">
                    {t("addMoreItems")}
                  </button>
                </Link>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-4 py-4"
                  >
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-100 dark:bg-neutral-800">
                      <SafeImage
                        src={item.image}
                        alt={resolveLocalized(item.name, lang)}
                        sizes="80px"
                        fallbackIcon={<UtensilsCrossed className="h-8 w-8" />}
                      />
                      <div className="absolute right-1 top-1 rounded-full bg-[#f9186b] dark:bg-pink-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {item.itemSummary.quantity}x
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-neutral-50">
                        {resolveLocalized(item.name, lang)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-neutral-400">
                        {t("basePrice")} €
                        {item.productPricing.priceAfterProductDiscount.toFixed(
                          2,
                        )}
                      </p>
                      {item.addons && item.addons.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {item.addons.map((addon) => (
                            <li
                              key={addon.sku}
                              className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400"
                            >
                              <span className="text-[#f9186b] dark:text-pink-400">+</span>
                              <span>
                                {resolveAddonName(addon.name, lang)}
                                {addon.quantity > 1 ? ` ×${addon.quantity}` : ""}
                              </span>
                              <span className="ml-auto">€{addon.lineTotal.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="font-bold text-gray-900 dark:text-neutral-50">
                      €{item.itemSummary.grandTotal.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-100">
            <div className="sticky top-6 rounded-lg border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm">
              <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-neutral-50">{t("paymentSummary")}</h2>

              {/* Price breakdown */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-neutral-400">{t("totalPrice")}</span>
                  <span className="font-semibold text-gray-900 dark:text-neutral-50">
                    €{orderCalculation.totalOriginalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-neutral-400">{t("discount")}</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    -€{orderCalculation.totalProductDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-gray-500 dark:text-neutral-400">
                    {t("subtotal")}
                    <span className="ml-1 whitespace-nowrap text-xs text-gray-400 dark:text-neutral-500">
                      ({t("inclTax")} -&nbsp;€{subtotalTax.toFixed(2)})
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-semibold text-gray-900 dark:text-neutral-50">
                    €{subtotal.toFixed(2)}
                  </span>
                </div>
                {/* The service fee is part of `payoutSummary.grandTotal`, so it
                    must be shown or the breakdown won't reconcile with the
                    amount charged. */}
                {serviceCharge > 0 && (
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-gray-500 dark:text-neutral-400">
                      {t("serviceCharge")}
                      {serviceChargeTax > 0 && (
                        <span className="ml-1 whitespace-nowrap text-xs text-gray-400 dark:text-neutral-500">
                          ({t("inclTax")} -&nbsp;€{serviceChargeTax.toFixed(2)})
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-gray-900 dark:text-neutral-50">
                      €{serviceCharge.toFixed(2)}
                    </span>
                  </div>
                )}
                {/* Dropped entirely on pickup rather than shown as "Free".
                    The backend does send 0, so the row would render — but
                    "Delivery fee: Free" claims there is a delivery that was not
                    charged for, which is a different statement from there being
                    no delivery at all. */}
                {!isPickup && (
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-gray-500 dark:text-neutral-400">
                      {t("deliveryFee")}
                      {delivery.totalDeliveryCharge > 0 && (
                        <span className="ml-1 whitespace-nowrap text-xs text-gray-400 dark:text-neutral-500">
                          ({t("inclTax")} -&nbsp;€{deliveryTax.toFixed(2)})
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-semibold text-green-600 dark:text-green-400">
                      {delivery.totalDeliveryCharge > 0
                        ? `€${delivery.totalDeliveryCharge.toFixed(2)}`
                        : t("free")}
                    </span>
                  </div>
                )}

                {/* Offer discount row – only shown when an offer is applied */}
                {offerDiscount > 0 && (
                  <div className="flex justify-between rounded-lg bg-green-50 dark:bg-green-950/20 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                      <Tag className="h-3.5 w-3.5" />
                      {appliedOffer
                        ? `${resolveLocalized(appliedOffer.title, lang)} (${appliedOffer.code})`
                        : t("offerDiscount")}
                    </span>
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      -€{offerDiscount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Voucher section */}
              <div className="my-6 border-t border-dashed border-gray-200 dark:border-neutral-800 pt-6">
                {appliedOffer ? (
                  /* Applied offer pill */
                  <div className="mb-6">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-950/20 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                        <span className="truncate text-sm font-semibold text-green-700 dark:text-green-400">
                          {resolveLocalized(appliedOffer.title, lang)}
                        </span>
                        <span className="shrink-0 rounded bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 text-xs font-bold text-green-700 dark:text-green-300">
                          {appliedOffer.code}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          onClick={handleOpenOfferModal}
                          disabled={isRemovingOffer}
                          className="text-xs font-semibold text-[#f9186b] dark:text-pink-400 underline hover:text-[#d4145b] dark:hover:text-pink-300 disabled:opacity-50"
                        >
                          {t("change")}
                        </button>
                        <button
                          onClick={removeOffer}
                          disabled={isRemovingOffer}
                          aria-label={t("remove")}
                          title={t("remove")}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-green-700 dark:text-green-400 transition hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50"
                        >
                          {isRemovingOffer ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {isRemovingOffer && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-neutral-400">
                        {t("removingVoucher")}
                      </p>
                    )}
                    {removeOfferError && (
                      <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                        {removeOfferError}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Apply voucher button */
                  <button
                    onClick={handleOpenOfferModal}
                    className="mb-6 flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-pink-300 dark:border-pink-850/40 bg-pink-50 dark:bg-pink-950/10 px-4 py-3 text-[#f9186b] dark:text-pink-400 transition hover:bg-pink-100 dark:hover:bg-pink-950/25"
                  >
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        {t("applyVoucherCode")}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {/* Order Total */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900 dark:text-neutral-50">{t("totalToPay")}</span>
                  <span className="text-3xl font-bold text-[#f9186b] dark:text-pink-400">
                    €{orderTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-neutral-50">
                {t("paymentMethod")}
              </h3>

              {/* 2×2 tiles, matching the app. */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: CreditCard, name: t("card"), value: "CARD" },
                  { icon: Smartphone, name: "MB WAY", value: "MB_WAY" },
                  { icon: Wallet, name: t("googlePay"), value: "GOOGLE_PAY" },
                  { icon: Wallet, name: t("other"), value: "OTHER" },
                ].map((method) => (
                  <label
                    key={method.value}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-4 transition ${
                      paymentMethod === method.value
                        ? "border-[#f9186b] dark:border-pink-500 bg-pink-50 dark:bg-pink-950/20 text-gray-900 dark:text-neutral-50"
                        : "border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <method.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate text-sm font-medium">
                        {method.name}
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="payment"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPaymentMethod(value);
                        // Both only mean anything under Card, so both are
                        // cleared with it — a stale `true` or a stale token
                        // must never ride along in another method's request.
                        if (value !== "CARD") {
                          setSaveCard(false);
                          setSelectedCardId(null);
                        }
                      }}
                      className="h-4 w-4 shrink-0 text-[#f9186b] dark:text-pink-500 focus:ring-pink-500"
                    />
                  </label>
                ))}
              </div>

              {/* Saved cards live under Card, because that is what they are:
                  a card payment with a token instead of the hosted page. */}
              {showSavedCards && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-neutral-50">
                    {t("savedCards")}
                  </p>

                  <div className="space-y-3">
                    {savedCards.map((card) => {
                      const isSelected = selectedCardId === card.id;

                      return (
                        <label
                          key={card.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                            isSelected
                              ? "border-[#f9186b] dark:border-pink-500 bg-pink-50 dark:bg-pink-950/20"
                              : "border-gray-200 dark:border-neutral-800"
                          }`}
                        >
                          <CreditCard className="h-5 w-5 shrink-0 text-[#f9186b] dark:text-pink-400" />
                          <div className="min-w-0 flex-1">
                            {/* Same row treatment as /payment-methods: brand
                                and last digits, both verbatim from the API. */}
                            <span className="block truncate font-medium tracking-wide text-gray-900 dark:text-neutral-50">
                              {card.brand} •••• {card.last4}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-neutral-400">
                              {t("expiresOn")} {card.expiryDate}
                            </span>
                          </div>
                          <input
                            type="radio"
                            name="savedCard"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedCardId(card.id);
                              // Nothing to save — this card already is saved.
                              setSaveCard(false);
                            }}
                            className="h-4 w-4 shrink-0 text-[#f9186b] dark:text-pink-500 focus:ring-pink-500"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Why the button below says "Pay Now" and nothing redirects. */}
              {isInstantPayment && (
                <p className="mt-3 flex items-start gap-2 text-xs text-[#f9186b] dark:text-pink-400">
                  <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t("instantOrderNote")}
                </p>
              )}

              {/* CARD only, and pointless once a saved card is picked: no other
                  method can be tokenized, and offering it under a wallet would
                  promise something that quietly doesn't happen. */}
              {paymentMethod === "CARD" && !isInstantPayment && (
                <label className="mt-5 flex cursor-pointer items-center justify-between gap-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-neutral-50">
                      {t("saveThisCard")}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-neutral-400">
                      {t("saveThisCardSubtitle")}
                    </span>
                  </span>

                  {/* Switch, not a checkbox — the native input stays in the
                      tree (peer) so keyboard and screen readers get a real
                      control, and the track/knob are drawn from its state. */}
                  <span className="relative inline-flex shrink-0">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="peer h-6 w-11 cursor-pointer appearance-none rounded-full bg-gray-200 transition-colors checked:bg-[#f9186b] focus-visible:ring-2 focus-visible:ring-[#f9186b] focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-neutral-700 dark:checked:bg-pink-500"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
                    />
                  </span>
                </label>
              )}

              {paymentError && (
                <div className="mt-6 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        {t("paymentFailed")}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-neutral-400">{paymentError}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
                className={`relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#f9186b] py-4 font-semibold text-white transition hover:bg-[#d4145b] disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500 ${
                  isPlacingOrder ? "" : "cart-cta"
                }`}
              >
                {!isPlacingOrder && (
                  <span className="cart-cta-shine" aria-hidden="true" />
                )}
                {/* The label is the honest signal of what the tap does: a
                    saved card charges immediately, everything else hands off
                    to the gateway's page first. */}
                <span className="relative z-10 flex items-center gap-2">
                  {isPlacingOrder
                    ? t("processing")
                    : isInstantPayment
                      ? t("payNow")
                      : t("placeOrder")}
                  {isInstantPayment ? (
                    <Zap className="h-5 w-5" />
                  ) : (
                    <ArrowRight className="h-5 w-5" />
                  )}
                </span>
              </button>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 dark:text-neutral-400">
                  {t("needHelpWithOrder")}
                </p>
                <button
                  onClick={() => setShowSupportModal(true)}
                  className="font-semibold text-[#f9186b] dark:text-pink-400 hover:text-[#d4145b] dark:hover:text-pink-300"
                >
                  {t("contactSupport")}
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-gray-400 dark:text-neutral-500">
                <Lock className="h-3 w-3" />
                {t("secureCheckout")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowOfferModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-50">
                  {t("availableOffers")}
                </h3>
              </div>
              <button
                onClick={() => setShowOfferModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Manual code input */}
              <div className="rounded-xl border border-gray-200 dark:border-neutral-800 p-4">
                <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-neutral-355">
                  {t("enterVoucherCode")}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) =>
                      setManualCode(e.target.value.toUpperCase())
                    }
                    placeholder={t("enterVoucherCode")}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm outline-none text-gray-900 dark:text-neutral-100 focus:border-pink-500 dark:focus:border-pink-400 placeholder:text-gray-400 dark:placeholder:text-neutral-600"
                  />
                  <button
                    onClick={() => applyOffer(undefined, manualCode)}
                    disabled={
                      !manualCode.trim() || applyingOfferId === "manual"
                    }
                    className="rounded-lg bg-[#f9186b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d4145b] disabled:opacity-50"
                  >
                    {applyingOfferId === "manual" ? t("applying") : t("apply")}
                  </button>
                </div>
              </div>

              {/* Error */}
              {offerApplyError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                  <p className="text-sm text-red-650 dark:text-red-400">{offerApplyError}</p>
                </div>
              )}

              {/* Available offer list */}
              {offersLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#f9186b] border-t-transparent" />
                </div>
              ) : offersError ? (
                <p className="py-4 text-center text-sm text-red-500">
                  {offersError}
                </p>
              ) : availableOffers.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-400 dark:text-neutral-500">
                  <Ticket className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm">{t("noOffersAvailable")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                    {t("availableOffers")}
                  </p>
                  {availableOffers.map((offer) => (
                    <div
                      key={offer._id}
                      className={`rounded-xl border p-4 transition ${
                        !offer.isEligible
                          ? "border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/40 opacity-60 text-gray-400 dark:text-neutral-500"
                          : "border-pink-100 dark:border-pink-900/30 bg-pink-50/40 dark:bg-pink-950/10 hover:border-pink-300 dark:hover:border-pink-700 text-gray-950 dark:text-neutral-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Icon badge */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/30">
                            <Percent className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-gray-900 dark:text-neutral-100">
                                {resolveLocalized(offer.title, lang)}
                              </p>
                              <span className="rounded-md bg-pink-100 dark:bg-pink-900/30 px-2 py-0.5 text-xs font-bold tracking-wide text-pink-700 dark:text-pink-300">
                                {offer.code}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-neutral-400 line-clamp-2">
                              {resolveLocalized(offer.description, lang)}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-neutral-500">
                              <span className="font-medium text-[#f9186b] dark:text-pink-400">
                                {offer.offerType === "PERCENT"
                                  ? `${offer.discountValue}% off`
                                  : `€${offer.discountValue} off`}
                              </span>
                              {offer.minOrderAmount > 0 && (
                                <span>Min. €{offer.minOrderAmount}</span>
                              )}
                              <span>
                                Expires{" "}
                                {new Date(offer.expiresAt).toLocaleDateString()}
                              </span>
                            </div>
                            {!offer.isEligible && (
                              <p className="mt-1 text-xs text-red-400">
                                {resolveLocalized(offer.message, lang)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Apply button */}
                        <button
                          onClick={() => applyOffer(offer)}
                          disabled={
                            !offer.isEligible || applyingOfferId === offer._id
                          }
                          className="shrink-0 rounded-lg bg-[#f9186b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d4145b] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {applyingOfferId === offer._id
                            ? t("applying")
                            : t("apply")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !switchingAddressId && setShowAddressModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-50">
                  {t("selectDeliveryAddress")}
                </h3>
              </div>
              <button
                onClick={() => !switchingAddressId && setShowAddressModal(false)}
                disabled={!!switchingAddressId}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 transition hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {addressError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                  <p className="text-sm text-red-650 dark:text-red-400">{addressError}</p>
                </div>
              )}

              {addresses.map((addr) => {
                const isSwitching = switchingAddressId === addr._id;
                const type = normalizeAddressType(addr.addressType);
                const TypeIcon =
                  type === "OFFICE"
                    ? Briefcase
                    : type === "HOME"
                      ? Home
                      : type === "CURRENT_LOCATION"
                        ? Navigation
                        : MapPin;
                return (
                  <button
                    key={addr._id}
                    onClick={() => selectAddress(addr)}
                    disabled={!!switchingAddressId}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed ${
                      addr.isActive
                        ? "border-[#f9186b] dark:border-pink-500 bg-pink-50/60 dark:bg-pink-950/20"
                        : "border-gray-200 dark:border-neutral-800 hover:border-pink-300 dark:hover:border-pink-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                    } ${switchingAddressId && !isSwitching ? "opacity-50" : ""}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/40">
                      <TypeIcon className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                          {addressTypeLabel(t, addr.addressType, addr.customAddressType)}
                        </span>
                        {addr.isActive && (
                          <span className="rounded bg-[#f9186b] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            {t("active")}
                          </span>
                        )}
                      </div>
                      {/* Same two-line format as the navbar dropdown and the
                          manage-addresses list. This is the last screen before
                          payment, so it is the worst place to show a partial
                          address — the apartment and country used to be
                          dropped here and the postal code came after the city. */}
                      <p className="mt-0.5 font-semibold break-words text-gray-900 dark:text-neutral-50">
                        {formatAddressLine1(addr)}
                      </p>
                      <p className="text-sm break-words text-gray-500 dark:text-neutral-400">
                        {formatAddressLine2(addr)}
                      </p>
                    </div>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center self-center">
                      {isSwitching ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#f9186b] dark:text-pink-400" />
                      ) : (
                        addr.isActive && (
                          <CheckCircle className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                        )
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer — add new address */}
            <div className="border-t border-gray-100 dark:border-neutral-800 px-6 py-4">
              <button
                onClick={() => router.push("/add-address")}
                disabled={!!switchingAddressId}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-pink-300 dark:border-pink-850/40 bg-pink-50 dark:bg-pink-950/10 px-4 py-3 text-sm font-semibold text-[#f9186b] dark:text-pink-400 transition hover:bg-pink-100 dark:hover:bg-pink-950/25 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {t("addNewAddress")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSupportModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-150 dark:border-neutral-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between bg-linear-to-r from-[#f9186b] to-[#d4145b] px-6 py-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {t("contactSupport")}
                </h3>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-gray-500 dark:text-neutral-400 text-center">
                {t("needHelpWithOrder")}
              </p>

              {/* Email */}
              <a
                href="mailto:contact@deligo.pt"
                className="flex items-center gap-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/60 p-4 transition hover:bg-pink-50 dark:hover:bg-pink-950/20 hover:border-pink-200 dark:hover:border-pink-850 group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/40 group-hover:bg-pink-200 dark:group-hover:bg-pink-900 transition">
                  <svg
                    className="h-5 w-5 text-[#f9186b] dark:text-pink-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                    {t("email")}
                  </p>
                  <p className="font-semibold text-gray-800 dark:text-neutral-200 group-hover:text-[#f9186b] dark:group-hover:text-pink-400 transition">
                    contact@deligo.pt
                  </p>
                </div>
              </a>

              {/* Phone */}
              <a
                href="tel:+351920136680"
                className="flex items-center gap-4 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/60 p-4 transition hover:bg-pink-50 dark:hover:bg-pink-950/20 hover:border-pink-200 dark:hover:border-pink-850 group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/40 group-hover:bg-pink-200 dark:group-hover:bg-pink-900 transition">
                  <svg
                    className="h-5 w-5 text-[#f9186b] dark:text-pink-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                    {t("phone")}
                  </p>
                  <p className="font-semibold text-gray-800 dark:text-neutral-200 group-hover:text-[#f9186b] dark:group-hover:text-pink-400 transition">
                    +351 920 136 680
                  </p>
                </div>
              </a>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 dark:border-neutral-800 px-6 py-4 bg-gray-50 dark:bg-neutral-900/80">
              <button
                onClick={() => setShowSupportModal(false)}
                className="w-full rounded-lg bg-gray-150 dark:bg-neutral-800 py-2.5 text-sm font-semibold text-gray-650 dark:text-neutral-305 transition hover:bg-gray-200 dark:hover:bg-neutral-700"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
