"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { useInvalidateSavedCards } from "@/hooks/queries/usePaymentTokens";
import Loader from "@/components/shared/Loader";
import { openSupportChat } from "@/stores/supportChatStore";
import { Button } from "@/components/ui/button";

export default function PaymentReturnPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateSavedCards = useInvalidateSavedCards();
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
          // This call is where a "save this card" request actually becomes a
          // saved card, so the cached list is now potentially wrong. Marking it
          // stale costs nothing here — there's no observer on this page, so it
          // just means the next visit to /payment-methods re-reads instead of
          // serving a minute-old empty list.
          invalidateSavedCards();
          setStatus("success");
          // Redirect to the order detail / tracking page. The route is
          // /orders/track-order/[orderId] — a bare /orders/[orderId] has no
          // page and would 404.
          router.replace(
            `/orders/track-order/${response.data.data.orderId}`,
          );
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
  }, [router, searchParams, t, invalidateSavedCards]);

  if (status === "loading") {
    return <Loader fullScreen label={t("finalizingYourOrder")} />;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center max-w-md">
          <h2 className="text-xl font-bold text-red-600">{t("paymentFailed")}</h2>
          <p className="mt-2 text-gray-700">{error}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => router.push("/cart")}>
              {t("returnToCart")}
            </Button>
            {/* Was `router.push("/contact")` — a route that does not exist
                (`Project_Reference.md` §4.9). The button says Contact Support,
                so it now does that: the chat opens over this page, filed under
                PAYMENT, without navigating away from a payment that has just
                failed. The customer is necessarily signed in to have got here. */}
            <Button
              onClick={() => openSupportChat({ category: "PAYMENT" })}
              className="cursor-pointer"
            >
              {t("contactSupport")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // status === "success" – the redirect will happen, but show a loader briefly
  return <Loader fullScreen label={t("orderConfirmedRedirecting")} />;
}