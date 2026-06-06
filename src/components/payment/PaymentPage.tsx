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
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import Image from "next/image";

// Type definitions (adjust based on actual API response)
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

interface CheckoutSummary {
  _id: string;
  items: CheckoutItem[];
  orderCalculation: OrderCalculation;
  delivery: Delivery;
  payoutSummary: PayoutSummary;
  deliveryAddress: DeliveryAddress;
  paymentStatus: string;
}

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get("checkoutId");

  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CARD");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [showVoucherInput, setShowVoucherInput] = useState(false);

  useEffect(() => {
    if (!checkoutId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No checkout ID provided");
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/checkout/summary/${checkoutId}`);
        setSummary(response.data.data);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load checkout summary"));
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [checkoutId]);

  const handlePlaceOrder = async () => {
    if (!summary) return;
    try {
      setIsPlacingOrder(true);
      setPaymentError("");

      const response = await apiClient.post("/payment/reduniq/create-payment-intent", {
        checkoutSummaryId: summary._id,
        paymentMethod,
      });

      const { redirectUrl } = response.data.data;
      // Redirect to payment gateway
      window.location.href = redirectUrl;
    } catch (err) {
      const errorMsg = getApiErrorMessage(err, "Failed to process payment");
      setPaymentError(errorMsg);

      // Call failure endpoint to reset payment status
      try {
        await apiClient.post(`/payment/reduniq/handle-payment-failure/${summary._id}`);
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

  const { items, orderCalculation, delivery, payoutSummary, deliveryAddress } = summary;
  const subtotal = orderCalculation.totalOriginalPrice - orderCalculation.totalProductDiscount;
  const orderTotal = payoutSummary.grandTotal;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* LEFT COLUMN */}
          <div className="flex-1 space-y-6">
            {/* Delivery Details */}
            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Delivery Details</h2>
                <button className="text-sm font-semibold text-pink-600">Change</button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Delivery From
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                      <Store className="h-5 w-5 text-pink-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Nova Vida Market</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs font-medium text-green-600">Online</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Delivery To
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
                  <p className="font-medium">Distance & Time</p>
                  <p className="text-sm text-gray-500">
                    Delivery distance: {(delivery.distance || 2.5).toFixed(1)} km • Est. time:{" "}
                    {(delivery.estimatedTime || 25)} min
                  </p>
                </div>
              </div>
            </div>

            {/* Your Order */}
            <div className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Your Order</h2>
                <button className="text-sm font-semibold text-pink-600">Add more items</button>
              </div>

              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-4 py-4">
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
                        Base price €{item.productPricing.priceAfterProductDiscount.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-bold">€{item.itemSummary.grandTotal.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Payment Summary */}
          <div className="w-full lg:w-100">
            <div className="sticky top-6 rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-2xl font-bold">Payment Summary</h2>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Items Total</span>
                  <span className="font-semibold">
                    €{orderCalculation.totalOriginalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span className="font-semibold text-green-600">
                    -€{orderCalculation.totalProductDiscount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span className="font-semibold">€{orderCalculation.totalTaxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Fee</span>
                  <span className="font-semibold text-green-600">
                    {delivery.totalDeliveryCharge > 0
                      ? `€${delivery.totalDeliveryCharge.toFixed(2)}`
                      : "FREE"}
                  </span>
                </div>
              </div>

              <div className="my-6 border-t border-dashed pt-6">
                <button
                  onClick={() => setShowVoucherInput(!showVoucherInput)}
                  className="mb-6 flex w-full items-center justify-end gap-2 text-pink-600"
                >
                  <Ticket className="h-4 w-4" />
                  Apply voucher code
                </button>

                {showVoucherInput && (
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter voucher code"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-2 outline-none focus:border-pink-500"
                    />
                    <button className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white">
                      Apply
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">Order Total</span>
                  <span className="text-3xl font-bold text-pink-600">
                    €{orderTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <h3 className="mb-4 text-lg font-semibold">Payment Method</h3>

              <div className="space-y-3">
                {[
                  { icon: CreditCard, name: "Debit/Credit Card", value: "CARD" },
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
                      <p className="font-semibold text-red-600">Payment Failed</p>
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
                {isPlacingOrder ? "Processing..." : "Place Order"}
                <ArrowRight className="h-5 w-5" />
              </button>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">Need help with your order?</p>
                <button className="font-semibold text-pink-600">Contact Support</button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-gray-400">
                <Lock className="h-3 w-3" />
                Secure Checkout
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}