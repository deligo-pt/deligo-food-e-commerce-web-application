"use client";

import Image from "next/image";
import Link from "next/link";
import {
  MoreVertical,
  Star,
  UtensilsCrossed,
} from "lucide-react";

interface CartStoreCardProps {
  vendorId: string;
  businessName: string;
  image: string;
  rating: number;
  itemCount: number;
  total: number;
}

export default function CartStoreCard({
  vendorId,
  businessName,
  image,
  rating,
  itemCount,
  total,
}: CartStoreCardProps) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-pink-100">
            <Image
              src={image}
              alt={businessName}
              fill
              className="object-cover"
            />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {businessName}
            </h3>

            <div className="mt-3 flex gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-yellow-50 px-3 py-2">
                <Star
                  size={16}
                  className="fill-yellow-500 text-yellow-500"
                />

                <span className="font-semibold text-yellow-700">
                  {rating > 0
                    ? rating.toFixed(1)
                    : "New"}
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-pink-50 px-3 py-2">
                <UtensilsCrossed
                  size={16}
                  className="text-pink-600"
                />

                <span className="font-semibold text-pink-600">
                  {itemCount} Items
                </span>
              </div>
            </div>
          </div>
        </div>

        <button>
          <MoreVertical className="text-gray-400" />
        </button>
      </div>

      <Link
        href={`/cart/checkout/${vendorId}`}
        className="flex items-center justify-between rounded-3xl bg-linear-to-r from-pink-500 to-pink-700 px-6 py-5 text-white"
      >
        <span className="text-xl font-bold">
          Go to Checkout
        </span>

        <div className="rounded-xl bg-white/20 px-4 py-2 font-bold">
          €{total.toFixed(2)}
        </div>
      </Link>
    </div>
  );
}