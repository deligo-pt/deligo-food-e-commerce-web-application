"use client";

import { Suspense } from "react";
import PaymentResult from "@/components/payment/PaymentResult";
import Loader from "@/components/shared/Loader";

/**
 * Where RedUniq sends the customer after a successful payment
 * (`/payment-success?summaryId=…&token=…`, checked 8 Oct 2026). "Success" in
 * the URL proves nothing: `/action` decides (see `PaymentResult`).
 */
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<Loader fullScreen />}>
      <PaymentResult />
    </Suspense>
  );
}
