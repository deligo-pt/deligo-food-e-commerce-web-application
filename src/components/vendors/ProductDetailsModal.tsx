/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Minus,
  Tag,
  ShoppingCart,
  Sparkles,
  ChevronDown,
  UtensilsCrossed,
  Moon,
} from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import axios from "axios";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useCartCache } from "@/hooks/queries/useCart";
import { activateAddedOrder } from "@/lib/cartActivation";
import { useTranslation } from "@/hooks/useTranslation";
import { useCustomerCoords } from "@/hooks/useCustomerCoords";
import { hasCoords, isOutOfArea, withCoords, type Coords } from "@/lib/customerCoords";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { getVendorKind, vendorCopyKey } from "@/lib/vendorKind";
import { currencySymbol } from "@/lib/currency";
import type { ProductSdr } from "@/types/sdr";
import { productDeposit } from "@/lib/sdr";
import {
  applyProductDiscount,
  formatDiscountValue,
  hasProductDiscount,
} from "@/lib/productPricing";
import { Button } from "@/components/ui/button";
import { getProductImage } from "@/lib/productImage";
import { DEFAULT_PRODUCT_IMAGE } from "@/components/shared/ProductImage";

interface ProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  /**
   * The store's own position, for when the customer's is unknown.
   *
   * The store page shows a guest with no location the menu asked from the
   * store's pin (`menuCoords`), but this modal asked with nothing and
   * `/products/open/:id` answered 400 — every dish on the page failed to open
   * (measured 30 Sep 2026: 19 of 19 on two branches). Used **only** when the
   * customer has no position: when they have one, the dish is asked from
   * there, so "not available in your area" stays the true answer.
   */
  storeCoords?: Coords | null;
}

interface Product {
  id?: string;
  _id?: string;
  productId: string;
  name: string;
  description: string;
  images?: string[];
  /** Newer products carry this instead of `images` — see `getProductImage`. */
  image?: string;
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
  /** Container deposit per unit — read through `productDeposit`. */
  sdr?: ProductSdr;
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
    businessDetails?: {
      isStoreOpen?: boolean;
      // Two shapes, both live: a string on the vendor lists, an object here.
      // `getVendorKind` reads either.
      businessType?:
        | string
        | { slug?: string | null; name?: { en?: string | null } | string | null }
        | null;
    };
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

/** A description longer than this gets the two-line clamp and "Read more". */
const DESCRIPTION_CLAMP_AT = 110;

export default function ProductDetailsModal({
  isOpen,
  onClose,
  productId,
  storeCoords,
}: ProductDetailsModalProps) {
  const { t } = useTranslation();
  const coords = useCustomerCoords();
  // Where the dish is asked from: the customer, else the store's own pin.
  // Kept as primitives so a new `storeCoords` object each render does not
  // refetch the dish.
  const askFrom = hasCoords(coords) ? coords : hasCoords(storeCoords) ? storeCoords : null;
  const askLat = askFrom?.lat;
  const askLng = askFrom?.lng;
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
  // True while the groups load — until then required groups are unknown, so
  // "Add to cart" waits (greyed) instead of skipping their minimums.
  const [addonsPending, setAddonsPending] = useState(false);
  // Selected quantity per addon option, keyed by the option sku.
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  // Add-on groups the customer opened or closed by hand; the rest follow
  // `isGroupOpen`'s default.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // "Add to cart" without a variation: outline the options block until one is picked.
  const [variationFlagged, setVariationFlagged] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The cart page and the navbar badge both read the `useCart` query, so a
  // single invalidation after adding updates the icon and the page together.
  const { invalidate: invalidateCart } = useCartCache();
  // Escape does what the ✕ does. Declared before the `!isOpen` early return,
  // as every hook here must be. The ✕ stays live while adding to the cart, so
  // Escape does too.
  useEscapeToClose(isOpen, onClose, { layer: 999 });

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
    setOpenGroups({});
    setVariationFlagged(false);
    setDescriptionOpen(false);
    if (!ids.length || !getAccessToken()) {
      setAddonGroups([]);
      setAddonsPending(false);
      return;
    }
    let cancelled = false;
    setAddonsPending(true);
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
          .filter((g) => g.options.length > 0)
          // Single-choice groups first, then by how many can be picked; ties
          // keep the vendor's order (sort is stable).
          .sort((a, b) => a.maxSelectable - b.maxSelectable);
        setAddonGroups(groups);
      } catch {
        if (!cancelled) setAddonGroups([]);
      } finally {
        if (!cancelled) setAddonsPending(false);
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
        // Only a line that has add-ons replaces the selection. This runs
        // again on every size change, and wiping here meant picking the extras
        // first and the size second lost the extras.
        if (Object.keys(preloaded).length > 0) setAddonQty(preloaded);
      } catch {
        // An unreadable cart just means no preload; the save path re-reads
        // authoritatively before writing anything.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, product, selectedOption, addonGroups]);

  const groupSelectedCount = (group: AddonGroup) =>
    group.options.reduce((sum, o) => sum + (addonQty[o.sku] || 0), 0);

  // Every group starts open, so every choice is in view without a tap (the
  // owner's call, 17 Oct 2026 — reversing a brief all-closed default). Each
  // header still closes its own group.
  const isGroupOpen = (group: AddonGroup) => openGroups[group._id] ?? true;

  const incAddon = (group: AddonGroup, sku: string) => {
    if (groupSelectedCount(group) >= group.maxSelectable) return;
    setAddonQty((prev) => ({ ...prev, [sku]: (prev[sku] || 0) + 1 }));
  };

  const decAddon = (sku: string) => {
    setAddonQty((prev) => ({ ...prev, [sku]: Math.max(0, (prev[sku] || 0) - 1) }));
  };

  // "Choose up to 1" groups are radios: picking one replaces the other.
  // Tapping the picked one clears it, unless the group is required.
  const pickAddon = (group: AddonGroup, sku: string) => {
    setAddonQty((prev) => {
      const wasPicked = (prev[sku] || 0) > 0;
      if (wasPicked && group.minSelectable > 0) return prev;
      const next = { ...prev };
      for (const o of group.options) delete next[o.sku];
      if (!wasPicked) next[sku] = 1;
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen || !productId) return;

    const fetchProduct = async () => {
      setLoading(true);
      setError("");
      try {
        const token = getAccessToken();
        // Both routes need the customer's position since 27 Sep 2026: without
        // it the open one answers 400 and the protected one 404s on a product
        // that exists. A product too far away 404s either way — which is a
        // different thing from "deleted", and Phase 4 is where that is said.
        const params = withCoords(
          {},
          askLat !== undefined && askLng !== undefined ? { lat: askLat, lng: askLng } : null,
        );
        if (token) {
          // Authenticated: use protected endpoint
          const { data } = await apiClient.get(`/products/${productId}`, { params });
          setProduct(data.data);
        } else {
          // Unauthenticated: use open public endpoint
          const { data } = await apiClient.get(`/products/open/${productId}`, { params });
          setProduct(data.data);
        }
        setQuantity(1);
        setSelectedOption(null);
      } catch (err) {
        // A 404 on a request that carried coordinates means the dish is out of
        // range, not gone. Saying "product not found" to someone whose only
        // problem is their address sends them away for good.
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        setError(
          isOutOfArea(status, coords)
            ? `${t("productOutOfAreaTitle")} — ${t("productOutOfAreaHint")}`
            : getApiErrorMessage(err, "Failed to load product details"),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    // `coords` is in the list: the same product answers differently from a
    // different place, so a customer who sets their address while the modal is
    // open should see the answer for where they actually are. `t` is here
    // because the out-of-area message is built inside the effect — a language
    // switch should re-render it in the new language.
    //
    // `askLat`/`askLng` cover the store fallback. `isOutOfArea` still reads
    // `coords`: a 404 from the store's own pin means the dish is gone, not far.
  }, [isOpen, productId, coords, askLat, askLng, t]);

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
  // Container deposit (SDR) per item. Charged at checkout, not in the cart:
  // the button keeps the food total and the line under it names the deposit.
  const depositPerItem = productDeposit(product);

  const description =
    product?.description || t("freshlyPreparedWithPremiumIngredients");

  const handleOptionClick = (opt: VariantOption) => {
    if (
      selectedOption?.label === opt.label &&
      selectedOption?.groupName === opt.groupName
    ) {
      setSelectedOption(null);
    } else {
      setSelectedOption(opt);
      setVariationFlagged(false);
    }
  };

  // Group subtitle: optional "Choose up to 2"; required "Choose at least 1 · up to 2",
  // or "Choose 1" when the minimum is the maximum.
  const requirementLabel = (group: { minSelectable: number; maxSelectable: number }) => {
    if (group.minSelectable <= 0) return `${t("chooseUpTo")} ${group.maxSelectable}`;
    if (group.minSelectable >= group.maxSelectable) return `${t("chooseExactly")} ${group.minSelectable}`;
    return `${t("chooseAtLeast")} ${group.minSelectable} · ${t("upTo")} ${group.maxSelectable}`;
  };

  // Only an explicit `false` means closed — if the backend omits the flag,
  // stay out of the way and let the API be the judge.
  const isStoreClosed =
    product?.vendorId?.businessDetails?.isStoreOpen === false;

  // What this vendor is called. A cosmetics store was being told "This
  // restaurant is closed — you can browse the menu"; the vendor's own record
  // says which noun belongs here.
  const vendorKind = getVendorKind(product?.vendorId?.businessDetails?.businessType);

  // Greys "Add to cart" (like the app) until a variation and every required
  // add-on group are chosen. The button stays tappable: the tap says what's missing.
  const missingRequired =
    addonsPending ||
    (groupedOptions.length > 0 && !selectedOption) ||
    addonGroups.some((g) => g.minSelectable > 0 && groupSelectedCount(g) < g.minSelectable);

  const handleAddToCart = async () => {
    if (!product) return;

    // The store can close between page load and this click (the backend flips
    // this on a schedule), so re-check rather than trusting the disabled state.
    if (isStoreClosed) {
      toast.error(t(vendorCopyKey("storeClosedCannotOrder", vendorKind)));
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

    // Add-on groups still loading: their minimums aren't known yet.
    if (addonsPending) return;

    // A product with variations needs one picked — the cart rejects it otherwise
    // ("Please select an option or size"). Say so here and point at the options.
    if (groupedOptions.length > 0 && !selectedOption) {
      // One toast id for both checks: the newer message replaces the older one.
      toast.error(t("selectVariationFirst"), { id: "product-required" });
      setVariationFlagged(true);
      scrollRef.current
        ?.querySelector("[data-variations]")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    // Enforce each group's minimum selection before hitting the API.
    const unmetGroup = addonGroups.find(
      (g) => g.minSelectable > 0 && groupSelectedCount(g) < g.minSelectable,
    );
    if (unmetGroup) {
      // Name the group, so the message can't be read as being about something else.
      toast.error(`${unmetGroup.title}: ${t("groupChooseAtLeast")} ${unmetGroup.minSelectable}`, { id: "product-required" });
      // Show which one: open it, outline it and bring it into view.
      setOpenGroups((prev) => ({ ...prev, [unmetGroup._id]: true }));
      scrollRef.current
        ?.querySelector(`[data-addon-group="${unmetGroup._id}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
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
      className="fixed inset-0 z-999 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6"
    >
      {/* A sheet from the bottom on a phone, a centred dialog from `sm`. The
          panel is a column: the middle scrolls, the footer never does, so the
          quantity and the price stay in reach however long the options are. */}
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={product?.name}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-4xl border bg-card shadow-2xl sm:max-h-[calc(100dvh-48px)] sm:max-w-160 sm:rounded-4xl dark:shadow-none"
      >
        {/* Drag handle — a phone cue only */}
        <div className="absolute left-1/2 top-2 z-20 h-1 w-12 -translate-x-1/2 rounded-full bg-gray-300 sm:hidden dark:bg-neutral-700" />

        {/* Close button */}
        <Button
          size="icon"
          variant="secondary"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 z-20 rounded-full"
        >
          <X size={20} />
        </Button>

        {/* Content */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
          {loading && (
            <div className="flex h-64 items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {error && <div className="p-8 text-center text-red-500">{error}</div>}

          {!loading && !error && product && (
            <div className="flex flex-col gap-6 p-4 pt-6 sm:p-6">
              {/* Header: picture beside the name, so the options start in the
                  first screenful instead of under a 256px image. */}
              <div className="flex items-start gap-4 pr-12">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border bg-gray-50 sm:h-28 sm:w-28 dark:bg-neutral-900">
                  <SafeImage
                    src={getProductImage(product)}
                    fallbackSrc={DEFAULT_PRODUCT_IMAGE}
                    alt={product.name}
                    sizes="112px"
                    fallbackIcon={<UtensilsCrossed className="h-8 w-8" />}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1 text-green-700 dark:text-green-400">
                    <UtensilsCrossed size={12} />
                    <span className="truncate text-xs font-bold uppercase tracking-wider">
                      {product.category?.name || t("product")}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">
                    {product.name}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="text-xl font-bold text-primary dark:text-pink-400">
                      {formatPrice(unitPrice, currency)}
                    </p>
                    {hasDiscount && (
                      <p className="text-sm text-gray-400 line-through dark:text-neutral-500">
                        {formatPrice(currentOriginalUnitPrice, currency)}
                      </p>
                    )}
                    {hasDiscount && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary dark:text-pink-400">
                        <Tag size={12} className="fill-primary/15" />
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
                    )}
                  </div>
                  {depositPerItem > 0 && (
                    <p
                      className="mt-1 text-xs font-medium text-muted-foreground dark:text-neutral-400"
                      title={t("sdrExplanation")}
                    >
                      +{formatPrice(depositPerItem, currency)} {t("sdrPerItem")}
                    </p>
                  )}
                </div>
              </div>

              {/* Description — two lines until asked for more */}
              <div className="text-sm leading-6 text-gray-600 dark:text-neutral-400">
                <p className={descriptionOpen ? "" : "line-clamp-2"}>{description}</p>
                {description.length > DESCRIPTION_CLAMP_AT && (
                  <button
                    type="button"
                    onClick={() => setDescriptionOpen((open) => !open)}
                    className="focus-ring mt-1 rounded-sm text-sm font-semibold text-primary dark:text-pink-400"
                  >
                    {descriptionOpen ? t("showLess") : t("readMore")}
                  </button>
                )}
              </div>

              {/* Variants — full-width radio rows like the mobile app: group
                  label, then one row per option (radio · name · price). One
                  option is chosen across all groups (one SKU per cart line). */}
              {groupedOptions.length > 0 && (
                <div
                  data-variations
                  className={`space-y-4 rounded-2xl ${
                    variationFlagged ? "p-3 ring-2 ring-red-400 dark:ring-red-500" : ""
                  }`}
                >
                  {groupedOptions.map((group) => (
                    <div key={group.groupName} role="radiogroup" aria-label={group.groupName}>
                      <h3 className="mb-2 text-sm text-gray-500 dark:text-neutral-400">{group.groupName}</h3>
                      <div className="flex flex-col gap-2">
                        {group.options.map((opt) => {
                          const isSelected =
                            selectedOption?.label === opt.label &&
                            selectedOption?.groupName === opt.groupName;
                          return (
                            <button
                              type="button"
                              key={`${opt.groupName}-${opt.label}`}
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => handleOptionClick(opt)}
                              className={`focus-ring ${optionRowClass(isSelected)}`}
                            >
                              <RadioDot checked={isSelected} />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-neutral-100">
                                {opt.label}
                              </span>
                              <span className="shrink-0 text-sm text-gray-500 tabular-nums dark:text-neutral-400">
                                {formatPrice(applyProductDiscount(opt.price, product?.pricing), currency)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add-ons — one collapsible block per group */}
              {addonGroups.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-primary dark:text-pink-400" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {t("customizeYourOrder")}
                    </h3>
                  </div>
                  {addonGroups.map((group) => {
                    const selectedCount = groupSelectedCount(group);
                    const atMax = selectedCount >= group.maxSelectable;
                    const single = group.maxSelectable === 1;
                    const open = isGroupOpen(group);
                    const picked = group.options
                      .filter((o) => (addonQty[o.sku] || 0) > 0)
                      .map((o) => ((addonQty[o.sku] || 0) > 1 ? `${addonQty[o.sku]}× ${o.name}` : o.name));
                    return (
                      <div
                        key={group._id}
                        data-addon-group={group._id}
                        // Every group carries the red outline (design request), filled or not.
                        className="overflow-hidden rounded-2xl border border-red-400 dark:border-red-500"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenGroups((prev) => ({ ...prev, [group._id]: !open }))}
                          aria-expanded={open}
                          className="focus-ring flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-left dark:bg-neutral-900/50"
                        >
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {group.title}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                  group.minSelectable > 0
                                    ? "bg-primary/10 text-primary dark:bg-pink-950/30 dark:text-pink-400"
                                    : "bg-gray-200 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                                }`}
                              >
                                {group.minSelectable > 0 ? t("required") : t("optional")}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-neutral-400">
                              {!open && picked.length > 0
                                ? picked.join(", ")
                                : requirementLabel(group)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                selectedCount > 0
                                  ? "text-primary dark:text-pink-400"
                                  : "text-gray-500 dark:text-neutral-400"
                              }`}
                            >
                              {selectedCount} / {group.maxSelectable}
                            </span>
                            <ChevronDown
                              size={18}
                              className={`text-gray-500 transition-transform dark:text-neutral-400 ${open ? "rotate-180" : ""}`}
                            />
                          </span>
                        </button>
                        {open && (
                          <div
                            role={single ? "radiogroup" : undefined}
                            aria-label={single ? group.title : undefined}
                            className="flex flex-col gap-2 p-3"
                          >
                            {group.options.map((opt) => {
                              const qty = addonQty[opt.sku] || 0;
                              const name = (
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-neutral-100">
                                  {opt.name}
                                </span>
                              );
                              // A free add-on (€0) says "Free"/"Grátis"; picking and
                              // the group limit work the same.
                              const price = (
                                <span className="shrink-0 text-sm text-gray-500 tabular-nums dark:text-neutral-400">
                                  {opt.price > 0 ? `+${formatPrice(opt.price, currency)}` : t("addonFree")}
                                </span>
                              );
                              if (single) {
                                return (
                                  <button
                                    key={opt.sku}
                                    type="button"
                                    role="radio"
                                    aria-checked={qty > 0}
                                    onClick={() => pickAddon(group, opt.sku)}
                                    className={`focus-ring ${optionRowClass(qty > 0)}`}
                                  >
                                    <RadioDot checked={qty > 0} />
                                    {name}
                                    {price}
                                  </button>
                                );
                              }
                              return (
                                <div key={opt.sku} className={optionRowClass(qty > 0)}>
                                  {name}
                                  {price}
                                  <div className="flex shrink-0 items-center gap-1">
                                    {qty > 0 && (
                                      <>
                                        <Button
                                          size="icon-sm"
                                          variant="outline"
                                          onClick={() => decAddon(opt.sku)}
                                          aria-label={t("decrease")}
                                          className="rounded-full"
                                        >
                                          <Minus size={14} />
                                        </Button>
                                        <span className="w-5 text-center text-sm font-bold text-gray-900 dark:text-white">
                                          {qty}
                                        </span>
                                      </>
                                    )}
                                    <Button
                                      size="icon-sm"
                                      variant={qty > 0 ? "default" : "outline"}
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        {!loading && !error && product && (
          <div className="border-t border-border bg-card p-4 sm:px-6">
            {isStoreClosed && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                <Moon
                  size={20}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
                />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    {t(vendorCopyKey("storeClosedTitle", vendorKind))}
                  </p>
                  <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-400/80">
                    {t(vendorCopyKey("storeClosedNotice", vendorKind))}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              {/* Quantity — beside the button, so it is never scrolled away */}
              <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border p-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label={t("decrease")}
                  className="rounded-xl"
                >
                  <Minus size={16} />
                </Button>
                <span className="w-6 text-center text-base font-bold text-gray-950 dark:text-white">
                  {quantity}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label={t("increase")}
                  className="rounded-xl"
                >
                  <Plus size={16} />
                </Button>
              </div>
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
                aria-disabled={missingRequired || undefined}
                className={`relative min-w-0 flex-1 gap-3 overflow-hidden rounded-2xl font-semibold active:scale-[0.98] ${
                  missingRequired
                    ? "bg-gray-200 text-gray-500 shadow-none hover:bg-gray-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    : `bg-linear-to-r from-primary to-primary-hover shadow-lg hover:from-primary-hover hover:to-[#b01254] ${cartLoading ? "" : "cart-cta"}`
                }`}
              >
                {!cartLoading && !missingRequired && (
                  <span className="cart-cta-shine" aria-hidden="true" />
                )}
                {cartLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="relative z-10 flex min-w-0 items-center gap-2">
                    <ShoppingCart size={20} className="shrink-0" />
                    {/* Long PT label on a phone: the words shorten, the price always shows. */}
                    <span className="truncate">{t("addToCart")}</span>
                    <span className="shrink-0">• {formatPrice(total, currency)}</span>
                  </span>
                )}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-neutral-400">
              {t("inclVat")} -&nbsp;{formatPrice(vatAmount, currency)}
              {depositPerItem > 0 && (
                <>
                  {" · "}
                  {t("sdrPlusDeposit")}&nbsp;{formatPrice(depositPerItem * quantity, currency)}
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Full-width option row (variations and add-ons), as in the mobile app. */
function optionRowClass(selected: boolean) {
  return `flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${
    selected
      ? "border-primary bg-primary/5 dark:border-pink-400 dark:bg-pink-950/20"
      : "border-gray-200 bg-card hover:bg-gray-50 dark:border-neutral-700 dark:hover:bg-neutral-800/60"
  }`;
}

/** The radio circle at the start of a single-choice row. */
function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
        checked ? "border-primary dark:border-pink-400" : "border-gray-300 dark:border-neutral-600"
      }`}
    >
      {checked && <span className="size-2.5 rounded-full bg-primary dark:bg-pink-400" />}
    </span>
  );
}
