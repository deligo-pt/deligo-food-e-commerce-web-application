// /* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Star, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import CartProductRow from "./CartProductRow";
import { useTranslation } from "@/hooks/useTranslation";

interface CartItem {
  productId: string;
  variationSku: string | null;
  vendorId: { _id: string };
  name: string;
  image: string;
  isActive: boolean;
  itemSummary: {
    quantity: number;
    grandTotal: number;
  };
  productPricing: {
    originalPrice: number;
    productDiscountAmount: number;
  };
}

interface CartStoreCardProps {
  vendorId: string;
  businessName: string;
  image: string;
  rating: number;
  items: CartItem[];
  total: number;
  onProductUpdate: () => Promise<void>;
  onProductRemove: (productId: string, variationSku: string | null) => void;
}

export default function CartStoreCard({
  vendorId,
  businessName,
  image,
  rating,
  items,
  onProductUpdate,
  onProductRemove,
}: CartStoreCardProps) {
  const { t } = useTranslation();
  const activeItems = useMemo(
    () => items.filter((item) => item.isActive),
    [items],
  );
  const hasActive = activeItems.length > 0;
  const activeTotal = useMemo(
    () =>
      activeItems.reduce((sum, item) => sum + item.itemSummary.grandTotal, 0),
    [activeItems],
  );
  const inactiveCount = items.length - activeItems.length;

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm transition-colors duration-200">
      {/* Store header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-pink-100 dark:border-pink-950">
            <Image
              src={image}
              alt={businessName}
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{businessName}</h3>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2">
                <Star size={16} className="fill-yellow-500 text-yellow-500" />
                <span className="font-semibold text-yellow-700 dark:text-yellow-400">
                  {rating > 0 ? rating.toFixed(1) : t("new")}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-pink-50 dark:bg-pink-950/20 px-3 py-2">
                <UtensilsCrossed size={16} className="text-pink-600 dark:text-pink-400" />
                <span className="font-semibold text-pink-600 dark:text-pink-400">
                  {activeItems.length} / {items.length} {t("active")}
                </span>
              </div>
              {inactiveCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-neutral-800 px-3 py-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-neutral-400">
                    {inactiveCount} {t("inactive")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product list – each with its own dropdown */}
      <div className="space-y-4">
        {items.map((item) => (
          <CartProductRow
            key={`${item.productId}-${item.variationSku ?? "default"}`}
            item={item}
            onUpdate={onProductUpdate}
            onRemove={onProductRemove}
          />
        ))}
      </div>

      {/* Store checkout button – enabled if at least one active item */}
      <div className="mt-6">
        <Link
          href={hasActive ? `/cart/checkout/${vendorId}` : "#"}
          onClick={(e) => {
            if (!hasActive) {
              e.preventDefault();
              toast.error(t("cannotCheckoutNoActiveItems"));
            }
          }}
          className={`flex items-center justify-between rounded-3xl px-6 py-5 text-white transition cursor-pointer ${
            hasActive
              ? "bg-linear-to-r from-pink-500 to-pink-700 hover:from-pink-600 hover:to-pink-800"
              : "cursor-not-allowed bg-gray-400 dark:bg-neutral-750 text-neutral-200 dark:text-neutral-400"
          }`}
        >
          <span className="text-xl font-bold">{t("goToCheckout")}</span>
          <div className="rounded-xl bg-white/20 px-4 py-2 font-bold">
            €{activeTotal.toFixed(2)}
          </div>
        </Link>
        {!hasActive && (
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-neutral-400">
            {t("activateAtLeastOneProduct")}
          </p>
        )}
      </div>
    </div>
  );
}
