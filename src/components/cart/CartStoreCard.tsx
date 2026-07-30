// /* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  Star,
  UtensilsCrossed,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import CartProductRow from "./CartProductRow";
import { useTranslation } from "@/hooks/useTranslation";
import SafeImage from "@/components/shared/SafeImage";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { activateOrder } from "@/lib/cartActivation";
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
   * Every product of this store, in the shape `/carts/delete-item` expects.
   * Built by the page, which holds the raw cart, so the card doesn't have to
   * know the endpoint's null-vs-omitted rule for `variationSku`.
   */
  deleteTargets: { productId: string; variationSku?: string }[];
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
  deleteTargets,
  onCartChanged,
}: CartStoreCardProps) {
  const { t } = useTranslation();
  const [isToggling, setIsToggling] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const togglingRef = useRef(false);
  const deletingRef = useRef(false);

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
   * Select this whole store for checkout.
   *
   * The backend enforces vendor lock-in: only one store's items can be active at
   * a time, so selection belongs here rather than on individual products. There
   * is no matching deselect — the button only exists on an order that isn't
   * selected, and choosing another order is how the selection moves. That makes
   * `activateOrder` responsible for switching the previous one off, since the
   * server rejects a second active vendor outright.
   */
  const handleActivateStore = async () => {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setIsToggling(true);

    try {
      await activateOrder(vendorId);
      toast.success(t("storeSelectedToast").replace("{store}", businessName));
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

  /**
   * Delete this store's whole basket, not one product.
   *
   * `/carts/delete-item` takes an array, so the entire order goes in a single
   * request — no per-product loop that could half-succeed and leave a basket
   * the customer thought they had thrown away.
   */
  const handleDeleteStore = async () => {
    setIsConfirmOpen(false);
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);

    try {
      await apiClient.delete("/carts/delete-item", { data: deleteTargets });
      toast.success(t("orderDeletedToast").replace("{store}", businessName));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("couldNotDeleteOrder")));
    } finally {
      // No exclusion here: this order is gone, so it can't be the one the
      // auto-activate rule picks.
      await onCartChanged();
      setIsDeleting(false);
      deletingRef.current = false;
    }
  };

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition-colors duration-200 sm:p-6">
      {/* Actions get their own row above the identity block. They used to be
          pinned to the card's top-right corner, which worked while the control
          was a 56px switch; a captioned button plus a delete button is wide
          enough to reach the centred avatar on a narrow screen. */}
      <div className="mb-3 flex items-center justify-end gap-2">
        {/* Store selection — only one store can be checked out at a time.
            Present only on an order that isn't selected, and it says one thing:
            Activate. The order that *is* selected has nothing to press; the
            "Selected" chip below states it, and the selection moves by
            activating a different order. */}
        {!hasActive && (
          <button
            type="button"
            onClick={handleActivateStore}
            disabled={isToggling || isDeleting}
            aria-label={t("activateOrderTooltip")}
            title={t("activateOrderTooltip")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 dark:bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-green-600 dark:hover:bg-green-700 disabled:opacity-60 cursor-pointer"
          >
            {isToggling && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("activateOrder")}
          </button>
        )}

        {/* Removes the whole order, unlike the per-product bin in each row. */}
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          disabled={isDeleting || isToggling}
          aria-label={t("deleteOrder")}
          title={t("deleteOrder")}
          className="rounded-full p-2 text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 cursor-pointer"
        >
          {isDeleting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Trash2 className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Store identity — avatar, name and meta, centred as a column. */}
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-pink-100 dark:border-pink-950 sm:h-20 sm:w-20">
          <SafeImage
            src={image}
            alt={businessName}
            sizes="(min-width: 640px) 80px, 64px"
            fallbackIcon={<UtensilsCrossed className="h-6 w-6" />}
          />
        </div>

        {/* Wraps rather than truncating — centred text has the full card width
            to work with, and the action row above is out of its way entirely. */}
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
              : "cursor-not-allowed bg-gray-400 dark:bg-neutral-750"
          }`}
        >
          {hasActive && <span className="cart-cta-shine" aria-hidden="true" />}
          <span className="relative z-10 min-w-0 truncate text-base font-bold sm:text-xl">
            {t("goToCheckout")}
          </span>
          {/* Bare price: no pill behind it and no rule in front of it. The
              caption truncates and this doesn't, so the gap between them is
              what keeps the two apart. */}
          <span className="relative z-10 shrink-0 font-bold">
            €{activeTotal.toFixed(2)}
          </span>
        </Link>
        {!hasActive && (
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-neutral-400">
            {t("selectStoreToCheckout")}
          </p>
        )}
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteOrder")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteOrderConfirm").replace("{store}", businessName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmOpen(false)}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStore}>
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
