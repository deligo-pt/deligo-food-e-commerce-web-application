"use client";

import { CheckCircle, Clock3, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface OrderCardProps {
  restaurant: string;
  orderId: string;
  date: string;
  price: string;
  status: "accepted" | "pending";
  items: string;
  progress: number;
  progressText: string;
  image?: string;
}

export default function OrderCard({
  restaurant,
  orderId,
  date,
  price,
  status,
  items,
  progress,
  progressText,
  image,
}: OrderCardProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-full border">
            <Image
              src={image || "/placeholder.png"}
              alt={restaurant}
              className="h-full w-full object-cover"
              width={80}
              height={80}
            />
          </div>

          <div>
            <h3 className="font-semibold text-[#191c1d]">{restaurant}</h3>

            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#5a4044]">
              <span>Order #{orderId}</span>
              <span>•</span>
              <span>{date}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="font-semibold text-[#b0004a]">{price}</span>

          {status === "accepted" ? (
            <div className="flex items-center gap-1 rounded-full bg-pink-50 px-2 py-1 text-xs text-[#b0004a]">
              <CheckCircle size={12} />
              Accepted
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              <Clock3 size={12} />
              Pending
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 rounded-lg bg-[#f3f4f5] px-3 py-3">
        <div className="flex items-center gap-2">
          <UtensilsCrossed size={15} className="text-[#b0004a]" />
          <p className="text-sm text-[#191c1d]">{items}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-2 text-xs">
          <span
            className={
              status === "accepted"
                ? "font-medium text-[#b0004a]"
                : "text-[#5a4044]"
            }
          >
            {progressText}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-[#b0004a]"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5">
        <Link
          href={`/orders/track-order/${orderId}`}
          className="block w-full rounded-lg bg-[#b0004a] py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
        >
          Track Order
        </Link>
      </div>
    </div>
  );
}