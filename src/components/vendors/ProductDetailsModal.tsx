/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  Sparkles,
  FileText,
  Circle,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useCartStore } from "@/stores/cartStore";
import { useTranslation } from "@/hooks/useTranslation";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}

interface Product {
  id: string;
  productId: string;
  name: string;
  description: string;
  images: string[];
  pricing: {
    price: number;
    discount: number;
    taxRate: number;
    currency: string;
    discountedBasePrice: number;
    taxAmount: number;
    finalPrice: number;
  };
  category?: { name: string };
  variations?: {
    name: string;
    options: {
      label: string;
      price: number;
      sku: string;
      isOutOfStock?: boolean;
    }[];
  }[];
  addonGroups?: any[];
}

interface VariantOption {
  groupName: string;
  label: string;
  price: number;
  sku: string;
}

export default function ProductDetailsModal({
  isOpen,
  onClose,
  productId,
}: ProductDetailsModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedOption, setSelectedOption] = useState<VariantOption | null>(
    null,
  );
  const [cartLoading, setCartLoading] = useState(false);
  const { fetchCart } = useCartStore();

  useEffect(() => {
    if (!isOpen || !productId) return;

    const fetchProduct = async () => {
      setLoading(true);
      setError("");
      try {
        const token = getAccessToken();
        if (token) {
          // Authenticated: use protected endpoint
          const { data } = await apiClient.get(`/products/${productId}`);
          setProduct(data.data);
        } else {
          // Unauthenticated: use open public endpoint
          const { data } = await apiClient.get(`/products/open/${productId}`);
          setProduct(data.data);
        }
        setQuantity(1);
        setSelectedOption(null);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load product details"));
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [isOpen, productId]);

  if (!isOpen) return null;

  const formatPrice = (price: number, currency = "€") => {
    return `${currency}${price.toFixed(2)}`.replace(".", ",");
  };

  const groupedOptions: { groupName: string; options: VariantOption[] }[] = [];
  if (product?.variations) {
    for (const group of product.variations) {
      const groupOptions = group.options.map((opt) => ({
        groupName: group.name,
        label: opt.label,
        price: opt.price,
        sku: opt.sku,
      }));
      if (groupOptions.length) {
        groupedOptions.push({ groupName: group.name, options: groupOptions });
      }
    }
  }

  const discountPercentage = product?.pricing?.discount ?? 0;
  const hasDiscount = discountPercentage > 0;

  const unitPrice = selectedOption
    ? selectedOption.price * (1 - discountPercentage / 100)
    : (product?.pricing?.discountedBasePrice ?? 0);

  const currentOriginalUnitPrice = selectedOption
    ? selectedOption.price
    : (product?.pricing?.price ?? 0);

  const subtotal = unitPrice * quantity;
  const taxRate = product?.pricing?.taxRate ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const currency = product?.pricing?.currency ?? "€";

  const handleOptionClick = (opt: VariantOption) => {
    if (
      selectedOption?.label === opt.label &&
      selectedOption?.groupName === opt.groupName
    ) {
      setSelectedOption(null);
    } else {
      setSelectedOption(opt);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    // Redirect guests to login
    const token = getAccessToken();
    if (!token) {
      toast.error("Please log in to add items to your cart.");
      onClose();
      router.push("/login");
      return;
    }

    setCartLoading(true);

    try {
      const payload: any = {
        items: [
          {
            productId: product.id,
            quantity,
          },
        ],
      };

      if (selectedOption) {
        payload.items[0].variationSku = selectedOption.sku;
      }

      const response = await apiClient.post("/carts/add-to-cart", payload);

      if (response.data.success) {
        await fetchCart();

        toast.success("Item added to cart successfully!");

        onClose();
      } else {
        throw new Error(response.data.message || "Failed to add to cart");
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Could not add item to cart"));
    } finally {
      setCartLoading(false);
    }
  };
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-999 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-145 flex-col overflow-hidden rounded-4xl bg-white dark:bg-neutral-900 border dark:border-neutral-800 shadow-2xl dark:shadow-none"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 transition hover:bg-gray-200 dark:hover:bg-neutral-700"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className="max-h-[calc(100vh-140px)] flex-1 overflow-y-auto scrollbar-hide">
          {loading && (
            <div className="flex h-96 items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-600 border-t-transparent" />
            </div>
          )}

          {error && <div className="p-8 text-center text-red-500">{error}</div>}

          {!loading && !error && product && (
            <div className="flex flex-col items-center px-8 pb-6 pt-10">
              {/* Image */}
              <div className="relative mb-6 h-64 w-64">
                <div className="absolute inset-0 rounded-full bg-pink-500/10 blur-3xl" />
                <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-white shadow-xl">
                  <Image
                    fill
                    src={product.images?.[0] || "/placeholder-product.jpg"}
                    alt={product.name}
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Category Badge */}
              <div className="mb-6 flex items-center gap-2 rounded-full bg-green-50 dark:bg-green-950/30 px-4 py-2 text-green-700 dark:text-green-400 border dark:border-green-900/30">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {product.category?.name || t("product")}
                </span>
              </div>

              {/* Product Info */}
              <div className="mb-8 w-full">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="max-w-[70%] text-3xl font-bold leading-tight text-gray-900 dark:text-white">
                    {product.name}
                  </h2>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                      {formatPrice(unitPrice, currency)}
                    </p>
                    {hasDiscount && (
                      <p className="text-gray-400 dark:text-neutral-500 line-through">
                        {formatPrice(currentOriginalUnitPrice, currency)}
                      </p>
                    )}
                  </div>
                </div>
                {hasDiscount && (
                  <div className="mt-3 flex items-center gap-2 text-pink-600 dark:text-pink-400">
                    <span className="text-sm font-semibold">
                      Save{" "}
                      {formatPrice(
                        currentOriginalUnitPrice - unitPrice,
                        currency,
                      )}{" "}
                      ({Math.round(discountPercentage)}% Off)
                    </span>
                  </div>
                )}
              </div>

              {/* Variants – Grouped, mutually exclusive, toggle on click */}
              {groupedOptions.length > 0 && (
                <div className="mb-8 w-full space-y-4">
                  {groupedOptions.map((group) => (
                    <div key={group.groupName}>
                      <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white">
                        {group.groupName}
                      </h3>
                      <div className="space-y-2">
                        {group.options.map((opt) => {
                          const isSelected =
                            selectedOption?.label === opt.label &&
                            selectedOption?.groupName === opt.groupName;
                          return (
                            <div
                              key={`${opt.groupName}-${opt.label}`}
                              onClick={() => handleOptionClick(opt)}
                              className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 dark:border-neutral-800 p-3 transition bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800"
                            >
                              <div className="flex items-center gap-3">
                                {isSelected ? (
                                  <CheckCircle
                                    size={20}
                                    className="text-pink-600 dark:text-pink-400"
                                  />
                                ) : (
                                  <Circle size={20} className="text-gray-400 dark:text-neutral-500" />
                                )}
                                <span className="text-gray-800 dark:text-neutral-200">
                                  {opt.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasDiscount && (
                                  <span className="text-sm text-gray-400 dark:text-neutral-500 line-through">
                                    {formatPrice(opt.price, currency)}
                                  </span>
                                )}
                                <span className="font-medium text-pink-600 dark:text-pink-400">
                                  {formatPrice(opt.price * (1 - discountPercentage / 100), currency)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quantity */}
              <div className="mb-8 flex w-full items-center justify-end gap-4">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-neutral-400 transition hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center text-xl font-bold text-gray-950 dark:text-white">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-600 text-white transition hover:bg-pink-700"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Summary */}
              <div className="mb-6 w-full rounded-3xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50 p-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600 dark:text-neutral-400">
                    <span>{t("subtotal")}</span>
                    <span>{formatPrice(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 dark:border-neutral-800 pb-3 text-gray-600 dark:text-neutral-400">
                    <span>
                      {t("tax")} ({taxRate}%)
                    </span>
                    <span>{formatPrice(taxAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{t("total")}</span>
                    <span className="text-lg font-bold text-pink-600 dark:text-pink-400">
                      {formatPrice(total, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customization (placeholder) */}
              <div className="mb-8 flex w-full cursor-pointer items-center gap-4 rounded-3xl border border-pink-200 dark:border-pink-900/30 bg-pink-50 dark:bg-pink-950/20 p-5 transition hover:bg-pink-100 dark:hover:bg-pink-950/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 shadow-sm">
                  <Sparkles size={20} className="text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {t("customizeYourOrder")}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-neutral-400">
                    {t("chooseToppingsAndExtras")}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="w-full text-gray-900 dark:text-white">
                <div className="mb-4 flex items-center gap-2">
                  <FileText size={18} />
                  <h3 className="text-lg font-semibold">{t("details")}</h3>
                </div>
                <p className="leading-7 text-gray-600 dark:text-neutral-400">
                  {product.description ||
                    t("freshlyPreparedWithPremiumIngredients")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        {!loading && !error && product && (
          <div className="border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8">
            <button
              onClick={handleAddToCart}
              disabled={cartLoading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-pink-600 py-5 text-lg font-semibold text-white shadow-lg transition hover:bg-pink-700 disabled:opacity-50"
            >
              {cartLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <ShoppingCart size={22} />
                  {t("addToCart")} • {formatPrice(total, currency)}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
