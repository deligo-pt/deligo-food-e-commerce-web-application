"use client";

import { useState, useSyncExternalStore } from "react";
import { CreditCard, Smartphone, Grid3X3, Wallet, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { getAccessToken } from "@/lib/authCookies";
import { getApiErrorMessage } from "@/lib/apiClient";
import { useSavedCards, useInvalidateSavedCards } from "@/hooks/queries/usePaymentTokens";
import { disableSavedCard } from "@/services/paymentTokenApi";
import type { SavedCard } from "@/types/payment";
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

export default function PaymentMethodPage() {
  const { t } = useTranslation();
  const [cardToRemove, setCardToRemove] = useState<SavedCard | null>(null);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);

  // Reading the cookie during render would make the server and the first client
  // paint disagree. `mounted` is false on the server and on the first client
  // render, true afterwards — the same guard SearchContent uses.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const authed = mounted && !!getAccessToken();

  // Gated on `authed`: `GET /payment-tokens` answers 401 for a guest, and the
  // response interceptor turns that into a redirect to /login — so an ungated
  // query would throw a visitor off this page for simply opening it.
  const {
    data: savedCards = [],
    isLoading,
    isError,
  } = useSavedCards({ enabled: authed });
  const invalidateSavedCards = useInvalidateSavedCards();

  const confirmRemoveCard = async () => {
    if (!cardToRemove) return;
    const { id } = cardToRemove;
    setCardToRemove(null);

    try {
      setRemovingCardId(id);
      await disableSavedCard(id);
      await invalidateSavedCards();
      toast.success(t("cardRemoved"));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("failedToRemoveCard")));
    } finally {
      setRemovingCardId(null);
    }
  };

  const paymentMethods = [
    {
      id: "card",
      title: t("creditDebitCard"),
      subtitle: t("visaMastercardMaestro"),
      icon: CreditCard,
      recommended: true,
    },
    {
      id: "googlepay",
      title: t("googlePay"),
      subtitle: t("fastSecureCheckout"),
      icon: Smartphone,
    },
    {
      id: "applepay",
      title: t("applePay"),
      subtitle: t("oneTapCheckout"),
      icon: Grid3X3,
    },
    {
      id: "other",
      title: t("otherMethods"),
      subtitle: t("otherMethodsSubtitle"),
      icon: Wallet,
    },
  ];

  return (
    <div className="bg-[#f6f6f6] dark:bg-neutral-950 px-4 py-8 sm:py-12 transition-colors duration-200">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-neutral-800 px-5 py-6 sm:px-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#222] dark:text-neutral-50">
              {t("paymentMethods")}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-neutral-400">
              {t("paymentMethodsDescription")}
            </p>
          </div>

          {/* Saved cards — first, because they are the only thing on this page
              the customer can actually act on. Hidden entirely for guests:
              there is nothing to manage and nothing to invite them to do here,
              since a card can only be saved during a checkout. */}
          {authed && (
            <div className="border-b border-gray-200 dark:border-neutral-800 px-5 py-6 sm:px-8">
              <h2 className="mb-3 text-base font-semibold text-[#222] dark:text-neutral-50">
                {t("savedCards")}
              </h2>

              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1].map((row) => (
                    <div
                      key={row}
                      className="h-[68px] animate-pulse rounded-xl bg-gray-100 dark:bg-neutral-800"
                    />
                  ))}
                </div>
              ) : isError ? (
                <p className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {t("failedToLoadSavedCards")}
                </p>
              ) : savedCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-neutral-700 px-4 py-6 text-center">
                  <CreditCard className="mx-auto h-6 w-6 text-gray-400 dark:text-neutral-500" />
                  <p className="mt-2 text-sm font-medium text-[#222] dark:text-neutral-100">
                    {t("noSavedCards")}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">
                    {t("noSavedCardsHint")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {savedCards.map((card) => {
                    const isRemoving = removingCardId === card.id;
                    return (
                      <li
                        key={card.id}
                        className={`flex items-center gap-3 rounded-xl border border-gray-200 dark:border-neutral-800 px-4 py-3.5 transition ${
                          isRemoving ? "pointer-events-none opacity-60" : ""
                        }`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff0f5] dark:bg-pink-950/20">
                          <CreditCard className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Brand and last digits, both verbatim from the API.
                              No scheme logos: the app doesn't show them, and
                              the web should not be first. `label` still reads
                              "Visa ending in 4242" and is used as-is in the
                              remove dialog, where the card is named in prose. */}
                          <h3 className="truncate text-base font-semibold tracking-wide text-[#222] dark:text-neutral-50">
                            {card.brand} •••• {card.last4}
                          </h3>
                          {/* `isDefault` is deliberately not surfaced. It is
                              read-only (no set-default endpoint) and nothing on
                              the web acts on it — checkout preselects no card —
                              so a badge would label a behaviour that does not
                              exist here. It survives only as the sort order the
                              API returns: default first, then newest. */}
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">
                            {t("expiresOn")} {card.expiryDate}
                          </p>
                        </div>

                        <button
                          type="button"
                          aria-label={t("removeCard")}
                          title={t("removeCard")}
                          onClick={() => setCardToRemove(card)}
                          disabled={isRemoving}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#f9186b] focus-visible:outline-none dark:hover:bg-white/10"
                        >
                          <Trash2 className="h-4 w-4 text-[#f9186b] dark:text-pink-400" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Accepted methods */}
          <div className="px-5 pt-6 sm:px-8">
            <h2 className="text-base font-semibold text-[#222] dark:text-neutral-50">
              {t("acceptedPaymentMethods")}
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-8 sm:pt-4">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              return (
                <li
                  key={method.id}
                  className="flex items-center gap-4 rounded-xl border border-[#e6e6e6] dark:border-neutral-800 bg-white dark:bg-neutral-900/40 px-4 py-4 transition-colors hover:border-[#f9186b]/40 dark:hover:border-[#f9186b]/40"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff0f5] dark:bg-pink-950/20">
                    <Icon className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[#222] dark:text-neutral-50">
                        {method.title}
                      </h3>
                      {method.recommended && (
                        <span className="rounded-full bg-[#f9186b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          {t("recommended")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-neutral-400">
                      {method.subtitle}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Secure note */}
          <div className="border-t border-gray-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-950/50 px-5 py-5 sm:px-8">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>{t("paymentInfoSecure")}</span>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={cardToRemove !== null}
        onOpenChange={(open) => !open && setCardToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeCard")}</AlertDialogTitle>
            <AlertDialogDescription>
              {cardToRemove?.label
                ? `${cardToRemove.label} — ${t("removeCardConfirm")}`
                : t("removeCardConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveCard}>
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
