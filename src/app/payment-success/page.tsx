import { Suspense } from "react";
import SuccessContent from "@/components/payment/SuccessContent";

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading payment details...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}