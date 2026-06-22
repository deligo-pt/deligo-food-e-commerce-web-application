"use client";

import { CheckCircle, Clock3, UtensilsCrossed, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

interface OrderCardProps {
  dbId: string;
  restaurant: string;
  orderId: string;
  date: string;
  price: string;
  status: "accepted" | "pending" | "delivered" | "cancelled";
  items: string;
  progress: number;
  progressText: string;
  image?: string;
  isRated?: boolean;
  onRateOrder?: (dbId: string) => void;
}

export default function OrderCard({
  dbId,
  restaurant,
  orderId,
  date,
  price,
  status,
  items,
  progress,
  progressText,
  image,
  isRated = false,
  onRateOrder,
}: OrderCardProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-colors duration-200">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-gray-100 dark:border-neutral-800">
            <Image
              src={image || "/placeholder.png"}
              alt={restaurant}
              className="h-full w-full object-cover"
              width={80}
              height={80}
            />
          </div>

          <div>
            <h3 className="font-semibold text-[#191c1d] dark:text-neutral-50">{restaurant}</h3>

            <div className="mt-1 flex items-center gap-2 text-[11px] text-[#5a4044] dark:text-neutral-400">
              <span>
                {t("order")} #{orderId}
              </span>
              <span>•</span>
              <span>{date}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="font-semibold text-[#b0004a] dark:text-pink-400">{price}</span>

          {status === "accepted" ? (
            <div className="flex items-center gap-1 rounded-full bg-pink-50 dark:bg-pink-950/30 px-2 py-1 text-xs text-[#b0004a] dark:text-pink-400">
              <CheckCircle size={12} />
              {t("accepted")}
            </div>
          ) : status === "delivered" ? (
            <div className="flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-950/20 px-2 py-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle size={12} />
              {t("delivered")}
            </div>
          ) : status === "cancelled" ? (
            <div className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/20 px-2 py-1 text-xs text-red-600 dark:text-red-400">
              <Clock3 size={12} />
              {t("cancelled") || "Cancelled"}
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-1 text-xs text-gray-600 dark:text-neutral-400">
              <Clock3 size={12} />
              {t("pending")}
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 rounded-lg bg-[#f3f4f5] dark:bg-neutral-950 px-3 py-3 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <UtensilsCrossed size={15} className="text-[#b0004a] dark:text-pink-400" />
          <p className="text-sm text-[#191c1d] dark:text-neutral-300">{items}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-2 text-xs">
          <span
            className={
              status === "accepted"
                ? "font-medium text-[#b0004a] dark:text-pink-400"
                : "text-[#5a4044] dark:text-neutral-400"
            }
          >
            {progressText}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-[#b0004a] dark:bg-pink-650"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5">
        {status === "delivered" ? (
          <button
            onClick={() => onRateOrder?.(dbId)}
            disabled={isRated}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-center text-sm transition ${
              isRated
                ? "bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 cursor-default"
                : "bg-[#b0004a] dark:bg-pink-650 text-white font-semibold hover:opacity-90"
            }`}
          >
            <Star size={16} className={isRated ? "fill-[#f6c344] text-[#f6c344]" : "fill-white text-white"} />
            {isRated ? t("alreadySubmitted") || "Already Submitted" : t("rateOrder") || "Rate Order"}
          </button>
        ) : (
          <Link
            href={`/orders/track-order/${orderId}`}
            className="block w-full rounded-lg bg-[#b0004a] dark:bg-pink-650 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t("trackOrder")}
          </Link>
        )}
      </div>
    </div>
  );
}