"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Headphones,
  Loader2,
  PackageSearch,
  RefreshCw,
  SearchX,
  ShoppingCart,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/apiClient";
import { DELIVERY_NOTES_KEY } from "@/lib/deliveryNotes";
import {
  orderTrackingPath,
  PAYMENT_METHODS_ANCHOR,
  paymentPagePath,
  type PaymentActionResult,
} from "@/lib/paymentAction";
import { useInvalidateSavedCards } from "@/hooks/queries/usePaymentTokens";
import { useTranslation } from "@/hooks/useTranslation";
import { callPaymentAction, clearPendingOrder, readPendingOrder } from "@/services/paymentActionApi";
import ContactSupportDialog from "@/components/support/ContactSupportDialog";
import PaymentStateCard from "./PaymentStateCard";

/**
 * Where RedUniq sends the customer back (8 Oct 2026): `/payment-success`,
 * `/payment-failed` and `/cart/checkout/<vendorId>/payment/return` all render
 * this.
 *
 * The URL proves nothing — `data.code` from `/action` decides (see
 * `lib/paymentAction.ts`). The order already exists by the time the customer
 * is back (`PAYMENT_COMPLETED` was there at +0 ms in testing); this page only
 * reports it. `/orders/create-order` is no longer called.
 *
 * Safe to refresh and to reach with Back: `/action` without options only
 * reads, and a repeat answers the same.
 */

/** Re-checks while the result is unknown: 2 s, 4 s, 8 s, 15 s. */
const RECHECK_DELAYS_MS = [2000, 4000, 8000, 15000];
/**
 * How long "Order placed" shows before tracking opens — long enough for its
 * animation to play through (26 Oct 2026; was 1.5 s with a still tick).
 */
const CONFIRMED_PAUSE_MS = 2800;

type View =
  | { kind: "checking"; attempt: number }
  | { kind: "result"; result: PaymentActionResult }
  /** Re-checks ran out with no answer we know. */
  | { kind: "stuck"; result: PaymentActionResult }
  /** No checkout id in the URL or storage. */
  | { kind: "missing" };

export default function PaymentResult({ routeVendorId }: { routeVendorId?: string }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  // RedUniq's return URL carries `summaryId` (checked); storage is the fallback.
  const [pending] = useState(() => readPendingOrder());
  const summaryId =
    searchParams.get("summaryId") || searchParams.get("checkoutSummaryId") || pending?.checkoutSummaryId || null;
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <PaymentResultCard
        routeVendorId={routeVendorId}
        summaryId={summaryId}
        pending={pending}
        onContactSupport={() => setSupportOpen(true)}
      />
      {/* "Contact Support": chat (with this payment's reference typed in),
          email or phone. */}
      <ContactSupportDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        category="PAYMENT"
        topic={t("supportPaymentPrefill")}
        reference={summaryId}
      />
    </>
  );
}

function PaymentResultCard({
  routeVendorId,
  summaryId,
  pending,
  onContactSupport,
}: {
  routeVendorId?: string;
  summaryId: string | null;
  pending: ReturnType<typeof readPendingOrder>;
  onContactSupport: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const invalidateSavedCards = useInvalidateSavedCards();

  const [view, setView] = useState<View>(() => (summaryId ? { kind: "checking", attempt: 0 } : { kind: "missing" }));
  const [vendorId, setVendorId] = useState<string | null>(
    routeVendorId || (pending?.checkoutSummaryId === summaryId ? pending?.vendorId : null) || null,
  );
  const [isContinuing, setIsContinuing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  /** Each fresh check starts a new run; an older run's answer is ignored. */
  const run = useRef(0);

  // Set on every mount, not only declared once: Strict Mode and Fast Refresh
  // remount the page, and a flag left `true` would leave it on "Checking…".
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // The way back to this checkout's payment page needs the store; the summary
  // has it when nothing else did.
  useEffect(() => {
    if (vendorId || !summaryId) return;
    apiClient
      .get(`/checkout/summary/${encodeURIComponent(summaryId)}`)
      .then((res) => {
        const ref = res.data?.data?.vendorId;
        const id = typeof ref === "string" ? ref : (ref?._id ?? ref?.id ?? null);
        if (!unmounted.current && id) setVendorId(id);
      })
      .catch(() => {});
  }, [summaryId, vendorId]);

  /** Waits, unless the page goes away first (the timer is cleared on unmount). */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timer.current = setTimeout(resolve, ms);
    });

  /**
   * Asks `/action` and shows the answer. While the answer is unknown it asks
   * again after 2, 4, 8 and 15 s — never offering success or a new payment —
   * then shows "still confirming". A newer check supersedes an older one.
   */
  const check = useCallback(
    async () => {
      if (!summaryId) return;
      run.current += 1;
      const myRun = run.current;
      if (timer.current) clearTimeout(timer.current);
      const stale = () => unmounted.current || myRun !== run.current;

      // The view is already "checking" here: it starts that way, and every
      // "Check again" sets it before calling (see `recheck`).
      for (let attempt = 0; ; attempt++) {
        const result = await callPaymentAction(summaryId);
        if (stale()) return;

        if (result.state === "ORDER_PLACED") {
          clearPendingOrder();
          try {
            sessionStorage.removeItem(DELIVERY_NOTES_KEY);
          } catch {
            // Storage blocked: nothing to clear.
          }
          // "Save this card" happens with the payment; the cached list is stale.
          invalidateSavedCards();
          setView({ kind: "result", result });
          await wait(CONFIRMED_PAUSE_MS);
          if (!stale()) router.replace(orderTrackingPath(result));
          return;
        }

        if (result.state === "VERIFYING" || result.state === "UNREACHABLE") {
          if (attempt < RECHECK_DELAYS_MS.length) {
            setView({ kind: "checking", attempt: attempt + 1 });
            await wait(RECHECK_DELAYS_MS[attempt]);
            if (stale()) return;
            continue;
          }
          setView({ kind: "stuck", result });
          return;
        }

        if (result.state === "ABANDONED" || result.state === "NOT_STARTED") clearPendingOrder();
        setView({ kind: "result", result });
        return;
      }
    },
    [summaryId, invalidateSavedCards, router],
  );

  /** A fresh check the customer asked for. */
  const recheck = () => {
    setView({ kind: "checking", attempt: 0 });
    void check();
  };

  useEffect(() => {
    // Every state change in `check` happens after `/action` answers, not
    // synchronously in this effect; the rule can't see past the `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
    // Once per checkout; `check` keeps asking while the answer is unknown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryId]);

  const paymentPage = summaryId ? paymentPagePath(summaryId, vendorId) : null;
  const goToPaymentPage = () => router.push(paymentPage ?? "/cart");
  /** The payment page, scrolled to the methods (see `PAYMENT_METHODS_ANCHOR`). */
  const goToPaymentMethods = () =>
    router.push(paymentPage ? `${paymentPage}#${PAYMENT_METHODS_ANCHOR}` : "/cart");
  const contactSupport: { label: string; onClick: () => void; icon: typeof Headphones } = {
    label: t("contactSupport"),
    onClick: onContactSupport,
    icon: Headphones,
  };
  const myOrders = { label: t("myOrders"), onClick: () => router.push("/orders"), icon: PackageSearch };
  const reference = { reference: summaryId, referenceLabel: t("referenceLabel") };

  /** Back to the RedUniq page of the payment that is still open. */
  const continuePayment = async () => {
    if (!summaryId) return;
    setIsContinuing(true);
    const result = await callPaymentAction(summaryId);
    if (result.state === "IN_PROGRESS" && result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
    setIsContinuing(false);
    recheck();
  };

  if (view.kind === "missing") {
    return (
      <PaymentStateCard
        tone="neutral"
        icon={SearchX}
        title={t("paymentNotFoundTitle")}
        body={t("paymentNotFoundBody")}
        primary={{ ...myOrders, icon: ArrowRight }}
        secondary={[{ label: t("backToCart"), onClick: () => router.push("/cart"), icon: ShoppingCart }]}
      />
    );
  }

  if (view.kind === "checking") {
    const steps = [t("checkingStepReturned"), t("checkingStepConfirming"), t("checkingStepOrder")];
    return (
      <PaymentStateCard
        tone="pending"
        icon={Loader2}
        iconSpinning
        title={t("checkingPayment")}
        body={view.attempt > 0 ? t("stillConfirmingShort") : undefined}
        {...reference}
      >
        <ol className="space-y-2 text-left">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm">
              {i === 0 ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              ) : i === 1 ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary dark:text-pink-400" />
              ) : (
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-200 dark:border-neutral-700" />
              )}
              <span className={i === 2 ? "text-gray-400 dark:text-neutral-500" : "text-gray-700 dark:text-neutral-300"}>
                {step}
              </span>
            </li>
          ))}
        </ol>
      </PaymentStateCard>
    );
  }

  if (view.kind === "stuck") {
    const unreachable = view.result.state === "UNREACHABLE";
    return (
      <PaymentStateCard
        tone="pending"
        icon={unreachable ? WifiOff : Clock}
        title={unreachable ? t("paymentUnreachableTitle") : t("stillConfirmingTitle")}
        body={unreachable ? t("paymentUnreachableBody") : t("stillConfirming")}
        primary={{ label: t("checkAgain"), onClick: recheck, icon: RefreshCw }}
        secondary={[myOrders, contactSupport]}
        {...reference}
      />
    );
  }

  const { result } = view;
  switch (result.state) {
    case "ORDER_PLACED":
      return (
        <PaymentStateCard
          tone="success"
          icon={CheckCircle2}
          animation="order-placed"
          title={t("orderPlacedTitle")}
          body={t("orderPlacedBody")}
          {...reference}
        >
          {result.displayOrderId ? (
            <p className="text-sm font-semibold text-gray-900 dark:text-neutral-50">{result.displayOrderId}</p>
          ) : null}
        </PaymentStateCard>
      );
    case "IN_PROGRESS":
      // Came back without finishing (e.g. "Cancel payment" on RedUniq's page —
      // the payment stays open). Continue it, or go back to the payment page,
      // where cancelling it on purpose lives.
      return (
        <PaymentStateCard
          tone="pending"
          icon={Clock}
          title={t("paymentNotFinishedTitle")}
          body={t("paymentNotFinishedBody")}
          primary={{
            label: isContinuing ? t("openingSecurePayment") : t("continuePayment"),
            onClick: () => void continuePayment(),
            icon: isContinuing ? Loader2 : ArrowRight,
            disabled: isContinuing,
          }}
          secondary={[{ label: t("chooseAnotherWayToPay"), onClick: goToPaymentMethods, icon: CreditCard }, contactSupport]}
          {...reference}
        />
      );
    case "FAILED":
      return (
        <PaymentStateCard
          tone="error"
          icon={XCircle}
          title={t("paymentFailedTitle")}
          body={t("paymentFailedBody")}
          primary={{ label: t("tryAgain"), onClick: goToPaymentPage, icon: RefreshCw }}
          secondary={[{ label: t("chooseAnotherWayToPay"), onClick: goToPaymentMethods, icon: CreditCard }, contactSupport]}
          {...reference}
        />
      );
    default:
      // ABANDONED, NOT_STARTED: nothing was taken, the basket is waiting.
      return (
        <PaymentStateCard
          tone="neutral"
          icon={ShoppingCart}
          title={t("paymentCancelledTitle")}
          body={t("paymentCancelledBody")}
          primary={{ label: t("payNow"), onClick: goToPaymentPage, icon: ArrowRight }}
          secondary={[{ label: t("backToCart"), onClick: () => router.push("/cart"), icon: ShoppingCart }]}
          {...reference}
        />
      );
  }
}
