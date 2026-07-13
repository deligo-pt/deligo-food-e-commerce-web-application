"use client";

import { CreditCard, Smartphone, Grid3X3, Wallet, Lock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function PaymentMethodPage() {
  const { t } = useTranslation();

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
      subtitle: t("paypalGooglePayEtc"),
      icon: Wallet,
    },
  ];

  return (
    <div className="bg-[#f6f6f6] dark:bg-neutral-950 px-4 py-8 sm:py-12 transition-colors duration-200">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-neutral-800 px-5 py-6 sm:px-8">
            <h1 className="text-2xl font-bold text-[#222] dark:text-neutral-50 sm:text-3xl">
              {t("paymentMethods")}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-neutral-400">
              {t("paymentMethodsDescription")}
            </p>
          </div>

          {/* Accepted methods */}
          <ul className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-8">
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
                        <span className="rounded-full bg-[#f9186b] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
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
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 dark:text-neutral-400">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>{t("paymentInfoSecure")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
