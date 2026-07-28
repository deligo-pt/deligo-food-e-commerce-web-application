// /* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  Star,
  UtensilsCrossed,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import CartProductRow from "./CartProductRow";
import { useTranslation } from "@/hooks/useTranslation";
import SafeImage from "@/components/shared/SafeImage";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

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
  /** True when the cart holds more than one store — enables collapsing. */
  collapsible?: boolean;
  /**
   * Re-read the cart from the server. Called after every mutation in this
   * subtree, including the ones that failed — see `CartPage.resyncCart`.
   */
  onCartChanged: () => Promise<void>;
}

export default function CartStoreCard({
  vendorId,
  businessName,
  image,
  rating,
  items,
  collapsible = false,
  onCartChanged,
}: CartStoreCardProps) {
  const { t } = useTranslation();
  const [isToggling, setIsToggling] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const togglingRef = useRef(false);

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
  const storeTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.itemSummary.grandTotal, 0),
    [items],
  );

  /**
   * Select or deselect this whole store.
   *
   * The backend enforces vendor lock-in: only one store's items can be active
   * at a time, so selection belongs here rather than on individual products.
   * `VENDOR_BULK` flips every item for this vendor in one call; activating a
   * second store while another is selected is rejected server-side, and that
   * message is surfaced as-is.
   */
  const handleToggleStore = async () => {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setIsToggling(true);

    try {
      await apiClient.patch("/carts/toggle-item-status", {
        toggleMode: "VENDOR_BULK",
        vendorId,
      });
      toast.success(
        (hasActive ? t("storeDeselectedToast") : t("storeSelectedToast")).replace(
          "{store}",
          businessName,
        ),
      );
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, t("couldNotChangeStoreSelection")),
      );
    } finally {
      // Both paths, not just the successful one: a rejected toggle is often the
      // server saying this cart no longer looks the way the page thinks it does.
      await onCartChanged();
      setIsToggling(false);
      togglingRef.current = false;
    }
  };

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-colors duration-200 sm:p-6">
      {/* Store header — the vendor's identity (avatar, name, meta) is centred as
          a column. The toggle is an action rather than part of that identity, so
          it is pinned out of flow: left in the row it would consume width on one
          side only and push the "centred" content visibly off-axis. */}
      <div className="relative mb-5 flex flex-col items-center text-center">
        {/* Store selection — only one store can be checked out at a time */}
        <button
          type="button"
          role="switch"
          onClick={handleToggleStore}
          disabled={isToggling}
          aria-checked={hasActive}
          aria-label={
            hasActive ? t("storeSelected") : t("selectStoreForCheckout")
          }
          title={hasActive ? t("storeSelected") : t("selectStoreForCheckout")}
          className={`absolute right-0 top-0 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-60 cursor-pointer ${
            hasActive
              ? "bg-green-500 dark:bg-green-600"
              : "bg-gray-300 dark:bg-neutral-700"
          }`}
        >
          {/* Icon sits on the side opposite the knob */}
          <span
            className={`absolute flex items-center text-white transition-all duration-200 ${
              hasActive ? "left-2" : "right-2"
            }`}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasActive ? (
              <Check className="h-4 w-4" strokeWidth={3} />
            ) : (
              <X className="h-4 w-4" strokeWidth={3} />
            )}
          </span>
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ${
              hasActive ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>

        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-pink-100 dark:border-pink-950 sm:h-20 sm:w-20">
          <SafeImage
            src={image}
            alt={businessName}
            sizes="(min-width: 640px) 80px, 64px"
            fallbackIcon={<UtensilsCrossed className="h-6 w-6" />}
          />
        </div>

        {/* Wraps rather than truncating — centred text has the full card width
            to work with, and the name clears the pinned toggle vertically (the
            toggle is 32px tall at the top; this sits below a 64px avatar). */}
        <h3 className="mt-3 max-w-full break-words text-lg font-bold text-gray-900 dark:text-neutral-100 sm:text-2xl">
          {businessName}
        </h3>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/20 px-2.5 py-1.5">
            <Star size={14} className="fill-yellow-500 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
              {rating > 0 ? rating.toFixed(1) : t("new")}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-pink-50 dark:bg-pink-950/20 px-2.5 py-1.5">
            <UtensilsCrossed size={14} className="text-[#f9186b] dark:text-pink-400" />
            <span className="text-sm font-semibold text-[#f9186b] dark:text-pink-400">
              {items.length} {t("items")} · €{storeTotal.toFixed(2)}
            </span>
          </div>
          <span
            className={`rounded-xl px-2.5 py-1.5 text-sm font-semibold ${
              hasActive
                ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400"
            }`}
          >
            {hasActive ? t("storeSelected") : t("storeNotSelected")}
          </span>
        </div>
      </div>

      {/* Collapse control — only worth offering when the cart has more than one
          store, since that's when the page gets long enough to need it. */}
      {collapsible && (
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-expanded={!isCollapsed}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-neutral-800 py-2 text-sm font-semibold text-gray-600 dark:text-neutral-400 transition hover:border-[#f9186b] hover:text-[#f9186b] dark:hover:text-pink-400 cursor-pointer"
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="h-4 w-4" />
              {t("showProducts")}
            </>
          ) : (
            <>
              <ChevronUp className="h-4 w-4" />
              {t("hideProducts")}
            </>
          )}
        </button>
      )}

      {/* Product list */}
      {isCollapsed ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={`${item.productId}-${item.variationSku ?? "default"}-chip`}
              className="max-w-full truncate rounded-xl bg-gray-100 dark:bg-neutral-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-neutral-300"
            >
              {item.itemSummary.quantity}× {item.name}
            </span>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <CartProductRow
              key={`${item.productId}-${item.variationSku ?? "default"}`}
              item={item}
              onCartChanged={onCartChanged}
            />
          ))}
        </div>
      )}

      {/* Store checkout button – enabled if at least one active item */}
      <div className="mt-6">
        <Link
          href={hasActive ? `/cart/checkout/${vendorId}` : "#"}
          onClick={(e) => {
            if (!hasActive) {
              e.preventDefault();
              toast.error(t("selectStoreToCheckout"));
            }
          }}
          className={`relative flex items-center justify-between gap-3 overflow-hidden rounded-3xl px-4 py-4 text-white transition cursor-pointer sm:px-6 sm:py-5 ${
            hasActive
              ? "cart-cta bg-linear-to-r from-[#f9186b] to-[#d4145b] hover:from-[#d4145b] hover:to-[#b01254]"
              : "cursor-not-allowed bg-gray-400 dark:bg-neutral-750 text-neutral-200 dark:text-neutral-400"
          }`}
        >
          {hasActive && <span className="cart-cta-shine" aria-hidden="true" />}
          <span className="relative z-10 min-w-0 truncate text-base font-bold sm:text-xl">
            {t("goToCheckout")}
          </span>
          <div className="relative z-10 shrink-0 rounded-xl bg-white/20 px-3 py-1.5 font-bold sm:px-4 sm:py-2">
            €{activeTotal.toFixed(2)}
          </div>
        </Link>
        {!hasActive && (
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-neutral-400">
            {t("selectStoreToCheckout")}
          </p>
        )}
      </div>
    </div>
  );
}
