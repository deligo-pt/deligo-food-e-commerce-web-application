/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Tag,
  ShoppingCart,
  Sparkles,
  FileText,
  Circle,
  CheckCircle,
  UtensilsCrossed,
  Moon,
} from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useCartCache } from "@/hooks/queries/useCart";
import { activateAddedOrder } from "@/lib/cartActivation";
import { useTranslation } from "@/hooks/useTranslation";
import { currencySymbol } from "@/lib/currency";
import {
  applyProductDiscount,
  formatDiscountValue,
  hasProductDiscount,
} from "@/lib/productPricing";
import { Button } from "@/components/ui/button";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}

interface Product {
  id?: string;
  _id?: string;
  productId: string;
  name: string;
  description: string;
  images: string[];
  pricing: {
    price: number;
    /** Percent when `discountType` is PERCENTAGE, an amount when it's FLAT. */
    discount: number;
    discountType?: string;
    taxRate: number;
    currency: string;
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
  // The product references addon groups by their ObjectId; the full group
  // (title/options/limits) is fetched separately from /add-ons/:id.
  addonGroups?: string[];
  // `/products/:id` populates the owning vendor, so the modal reads store
  // status straight off the product response rather than taking it as a prop —
  // one source of truth, and it stays correct however the modal was opened.
  vendorId?: {
    userId?: string;
    businessDetails?: { isStoreOpen?: boolean };
  };
}

interface VariantOption {
  groupName: string;
  label: string;
  price: number;
  sku: string;
}

interface AddonOption {
  name: string;
  sku: string;
  price: number;
  tax?: { taxRate: number };
  isActive?: boolean;
}

interface AddonGroup {
  _id: string;
  title: string;
  minSelectable: number;
  maxSelectable: number;
  options: AddonOption[];
  isActive?: boolean;
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
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  // Selected quantity per addon option, keyed by the option sku.
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  // The cart page and the navbar badge both read the `useCart` query, so a
  // single invalidation after adding updates the icon and the page together.
  const { invalidate: invalidateCart } = useCartCache();

  // Addon groups are auth-only and referenced by id on the product, so fetch
  // and populate them once the product loads (skipped for guests, who must log
  // in before they can add anything to the cart anyway).
  useEffect(() => {
    const ids = Array.isArray(product?.addonGroups)
      ? product.addonGroups.filter((g): g is string => typeof g === "string")
      : [];
    // Reset any prior selection whenever the product changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddonQty({});
    if (!ids.length || !getAccessToken()) {
      setAddonGroups([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          ids.map((id) => apiClient.get(`/add-ons/${id}`)),
        );
        if (cancelled) return;
        const groups = results
          .map((r) => r.data?.data as AddonGroup)
          .filter((g): g is AddonGroup => !!g && g.isActive !== false)
          .map((g) => ({
            ...g,
            options: (g.options || []).filter((o) => o.isActive !== false),
          }))
          .filter((g) => g.options.length > 0);
        setAddonGroups(groups);
      } catch {
        if (!cancelled) setAddonGroups([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product]);

  // Preload the add-ons already saved on this cart line.
  //
  // `add-to-cart` MERGES add-ons into whatever the line already has (it only
  // replaces the skus you name). So without preloading, the user sees an empty
  // selection while the backend still counts the hidden ones: picking a single
  // topping on a line already at its group maximum fails with "You can select a
  // maximum of N" — an error they can't understand or fix from this screen.
  // Showing the real state makes the group limits enforceable client-side.
  useEffect(() => {
    const productMongoId = product?._id ?? product?.productId;
    if (!isOpen || !productMongoId || !addonGroups.length || !getAccessToken()) {
      return;
    }

    const variationSku = selectedOption ? selectedOption.sku : null;
    const knownSkus = new Set(
      addonGroups.flatMap((g) => g.options.map((o) => o.sku)),
    );

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get("/carts/view-cart");
        if (cancelled) return;
        const items = (res.data?.data?.items ?? []) as Array<{
          productId?: string;
          variationSku?: string | null;
          addons?: { sku?: string; quantity?: number }[];
        }>;
        const line = items.find(
          (l) =>
            l.productId === productMongoId &&
            (l.variationSku ?? null) === variationSku,
        );

        const preloaded: Record<string, number> = {};
        for (const addon of line?.addons ?? []) {
          // Skip anything the current groups no longer offer, so a stale sku
          // can't be echoed back and rejected on save.
          if (addon.sku && addon.quantity && knownSkus.has(addon.sku)) {
            preloaded[addon.sku] = addon.quantity;
          }
        }
        setAddonQty(preloaded);
      } catch {
        // An unreadable cart just means no preload; the save path re-reads
        // authoritatively before writing anything.
        if (!cancelled) setAddonQty({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, product, selectedOption, addonGroups]);

  const groupSelectedCount = (group: AddonGroup) =>
    group.options.reduce((sum, o) => sum + (addonQty[o.sku] || 0), 0);

  const incAddon = (group: AddonGroup, sku: string) => {
    if (groupSelectedCount(group) >= group.maxSelectable) return;
    setAddonQty((prev) => ({ ...prev, [sku]: (prev[sku] || 0) + 1 }));
  };

  const decAddon = (sku: string) => {
    setAddonQty((prev) => ({ ...prev, [sku]: Math.max(0, (prev[sku] || 0) - 1) }));
  };

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

  // Decimal point, matching the cart, checkout, payment and invoice surfaces —
  // this modal was the only place rendering the same product as "€5,42".
  const formatPrice = (price: number, currency = "€") => {
    return `${currency}${price.toFixed(2)}`;
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

  const hasDiscount = hasProductDiscount(product?.pricing);

  const unitPrice = selectedOption
    // No `finalPrice` exists per option, so the discount is applied here — and
    // it has to respect `discountType`. Reading `discount` as a percentage
    // regardless priced Chocolate Salami's Large at €1.99 against a €1.40
    // charge; `applyProductDiscount` is checked against the cart's own figures.
    ? applyProductDiscount(selectedOption.price, product?.pricing)
    // The API exposes the post-discount unit price as `finalPrice` (there is no
    // `discountedBasePrice` field). Reading the missing field made this `0`,
    // which zeroed out the subtotal/VAT/total shown in the modal.
    : (product?.pricing?.finalPrice ?? 0);

  const currentOriginalUnitPrice = selectedOption
    ? selectedOption.price
    : (product?.pricing?.price ?? 0);

  const productSubtotal = unitPrice * quantity;
  const vatRate = product?.pricing?.taxRate ?? 0;
  // Addon prices are independent of the product quantity (they carry their own
  // quantity) and, like products, are VAT-inclusive with their own VAT rate.
  const addonsSubtotal = addonGroups.reduce(
    (sum, g) =>
      sum + g.options.reduce((s, o) => s + (addonQty[o.sku] || 0) * o.price, 0),
    0,
  );
  const addonsVat = addonGroups.reduce(
    (sum, g) =>
      sum +
      g.options.reduce((s, o) => {
        const gross = (addonQty[o.sku] || 0) * o.price;
        const r = o.tax?.taxRate ?? 0;
        return s + (gross - gross / (1 + r / 100));
      }, 0),
    0,
  );
  const subtotal = productSubtotal + addonsSubtotal;
  // Prices are VAT-inclusive (the backend's grandTotal already contains the
  // VAT), so the VAT is embedded in the price and must be *extracted* for the
  // breakdown line — not added on top. The total therefore equals the subtotal.
  const vatAmount =
    productSubtotal - productSubtotal / (1 + vatRate / 100) + addonsVat;
  const total = subtotal;
  const currency = currencySymbol(product?.pricing?.currency);

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

  // Only an explicit `false` means closed — if the backend omits the flag,
  // stay out of the way and let the API be the judge.
  const isStoreClosed =
    product?.vendorId?.businessDetails?.isStoreOpen === false;

  const handleAddToCart = async () => {
    if (!product) return;

    // The store can close between page load and this click (the backend flips
    // this on a schedule), so re-check rather than trusting the disabled state.
    if (isStoreClosed) {
      toast.error(t("storeClosedCannotOrder"));
      return;
    }

    // Redirect guests to login
    const token = getAccessToken();
    if (!token) {
      toast.error(t("pleaseLogInToAddToCart"));
      onClose();
      router.push("/login");
      return;
    }

    // Enforce each group's minimum selection before hitting the API.
    const unmetGroup = addonGroups.find(
      (g) => g.minSelectable > 0 && groupSelectedCount(g) < g.minSelectable,
    );
    if (unmetGroup) {
      toast.error(t("selectRequiredAddons"));
      return;
    }

    setCartLoading(true);

    try {
      // The API returns products with `_id` and a business `productId`
      // (PROD-XXXX), never a bare `id`. The cart endpoint keys off the Mongo
      // `_id` (the business `productId` is rejected as an "Invalid Id").
      const productMongoId = product._id ?? product.productId;
      const variationSku = selectedOption ? selectedOption.sku : null;

      // Read the line fresh rather than trusting the preload or the React Query
      // cache: `add-to-cart` SETs the quantity it receives, so a stale base here
      // doesn't just render wrong — it destroys real quantity.
      let existingQuantity = 0;
      let existingAddonSkus: string[] = [];
      try {
        const cartRes = await apiClient.get("/carts/view-cart");
        const cartItems = (cartRes.data?.data?.items ?? []) as Array<{
          productId?: string;
          variationSku?: string | null;
          itemSummary?: { quantity?: number };
          addons?: { sku?: string; quantity?: number }[];
        }>;
        const existingLine = cartItems.find(
          (line) =>
            line.productId === productMongoId &&
            (line.variationSku ?? null) === variationSku,
        );
        existingQuantity = existingLine?.itemSummary?.quantity ?? 0;
        existingAddonSkus = (existingLine?.addons ?? [])
          .map((a) => a.sku)
          .filter((sku): sku is string => !!sku);
      } catch {
        // An unreadable cart must not silently reset the line to the picker
        // value — bail out instead of sending a quantity we can't trust.
        toast.error(t("failedToAddToCart"));
        return;
      }

      // Each { optionSku, quantity } SETs that add-on on the line and 0 removes
      // it, but add-ons the payload omits are left untouched. So deselecting one
      // in the modal has to be sent as an explicit 0 — otherwise it silently
      // survives on the line and the user cannot remove it from here.
      const selectedAddons = addonGroups.flatMap((g) =>
        g.options
          .filter((o) => (addonQty[o.sku] || 0) > 0)
          .map((o) => ({ optionSku: o.sku, quantity: addonQty[o.sku] })),
      );
      const selectedSkus = new Set(selectedAddons.map((a) => a.optionSku));
      const removedAddons = existingAddonSkus
        .filter((sku) => !selectedSkus.has(sku))
        .map((sku) => ({ optionSku: sku, quantity: 0 }));
      const addonsPayload = [...selectedAddons, ...removedAddons];

      // `add-to-cart` SETs the line quantity — it does not add to it (the
      // Postman docs still describe the old additive behaviour). This modal
      // means "add N more", so send existing + selected.
      const payload: any = {
        items: [
          { productId: productMongoId, quantity: existingQuantity + quantity },
        ],
      };
      if (variationSku) {
        payload.items[0].variationSku = variationSku;
      }
      if (addonsPayload.length > 0) {
        payload.items[0].addons = addonsPayload;
      }

      const response = await apiClient.post("/carts/add-to-cart", payload);

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to add to cart");
      }

      // The store just added to becomes the cart's active order and the others
      // go quiet, so the basket the customer is building is always the one
      // selected for checkout.
      await activateAddedOrder({ productId: productMongoId, variationSku });

      await invalidateCart();
      toast.success(t("itemAddedToCart"));
      onClose();
    } catch (err: any) {
      // Store-closed and friends are translated centrally by errorKey.
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
        className="relative flex w-full max-w-145 flex-col overflow-hidden rounded-4xl bg-card border shadow-2xl dark:shadow-none"
      >
        {/* Drag handle */}
        <div className="absolute left-1/2 top-3 z-20 h-1.5 w-12 -translate-x-1/2 rounded-full bg-gray-300 dark:bg-neutral-700" />

        {/* Close button */}
        <Button
          size="icon"
          variant="secondary"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 z-20 rounded-full"
        >
          <X size={20} />
        </Button>

        {/* Content */}
        <div className="max-h-[calc(100vh-140px)] flex-1 overflow-y-auto scrollbar-hide">
          {loading && (
            <div className="flex h-96 items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {error && <div className="p-8 text-center text-red-500">{error}</div>}

          {!loading && !error && product && (
            <div className="flex flex-col items-center px-8 pb-6 pt-8">
              {/* Image */}
              <div className="relative mb-6 h-64 w-64">
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-white shadow-xl">
                  <SafeImage
                    src={product.images?.[0]}
                    alt={product.name}
                    sizes="256px"
                    fallbackIcon={<UtensilsCrossed className="h-16 w-16" />}
                  />
                </div>
              </div>

              {/* Category Badge */}
              <div className="mb-6 flex items-center gap-2 rounded-full bg-green-50 dark:bg-green-950/30 px-4 py-2 text-green-700 dark:text-green-400 border dark:border-green-900/30">
                <UtensilsCrossed size={14} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {product.category?.name || t("product")}
                </span>
              </div>

              {/* Product Info */}
              <div className="mb-8 w-full">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="max-w-[70%] text-xl font-bold leading-tight text-gray-900 dark:text-white">
                    {product.name}
                  </h2>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary dark:text-pink-400">
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
                  <div className="mt-3 flex items-center justify-end gap-1.5 text-primary dark:text-pink-400">
                    <Tag size={14} className="fill-primary/15" />
                    <span className="text-sm font-semibold">
                      Save{" "}
                      {formatPrice(
                        currentOriginalUnitPrice - unitPrice,
                        currency,
                      )}
                      {/* Only worth appending for a percentage — on a FLAT
                          discount the rate *is* the saving already printed,
                          so "(€0.60 Off)" would just say it twice. */}
                      {product?.pricing?.discountType === "PERCENTAGE" &&
                        ` (${formatDiscountValue(product.pricing, currency)} Off)`}
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
                              className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition bg-card hover:bg-gray-50 dark:hover:bg-neutral-800"
                            >
                              <div className="flex items-center gap-3">
                                {isSelected ? (
                                  <CheckCircle
                                    size={20}
                                    className="text-primary dark:text-pink-400"
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
                                <span className="font-medium text-primary dark:text-pink-400">
                                  {formatPrice(
                                    applyProductDiscount(opt.price, product?.pricing),
                                    currency,
                                  )}
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
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label={quantity <= 1 ? t("remove") : t("decrease")}
                  className="rounded-full"
                >
                  {quantity <= 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                </Button>
                <span className="w-8 text-center text-xl font-bold text-gray-950 dark:text-white">
                  {quantity}
                </span>
                <Button
                  size="icon"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label={t("increase")}
                  className="rounded-full"
                >
                  <Plus size={16} />
                </Button>
              </div>

              {/* Summary */}
              <div className="mb-6 w-full rounded-3xl border border-border bg-gray-50 dark:bg-neutral-900/50 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-xl font-semibold text-gray-900 dark:text-white">
                      {t("total")}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-neutral-400">
                      ({t("inclVat")} -&nbsp;{formatPrice(vatAmount, currency)})
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xl font-bold text-primary dark:text-pink-400">
                    {formatPrice(total, currency)}
                  </span>
                </div>
              </div>

              {/* Add-ons */}
              {addonGroups.length > 0 && (
                <div className="mb-8 w-full space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-primary dark:text-pink-400" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {t("customizeYourOrder")}
                    </h3>
                  </div>
                  {addonGroups.map((group) => {
                    const selectedCount = groupSelectedCount(group);
                    const atMax = selectedCount >= group.maxSelectable;
                    return (
                      <div key={group._id}>
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                            {group.title}
                          </h4>
                          <span className="text-xs text-gray-500 dark:text-neutral-400">
                            {group.minSelectable > 0 ? t("required") : t("optional")}
                            {" · "}
                            {t("chooseUpTo")} {group.maxSelectable}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {group.options.map((opt) => {
                            const qty = addonQty[opt.sku] || 0;
                            return (
                              <div
                                key={opt.sku}
                                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-800 dark:text-neutral-200">
                                    {opt.name}
                                  </span>
                                  <span className="text-sm font-medium text-primary dark:text-pink-400">
                                    +{formatPrice(opt.price, currency)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    onClick={() => decAddon(opt.sku)}
                                    disabled={qty === 0}
                                    aria-label={t("decrease")}
                                    className="rounded-full"
                                  >
                                    <Minus size={14} />
                                  </Button>
                                  <span className="w-5 text-center text-sm font-bold text-gray-900 dark:text-white">
                                    {qty}
                                  </span>
                                  <Button
                                    size="icon-sm"
                                    onClick={() => incAddon(group, opt.sku)}
                                    disabled={atMax}
                                    aria-label={t("increase")}
                                    className="rounded-full"
                                  >
                                    <Plus size={14} />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Details */}
              <div className="w-full text-gray-900 dark:text-white">
                <div className="mb-4 flex items-center gap-2">
                  <FileText size={18} />
                  <h3 className="text-xl font-semibold">{t("details")}</h3>
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
          <div className="border-t border-border bg-card p-8">
            {isStoreClosed && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                <Moon
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    {t("storeClosedTitle")}
                  </p>
                  <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-400/80">
                    {t("storeClosedNotice")}
                  </p>
                </div>
              </div>
            )}
            {/* Plan.md Phase 2/3: this was `py-4 text-lg` — a 68px slab with an
                18px label, the shape that started the whole design pass. It is
                now the `lg` size (48px, 14px label) and keeps its gradient and
                shine, which are bespoke to the primary CTA. The gradient still
                holds two of the seven pink literals; those belong to the Phase 4
                sweep, not here. */}
            <Button
              size="lg"
              onClick={handleAddToCart}
              disabled={cartLoading || isStoreClosed}
              className={`relative w-full gap-3 overflow-hidden rounded-2xl bg-linear-to-r from-primary to-primary-hover font-semibold shadow-lg hover:from-primary-hover hover:to-[#b01254] active:scale-[0.98] ${
                cartLoading ? "" : "cart-cta"
              }`}
            >
              {!cartLoading && (
                <span className="cart-cta-shine" aria-hidden="true" />
              )}
              {cartLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="relative z-10 flex items-center gap-3">
                  <ShoppingCart size={22} />
                  {t("addToCart")} • {formatPrice(total, currency)}
                </span>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
