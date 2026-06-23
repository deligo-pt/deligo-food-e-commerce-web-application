"use client";

import { useState } from "react";
import { CreditCard, Smartphone, Grid3X3, Wallet, Lock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function PaymentMethodPage() {
  const { t } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState("card");
  const paymentMethods = [
    {
      id: "card",
      title: t("creditDebitCard"),
      subtitle: t("visaMastercardMaestro"),
      icon: CreditCard,
      recommended: true,
    },
    {
      id: "mbway",
      title: t("mbway"),
      subtitle: t("fastMobilePayment"),
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
    <div className="min-h-screen bg-[#f6f6f6] dark:bg-neutral-950 transition-colors duration-200">
      {/* Content */}
      <div className="mx-auto max-w-7xl">
        <div className="bg-white dark:bg-neutral-900 border-x border-b border-gray-150 dark:border-neutral-800/80 shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-neutral-800 px-4 py-6">
            <h1 className="text-[32px] font-bold text-[#222] dark:text-neutral-50">
              {t("paymentMethods")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
              {t("paymentMethodsDescription")}
            </p>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3 p-4">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;

              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex w-full items-center justify-between rounded-md border px-4 py-3 transition-all ${isSelected
                      ? "border-[#c5005a] dark:border-pink-600 bg-[#fff9fb] dark:bg-pink-950/10"
                      : "border-[#e6e6e6] dark:border-neutral-800 bg-white dark:bg-neutral-900/30 hover:bg-gray-50 dark:hover:bg-neutral-800/20"
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efefef] dark:bg-neutral-950">
                      <Icon
                        className={`h-5 w-5 ${isSelected ? "text-[#c5005a] dark:text-pink-400" : "text-gray-500 dark:text-neutral-400"
                          }`}
                      />
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#222] dark:text-neutral-50">
                          {method.title}
                        </h3>

                        {method.recommended && (
                          <span className="rounded-full bg-[#c5005a] dark:bg-pink-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            {t("recommended")}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 dark:text-neutral-400">{method.subtitle}</p>
                    </div>
                  </div>

                  {/* Radio */}
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? "border-[#c5005a] dark:border-pink-500" : "border-gray-300 dark:border-neutral-700"
                      }`}
                  >
                    {isSelected && (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#c5005a] dark:bg-pink-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Action */}
          <div className="border-t border-gray-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-950 px-4 py-8">
            <button className="w-full rounded-md bg-[#c5005a] dark:bg-pink-650 py-4 text-base font-semibold text-white shadow-md transition hover:opacity-95">
              {t("confirmPaymentMethod")}
            </button>

            <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-gray-500 dark:text-neutral-450">
              <Lock className="h-3 w-3" />
              <span>{t("paymentInfoSecure")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
