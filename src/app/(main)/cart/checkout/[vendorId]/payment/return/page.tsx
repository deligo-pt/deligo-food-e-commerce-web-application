"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

export default function PaymentReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const finalizeOrder = async () => {
      // 1. Extract from query parameters (if the gateway sends them)
      let summaryId = searchParams.get("summaryId") || searchParams.get("checkoutSummaryId");
      let token = searchParams.get("token") || searchParams.get("paymentToken");
      let deliveryNotes = searchParams.get("deliveryNotes") || "";

      // 2. Fallback to sessionStorage (for the redirect we initiated)
      if (!summaryId || !token) {
        const pending = sessionStorage.getItem("pendingOrder");
        if (pending) {
          const parsed = JSON.parse(pending);
          summaryId = summaryId || parsed.checkoutSummaryId;
          token = token || parsed.paymentToken;
          deliveryNotes = deliveryNotes || parsed.deliveryNotes;
        }
      }

      if (!summaryId || !token) {
        setError("Missing payment information. Please contact support.");
        setStatus("error");
        return;
      }

      try {
        const response = await apiClient.post("/orders/create-order", {
          checkoutSummaryId: summaryId,
          paymentToken: token,
          deliveryNotes: deliveryNotes || "",
        });

        if (response.data.success) {
          // Clear temporary storage
          sessionStorage.removeItem("pendingOrder");
          sessionStorage.removeItem("deliveryNotes");
          setStatus("success");
          // Redirect to order detail page (adjust route as needed)
          router.replace(`/orders/${response.data.data.orderId}`);
        } else {
          throw new Error(response.data.message || "Order creation failed");
        }
      } catch (err) {
        const errorMsg = getApiErrorMessage(err, "Failed to create your order");
        setError(errorMsg);
        setStatus("error");
      }
    };

    finalizeOrder();
  }, [router, searchParams]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-gray-600">Finalizing your order...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center max-w-md">
          <h2 className="text-xl font-bold text-red-600">Payment Failed</h2>
          <p className="mt-2 text-gray-700">{error}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              onClick={() => router.push("/cart")}
              className="rounded-lg bg-gray-600 px-4 py-2 text-white"
            >
              Return to Cart
            </button>
            <button
              onClick={() => router.push("/contact")}
              className="rounded-lg bg-pink-600 px-4 py-2 text-white"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // status === "success" – the redirect will happen, but show a loader briefly
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent mx-auto" />
        <p className="mt-4 text-gray-600">Order confirmed! Redirecting...</p>
      </div>
    </div>
  );
}