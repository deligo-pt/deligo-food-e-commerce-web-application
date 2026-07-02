"use client";

import { Suspense } from "react";
import SuccessContent from "@/components/payment/SuccessContent";
import { useTranslation } from "@/hooks/useTranslation";

export default function PaymentSuccessPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          {t("loadingPaymentDetails")}
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
