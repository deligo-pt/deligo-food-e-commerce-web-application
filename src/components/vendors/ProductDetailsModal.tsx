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
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useCartStore } from "@/stores/cartStore";

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
        const { data } = await apiClient.get(`/products/${productId}`);
        setProduct(data.data);
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

  const unitPrice =
    selectedOption?.price ?? product?.pricing?.discountedBasePrice ?? 0;
  const subtotal = unitPrice * quantity;
  const taxRate = product?.pricing?.taxRate ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const currency = product?.pricing?.currency ?? "€";
  const originalProductPrice = product?.pricing?.price ?? 0;

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
        className="relative flex w-full max-w-145 flex-col overflow-hidden rounded-4xl bg-white shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
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
              <div className="mb-6 flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-green-700">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {product.category?.name || "Product"}
                </span>
              </div>

              {/* Product Info */}
              <div className="mb-8 w-full">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="max-w-[70%] text-3xl font-bold leading-tight text-gray-900">
                    {product.name}
                  </h2>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-pink-600">
                      {formatPrice(unitPrice, currency)}
                    </p>
                    {product.pricing.discount > 0 && !selectedOption && (
                      <p className="text-gray-400 line-through">
                        {formatPrice(originalProductPrice, currency)}
                      </p>
                    )}
                  </div>
                </div>
                {product.pricing.discount > 0 && !selectedOption && (
                  <div className="mt-3 flex items-center gap-2 text-pink-600">
                    <span className="text-sm font-semibold">
                      Save{" "}
                      {formatPrice(
                        originalProductPrice -
                          product.pricing.discountedBasePrice,
                        currency,
                      )}{" "}
                      ({Math.round(product.pricing.discount)}% Off)
                    </span>
                  </div>
                )}
              </div>

              {/* Variants – Grouped, mutually exclusive, toggle on click */}
              {groupedOptions.length > 0 && (
                <div className="mb-8 w-full space-y-4">
                  {groupedOptions.map((group) => (
                    <div key={group.groupName}>
                      <h3 className="mb-2 text-base font-semibold text-gray-900">
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
                              className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 p-3 transition hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-3">
                                {isSelected ? (
                                  <CheckCircle
                                    size={20}
                                    className="text-pink-600"
                                  />
                                ) : (
                                  <Circle size={20} className="text-gray-400" />
                                )}
                                <span className="text-gray-800">
                                  {opt.label}
                                </span>
                              </div>
                              <span className="font-medium text-pink-600">
                                {formatPrice(opt.price, currency)}
                              </span>
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
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center text-xl font-bold">
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
              <div className="mb-6 w-full rounded-3xl border border-gray-200 bg-gray-50 p-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-3 text-gray-600">
                    <span>Tax ({taxRate}%)</span>
                    <span>{formatPrice(taxAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-lg font-bold text-pink-600">
                      {formatPrice(total, currency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customization (placeholder) */}
              <div className="mb-8 flex w-full cursor-pointer items-center gap-4 rounded-3xl border border-pink-200 bg-pink-50 p-5 transition hover:bg-pink-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Sparkles size={20} className="text-pink-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Customize your order
                  </h4>
                  <p className="text-sm text-gray-500">
                    Choose toppings & extras in the next step
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="w-full">
                <div className="mb-4 flex items-center gap-2">
                  <FileText size={18} />
                  <h3 className="text-lg font-semibold">Details</h3>
                </div>
                <p className="leading-7 text-gray-600">
                  {product.description ||
                    "Freshly prepared with premium ingredients."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        {!loading && !error && product && (
          <div className="border-t bg-white p-8">
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
                  Add To Cart • {formatPrice(total, currency)}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}