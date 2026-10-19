"use client";

import { Suspense } from "react";
import PaymentResult from "@/components/payment/PaymentResult";
import Loader from "@/components/shared/Loader";
import SupportChatDialogLazy from "@/components/support/SupportChatDialogLazy";

/**
 * Where RedUniq sends the customer after a successful payment
 * (`/payment-success?summaryId=…&token=…`, checked 8 Oct 2026). "Success" in
 * the URL proves nothing: `/action` decides (see `PaymentResult`).
 */
export default function PaymentSuccessPage() {
  return (
    <>
      <Suspense fallback={<Loader fullScreen />}>
        <PaymentResult />
      </Suspense>
      {/* Outside the (main) layout, which is where the chat panel normally
          lives — "Contact Support" → Live chat needs it here too. */}
      <SupportChatDialogLazy />
    </>
  );
}
