"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

export default function SuccessContent() {
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
        setError("Missing payment summary.");
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
        setError(getApiErrorMessage(err, "Failed to create order."));
      }
    };

    createOrder();
  }, [summaryId, token, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-md">
          <h1 className="text-2xl font-bold text-red-600">
            Order Creation Failed
          </h1>

          <p className="mt-3 text-gray-600">{error}</p>

          <button
            onClick={() => router.replace("/payment-failed")}
            className="mt-6 rounded-lg bg-pink-600 px-6 py-2 text-white"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />

        <h2 className="mt-4 text-lg font-semibold text-gray-800">
          Payment Successful
        </h2>

        <p className="mt-2 text-gray-600">
          Creating your order...
        </p>
      </div>
    </div>
  );
}