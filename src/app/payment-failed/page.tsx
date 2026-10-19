"use client";

import { Suspense } from "react";
import PaymentResult from "@/components/payment/PaymentResult";
import Loader from "@/components/shared/Loader";
import SupportChatDialogLazy from "@/components/support/SupportChatDialogLazy";

/**
 * Where RedUniq sends the customer after a declined or cancelled payment
 * (`/payment-failed?summaryId=…&token=…`, checked 8 Oct 2026).
 *
 * "Failed" in the URL proves nothing either: `/action` decides (see
 * `PaymentResult`). If the payment actually went through, or is still open,
 * that is what the customer sees. The retired `handle-payment-failure` (404
 * since 8 Oct 2026) is no longer called — it could only ever have reset a
 * payment the backend still considered open.
 */
export default function PaymentFailedPage() {
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
