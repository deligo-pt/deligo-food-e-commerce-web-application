"use client";

interface CartSummaryProps {
  originalPrice?: number;
  discount?: number;
  taxableAmount?: number;
  tax?: number;
  total?: number;
}

export default function CartSummary({
  originalPrice = 0,
  discount = 0,
  taxableAmount = 0,
  tax = 0,
  total = 0,
}: CartSummaryProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 p-6">
        <h3 className="text-2xl font-bold text-gray-900">
          Order Summary
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Price details of your cart
        </p>
      </div>

      {/* Body */}
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            Original Price
          </span>

          <span className="font-medium text-gray-900">
            €{originalPrice.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            Product Discount
          </span>

          <span className="font-medium text-green-600">
            -€{discount.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            Taxable Amount
          </span>

          <span className="font-medium text-gray-900">
            €{taxableAmount.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-600">
            Tax
          </span>

          <span className="font-medium text-gray-900">
            €{tax.toFixed(2)}
          </span>
        </div>

        <div className="border-t border-dashed border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-gray-900">
              Grand Total
            </span>

            <span className="text-3xl font-extrabold text-pink-600">
              €{total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-6">
        <button className="w-full rounded-2xl bg-pink-600 py-4 text-lg font-semibold text-white transition-all hover:bg-pink-700">
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}