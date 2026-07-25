/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef } from "react";
import { Trash2, Loader2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import SafeImage from "@/components/shared/SafeImage";
import { useTranslation } from "@/hooks/useTranslation";
import { getAddonsTotal } from "@/lib/cart";
import type { CartAddon } from "@/types/cart";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CartItem {
  productId: string;
  variationSku: string | null;
  name: string;
  image: string;
  isActive: boolean;
  addons?: CartAddon[];
  itemSummary: {
    quantity: number;
    grandTotal: number;
  };
  productPricing: {
    originalPrice: number;
    productDiscountAmount: number;
  };
}

interface CartProductRowProps {
  item: CartItem;
  onRemove: (productId: string, variationSku: string | null) => void;
}

export default function CartProductRow({
  item,
  onRemove,
}: CartProductRowProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const processingRef = useRef(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (processingRef.current) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsConfirmOpen(false);
    if (processingRef.current) return;
    processingRef.current = true;

    setIsDeleting(true);
    try {
      // Only send variationSku for variant lines. A plain product must omit it
      // (not send null) — the backend's Zod schema rejects null with
      // "variationSku: Expected string, received null".
      const target: { productId: string; variationSku?: string } = {
        productId: item.productId,
      };
      if (item.variationSku) {
        target.variationSku = item.variationSku;
      }
      await apiClient.delete("/carts/delete-item", { data: [target] });
      onRemove(item.productId, item.variationSku);
      toast.success(`Removed "${item.name}" from cart`);
    } catch (error: any) {
      console.error("Deletion error:", error);
      toast.error(getApiErrorMessage(error, "Could not remove product"));
    } finally {
      setIsDeleting(false);
      processingRef.current = false;
    }
  };

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50 p-4 transition-all sm:flex-row"
    >
      {/* Product image */}
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-200 dark:bg-neutral-800">
        <SafeImage
          src={item.image}
          alt={item.name}
          sizes="96px"
          fallbackIcon={<UtensilsCrossed className="h-8 w-8" />}
        />
      </div>

      {/* Product details */}
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4 className="text-lg font-bold text-gray-900 dark:text-neutral-100">{item.name}</h4>
            {item.variationSku && (
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                {t("sku")}: {item.variationSku}
              </p>
            )}
          </div>

          {/* Remove is the only per-product action. Activate/deactivate is a
              store-level concept (see CartStoreCard) because the backend only
              lets one vendor be checked out at a time. */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={t("remove")}
            title={t("remove")}
            className="rounded-full p-2 text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Trash2 className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Quantity and price */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500 dark:text-neutral-400">{t("qty")}:</span>
            <span className="font-semibold text-gray-900 dark:text-neutral-100">{item.itemSummary.quantity}</span>
          </div>
          <div className="text-right">
            {item.productPricing.productDiscountAmount > 0 && (
              <p className="text-xs text-gray-400 dark:text-neutral-500 line-through">
                €
                {(
                  item.productPricing.originalPrice *
                    item.itemSummary.quantity +
                  getAddonsTotal(item)
                ).toFixed(2)}
              </p>
            )}
            <p className="text-xl font-bold text-[#f9186b] dark:text-pink-400">
              €{item.itemSummary.grandTotal.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeFromCart") || "Remove from cart?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &ldquo;{item.name}&rdquo; from your cart?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => {
              e?.stopPropagation();
              setIsConfirmOpen(false);
            }}>{t("cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => {
              e?.stopPropagation();
              handleConfirmDelete();
            }} className="bg-[#f9186b] hover:bg-[#d4145b] text-white cursor-pointer">
              {t("remove") || "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
