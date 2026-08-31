"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

interface CartSummaryProps {
  originalPrice?: number;
  discount?: number;
  vatableAmount?: number;
  vat?: number;
  total?: number;
}

export default function CartSummary({
  originalPrice = 0,
  discount = 0,
  vatableAmount = 0,
  vat = 0,
  total = 0,
}: CartSummaryProps) {
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 p-6">
        <h3 className="text-2xl font-bold text-gray-900">
          {t("orderSummary")}
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          {t("priceDetailsOfCart")}
        </p>
      </div>

      {/* Body */}
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            {t("originalPrice")}
          </span>

          <span className="font-medium text-gray-900">
            €{originalPrice.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            {t("productDiscount")}
          </span>

          <span className="font-medium text-green-600">
            -€{discount.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            {t("subtotalExclServiceFee")}
          </span>

          <span className="font-medium text-gray-900">
            €{vatableAmount.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            {t("serviceCharge")}
          </span>

          <span className="font-medium text-gray-900">
            €{vat.toFixed(2)}
          </span>
        </div>

        <div className="border-t border-dashed border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-gray-900">
              {t("grandTotal")}
            </span>

            <span className="text-2xl font-extrabold text-primary">
              €{total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-6">
        <Button
          size="lg"
          className="cart-cta relative w-full overflow-hidden rounded-2xl font-semibold"
        >
          <span className="cart-cta-shine" aria-hidden="true" />
          <span className="relative z-10">{t("proceedToCheckout")}</span>
        </Button>
      </div>
    </div>
  );
}