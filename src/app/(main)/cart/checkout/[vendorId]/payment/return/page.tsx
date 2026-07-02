"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";

export default function PaymentReturnPage() {
  const { t } = useTranslation();
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
        setError(t("missingPaymentInfo"));
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
  }, [router, searchParams, t]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-gray-600">{t("finalizingYourOrder")}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center max-w-md">
          <h2 className="text-xl font-bold text-red-600">{t("paymentFailed")}</h2>
          <p className="mt-2 text-gray-700">{error}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              onClick={() => router.push("/cart")}
              className="rounded-lg bg-gray-600 px-4 py-2 text-white"
            >
              {t("returnToCart")}
            </button>
            <button
              onClick={() => router.push("/contact")}
              className="rounded-lg bg-pink-600 px-4 py-2 text-white"
            >
              {t("contactSupport")}
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
        <p className="mt-4 text-gray-600">{t("orderConfirmedRedirecting")}</p>
      </div>
    </div>
  );
}