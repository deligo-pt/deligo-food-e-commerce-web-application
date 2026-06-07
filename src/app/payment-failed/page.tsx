"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";

function PaymentFailedContent() {
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-md">
        <h1 className="text-2xl font-bold text-red-600">
          Payment Failed
        </h1>

        <p className="mt-3 text-gray-600">
          We could not process your payment. Please try again or use another
          payment method.
        </p>

        {summaryId && (
          <p className="mt-2 text-sm text-gray-500">
            Reference: {summaryId}
          </p>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => router.push("/cart")}
            className="rounded-lg bg-gray-200 px-6 py-2 text-gray-800"
          >
            Go Back
          </button>

          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-pink-600 px-6 py-2 text-white"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading payment details...
        </div>
      }
    >
      <PaymentFailedContent />
    </Suspense>
  );
}