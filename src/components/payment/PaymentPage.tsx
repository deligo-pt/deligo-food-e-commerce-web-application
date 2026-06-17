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
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";
import Link from "next/link";

interface CheckoutItem {
  productId: string;
  name: string;
  image: string;
  itemSummary: { quantity: number; grandTotal: number };
  productPricing: { priceAfterProductDiscount: number };
}

interface OrderCalculation {
  totalOriginalPrice: number;
  totalProductDiscount: number;
  totalOfferDiscount: number;
  totalTaxAmount: number;
}

interface Delivery {
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
}

interface OfferApplied {
  promoId: string;
  title: string;
  discountValue: number;
  code: string;
}

interface CheckoutSummary {
  _id: string;
  vendorId: string;
  items: CheckoutItem[];
  orderCalculation: OrderCalculation;
  delivery: Delivery;
  payoutSummary: PayoutSummary;
  deliveryAddress: DeliveryAddress;
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

interface AvailableOffer {
  _id: string;
  title: string;
  description: string;
  offerType: "PERCENT" | "FLAT";
  isAutoApply: boolean;
  code: string;
  discountValue: number;
  maxDiscountAmount: number;
  minOrderAmount: number;
  expiresAt: string;
  isEligible: boolean;
  message: string;
}

export default function PaymentPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get("checkoutId");

  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CARD");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [availableOffers, setAvailableOffers] = useState<AvailableOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [applyingOfferId, setApplyingOfferId] = useState<string | null>(null);
  const [offerApplyError, setOfferApplyError] = useState("");

  useEffect(() => {
    if (!checkoutId) {
      setError("No checkout ID provided");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        const summaryResponse = await apiClient.get(
          `/checkout/summary/${checkoutId}`,
        );
        const summaryData = summaryResponse.data.data;
        setSummary(summaryData);

        if (summaryData.vendorId) {
          const vendorResponse = await apiClient.get("/vendors/customer");
          const vendors: Vendor[] = vendorResponse.data.data;
          const matchedVendor = vendors.find(
            (v) => v.id === summaryData.vendorId,
          );
          if (matchedVendor) setVendor(matchedVendor);
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
  }, [checkoutId]);

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
      setAvailableOffers(res.data.data ?? []);
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

  const handlePlaceOrder = async () => {
    if (!summary) return;
    try {
      setIsPlacingOrder(true);
      setPaymentError("");

      const response = await apiClient.post(
        "/payment/reduniq/create-payment-intent",
        {
          checkoutSummaryId: summary._id,
          paymentMethod,
        },
      );

      const { redirectUrl } = response.data.data;
      window.location.href = redirectUrl;
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, "Failed to process payment");
      setPaymentError(errorMsg);

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
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-600">
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
  const orderTotal = payoutSummary.grandTotal;

  const vendorRating = vendor?.rating.average ?? 0;
  const vendorReviewCount = vendor?.rating.totalReviews ?? 0;

  const appliedOffer = summary.offer?.isApplied
    ? summary.offer.offerApplied
    : null;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-6">
            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  {t("deliveryDetails")}
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Delivery From */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {t("deliveryFrom")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-pink-100">
                      {vendor?.storePhoto?.[0] ? (
                        <Image
                          src={vendor.storePhoto[0]}
                          alt={vendor.businessDetails.businessName}
                          className="h-full w-full object-cover"
                          width={48}
                          height={48}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Store className="h-5 w-5 text-pink-600" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">
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
                            <span className="text-xs font-medium text-gray-600">
                              {vendor.businessDetails.isStoreOpen
                                ? t("open")
                                : t("closed")}
                            </span>
                            {vendorRating > 0 && (
                              <div className="flex items-center gap-1 ml-2">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs font-medium">
                                  {vendorRating.toFixed(1)} ({vendorReviewCount}
                                  )
                                </span>
                              </div>
                            )}
                          </div>
                          {vendor.businessLocation && (
                            <p className="mt-1 text-sm text-gray-500">
                              {vendor.businessLocation.street},{" "}
                              {vendor.businessLocation.city}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery To */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {t("deliveryTo")}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                      <Home className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{deliveryAddress.city}</p>
                      <p className="text-sm text-gray-500">
                        {deliveryAddress.street}, {deliveryAddress.postalCode}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-lg border border-dashed border-pink-200 bg-gray-50 p-4">
                <MapPinned className="h-5 w-5 text-pink-600" />
                <div>
                  <p className="font-medium">{t("distanceAndTime")}</p>
                  <p className="text-sm text-gray-500">
                    {t("deliveryDistance")}:{" "}
                    {(delivery.distance || 2.5).toFixed(1)} km •{" "}
                    {t("estimatedTime")}: {delivery.estimatedTime || 25} min
                  </p>
                </div>
              </div>
            </div>

            {/* Your Order */}
            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">{t("yourOrder")}</h2>
                <Link href={`/vendors`}>
                  <button className="text-sm font-semibold text-pink-600">
                    {t("addMoreItems")}
                  </button>
                </Link>
              </div>

              <div className="divide-y">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center gap-4 py-4"
                  >
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-100">
                      <Image
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        height={80}
                        width={80}
                      />
                      <div className="absolute right-1 top-1 rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {item.itemSummary.quantity}x
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {t("basePrice")} €
                        {item.productPricing.priceAfterProductDiscount.toFixed(
                          2,
                        )}
                      </p>
                    </div>
                    <p className="font-bold">
                      €{item.itemSummary.grandTotal.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-100">
            <div className="sticky top-6 rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-2xl font-bold">{t("paymentSummary")}</h2>

              {/* Price breakdown */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("itemsTotal")}</span>
                  <span className="font-semibold">
                    €{orderCalculation.totalOriginalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("discount")}</span>
                  <span className="font-semibold text-green-600">
                    -€{orderCalculation.totalProductDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("subtotal")}</span>
                  <span className="font-semibold">€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("serviceCharge")}</span>
                  <span className="font-semibold">
                    €{orderCalculation.totalTaxAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("deliveryFee")}</span>
                  <span className="font-semibold text-green-600">
                    {delivery.totalDeliveryCharge > 0
                      ? `€${delivery.totalDeliveryCharge.toFixed(2)}`
                      : t("free")}
                  </span>
                </div>

                {/* Offer discount row – only shown when an offer is applied */}
                {offerDiscount > 0 && (
                  <div className="flex justify-between rounded-lg bg-green-50 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-green-700 font-medium">
                      <Tag className="h-3.5 w-3.5" />
                      {appliedOffer
                        ? `${appliedOffer.title} (${appliedOffer.code})`
                        : t("offerDiscount")}
                    </span>
                    <span className="font-semibold text-green-700">
                      -€{offerDiscount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Voucher section */}
              <div className="my-6 border-t border-dashed pt-6">
                {appliedOffer ? (
                  /* Applied offer pill */
                  <div className="mb-6 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">
                        {appliedOffer.title}
                      </span>
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                        {appliedOffer.code}
                      </span>
                    </div>
                    <button
                      onClick={handleOpenOfferModal}
                      className="text-xs font-semibold text-pink-600 underline"
                    >
                      {t("change")}
                    </button>
                  </div>
                ) : (
                  /* Apply voucher button */
                  <button
                    onClick={handleOpenOfferModal}
                    className="mb-6 flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-pink-300 bg-pink-50 px-4 py-3 text-pink-600 transition hover:bg-pink-100"
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
                  <span className="text-2xl font-bold">{t("orderTotal")}</span>
                  <span className="text-3xl font-bold text-pink-600">
                    €{orderTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <h3 className="mb-4 text-lg font-semibold">
                {t("paymentMethod")}
              </h3>

              <div className="space-y-3">
                {[
                  {
                    icon: CreditCard,
                    name: "Debit/Credit Card",
                    value: "CARD",
                  },
                  { icon: Smartphone, name: "MB WAY", value: "MB_WAY" },
                  { icon: Wallet, name: "Google Pay", value: "GOOGLE_PAY" },
                  { icon: Wallet, name: "Other", value: "OTHER" },
                ].map((method) => (
                  <label
                    key={method.value}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 ${
                      paymentMethod === method.value
                        ? "border-pink-600 bg-pink-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <method.icon className="h-5 w-5" />
                      <span className="font-medium">{method.name}</span>
                    </div>
                    <input
                      type="radio"
                      name="payment"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="h-4 w-4 text-pink-600"
                    />
                  </label>
                ))}
              </div>

              {paymentError && (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-600">
                        {t("paymentFailed")}
                      </p>
                      <p className="text-sm text-gray-600">{paymentError}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 py-4 font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
              >
                {isPlacingOrder ? t("processing") : t("placeOrder")}
                <ArrowRight className="h-5 w-5" />
              </button>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  {t("needHelpWithOrder")}
                </p>
                <button className="font-semibold text-pink-600">
                  {t("contactSupport")}
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-gray-400">
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
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-pink-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  {t("availableOffers")}
                </h3>
              </div>
              <button
                onClick={() => setShowOfferModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Manual code input */}
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-2 text-sm font-semibold text-gray-700">
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
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                  />
                  <button
                    onClick={() => applyOffer(undefined, manualCode)}
                    disabled={
                      !manualCode.trim() || applyingOfferId === "manual"
                    }
                    className="rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
                  >
                    {applyingOfferId === "manual" ? t("applying") : t("apply")}
                  </button>
                </div>
              </div>

              {/* Error */}
              {offerApplyError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-sm text-red-600">{offerApplyError}</p>
                </div>
              )}

              {/* Available offer list */}
              {offersLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />
                </div>
              ) : offersError ? (
                <p className="py-4 text-center text-sm text-red-500">
                  {offersError}
                </p>
              ) : availableOffers.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-400">
                  <Ticket className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm">{t("noOffersAvailable")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    {t("availableOffers")}
                  </p>
                  {availableOffers.map((offer) => (
                    <div
                      key={offer._id}
                      className={`rounded-xl border p-4 transition ${
                        !offer.isEligible
                          ? "border-gray-100 bg-gray-50 opacity-60"
                          : "border-pink-100 bg-pink-50/40 hover:border-pink-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Icon badge */}
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100">
                            <Percent className="h-5 w-5 text-pink-600" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-gray-900">
                                {offer.title}
                              </p>
                              <span className="rounded-md bg-pink-100 px-2 py-0.5 text-xs font-bold tracking-wide text-pink-700">
                                {offer.code}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">
                              {offer.description}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                              <span className="font-medium text-pink-600">
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
                                {offer.message}
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
                          className="shrink-0 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>
  );
}
