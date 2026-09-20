"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import Loader from "@/components/shared/Loader";
import { Button } from "@/components/ui/button";
import { DELIVERY_NOTES_KEY } from "@/lib/deliveryNotes";

/** The note the payment page stored beside the pending order, if any. */
function readPendingDeliveryNotes(): string {
  try {
    const pending = sessionStorage.getItem("pendingOrder");
    if (!pending) return "";
    const parsed: unknown = JSON.parse(pending);
    const notes =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { deliveryNotes?: unknown }).deliveryNotes
        : undefined;
    return typeof notes === "string" ? notes : "";
  } catch {
    // A half-written entry must not stop an order that is already paid for.
    return "";
  }
}

export default function SuccessContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const summaryId = searchParams.get("summaryId");
  const token = searchParams.get("token");

  const hasCreatedOrder = useRef(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createOrder = async () => {
      if (hasCreatedOrder.current) return;

      if (!summaryId) {
        setError(t("missingPaymentSummary"));
        return;
      }

      hasCreatedOrder.current = true;

      try {
        // The rider instructions the customer typed before paying. This route
        // creates the order without ever having seen them, so they come back
        // out of the same sessionStorage the redirect flow uses — without
        // this, an order finalized here arrives with an empty note and nobody
        // can tell it was ever written.
        const notes =
          readPendingDeliveryNotes() ||
          sessionStorage.getItem(DELIVERY_NOTES_KEY) ||
          "";

        await apiClient.post("/orders/create-order", {
          checkoutSummaryId: summaryId,
          paymentToken: token || undefined,
          deliveryNotes: notes,
        });

        sessionStorage.removeItem(DELIVERY_NOTES_KEY);

        router.replace("/orders");
      } catch (err) {
        setError(getApiErrorMessage(err, t("failedToCreateOrder")));
      }
    };

    createOrder();
  }, [summaryId, token, router, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4 transition-colors duration-200">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-md border border-border">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-500">
            {t("orderCreationFailed")}
          </h1>

          <p className="mt-3 text-gray-600 dark:text-neutral-400">{error}</p>

          <Button
            size="lg"
            onClick={() => router.replace("/payment-failed")}
            className="mt-6 w-full rounded-xl font-semibold"
          >
            {t("continueButton")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950 transition-colors duration-200">
      <div className="text-center">
        <Loader label={null} className="mx-auto" />

        <h2 className="mt-4 text-xl font-semibold text-gray-800 dark:text-neutral-200">
          {t("paymentSuccessful")}
        </h2>

        <p className="mt-2 text-gray-600 dark:text-neutral-400">
          {t("creatingYourOrder")}
        </p>
      </div>
    </div>
  );
}