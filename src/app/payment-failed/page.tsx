"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";

function PaymentFailedContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const summaryId = searchParams.get("summaryId");

  useEffect(() => {
    const handleFailure = async () => {
      if (!summaryId) return;

      try {
        await apiClient.post(
          `/payment/reduniq/handle-payment-failure/${summaryId}`
        );
      } catch (error) {
        console.error("Failed to update payment status", error);
      }
    };

    handleFailure();
  }, [summaryId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4 transition-colors duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 text-center shadow-md border border-neutral-200 dark:border-neutral-800">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-500">
          {t("paymentFailed")}
        </h1>

        <p className="mt-3 text-gray-600 dark:text-neutral-400">
          {t("paymentFailedDesc")}
        </p>

        {summaryId && (
          <p className="mt-2 text-sm text-gray-500 dark:text-neutral-500">
            {t("referenceLabel")}: {summaryId}
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => router.push("/cart")}
            className="flex-1 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 px-6 py-3 text-gray-800 dark:text-neutral-200 font-semibold transition"
          >
            {t("goBack")}
          </button>

          <button
            onClick={() => router.push("/")}
            className="flex-1 rounded-xl bg-pink-600 hover:bg-pink-700 px-6 py-3 text-white font-semibold transition"
          >
            {t("home")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-neutral-950 text-gray-800 dark:text-neutral-200 transition-colors duration-200">
          {t("loadingPaymentDetails")}
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}