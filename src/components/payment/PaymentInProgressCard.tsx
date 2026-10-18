"use client";

import { ArrowRight, Clock, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Takes the place of the payment methods when this checkout already has a
 * payment that isn't settled (8 Oct 2026). See `lib/paymentAction.ts`.
 *
 * - `in-progress`: a RedUniq payment is open. The customer continues it, or
 *   cancels it and starts again. Starting a second one beside it is not
 *   offered: the backend refuses it, and it is how a customer gets charged
 *   twice. Cancelling asks first, because they may already have paid on
 *   RedUniq's page.
 * - `verifying`: the backend answered with a code this app doesn't know, or
 *   couldn't be reached. "Check again" first — the payment may already have
 *   gone through. Once its attempt window has passed (`canCancel`), the same
 *   confirmed "Cancel and start a new payment" is offered too (18 Oct 2026): a
 *   saved-card charge left `PAYMENT_STATUS_UNKNOWN` forever and locked the
 *   customer's cart, while the backend accepts the release and keeps watching
 *   the old payment ("if it completes, your order is created automatically").
 */
type Props = {
  mode: "in-progress" | "verifying";
  /** The checkout total, so the customer recognises the payment. */
  amount?: number;
  onContinue: () => void;
  onCancelAndStartNew: () => Promise<void> | void;
  onCheckAgain: () => void;
  /** `verifying` only: the payment's attempt window has passed, so it may be
   *  released. Never offered while it could still be going through. */
  canCancel?: boolean;
  isContinuing?: boolean;
  isReleasing?: boolean;
  isChecking?: boolean;
};

export default function PaymentInProgressCard({
  mode,
  amount,
  onContinue,
  onCancelAndStartNew,
  onCheckAgain,
  canCancel = false,
  isContinuing = false,
  isReleasing = false,
  isChecking = false,
}: Props) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const verifying = mode === "verifying";

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 dark:border-pink-500/20 dark:bg-pink-950/10 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff0f5] ring-8 ring-primary/5 dark:bg-pink-950/30">
          {verifying ? (
            <ShieldCheck className="h-6 w-6 text-primary dark:text-pink-400" />
          ) : (
            <Clock className="h-6 w-6 text-primary dark:text-pink-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-gray-900 dark:text-neutral-50">
            {verifying ? t("paymentVerifyingTitle") : t("paymentInProgressTitle")}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
            {verifying ? t("paymentVerifyingBody") : t("paymentInProgressBody")}
          </p>
          {amount !== undefined && (
            <p className="mt-3 text-sm text-gray-500 dark:text-neutral-400">
              {t("paymentInProgressAmount")}{" "}
              <span className="font-bold text-gray-900 dark:text-neutral-50">€{amount.toFixed(2)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {verifying ? (
          <>
            <Button size="lg" onClick={onCheckAgain} disabled={isChecking || isReleasing} className="w-full gap-2 font-semibold">
              {isChecking ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              {t("checkAgain")}
            </Button>
            {canCancel && (
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(true)}
                disabled={isChecking || isReleasing}
                className="w-full font-semibold text-gray-600 hover:text-primary dark:text-neutral-400 dark:hover:text-pink-400"
              >
                {isReleasing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("cancelAndStartNew")}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              size="lg"
              onClick={onContinue}
              disabled={isContinuing || isReleasing}
              className="cart-cta relative w-full gap-2 overflow-hidden font-semibold"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isContinuing ? t("openingSecurePayment") : t("continuePayment")}
                {isContinuing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={isContinuing || isReleasing}
              className="w-full font-semibold text-gray-600 hover:text-primary dark:text-neutral-400 dark:hover:text-pink-400"
            >
              {isReleasing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("cancelAndStartNew")}
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmCancelPaymentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {verifying ? t("confirmCancelUnknownPaymentBody") : t("confirmCancelPaymentBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepPayment")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void onCancelAndStartNew();
              }}
            >
              {t("cancelPayment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
