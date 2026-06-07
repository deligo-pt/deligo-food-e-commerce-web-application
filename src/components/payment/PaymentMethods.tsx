"use client";

import { useState } from "react";
import { CreditCard, Smartphone, Grid3X3, Wallet, Lock } from "lucide-react";

const paymentMethods = [
  {
    id: "card",
    title: "Credit/Debit Card",
    subtitle: "Visa, Mastercard, Maestro",
    icon: CreditCard,
    recommended: true,
  },
  {
    id: "mbway",
    title: "MB WAY",
    subtitle: "Fast mobile payment",
    icon: Smartphone,
  },
  {
    id: "applepay",
    title: "Apple Pay",
    subtitle: "One-tap checkout",
    icon: Grid3X3,
  },
  {
    id: "other",
    title: "Other Methods",
    subtitle: "PayPal, Google Pay, etc.",
    icon: Wallet,
  },
];

export default function PaymentMethodPage() {
  const [selectedMethod, setSelectedMethod] = useState("card");

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      {/* Content */}
      <div className="mx-auto max-w-7xl">
        <div className="bg-white">
          {/* Header */}
          <div className="border-b border-gray-200 px-4 py-6">
            <h1 className="text-[32px] font-bold text-[#222]">
              Payment Methods
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Choose your preferred way to pay for your delicious meal.
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
                  className={`flex w-full items-center justify-between rounded-md border px-4 py-3 transition-all ${
                    isSelected
                      ? "border-[#c5005a] bg-[#fff9fb]"
                      : "border-[#e6e6e6] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#efefef]">
                      <Icon
                        className={`h-5 w-5 ${
                          isSelected ? "text-[#c5005a]" : "text-gray-500"
                        }`}
                      />
                    </div>

                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-[#222]">
                          {method.title}
                        </h3>

                        {method.recommended && (
                          <span className="rounded-full bg-[#c5005a] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Recommended
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500">{method.subtitle}</p>
                    </div>
                  </div>

                  {/* Radio */}
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      isSelected ? "border-[#c5005a]" : "border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#c5005a]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Action */}
          <div className="border-t border-gray-200 bg-[#fafafa] px-4 py-8">
            <button className="w-full rounded-md bg-[#c5005a] py-4 text-base font-semibold text-white shadow-md transition hover:opacity-95">
              Confirm Payment Method
            </button>

            <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-gray-500">
              <Lock className="h-3 w-3" />
              <span>Your payment information is encrypted and secure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
