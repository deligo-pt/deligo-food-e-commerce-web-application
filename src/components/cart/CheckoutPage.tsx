/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  MapPin,
  Loader2,
  Store,
  UtensilsCrossed,
  Check,
  ChevronRight,
  Clock,
} from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import Loader from "@/components/shared/Loader";
import { toast } from "sonner";
import { apiClient, getApiErrorKey, getApiErrorMessage } from "@/lib/apiClient";
import { CartResponse } from "@/types/cart";
import {
  getCartVendorId,
  getLineOriginalPrice,
  getLineTaxForQuantity,
  getLineTotalForQuantity,
  resolveAddonName,
} from "@/lib/cart";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { useCart } from "@/hooks/queries/useCart";
import { useVendorsCustomer } from "@/hooks/queries/useVendors";
import { activateOrder } from "@/lib/cartActivation";
import PickupTimePicker from "./PickupTimePicker";
import {
  formatTimeOfDay,
  getPickupWindow,
  isWithinWindow,
  toPickupIso,
  type TimeOfDay,
} from "@/lib/pickupTime";

interface CheckoutPageProps {
  vendorId: string;
}

// Recomputes an add-on line for a new quantity. Add-ons are tax-inclusive and
// carry their own rate, so the VAT is extracted from the gross rather than
// added on top — mirroring the backend's per-add-on figures.
function addonLineValues(addon: any, qty: number) {
  const lineTotal = (addon.unitPrice || 0) * qty;
  const rate = addon.taxRate ?? 0;
  const taxAmount = lineTotal - lineTotal / (1 + rate / 100);
  return { lineTotal, taxAmount };
}

// Flat sum of an add-ons array's gross total and embedded VAT. Add-ons are NOT
// multiplied by the product quantity — each carries its own quantity.
function sumAddons(addons: any[] | undefined | null) {
  if (!addons?.length) return { total: 0, tax: 0 };
  return addons.reduce(
    (acc, a) => {
      acc.total += a.lineTotal || 0;
      acc.tax += a.taxAmount || 0;
      return acc;
    },
    { total: 0, tax: 0 },
  );
}

export default function CheckoutPage({ vendorId }: CheckoutPageProps) {
  const { t } = useTranslation();
  const lang = useStore((s) => s.lang);
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse | null>(null);
  // Mirrors the latest optimistic cart so a debounced add-on sync can read the
  // current product-line quantity (add-to-cart SETs it) without capturing a
  // stale render's closure.
  const cartRef = useRef<CartResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  // Absolute target quantity per cart line while a debounced sync is pending.
  const pendingQtyRef = useRef<Record<string, number>>({});
  const syncTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const isSyncingRef = useRef<Record<string, boolean>>({});

  // The same debounce/optimistic machinery for add-on quantities, keyed by
  // line + add-on sku so one line's add-ons don't collide with another's.
  const pendingAddonQtyRef = useRef<Record<string, number>>({});
  const addonSyncTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const addonIsSyncingRef = useRef<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState("");
  const [isProceeding, setIsProceeding] = useState(false);

  // Self-pickup. `pickupTime` is held as a store-local wall-clock time rather
  // than an ISO string so that reopening the picker resumes on the time the
  // customer actually chose; the ISO is derived at submit, against the offset
  // in force then.
  const [isSelfPickup, setIsSelfPickup] = useState(false);
  // What the customer last confirmed. Read through `pickupTime` below, which
  // discards it once the window has moved past it.
  const [selectedPickupTime, setPickupTime] = useState<TimeOfDay | null>(null);
  const [showPickupPicker, setShowPickupPicker] = useState(false);

  // Shared, cached cart + vendor list — deduped with CartPage, Navbar, etc.
  const {
    data: cartData,
    isLoading: cartLoading,
    error: cartError,
    refetch: refetchCart,
  } = useCart<CartResponse>();
  const {
    data: vendorList = [],
    isLoading: vendorsLoading,
    error: vendorsError,
  } = useVendorsCustomer<any>();

  const vendor = useMemo(
    () =>
      vendorList.find((v: any) => v.id === vendorId || v._id === vendorId) ??
      null,
    [vendorList, vendorId],
  );

  /**
   * A coarse clock, so anything derived from "now" stays true on a page that is
   * left open.
   *
   * Thirty seconds is fine-grained enough that the earliest offered slot is
   * never more than half a minute stale, and coarse enough to be invisible.
   */
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClockTick((tick) => tick + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  /**
   * The times this store can be collected from today, or null when there are
   * none left.
   *
   * Recomputed as the clock moves, not once per vendor. It was originally
   * memoised on the vendor alone, on the reasoning that a moving window would
   * shift under a customer mid-choice — but that traded a real correctness
   * problem for a cosmetic one. A checkout page open for twenty minutes would
   * still offer the slot it computed on load, which by then is in the past, and
   * the customer only finds out when the backend rejects it.
   *
   * The window can only ever move forward, so the cost is that a slot the
   * customer was looking at occasionally disappears — which is exactly what has
   * happened to it.
   */
  const pickupWindow = useMemo(
    () =>
      getPickupWindow(
        vendor?.businessDetails?.openingHours,
        vendor?.businessDetails?.closingHours,
      ),
    // `clockTick` is the dependency that matters; `getPickupWindow` reads the
    // current time internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendor, clockTick],
  );

  /**
   * The chosen pickup time, or null once the advancing window has left it
   * behind.
   *
   * Derived rather than cleared by an effect. The picker normalises its own
   * draft while it is open, but this value outlives the sheet: a customer can
   * choose 14:20, switch tabs, and come back at 14:30 to a Proceed button that
   * looks ready and is not. Treating a stale time as no selection sends the row
   * back to "Select pickup time" so the choice is made again deliberately —
   * rather than silently rebooking them for a slot they never picked.
   */
  const pickupTime =
    selectedPickupTime && pickupWindow && isWithinWindow(selectedPickupTime, pickupWindow)
      ? selectedPickupTime
      : null;

  const loading = cartLoading || vendorsLoading;
  const error =
    cartError || vendorsError
      ? getApiErrorMessage(cartError || vendorsError, "Failed to load checkout")
      : "";

  const applyPendingUpdates = useCallback((cartData: CartResponse | null): CartResponse | null => {
    if (!cartData) return null;

    const updatedItems = cartData.items.map((cartItem) => {
      const key = cartItem.productId + "_" + (cartItem.variationSku || "default");
      const pendingQty = pendingQtyRef.current[key];

      // Re-apply any pending add-on quantities so an in-flight add-on edit
      // survives a refetch (dropping lines the user zeroed out).
      let addons = cartItem.addons;
      let addonsChanged = false;
      if (addons?.length) {
        const mapped = addons
          .map((a) => {
            const aKey = key + "_" + a.sku;
            const target = pendingAddonQtyRef.current[aKey];
            if (target === undefined || target === a.quantity) return a;
            addonsChanged = true;
            return { ...a, quantity: target, ...addonLineValues(a, target) };
          })
          .filter((a) => a.quantity > 0);
        if (mapped.length !== addons.length) addonsChanged = true;
        addons = mapped;
      }

      if (pendingQty === undefined && !addonsChanged) return cartItem;

      const pricing = cartItem.productPricing;
      const newQty = pendingQty === undefined
        ? cartItem.itemSummary.quantity
        : Math.max(1, pendingQty);

      const newTotalProductDiscount = pricing.productDiscountAmount * newQty;
      // Prices are tax-inclusive: the gross line total already contains the VAT,
      // so scale the line and extract the embedded tax rather than adding it on
      // top. Only the product's share scales with quantity — add-ons carry their
      // own — so the line is rebuilt from `grandTotal`, not `unitPrice * qty`.
      // Isolate the product's share from the *original* add-ons, then re-add the
      // (possibly edited) add-ons, so quantity and add-on edits compose.
      const origAddons = sumAddons(cartItem.addons);
      const productGross = getLineTotalForQuantity(cartItem, newQty) - origAddons.total;
      const productTax = getLineTaxForQuantity(cartItem, newQty) - origAddons.tax;
      const nextAddons = sumAddons(addons);

      return {
        ...cartItem,
        addons,
        itemSummary: {
          ...cartItem.itemSummary,
          quantity: newQty,
          totalProductDiscount: newTotalProductDiscount,
          totalTaxAmount: productTax + nextAddons.tax,
          grandTotal: productGross + nextAddons.total,
        },
      };
    });

    const totalItems = updatedItems.reduce(
      (sum, i) => sum + i.itemSummary.quantity,
      0,
    );

    return {
      ...cartData,
      items: updatedItems,
      totalItems,
    };
  }, []);

  // Seed the optimistic local cart from the cached query, re-applying any
  // pending (debounced) quantity deltas so in-flight edits survive a refetch.
  // A language switch just re-seeds with the newly-localized data in place.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(applyPendingUpdates(cartData ?? null));
  }, [cartData, applyPendingUpdates]);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    const timeouts = syncTimeoutRef.current;
    const addonTimeouts = addonSyncTimeoutRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
      Object.values(addonTimeouts).forEach(clearTimeout);
    };
  }, []);
  const vendorItems = useMemo(() => {
    return (
      cart?.items.filter(
        (item) => getCartVendorId(item.vendorId) === vendorId && item.isActive === true,
      ) || []
    );
  }, [cart, vendorId]);

  /** This store's lines that exist but are switched off. */
  const inactiveVendorItems = useMemo(() => {
    return (
      cart?.items.filter(
        (item) => getCartVendorId(item.vendorId) === vendorId && item.isActive !== true,
      ) || []
    );
  }, [cart, vendorId]);

  /**
   * Last line of defence against a half-selected order reaching this page.
   *
   * The list above only prices *active* lines, which is the same rule the
   * backend applies to `useCart: true` — so a store whose group is half on and
   * half off silently loses the switched-off products between the cart page and
   * the order summary. Adding a product repairs the group at the source now,
   * but nothing stops the cart arriving in that state from somewhere this app
   * does not control: the mobile app, another tab, a second device.
   *
   * So the page repairs it once and re-reads. Guarded by a ref rather than
   * state: this must never become a loop, and one attempt per mount is enough —
   * if it fails, the page still renders and the cart page's Activate button is
   * one step back.
   */
  const hasRepairedGroupRef = useRef(false);
  useEffect(() => {
    if (hasRepairedGroupRef.current) return;
    if (!vendorId || vendorItems.length === 0 || inactiveVendorItems.length === 0) return;

    hasRepairedGroupRef.current = true;
    void (async () => {
      try {
        await activateOrder(vendorId);
        await refetchCart();
      } catch {
        // Nobody asked for this, so it fails quietly. The summary still shows
        // the active lines, which is what checkout would have charged anyway.
      }
    })();
  }, [vendorId, vendorItems.length, inactiveVendorItems.length, refetchCart]);

  const summary = useMemo(() => {
    return vendorItems.reduce(
      (acc, item) => {
        // Includes the line's add-ons, matching the basis `grandTotal` (and the
        // backend's totalOriginalPrice) uses. Without them "Total Price -
        // Discount" comes out short of the amount actually due.
        acc.originalPrice += getLineOriginalPrice(item);
        acc.discount += item.itemSummary.totalProductDiscount;
        acc.tax += item.itemSummary.totalTaxAmount;
        acc.total += item.itemSummary.grandTotal;
        return acc;
      },
      { originalPrice: 0, discount: 0, tax: 0, total: 0 },
    );
  }, [vendorItems]);

  const executeSync = async (key: string, item: any) => {
    const targetQty = pendingQtyRef.current[key];
    if (targetQty === undefined) return;

    delete syncTimeoutRef.current[key];

    isSyncingRef.current[key] = true;

    // Consume the pending target; a click during the in-flight request sets a
    // fresh target and re-triggers the sync from the finally block below.
    delete pendingQtyRef.current[key];

    try {
      // add-to-cart now SETs the line to the exact quantity, so we send the
      // absolute target the user landed on after they stopped clicking.
      const payload: any = {
        items: [
          {
            productId: item.productId,
            quantity: targetQty,
          },
        ],
      };
      if (item.variationSku && item.variationSku !== null) {
        payload.items[0].variationSku = item.variationSku;
      }

      await apiClient.post("/carts/add-to-cart", payload);

      await refetchCart();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to sync cart updates"));
      await refetchCart();
    } finally {
      isSyncingRef.current[key] = false;
      if (pendingQtyRef.current[key] !== undefined) {
        triggerSync(key, item);
      }
    }
  };

  const triggerSync = (key: string, item: any) => {
    if (isSyncingRef.current[key]) return;

    if (syncTimeoutRef.current[key]) {
      clearTimeout(syncTimeoutRef.current[key]);
    }

    syncTimeoutRef.current[key] = setTimeout(() => {
      executeSync(key, item);
    }, 500);
  };

  const updateQuantity = (
    item: any,
    action: "increment" | "decrement",
  ) => {
    const key = item.productId + "_" + (item.variationSku || "default");
    const change = action === "increment" ? 1 : -1;
    const currentQty = item.itemSummary.quantity;
    const newQty = currentQty + change;

    if (newQty < 1) return;

    setCart((prevCart) => {
      if (!prevCart) return null;
      const updatedItems = prevCart.items.map((cartItem) => {
        const itemKey = cartItem.productId + "_" + (cartItem.variationSku || "default");
        if (itemKey === key) {
          const pricing = cartItem.productPricing;
          const newTotalProductDiscount = pricing.productDiscountAmount * newQty;
          // Tax-inclusive. Only the product's share scales with quantity —
          // add-ons carry their own — so rebuild the line from `grandTotal`
          // rather than `unitPrice * qty`, and keep each add-on's own VAT rate.
          const newGrandTotal = getLineTotalForQuantity(cartItem, newQty);
          const newTotalTaxAmount = getLineTaxForQuantity(cartItem, newQty);

          return {
            ...cartItem,
            itemSummary: {
              ...cartItem.itemSummary,
              quantity: newQty,
              totalProductDiscount: newTotalProductDiscount,
              totalTaxAmount: newTotalTaxAmount,
              grandTotal: newGrandTotal,
            },
          };
        }
        return cartItem;
      });

      const totalItems = updatedItems.reduce(
        (sum, i) => sum + i.itemSummary.quantity,
        0,
      );

      return {
        ...prevCart,
        items: updatedItems,
        totalItems,
      };
    });

    // 2. Record the absolute target quantity and queue the debounced sync
    pendingQtyRef.current[key] = newQty;
    triggerSync(key, item);
  };

  const executeAddonSync = async (aKey: string, item: any, addon: any) => {
    const targetQty = pendingAddonQtyRef.current[aKey];
    if (targetQty === undefined) return;

    delete addonSyncTimeoutRef.current[aKey];
    addonIsSyncingRef.current[aKey] = true;
    delete pendingAddonQtyRef.current[aKey];

    try {
      // add-to-cart is the add-on write path now (update-addon-quantity is
      // retired). It SETs each add-on's absolute quantity (0 removes it), MERGES
      // by optionSku so untouched add-ons on the line survive, and SETs the
      // product-line quantity — which is [Required] — so we must resend the
      // line's current quantity (a pending qty edit, else the live cart value)
      // to avoid resetting it.
      const key = item.productId + "_" + (item.variationSku || "default");
      const liveItem = cartRef.current?.items.find(
        (ci) => ci.productId + "_" + (ci.variationSku || "default") === key,
      );
      const productQty = Math.max(
        1,
        pendingQtyRef.current[key] ??
          liveItem?.itemSummary?.quantity ??
          item.itemSummary?.quantity ??
          1,
      );

      const payload: any = {
        items: [
          {
            productId: item.productId,
            quantity: productQty,
            addons: [{ optionSku: addon.sku, quantity: targetQty }],
          },
        ],
      };
      if (item.variationSku) {
        payload.items[0].variationSku = item.variationSku;
      }

      await apiClient.post("/carts/add-to-cart", payload);

      await refetchCart();
    } catch (error) {
      // The backend enforces each add-on group's max (e.g. "You can select a
      // maximum of 2 items for Cheese"); surface its message and revert the
      // optimistic bump via the refetch below.
      toast.error(getApiErrorMessage(error, t("failedToUpdateAddon")));
      await refetchCart();
    } finally {
      addonIsSyncingRef.current[aKey] = false;
      if (pendingAddonQtyRef.current[aKey] !== undefined) {
        triggerAddonSync(aKey, item, addon);
      }
    }
  };

  const triggerAddonSync = (aKey: string, item: any, addon: any) => {
    if (addonIsSyncingRef.current[aKey]) return;

    if (addonSyncTimeoutRef.current[aKey]) {
      clearTimeout(addonSyncTimeoutRef.current[aKey]);
    }

    addonSyncTimeoutRef.current[aKey] = setTimeout(() => {
      executeAddonSync(aKey, item, addon);
    }, 400);
  };

  const updateAddonQuantity = (
    item: any,
    addon: any,
    action: "increment" | "decrement",
  ) => {
    const key = item.productId + "_" + (item.variationSku || "default");
    const aKey = key + "_" + addon.sku;
    const newAddonQty = addon.quantity + (action === "increment" ? 1 : -1);
    // Zero removes the add-on (the API drops it); never go negative.
    if (newAddonQty < 0) return;

    setCart((prevCart) => {
      if (!prevCart) return null;
      const updatedItems = prevCart.items.map((cartItem) => {
        const itemKey =
          cartItem.productId + "_" + (cartItem.variationSku || "default");
        if (itemKey !== key) return cartItem;

        // Isolate the product's share from the *current* add-ons, then swap in
        // the edited add-ons (dropping any zeroed out) and re-add their totals.
        const curAddons = sumAddons(cartItem.addons);
        const productGross = cartItem.itemSummary.grandTotal - curAddons.total;
        const productTax = cartItem.itemSummary.totalTaxAmount - curAddons.tax;

        const nextAddonsList = (cartItem.addons || [])
          .map((a) =>
            a.sku === addon.sku
              ? { ...a, quantity: newAddonQty, ...addonLineValues(a, newAddonQty) }
              : a,
          )
          .filter((a) => a.quantity > 0);
        const nextAddons = sumAddons(nextAddonsList);

        return {
          ...cartItem,
          addons: nextAddonsList,
          itemSummary: {
            ...cartItem.itemSummary,
            totalTaxAmount: productTax + nextAddons.tax,
            grandTotal: productGross + nextAddons.total,
          },
        };
      });

      return { ...prevCart, items: updatedItems };
    });

    pendingAddonQtyRef.current[aKey] = newAddonQty;
    triggerAddonSync(aKey, item, addon);
  };

  const deleteItem = async (item: any) => {
    try {
      setDeletingItem(item.productId);

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

      await refetchCart();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to remove item"));
    } finally {
      setDeletingItem(null);
    }
  };

  const handleProceedToCheckout = async () => {
    if (!vendorId) {
      toast.error(t("vendorInfoMissing"));
      return;
    }

    // The store closed while the page sat open. Opening the picker would be a
    // dead end — it has no valid rows to offer — so say what happened and drop
    // back to delivery rather than leaving the customer stuck on a button that
    // cannot succeed.
    if (isSelfPickup && !pickupWindow) {
      toast.error(t("storeClosedForPickup"));
      setIsSelfPickup(false);
      return;
    }

    // Catch the missing time here rather than letting the backend answer with
    // its generic Zod wrapper ("Validation failed. Please check the highlighted
    // fields"), which names no field and gives the customer nothing to act on.
    if (isSelfPickup && !pickupTime) {
      toast.error(t("pickupTimeRequired"));
      setShowPickupPicker(true);
      return;
    }

    try {
      setIsProceeding(true);

      // Delivery sends exactly what it always sent — both pickup keys are
      // omitted, not sent as null, so the existing path is provably untouched.
      const response = await apiClient.post("/checkout", {
        useCart: true,
        ...(isSelfPickup && pickupTime
          ? { fulfillmentType: "PICKUP", pickupTime: toPickupIso(pickupTime) }
          : {}),
      });
      const checkoutId = response.data.data._id;
      // Redirect to payment page under the same vendor route
      router.push(
        `/cart/checkout/${vendorId}/payment?checkoutId=${checkoutId}`,
      );
    } catch (error) {
      // These two mean the chosen time has become invalid — the slot passed
      // while the page sat open, or the store closed. Clearing it and
      // reopening the picker is the only useful next step; leaving the stale
      // value in place would let the customer press the button again and get
      // the same rejection. Branching on errorKey, never on message text.
      const errorKey = getApiErrorKey(error);
      if (
        errorKey === "PICKUP_TIME_MUST_BE_IN_FUTURE" ||
        errorKey === "PICKUP_TIME_OUTSIDE_STORE_HOURS" ||
        errorKey === "PICKUP_TIME_MUST_BE_TODAY" ||
        errorKey === "INVALID_PICKUP_TIME"
      ) {
        setPickupTime(null);
        setShowPickupPicker(true);
      }

      // The pickup rejections arrive already translated, so the server's own
      // wording is the right thing to show — `PICKUP_TIME_OUTSIDE_STORE_HOURS`
      // even names the store's hours.
      toast.error(
        getApiErrorMessage(error, "Failed to create checkout session"),
      );
    } finally {
      setIsProceeding(false);
    }
  };

  const handleToggleSelfPickup = () => {
    setIsSelfPickup((wasSelected) => {
      const isNowSelected = !wasSelected;
      // Drop any chosen time when switching back to delivery, so re-ticking
      // the box never silently reuses a slot that has since passed.
      if (!isNowSelected) setPickupTime(null);
      // Going straight into the picker saves a second click: choosing pickup
      // without a time is not a state the customer can check out from.
      if (isNowSelected && !pickupTime) setShowPickupPicker(true);
      return isNowSelected;
    });
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-8 bg-[#f8f9fa] dark:bg-neutral-950 min-h-screen">
        <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-6 text-red-500 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const vendorImage =
    vendor?.documents?.storePhoto?.[0] ||
    vendor?.storePhoto?.[0] ||
    "https://placehold.co/400x400?text=No+Image";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-neutral-50">
        {t("reviewYourCart")}
      </h1>
      <p className="mt-2 text-gray-500 dark:text-neutral-400">{t("completeOrderDetails")}</p>

      <div className="mt-8 mb-8 overflow-hidden rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
        <div className="p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-gray-100 dark:bg-neutral-800">
              <SafeImage
                src={vendorImage}
                alt={vendor?.businessDetails?.businessName || "Store"}
                sizes="96px"
                fallbackIcon={<Store className="h-8 w-8" />}
              />
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-neutral-50">
                {vendor?.businessDetails?.businessName || "Store"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-pink-50 dark:bg-pink-950/30 px-3 py-2 text-[#f9186b] dark:text-pink-400">
                  <ShoppingBag size={16} />
                  <span className="font-medium">
                    {vendorItems.length} {t("products")}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 px-3 py-2 text-green-600 dark:text-green-400">
                  <MapPin size={16} />
                  <span className="font-medium">{t("deliveryAvailable")}</span>
                </div>
              </div>
            </div>

            {vendor?.userId && (
              <Link
                href={`/vendors/${vendor.userId}`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#f9186b] px-5 py-2.5 text-sm font-semibold text-[#f9186b] transition-colors hover:bg-[#f9186b] hover:text-white dark:border-pink-500 dark:text-pink-400 dark:hover:bg-pink-600 dark:hover:text-white"
              >
                <Plus size={16} />
                {t("addMoreItems")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {vendorItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-neutral-50">{t("noProductsFound")}</h3>
              <p className="mt-2 text-gray-500 dark:text-neutral-400">{t("vendorHasNoProducts")}</p>
            </div>
          ) : (
            vendorItems.map((item) => (
              <div
                key={`${item.productId}-${item.variationSku ?? "default"}`}
                className="overflow-hidden rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm"
              >
                <div className="p-5">
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="relative h-28 w-full overflow-hidden rounded-2xl sm:w-28 bg-gray-100 dark:bg-neutral-800">
                      <SafeImage
                        src={item.image}
                        alt={item.name}
                        sizes="112px"
                        fallbackIcon={<UtensilsCrossed className="h-10 w-10" />}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-neutral-50">
                            {item.name}
                          </h3>
                          {item.variationSku && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                              {t("sku")}: {item.variationSku}
                            </p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <ul className="mt-3 space-y-2">
                              {item.addons.map((addon) => (
                                <li
                                  key={addon.sku}
                                  className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50 px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-gray-700 dark:text-neutral-300">
                                      <span className="text-[#f9186b] dark:text-pink-400">+ </span>
                                      {resolveAddonName(addon.name, lang)}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-neutral-500">
                                      €{addon.unitPrice.toFixed(2)} × {addon.quantity}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 items-center rounded-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                                    <button
                                      type="button"
                                      aria-label={t("decreaseQuantity")}
                                      onClick={() => updateAddonQuantity(item, addon, "decrement")}
                                      className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 transition hover:bg-gray-100 dark:hover:bg-neutral-800 active:scale-90"
                                    >
                                      {addon.quantity <= 1 ? (
                                        <Trash2 size={13} />
                                      ) : (
                                        <Minus size={13} />
                                      )}
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-neutral-50">
                                      {addon.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={t("increaseQuantity")}
                                      onClick={() => updateAddonQuantity(item, addon, "increment")}
                                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f9186b] text-white transition hover:bg-[#d4145b] active:scale-90"
                                    >
                                      <Plus size={13} />
                                    </button>
                                  </div>
                                  <span className="w-14 shrink-0 text-right text-sm font-semibold text-gray-900 dark:text-neutral-50">
                                    €{addon.lineTotal.toFixed(2)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <button
                          onClick={() => deleteItem(item)}
                          disabled={deletingItem === item.productId}
                          className="rounded-xl p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        >
                          {deletingItem === item.productId ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center rounded-2xl border border-gray-200 dark:border-neutral-800">
                          <button
                            onClick={() => updateQuantity(item, "decrement")}
                            className="p-3 transition hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                          >
                            <Minus size={16} />
                          </button>
                          <div className="min-w-15 text-center font-bold text-gray-900 dark:text-neutral-50">
                            {item.itemSummary.quantity}
                          </div>

                          <button
                            onClick={() => updateQuantity(item, "increment")}
                            className="p-3 transition hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-neutral-300"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="text-right">
                          {/* Only a genuine saving gets a strikethrough, and it
                              compares like with like — both sides include the
                              line's add-ons. */}
                          {getLineOriginalPrice(item) >
                            item.itemSummary.grandTotal + 0.005 && (
                            <p className="text-sm text-gray-400 dark:text-neutral-500 line-through">
                              €{getLineOriginalPrice(item).toFixed(2)}
                            </p>
                          )}
                          <p className="text-2xl font-bold text-[#f9186b] dark:text-pink-400">
                            €{item.itemSummary.grandTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-24 overflow-hidden rounded-3xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
            <div className="border-b border-gray-100 dark:border-neutral-800 p-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-neutral-50">
                {t("orderSummary")}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                {t("reviewOrderDetails")}
              </p>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-400">{t("totalPrice")}</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-50">
                  €{summary.originalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-400">{t("discount")}</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  -€{summary.discount.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-dashed border-gray-200 dark:border-neutral-800 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-xl font-bold text-gray-900 dark:text-neutral-50">
                      {t("finalPrice")}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-neutral-400">
                      ({t("inclTax")} -&nbsp;€{summary.tax.toFixed(2)})
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-3xl font-extrabold text-[#f9186b] dark:text-pink-400">
                    €{summary.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Self-pickup sits between the summary and the instructions, the
                same slot the mobile app puts it in. */}
            <div className="border-t border-gray-100 dark:border-neutral-800 p-6">
              <button
                type="button"
                onClick={handleToggleSelfPickup}
                disabled={!pickupWindow}
                aria-pressed={isSelfPickup}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelfPickup
                    ? "border-[#f9186b] bg-pink-50/50 dark:border-pink-400 dark:bg-pink-950/20"
                    : "border-gray-200 dark:border-neutral-800"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                    isSelfPickup
                      ? "border-[#f9186b] bg-[#f9186b] dark:border-pink-400 dark:bg-pink-500"
                      : "border-gray-300 dark:border-neutral-600"
                  }`}
                >
                  {isSelfPickup && <Check size={14} strokeWidth={3} className="text-white" />}
                </span>

                <span className="min-w-0 flex-1 font-semibold text-gray-900 dark:text-neutral-50">
                  {t("selfPickup")}
                </span>

                <Store
                  size={20}
                  className={`shrink-0 ${
                    isSelfPickup
                      ? "text-[#f9186b] dark:text-pink-400"
                      : "text-gray-400 dark:text-neutral-500"
                  }`}
                />
              </button>

              {/* No window means the store has already closed for today, so the
                  option is offered but not actionable. Saying why beats a
                  disabled control with no explanation. */}
              {!pickupWindow && (
                <p className="mt-2 text-xs text-gray-500 dark:text-neutral-400">
                  {t("storeClosedForPickup")}
                </p>
              )}

              {isSelfPickup && pickupWindow && (
                <button
                  type="button"
                  onClick={() => setShowPickupPicker(true)}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[#f9186b] p-4 text-left transition hover:bg-pink-50/50 dark:border-pink-400 dark:hover:bg-pink-950/20"
                >
                  <Clock size={18} className="shrink-0 text-[#f9186b] dark:text-pink-400" />
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      pickupTime
                        ? "font-semibold text-gray-900 dark:text-neutral-50"
                        : "text-gray-500 dark:text-neutral-400"
                    }`}
                  >
                    {/* Composed in JSX, not interpolated: t() takes a single
                        key and has no placeholder support. */}
                    {pickupTime
                      ? `${t("today")}  ${formatTimeOfDay(pickupTime)}`
                      : t("selectPickupTime")}
                  </span>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-gray-400 dark:text-neutral-500"
                  />
                </button>
              )}
            </div>

            {/* Hidden for pickup: the placeholder reads "Leave at door, ring
                bell twice", which describes a courier who does not exist on a
                collected order. `instructions` is local-only state and is not
                sent to /checkout, so nothing is lost by dropping it here. */}
            {!isSelfPickup && (
              <div className="border-t border-gray-100 dark:border-neutral-800 p-6">
                <label className="mb-2 block font-semibold text-gray-900 dark:text-neutral-50">
                  {t("deliveryInstructions")}
                </label>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={t("deliveryInstructionsPlaceholder")}
                  className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 outline-none transition focus:border-pink-500 dark:focus:border-pink-400 text-gray-900 dark:text-neutral-50 placeholder:text-gray-400 dark:placeholder:text-neutral-600"
                />
              </div>
            )}

            <div className="border-t border-gray-100 dark:border-neutral-800 p-6">
              <button
                onClick={handleProceedToCheckout}
                disabled={isProceeding || vendorItems.length === 0}
                className={`relative w-full overflow-hidden rounded-2xl bg-[#f9186b] py-4 text-lg font-semibold text-white transition hover:bg-[#d4145b] disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500 ${
                  !isProceeding && vendorItems.length > 0 ? "cart-cta" : ""
                }`}
              >
                {!isProceeding && vendorItems.length > 0 && (
                  <span className="cart-cta-shine" aria-hidden="true" />
                )}
                <span className="relative z-10">
                  {isProceeding ? t("processing") : t("proceedToCheckout")}
                </span>
              </button>
              <p className="mt-3 text-center text-xs text-gray-400 dark:text-neutral-500">
                {t("termsAndConditions")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPickupPicker && pickupWindow && (
        <PickupTimePicker
          window={pickupWindow}
          value={pickupTime}
          onConfirm={(time) => {
            setPickupTime(time);
            setShowPickupPicker(false);
          }}
          onClose={() => setShowPickupPicker(false)}
        />
      )}
    </div>
  );
}