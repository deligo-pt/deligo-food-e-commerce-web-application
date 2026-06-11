/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { MoreVertical, CheckCircle, Ban, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";

interface CartItem {
  productId: string;
  variationSku: string | null;
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

interface CartProductRowProps {
  item: CartItem;
  onUpdate: () => Promise<void>;
  onRemove: (productId: string, variationSku: string | null) => void;
}

export default function CartProductRow({
  item,
  onUpdate,
  onRemove,
}: CartProductRowProps) {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (processingRef.current) return;
    processingRef.current = true;
    setIsToggling(true);

    try {
      await apiClient.patch(`/carts/activate-item/${item.productId}`, {
        variationSku: item.variationSku ?? null,
      });
      const newState = item.isActive ? "deactivated" : "activated";
      toast.success(`"${item.name}" has been ${newState}`);
      await onUpdate();
    } catch (error: any) {
      console.error("Toggle error:", error);
      toast.error(
        error?.response?.data?.message || "Could not change product status",
      );
    } finally {
      setIsToggling(false);
      setIsDropdownOpen(false);
      processingRef.current = false;
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (processingRef.current) return;
    processingRef.current = true;

    const confirmRemove = confirm(`${t("removeFromCart")} "${item.name}"?`);
    if (!confirmRemove) {
      processingRef.current = false;
      return;
    }

    setIsDeleting(true);
    try {
      await apiClient.delete("/carts/delete-item", {
        data: [
          {
            productId: item.productId,
            variationSku: item.variationSku ?? null,
          },
        ],
      });
      onRemove(item.productId, item.variationSku);
      toast.success(`Removed "${item.name}" from cart`);
    } catch (error: any) {
      console.error("Deletion error:", error);
      toast.error(error?.response?.data?.message || "Could not remove product");
    } finally {
      setIsDeleting(false);
      setIsDropdownOpen(false);
      processingRef.current = false;
    }
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border p-4 transition-all sm:flex-row ${
        item.isActive
          ? "border-gray-100 bg-gray-50"
          : "border-gray-200 bg-gray-100 opacity-75"
      }`}
    >
      {/* Product image */}
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-200">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>

      {/* Product details */}
      <div className="flex flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-lg font-bold text-gray-900">{item.name}</h4>
              {/* Active/Inactive Badge */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  item.isActive
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-300 text-gray-700"
                }`}
              >
                {item.isActive ? t("active") : t("inactive")}
              </span>
            </div>
            {item.variationSku && (
              <p className="text-xs text-gray-500">
                {t("sku")}: {item.variationSku}
              </p>
            )}
          </div>

          {/* Three‑dot dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              disabled={isToggling || isDeleting}
              className="rounded-full p-1 transition-colors hover:bg-gray-200"
            >
              <MoreVertical className="h-5 w-5 text-gray-500" />
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 z-10 mt-2 w-44 origin-top-right rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={handleToggleActive}
                  disabled={isToggling || isDeleting}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {isToggling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : item.isActive ? (
                    <Ban className="h-4 w-4 text-orange-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  {item.isActive ? t("setAsInactive") : t("setAsActive")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isToggling || isDeleting}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {t("remove")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quantity and price */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500">{t("qty")}:</span>
            <span className="font-semibold">{item.itemSummary.quantity}</span>
          </div>
          <div className="text-right">
            {item.productPricing.productDiscountAmount > 0 && (
              <p className="text-xs text-gray-400 line-through">
                €
                {(
                  item.productPricing.originalPrice * item.itemSummary.quantity
                ).toFixed(2)}
              </p>
            )}
            <p className="text-xl font-bold text-pink-600">
              €{item.itemSummary.grandTotal.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
