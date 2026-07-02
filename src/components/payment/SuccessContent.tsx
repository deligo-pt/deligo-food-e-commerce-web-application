"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";

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
        await apiClient.post("/orders/create-order", {
          checkoutSummaryId: summaryId,
          paymentToken: token || undefined,
        });

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
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 text-center shadow-md border border-neutral-200 dark:border-neutral-800">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-500">
            {t("orderCreationFailed")}
          </h1>

          <p className="mt-3 text-gray-600 dark:text-neutral-400">{error}</p>

          <button
            onClick={() => router.replace("/payment-failed")}
            className="mt-6 w-full rounded-xl bg-pink-600 hover:bg-pink-700 px-6 py-3 text-white font-semibold transition"
          >
            {t("continueButton")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950 transition-colors duration-200">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />

        <h2 className="mt-4 text-lg font-semibold text-gray-800 dark:text-neutral-200">
          {t("paymentSuccessful")}
        </h2>

        <p className="mt-2 text-gray-600 dark:text-neutral-400">
          {t("creatingYourOrder")}
        </p>
      </div>
    </div>
  );
}