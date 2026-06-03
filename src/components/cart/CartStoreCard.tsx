"use client";

import Image from "next/image";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";

interface CartStoreCardProps {
  storeName: string;
  itemCount: number;
  total: number;

  items: {
    productId: string;
    name: string;
    image: string;
    quantity: number;
    grandTotal: number;
  }[];
}

export default function CartStoreCard({
  storeName,
  itemCount,
  total,
  items,
}: CartStoreCardProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {storeName}
            </h3>

            <div className="mt-2 flex items-center gap-2 text-gray-500">
              <ShoppingBag size={16} />
              <span>{itemCount} items in cart</span>
            </div>
          </div>

          <button className="text-gray-400 transition hover:text-red-500">
            <Trash2 size={20} />
          </button>
        </div>

        {/* Products */}
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 p-4 transition hover:bg-gray-50"
            >
              {/* Product Image */}
              <div className="relative h-20 w-20 overflow-hidden rounded-xl">
                <Image
                  fill
                  src={item.image}
                  alt={item.name}
                  className="object-cover"
                />
              </div>

              {/* Product Info */}
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">
                  {item.name}
                </h4>

                <p className="mt-1 text-sm text-gray-500">
                  Quantity: {item.quantity}
                </p>
              </div>

              {/* Price */}
              <div className="text-right">
                <p className="font-bold text-pink-600">
                  €{item.grandTotal.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button className="flex items-center gap-3 rounded-xl bg-pink-600 px-6 py-3 font-semibold text-white transition hover:bg-pink-700">
            Checkout

            <div className="h-5 w-px bg-white/30" />

            €{total.toFixed(2)}

            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}