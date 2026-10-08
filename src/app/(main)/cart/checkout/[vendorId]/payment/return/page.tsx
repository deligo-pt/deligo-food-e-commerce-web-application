"use client";

import { Suspense, use } from "react";
import PaymentResult from "@/components/payment/PaymentResult";
import Loader from "@/components/shared/Loader";

/**
 * RedUniq's return to a checkout's payment flow. The result is read from
 * `/action` (see `components/payment/PaymentResult.tsx`); this page no longer
 * creates the order — the backend does, once the payment is confirmed.
 */
export default function PaymentReturnPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = use(params);
  return (
    <Suspense fallback={<Loader fullScreen />}>
      <PaymentResult routeVendorId={vendorId} />
    </Suspense>
  );
}
