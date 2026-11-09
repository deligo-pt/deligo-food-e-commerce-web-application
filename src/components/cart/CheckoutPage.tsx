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
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Truck,
  CalendarClock,
} from "lucide-react";
import axios from "axios";
import { callPaymentAction } from "@/services/paymentActionApi";
import { orderTrackingPath, paymentPagePath } from "@/lib/paymentAction";
import SafeImage from "@/components/shared/SafeImage";
import ProductImage from "@/components/shared/ProductImage";
import Loader from "@/components/shared/Loader";
import { toast } from "sonner";
import {
  MAX_RIDER_INSTRUCTIONS,
  MAX_VENDOR_INSTRUCTIONS,
  checkoutNotesBody,
} from "@/lib/deliveryNotes";
import { getVendorKind, vendorCopyKey } from "@/lib/vendorKind";
import {
  apiClient,
  getApiErrorKey,
  getApiErrorMessage,
  getApiErrorPath,
} from "@/lib/apiClient";
import { CartResponse } from "@/types/cart";
import {
  getCartVendorDetails,
  getCartVendorId,
  getCartVendorPhoto,
  getLineOriginalPrice,
  getLineVatForQuantity,
  getLineTotalForQuantity,
  resolveAddonName,
} from "@/lib/cart";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { useCart } from "@/hooks/queries/useCart";
import { useCartAddonGroups } from "@/hooks/queries/useCartAddonGroups";
import {
  addonGroupMinimum,
  addonsPayload,
  isAddonDecrementBlocked,
} from "@/lib/requiredAddons";
import { useVendorsCustomer } from "@/hooks/queries/useVendors";
import { activateOrder } from "@/lib/cartActivation";
import { vendorHref, vendorRouteId } from "@/lib/vendorId";
import { useVendorCardTitle } from "@/hooks/useVendorCardTitle";
import SlotPicker from "./SlotPicker";
import SmallOrderFeeNudge from "./SmallOrderFeeNudge";
import FirstOrderTeaser from "./FirstOrderTeaser";
import { smallOrderFeeNudge } from "@/lib/smallOrderFee";
import { useQueryClient } from "@tanstack/react-query";
import { checkoutSlotKeys } from "@/hooks/queries/useCheckoutSlots";
import { useSlotChoice } from "@/hooks/useSlotChoice";
import { useAvailabilityRefresh } from "@/hooks/useAvailabilityRefresh";
import { getAvailability } from "@/lib/availability";
import { backText, capitalize, formatScheduledWindow, opensText } from "@/lib/storeStatusText";
import { SLOT_DATE_WINDOW_ERRORS, toScheduledWindow, type FulfillmentType } from "@/types/slots";
import { Button } from "@/components/ui/button";
import { lineDeposit } from "@/lib/sdr";
import { subtotalBreakdown } from "@/lib/vatBreakdown";
import VatInfoButton from "@/components/shared/VatInfoButton";
import { formatEuro } from "@/lib/currency";

interface CheckoutPageProps {
  vendorId: string;
}

// Recomputes an add-on line for a new quantity. Add-ons are VAT-inclusive and
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
  if (!addons?.length) return { total: 0, vat: 0 };
  return addons.reduce(
    (acc, a) => {
      acc.total += a.lineTotal || 0;
      acc.vat += a.taxAmount || 0;
      return acc;
    },
    { total: 0, vat: 0 },
  );
}

/** Retries while a paid checkout still holds the cart: about a minute in all. */
const CHECKOUT_RETRY_DELAYS_MS = [3000, 3000, 4000, 5000, 5000, 10000, 10000, 10000, 10000];

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
  // The two notes sent with the checkout (see `lib/deliveryNotes.ts`): one
  // for the rider, one for the restaurant or store.
  const [instructions, setInstructions] = useState("");
  const [vendorNote, setVendorNote] = useState("");
  const [isProceeding, setIsProceeding] = useState(false);
  /**
   * `POST /checkout` refused because another checkout of this cart has a
   * payment (8 Oct 2026, `CHECKOUT_PAYMENT_IN_PROGRESS`, with
   * `blockingCheckoutId`). Instead of the backend's raw red message, the
   * customer gets the next step for what that payment actually is:
   *
   * - `in-progress`: it is still open → continue it on its payment page (where
   *   cancelling it on purpose also lives);
   * - `settling`: it is already paid (or settled) but the backend still holds
   *   the cart for a few minutes → keep retrying, then go on to payment;
   * - `stuck`: the retries ran out → Try again, and a link to that order;
   * - `verifying`: the result is unknown → only "Check again", never a second
   *   payment.
   */
  const [blockedCheckout, setBlockedCheckout] = useState<{
    kind: "in-progress" | "settling" | "stuck" | "verifying";
    checkoutId: string | null;
    displayOrderId: string | null;
  } | null>(null);
  const unmountedRef = useRef(false);
  // Set on every mount, not only declared once: React's Strict Mode and Fast
  // Refresh unmount and remount the page, and a flag left `true` by that made
  // every blocked checkout end silently ("Processing…", then nothing).
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  // Self-pickup or delivery. Pickup is always booked as a slot (sent as a
  // SCHEDULED order); delivery is ASAP unless the customer schedules it, or the
  // store cannot take an ASAP order right now.
  const [isSelfPickup, setIsSelfPickup] = useState(false);
  const [wantsScheduledDelivery, setWantsScheduledDelivery] = useState(false);
  /** Which slot sheet is open, if any. */
  const [pickerFor, setPickerFor] = useState<FulfillmentType | null>(null);

  // Shared, cached cart + vendor list — deduped with CartPage, Navbar, etc.
  const {
    data: cartData,
    isLoading: cartLoading,
    error: cartError,
    refetch: refetchCart,
  } = useCart<CartResponse>();
  // Which add-ons belong to a required group — see `lib/requiredAddons.ts`.
  const { data: addonGroups } = useCartAddonGroups(cartData?.items);
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
   * This store's own terms, as the cart reports them.
   *
   * Read from `cartData` — the query result — rather than from the optimistic
   * `cart` state below it. A store's hours do not change when the customer
   * nudges a quantity, and the query answers a render earlier.
   */
  const cartVendor = useMemo(
    () => getCartVendorDetails(cartData?.items, vendorId),
    [cartData, vendorId],
  );
  // "restaurant", "store" or "partner", for the note box's wording.
  const vendorKind = getVendorKind(cartVendor?.businessType);

  /**
   * The store's name, cart first for the same reason as its hours.
   *
   * The cart's populated vendor carries `businessDetails.businessName`, so the
   * header no longer falls back to a bare "Store" when the vendor list misses.
   */
  const storeTitle = useVendorCardTitle(vendor ?? (vendorId ? { id: vendorId } : null));
  // A branch is named as that branch (`useVendorCardTitle`); the cart's own
  // name is the fallback while that is being worked out.
  const businessName =
    storeTitle.title || cartVendor?.businessName || vendor?.businessDetails?.businessName || "";

  /**
   * Each fulfilment type's slot (guide §2): today's server list, the
   * confirmed choice, and that choice re-checked against its own day.
   */
  const queryClient = useQueryClient();
  const pickup = useSlotChoice({ vendorId, fulfillmentType: "PICKUP", active: isSelfPickup });
  const delivery = useSlotChoice({
    vendorId,
    fulfillmentType: "DELIVERY",
    active: !isSelfPickup,
  });
  const canSelfPickup = pickup.canSchedule;
  const pickupSlot = pickup.slot;

  /**
   * Can delivery be ASAP? Only while the store is OPEN (extended hours
   * included). The slots answer is the fresher source — it refetches every
   * 3 min and on focus — and the vendor list is the fallback while it loads.
   */
  const storeStatus = delivery.today.data?.store ?? getAvailability(vendor);
  const storeState = storeStatus?.state ?? "OPEN";
  // At the pause's `resumeAt` / the store's `nextOpenAt`, refetch the slots
  // (which carry the store state) and the vendor (guide §1), so ASAP comes back
  // without waiting for the 3-minute refresh.
  useAvailabilityRefresh(storeStatus, () => {
    void queryClient.invalidateQueries({ queryKey: checkoutSlotKeys.all });
    void queryClient.invalidateQueries({ queryKey: ["vendors"] });
  });
  const canDeliverAsap = storeState === "OPEN";
  const isScheduledDelivery = !isSelfPickup && (wantsScheduledDelivery || !canDeliverAsap);
  const deliverySlot = delivery.slot;

  /** Why ASAP is off: "Closed right now… Opens tomorrow at 09:00." */
  const asapUnavailableNote = useMemo(() => {
    if (canDeliverAsap) return "";
    const lng = lang as "en" | "pt";
    const zone = delivery.today.data?.timezone;
    const isPaused = storeState === "PAUSED";
    const when = isPaused
      ? backText(storeStatus, t, lng, zone)
      : opensText(storeStatus, t, lng, zone);
    const base = t(isPaused ? "asapUnavailablePaused" : "asapUnavailableClosed");
    return when ? `${base} ${capitalize(when)}.` : base;
  }, [canDeliverAsap, storeState, storeStatus, delivery.today.data?.timezone, t, lang]);

  /** "Hoje 15:00–15:30", as the summary rows show a chosen slot. */
  const slotLabel = (choice: typeof pickupSlot) =>
    choice
      ? formatScheduledWindow(toScheduledWindow(choice.slot), t, lang as "en" | "pt", choice.timezone)
      : "";
  const pickupSlotLabel = slotLabel(pickupSlot);
  const deliverySlotLabel = slotLabel(deliverySlot);

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
      // Prices are VAT-inclusive: the gross line total already contains the VAT,
      // so scale the line and extract the embedded VAT rather than adding it on
      // top. Only the product's share scales with quantity — add-ons carry their
      // own — so the line is rebuilt from `grandTotal`, not `unitPrice * qty`.
      // Isolate the product's share from the *original* add-ons, then re-add the
      // (possibly edited) add-ons, so quantity and add-on edits compose.
      const origAddons = sumAddons(cartItem.addons);
      const productGross = getLineTotalForQuantity(cartItem, newQty) - origAddons.total;
      const productVat = getLineVatForQuantity(cartItem, newQty) - origAddons.vat;
      const nextAddons = sumAddons(addons);

      return {
        ...cartItem,
        addons,
        itemSummary: {
          ...cartItem.itemSummary,
          quantity: newQty,
          totalProductDiscount: newTotalProductDiscount,
          totalTaxAmount: productVat + nextAddons.vat,
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
        acc.vat += item.itemSummary.totalTaxAmount;
        acc.total += item.itemSummary.grandTotal;
        // Kept apart from `total`: the cart's totals exclude the container
        // deposit, and the checkout adds it to the amount charged.
        acc.deposit += lineDeposit(item).total;
        return acc;
      },
      { originalPrice: 0, discount: 0, vat: 0, total: 0, deposit: 0 },
    );
  }, [vendorItems]);
  /**
   * The small order fee as the cart quotes it (guide §3). `cartCalculation`
   * covers the cart's active lines, so it is this order's only while no other
   * store's lines are active — which checkout makes sure of, but a second tab
   * could undo. Read from the query result, never computed here.
   */
  const feeNudge = useMemo(() => {
    const activeElsewhere = cartData?.items.some(
      (item) => item.isActive === true && getCartVendorId(item.vendorId) !== vendorId,
    );
    return activeElsewhere ? null : smallOrderFeeNudge(cartData?.cartCalculation);
  }, [cartData, vendorId]);

  /**
   * The store's welcome offer as the cart quotes it (`first-order-offers.md`
   * §6.1). Same rule as the fee: the cart describes its active lines, so it is
   * this store's only while no other store's lines are active.
   */
  const firstOrderOffer = useMemo(() => {
    const activeElsewhere = cartData?.items.some(
      (item) => item.isActive === true && getCartVendorId(item.vendorId) !== vendorId,
    );
    return activeElsewhere ? null : cartData?.firstOrderOffer ?? null;
  }, [cartData, vendorId]);

  // The ⓘ breakdown of `summary.vat`: products and add-ons only — the fees
  // are priced at the payment step, which the popup says.
  const vatBreakdown = subtotalBreakdown({ items: vendorItems, lang, t, totalLabel: t("finalPrice") });

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
      // absolute target the user landed on after they stopped clicking. The
      // line's add-ons go with it: the backend checks a required group against
      // the request alone and refuses one that leaves it out
      // (`lib/requiredAddons.ts`).
      const liveItem = cartRef.current?.items.find(
        (ci) => ci.productId + "_" + (ci.variationSku || "default") === key,
      );
      const addons = addonsPayload(liveItem?.addons ?? item.addons);
      const payload: any = {
        items: [
          {
            productId: item.productId,
            quantity: targetQty,
            ...(addons.length ? { addons } : {}),
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
          // VAT-inclusive. Only the product's share scales with quantity —
          // add-ons carry their own — so rebuild the line from `grandTotal`
          // rather than `unitPrice * qty`, and keep each add-on's own VAT rate.
          const newGrandTotal = getLineTotalForQuantity(cartItem, newQty);
          const newTotalVatAmount = getLineVatForQuantity(cartItem, newQty);

          return {
            ...cartItem,
            itemSummary: {
              ...cartItem.itemSummary,
              quantity: newQty,
              totalProductDiscount: newTotalProductDiscount,
              totalTaxAmount: newTotalVatAmount,
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
      // to avoid resetting it. The rest of the line's add-ons are resent as
      // they are: the backend checks a required group against the request
      // alone, so leaving it out is refused (`lib/requiredAddons.ts`).
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
            addons: addonsPayload(liveItem?.addons ?? item.addons, {
              sku: addon.sku,
              quantity: targetQty,
            }),
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
    // A required group keeps its minimum; the button is disabled too.
    if (
      action === "decrement" &&
      isAddonDecrementBlocked(item.addons ?? [], addon, addonGroups)
    ) {
      return;
    }

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
        const productVat = cartItem.itemSummary.totalTaxAmount - curAddons.vat;

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
            totalTaxAmount: productVat + nextAddons.vat,
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
    if (isSelfPickup && !canSelfPickup) {
      toast.error(t("storeClosedForPickup"));
      setIsSelfPickup(false);
      return;
    }

    // Catch a missing time here rather than letting the backend answer with
    // its generic Zod wrapper, which names no field.
    if (isSelfPickup && !pickupSlot) {
      toast.error(t("pickupTimeRequired"));
      setPickerFor("PICKUP");
      return;
    }
    if (isScheduledDelivery && !delivery.canSchedule) {
      toast.error(t("noDeliverySlots"));
      return;
    }
    if (isScheduledDelivery && !deliverySlot) {
      toast.error(t("deliveryTimeRequired"));
      setPickerFor("DELIVERY");
      return;
    }

    // The slot being booked, if any. Its `startTime`/`endTime` go back exactly
    // as the server listed them. Pickup is always SCHEDULED, so `pickupTime`
    // is never sent (guide §4).
    const booked = isSelfPickup ? pickupSlot : isScheduledDelivery ? deliverySlot : null;
    const fulfillmentType: FulfillmentType = isSelfPickup ? "PICKUP" : "DELIVERY";

    // ASAP delivery sends exactly what it always sent — no fulfilment or
    // scheduling keys at all.
    const createCheckout = async (): Promise<string> => {
      const response = await apiClient.post("/checkout", {
        useCart: true,
        ...(booked
          ? {
              fulfillmentType,
              orderType: "SCHEDULED",
              scheduledFor: toScheduledWindow(booked.slot),
            }
          : {}),
        // Stored on the checkout since 15 Oct 2026. Only keys with something
        // to say are sent, and pickup never sends the rider note.
        ...checkoutNotesBody({
          deliveryNotes: instructions,
          vendorInstructions: vendorNote,
          isPickup: isSelfPickup,
        }),
      });
      return response.data.data._id;
    };

    const goToPayment = (checkoutId: string) => {
      // Redirect to payment page under the same vendor route
      router.push(
        `/cart/checkout/${vendorId}/payment?checkoutId=${checkoutId}`,
      );
    };

    try {
      setIsProceeding(true);
      setBlockedCheckout(null);
      goToPayment(await createCheckout());
    } catch (error) {
      if (getApiErrorKey(error) === "CHECKOUT_PAYMENT_IN_PROGRESS") {
        await resolveBlockedCheckout(error, createCheckout, goToPayment);
        return;
      }

      handleSlotRejection(error, fulfillmentType, !!booked);

      // These rejections arrive already translated, so the server's own
      // wording is the right thing to show.
      toast.error(
        getApiErrorMessage(error, "Failed to create checkout session"),
      );
    } finally {
      setIsProceeding(false);
    }
  };

  /**
   * `CHECKOUT_PAYMENT_IN_PROGRESS`: ask `/action` what the blocking checkout's
   * payment is, and act on that (see `blockedCheckout`). Never releases or
   * starts a payment here — continuing or cancelling one happens on its own
   * payment page, behind the confirmation there.
   */
  const resolveBlockedCheckout = async (
    error: unknown,
    createCheckout: () => Promise<string>,
    goToPayment: (checkoutId: string) => void,
  ) => {
    const body = axios.isAxiosError(error) ? error.response?.data : null;
    const blockingId: string | null =
      body?.data?.blockingCheckoutId ?? body?.err?.data?.blockingCheckoutId ?? null;
    if (!blockingId) {
      setBlockedCheckout({ kind: "stuck", checkoutId: null, displayOrderId: null });
      return;
    }

    const result = await callPaymentAction(blockingId);
    if (unmountedRef.current) return;
    if (result.state === "IN_PROGRESS") {
      setBlockedCheckout({ kind: "in-progress", checkoutId: blockingId, displayOrderId: null });
      return;
    }
    if (result.state === "VERIFYING" || result.state === "UNREACHABLE") {
      setBlockedCheckout({ kind: "verifying", checkoutId: blockingId, displayOrderId: null });
      return;
    }

    // Paid, failed or cancelled: the backend can hold the cart for a minute or
    // more after (seen 8 Oct 2026; ~60 s after a cancel). Keep trying for about
    // a minute, then hand over. "Your previous order was placed" only when it
    // really was (an ORD- number came back); otherwise "Getting your cart
    // ready".
    const displayOrderId = result.state === "ORDER_PLACED" ? result.displayOrderId : null;
    setBlockedCheckout({ kind: "settling", checkoutId: blockingId, displayOrderId });
    for (const delay of CHECKOUT_RETRY_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (unmountedRef.current) return;
      try {
        const checkoutId = await createCheckout();
        setBlockedCheckout(null);
        goToPayment(checkoutId);
        return;
      } catch (retryError) {
        if (getApiErrorKey(retryError) !== "CHECKOUT_PAYMENT_IN_PROGRESS") {
          setBlockedCheckout(null);
          toast.error(getApiErrorMessage(retryError, "Failed to create checkout session"));
          return;
        }
      }
    }
    setBlockedCheckout({ kind: "stuck", checkoutId: blockingId, displayOrderId });
  };

  /**
   * After `POST /checkout` refuses the time (guide §4 error table). Branches
   * on errorKey, never on message text; the backend's validation errors carry
   * no key, only the field path, so `scheduledFor` / `pickupTime` count too.
   *
   * - The slot is not bookable any more (passed, too soon, after last order,
   *   outside the window): clear it, refetch the lists, reopen the picker.
   * - The store paused or closed under an ASAP delivery: switch to "Schedule
   *   for later" and open the picker, which shows when it is back.
   */
  const handleSlotRejection = (
    error: unknown,
    fulfillmentType: FulfillmentType,
    wasScheduled: boolean,
  ) => {
    const errorKey = getApiErrorKey(error);
    const path = getApiErrorPath(error);
    const slotRejected =
      (!!errorKey &&
        (errorKey.startsWith("SCHEDULED_") ||
          errorKey.startsWith("PICKUP_") ||
          errorKey === "INVALID_PICKUP_TIME" ||
          SLOT_DATE_WINDOW_ERRORS.has(errorKey))) ||
      (!errorKey && (path?.startsWith("scheduledFor") || path?.startsWith("pickupTime")));
    const storeStopped = errorKey === "VENDOR_PAUSED" || errorKey === "VENDOR_CLOSED";

    if (!slotRejected && !storeStopped) return;

    // Whatever the list said is out of date now.
    void queryClient.invalidateQueries({ queryKey: checkoutSlotKeys.all });
    const slotState = fulfillmentType === "PICKUP" ? pickup : delivery;
    if (wasScheduled || slotRejected) slotState.setChoice(null);
    if (fulfillmentType === "DELIVERY") setWantsScheduledDelivery(true);
    setPickerFor(fulfillmentType);
  };

  const handleToggleSelfPickup = () => {
    const isNowSelected = !isSelfPickup;
    setIsSelfPickup(isNowSelected);
    // Drop the pickup time when switching back to delivery, so re-ticking the
    // box never silently reuses a slot that has since passed.
    if (!isNowSelected) pickup.setChoice(null);
    // Choosing pickup without a time is not a state the customer can check
    // out from, so go straight into the picker.
    if (isNowSelected && !pickupSlot) setPickerFor("PICKUP");
  };

  /** ASAP or "Schedule for later" for delivery. */
  const handleDeliveryTiming = (scheduled: boolean) => {
    if (!scheduled && !canDeliverAsap) return;
    setWantsScheduledDelivery(scheduled);
    if (!scheduled) delivery.setChoice(null);
    if (scheduled && !deliverySlot && delivery.canSchedule) setPickerFor("DELIVERY");
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

  // Cart first, for the same reason as the name above it: the vendor list is a
  // separate query and a miss there used to put a placeholder box next to a
  // real store.
  const vendorImage =
    getCartVendorPhoto(cartData?.items, vendorId) ||
    vendor?.documents?.storePhoto?.[0] ||
    vendor?.storePhoto?.[0] ||
    "https://placehold.co/400x400?text=No+Image";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl lg:text-display font-extrabold text-gray-900 dark:text-neutral-50">
        {t("reviewYourCart")}
      </h1>
      <p className="mt-2 text-gray-500 dark:text-neutral-400">{t("completeOrderDetails")}</p>

      <div className="mt-8 mb-8 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-gray-100 dark:bg-neutral-800">
              <SafeImage
                src={vendorImage}
                alt={businessName || t("store")}
                sizes="96px"
                fallbackIcon={<Store className="h-8 w-8" />}
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-50">
                {businessName || t("store")}
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-primary/5 dark:bg-pink-950/30 px-3 py-2 text-primary dark:text-pink-400">
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

            {vendorRouteId(vendor) && (
              <Link
                href={vendorHref(vendor)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white dark:border-pink-500 dark:text-pink-400 dark:hover:bg-pink-600 dark:hover:text-white"
              >
                <Plus size={16} />
                {t("addMoreItems")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-8">
          {vendorItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 dark:border-neutral-800 bg-card p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-neutral-50">{t("noProductsFound")}</h3>
              <p className="mt-2 text-gray-500 dark:text-neutral-400">{t("vendorHasNoProducts")}</p>
            </div>
          ) : (
            vendorItems.map((item) => (
              <div
                key={`${item.productId}-${item.variationSku ?? "default"}`}
                className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
              >
                <div className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative h-28 w-full overflow-hidden rounded-2xl sm:w-28 bg-gray-100 dark:bg-neutral-800">
                      {/* Empty for old-shape products — see `ProductImage`. */}
                      <ProductImage
                        src={item.image}
                        productIds={[item.productId]}
                        vendorId={vendorId}
                        alt={item.name}
                        sizes="112px"
                        fallbackIcon={<UtensilsCrossed className="h-10 w-10" />}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        {/* min-w-0 down this column so an add-on's name
                            truncates instead of pushing the row off a phone. */}
                        <div className="min-w-0 flex-1">
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
                              {item.addons.map((addon) => {
                                // A required group can't drop below its
                                // minimum, so its last add-on has no delete.
                                const required = addonGroupMinimum(addon, addonGroups) > 0;
                                const locked = isAddonDecrementBlocked(item.addons ?? [], addon, addonGroups);
                                const lockedHint = t("addonRequiredHint").replace(
                                  "{min}",
                                  String(addonGroupMinimum(addon, addonGroups)),
                                );
                                return (
                                <li
                                  key={addon.sku}
                                  className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-neutral-800/50 px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-gray-700 dark:text-neutral-300">
                                      <span className="text-primary dark:text-pink-400">+ </span>
                                      {resolveAddonName(addon.name, lang)}
                                    </span>
                                    {/* The badge sits on the second line so the
                                        name keeps the width on a phone. Free
                                        add-ons (€0) skip the unit price; the
                                        total column says "Free"/"Grátis". */}
                                    {(required || addon.unitPrice > 0) && (
                                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                                        {required && (
                                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary dark:bg-pink-950/30 dark:text-pink-400">
                                            {t("required")}
                                          </span>
                                        )}
                                        {addon.unitPrice > 0 && (
                                          <span className="text-xs text-gray-400 dark:text-neutral-500">
                                            {formatEuro(addon.unitPrice)} × {addon.quantity}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center rounded-full border border-gray-200 dark:border-neutral-700 bg-card">
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={locked ? lockedHint : t("decreaseQuantity")}
                                      title={locked ? lockedHint : undefined}
                                      disabled={locked}
                                      onClick={() => updateAddonQuantity(item, addon, "decrement")}
                                      className="rounded-full text-gray-500 active:scale-90 dark:text-neutral-400"
                                    >
                                      {addon.quantity <= 1 && !locked ? (
                                        <Trash2 size={13} />
                                      ) : (
                                        <Minus size={13} />
                                      )}
                                    </Button>
                                    <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-neutral-50">
                                      {addon.quantity}
                                    </span>
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      aria-label={t("increaseQuantity")}
                                      onClick={() => updateAddonQuantity(item, addon, "increment")}
                                      className="rounded-full active:scale-90"
                                    >
                                      <Plus size={13} />
                                    </Button>
                                  </div>
                                  <span className="w-14 shrink-0 text-right text-sm font-semibold text-gray-900 dark:text-neutral-50">
                                    {addon.unitPrice > 0 ? formatEuro(addon.lineTotal) : t("addonFree")}
                                  </span>
                                </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteItem(item)}
                          disabled={deletingItem === item.productId}
                          aria-label={t("remove")}
                          className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                        >
                          {deletingItem === item.productId ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </Button>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center rounded-2xl border border-border">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("decreaseQuantity")}
                            onClick={() => updateQuantity(item, "decrement")}
                            className="rounded-none rounded-l-2xl text-gray-700 dark:text-neutral-300"
                          >
                            <Minus size={16} />
                          </Button>
                          <div className="min-w-15 text-center font-bold text-gray-900 dark:text-neutral-50">
                            {item.itemSummary.quantity}
                          </div>

                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("increaseQuantity")}
                            onClick={() => updateQuantity(item, "increment")}
                            className="rounded-none rounded-r-2xl text-gray-700 dark:text-neutral-300"
                          >
                            <Plus size={16} />
                          </Button>
                        </div>
                        <div className="text-right">
                          {/* Only a genuine saving gets a strikethrough, and it
                              compares like with like — both sides include the
                              line's add-ons. */}
                          {getLineOriginalPrice(item) >
                            item.itemSummary.grandTotal + 0.005 && (
                            <p className="text-sm text-gray-400 dark:text-neutral-500 line-through">
                              {formatEuro(getLineOriginalPrice(item))}
                            </p>
                          )}
                          <p className="text-2xl font-bold text-primary dark:text-pink-400">
                            {formatEuro(item.itemSummary.grandTotal)}
                          </p>
                          {lineDeposit(item).total > 0 && (
                            <p className="text-xs font-medium text-muted-foreground dark:text-neutral-400" title={t("sdrExplanation")}>
                              +{formatEuro(lineDeposit(item).total)} {t("sdrDepositShort")} ({lineDeposit(item).containers} × {formatEuro(lineDeposit(item).unit)})
                            </p>
                          )}
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
          <div className="sticky top-24 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-neutral-50">
                {t("orderSummary")}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                {t("reviewOrderDetails")}
              </p>
              <FirstOrderTeaser offer={firstOrderOffer} className="mt-4" />
            </div>
            <div className="space-y-4 p-6">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-400">{t("totalPrice")}</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-50">
                  {formatEuro(summary.originalPrice)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-neutral-400">{t("discount")}</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  -{formatEuro(summary.discount)}
                </span>
              </div>
              <div className="border-t border-dashed border-border pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-xl font-bold text-gray-900 dark:text-neutral-50">
                      {t("finalPrice")}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-gray-500 dark:text-neutral-400">
                      ({t("inclVat")} -&nbsp;{formatEuro(summary.vat)})
                      <VatInfoButton breakdown={vatBreakdown} label={t("vatBreakdownOpen")} />
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-2xl font-extrabold text-primary dark:text-pink-400">
                    {formatEuro(summary.total)}
                  </span>
                </div>
              </div>
              {/* Like the deposit: not in the final price above (the cart's
                  `grandTotal` excludes it), added to the amount charged at
                  payment. With the nudge to avoid it. */}
              {feeNudge && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block text-gray-600 dark:text-neutral-400">{t("smallOrderFee")}</span>
                      <span className="mt-1 block text-xs text-gray-500 dark:text-neutral-400">
                        {t("smallOrderFeeAddedAtPayment").replace("{threshold}", formatEuro(feeNudge.threshold))}
                      </span>
                    </div>
                    <span className="shrink-0 font-semibold text-gray-900 dark:text-neutral-50">
                      +{formatEuro(feeNudge.fee)}
                    </span>
                  </div>
                  <SmallOrderFeeNudge nudge={feeNudge} />
                </div>
              )}
              {/* Its own row under the final price, never folded into it:
                  this figure is the cart's, and the deposit is added to the
                  amount charged only at payment. */}
              {summary.deposit > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-gray-600 dark:text-neutral-400">{t("sdrDeposit")}</span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-neutral-400">{t("sdrAddedAtPayment")}</span>
                  </div>
                  <span className="shrink-0 font-semibold text-gray-900 dark:text-neutral-50">
                    +{formatEuro(summary.deposit)}
                  </span>
                </div>
              )}
            </div>

            {/* Self-pickup sits between the summary and the instructions, the
                same slot the mobile app puts it in. */}
            <div className="border-t border-border p-6">
              <button
                type="button"
                onClick={handleToggleSelfPickup}
                disabled={!canSelfPickup}
                aria-pressed={isSelfPickup}
                className={`focus-ring flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isSelfPickup
                    ? "border-primary bg-primary/5 dark:border-pink-400 dark:bg-pink-950/20"
                    : "border-border"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                    isSelfPickup
                      ? "border-primary bg-primary dark:border-pink-400 dark:bg-pink-500"
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
                      ? "text-primary dark:text-pink-400"
                      : "text-gray-400 dark:text-neutral-500"
                  }`}
                />
              </button>

              {/* No window means the store has already closed for today, so the
                  option is offered but not actionable. Saying why beats a
                  disabled control with no explanation. */}
              {!canSelfPickup && (
                <p className="mt-2 text-xs text-gray-500 dark:text-neutral-400">
                  {t("storeClosedForPickup")}
                </p>
              )}

              {isSelfPickup && canSelfPickup && (
                <button
                  type="button"
                  onClick={() => setPickerFor("PICKUP")}
                  className="focus-ring mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary p-4 text-left transition hover:bg-primary/5 dark:border-pink-400 dark:hover:bg-pink-950/20"
                >
                  <Clock size={18} className="shrink-0 text-primary dark:text-pink-400" />
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      pickupSlot
                        ? "font-semibold text-gray-900 dark:text-neutral-50"
                        : "text-gray-500 dark:text-neutral-400"
                    }`}
                  >
                    {/* "Hoje 15:00–15:30": the day as well as the time. */}
                    {pickupSlot ? pickupSlotLabel : t("selectPickupTime")}
                  </span>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-gray-400 dark:text-neutral-500"
                  />
                </button>
              )}

              {/* Delivery timing: ASAP, or a slot. ASAP is off while the store
                  is closed or paused, with the reason and when it is back. */}
              {!isSelfPickup && (
                <div className="mt-5">
                  <p className="mb-2 font-semibold text-gray-900 dark:text-neutral-50">
                    {t("deliveryTime")}
                  </p>
                  <div
                    role="radiogroup"
                    aria-label={t("deliveryTime")}
                    className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-neutral-800/60"
                  >
                    {[
                      { scheduled: false, label: t("deliverAsap"), Icon: Truck },
                      { scheduled: true, label: t("scheduleForLater"), Icon: CalendarClock },
                    ].map(({ scheduled, label, Icon }) => {
                      const selected = isScheduledDelivery === scheduled;
                      const disabled = scheduled ? !delivery.canSchedule : !canDeliverAsap;
                      return (
                        <button
                          key={String(scheduled)}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={disabled}
                          onClick={() => handleDeliveryTiming(scheduled)}
                          className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                              ? "bg-card text-primary shadow-sm dark:text-pink-400"
                              : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                          }`}
                        >
                          <Icon size={16} className="shrink-0" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!canDeliverAsap && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      {asapUnavailableNote}
                    </p>
                  )}

                  {isScheduledDelivery && !delivery.canSchedule && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-neutral-400">
                      {delivery.todayKey === "VENDOR_NOT_ACCEPTING_ORDERS"
                        ? t(vendorCopyKey("vendorNotAcceptingOrders", vendorKind))
                        : t("noDeliverySlots")}
                    </p>
                  )}

                  {isScheduledDelivery && delivery.canSchedule && (
                    <button
                      type="button"
                      onClick={() => setPickerFor("DELIVERY")}
                      className="focus-ring mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary p-4 text-left transition hover:bg-primary/5 dark:border-pink-400 dark:hover:bg-pink-950/20"
                    >
                      <Clock size={18} className="shrink-0 text-primary dark:text-pink-400" />
                      <span
                        className={`min-w-0 flex-1 text-sm ${
                          deliverySlot
                            ? "font-semibold text-gray-900 dark:text-neutral-50"
                            : "text-gray-500 dark:text-neutral-400"
                        }`}
                      >
                        {deliverySlot ? deliverySlotLabel : t("selectDeliveryTime")}
                      </span>
                      <ChevronRight
                        size={18}
                        className="shrink-0 text-gray-400 dark:text-neutral-500"
                      />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* The two notes, sent with the checkout. The rider one is hidden
                for pickup: its placeholder describes a courier who does not
                exist on a collected order. The note for the restaurant or store
                stays — "no onions" matters either way. */}
            <div className="space-y-4 border-t border-border p-6">
              {!isSelfPickup && (
                <div>
                  <label
                    htmlFor="rider-instructions"
                    className="mb-2 block font-semibold text-gray-900 dark:text-neutral-50"
                  >
                    {t("deliveryInstructions")}
                  </label>
                  <textarea
                    id="rider-instructions"
                    rows={3}
                    maxLength={MAX_RIDER_INSTRUCTIONS}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder={t("riderInstructionsPlaceholder")}
                    className="w-full rounded-2xl border border-border bg-card p-4 outline-none transition focus:border-primary dark:focus:border-pink-400 text-gray-900 dark:text-neutral-50 placeholder:text-gray-400 dark:placeholder:text-neutral-600"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="vendor-instructions"
                  className="mb-2 block font-semibold text-gray-900 dark:text-neutral-50"
                >
                  {t(vendorCopyKey("noteForVendor", vendorKind))}
                </label>
                <textarea
                  id="vendor-instructions"
                  rows={3}
                  maxLength={MAX_VENDOR_INSTRUCTIONS}
                  value={vendorNote}
                  onChange={(e) => setVendorNote(e.target.value)}
                  placeholder={t(vendorCopyKey("noteForVendorPlaceholder", vendorKind))}
                  className="w-full rounded-2xl border border-border bg-card p-4 outline-none transition focus:border-primary dark:focus:border-pink-400 text-gray-900 dark:text-neutral-50 placeholder:text-gray-400 dark:placeholder:text-neutral-600"
                />
              </div>
            </div>

            <div className="border-t border-border p-6">
              {blockedCheckout && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 dark:border-pink-500/20 dark:bg-pink-950/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0f5] dark:bg-pink-950/30">
                      {blockedCheckout.kind === "settling" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary dark:text-pink-400" />
                      ) : blockedCheckout.kind === "verifying" ? (
                        <ShieldCheck className="h-5 w-5 text-primary dark:text-pink-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-primary dark:text-pink-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-neutral-50">
                        {blockedCheckout.kind === "in-progress"
                          ? t("checkoutBlockedTitle")
                          : blockedCheckout.kind === "settling"
                            ? blockedCheckout.displayOrderId
                              ? t("checkoutSettlingTitle")
                              : t("checkoutPreparingTitle")
                            : blockedCheckout.kind === "verifying"
                              ? t("paymentVerifyingTitle")
                              : t("checkoutStuckTitle")}
                        {blockedCheckout.displayOrderId ? ` (${blockedCheckout.displayOrderId})` : ""}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
                        {blockedCheckout.kind === "in-progress"
                          ? t("checkoutBlockedBody")
                          : blockedCheckout.kind === "settling"
                            ? blockedCheckout.displayOrderId
                              ? t("checkoutSettlingBody")
                              : t("checkoutPreparingBody")
                            : blockedCheckout.kind === "verifying"
                              ? t("paymentVerifyingBody")
                              : t("checkoutStuckBody")}
                      </p>
                    </div>
                  </div>
                  {/* An unknown result: the cart never releases a payment itself.
                      The payment page does, behind its confirmation — so this
                      is the way there, not a dead end of "Check again". */}
                  {blockedCheckout.kind === "verifying" && blockedCheckout.checkoutId && (
                    <Link
                      href={paymentPagePath(blockedCheckout.checkoutId, vendorId) ?? "/cart"}
                      className="mt-3 inline-block text-sm font-semibold text-primary hover:opacity-80 dark:text-pink-400"
                    >
                      {t("viewThatPayment")}
                    </Link>
                  )}
                  {blockedCheckout.kind === "in-progress" && blockedCheckout.checkoutId && (
                    <Button
                      size="lg"
                      onClick={() =>
                        router.push(paymentPagePath(blockedCheckout.checkoutId as string, vendorId) ?? "/cart")
                      }
                      className="cart-cta relative mt-4 w-full gap-2 overflow-hidden rounded-2xl font-semibold"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {t("continuePayment")}
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    </Button>
                  )}
                  {blockedCheckout.kind === "stuck" && blockedCheckout.displayOrderId && (
                    <Link
                      href={orderTrackingPath({ displayOrderId: blockedCheckout.displayOrderId })}
                      className="mt-3 inline-block text-sm font-semibold text-primary hover:opacity-80 dark:text-pink-400"
                    >
                      {t("viewOrder")}
                    </Link>
                  )}
                </div>
              )}
              {/* While a payment is open, the card's Continue payment is the
                  main action; this one steps back to a quiet "Check again". */}
              <Button
                size="lg"
                variant={blockedCheckout?.kind === "in-progress" ? "outline" : "default"}
                onClick={handleProceedToCheckout}
                disabled={isProceeding || vendorItems.length === 0}
                className={`relative w-full overflow-hidden rounded-2xl font-semibold ${
                  !isProceeding && vendorItems.length > 0 && blockedCheckout?.kind !== "in-progress" ? "cart-cta" : ""
                }`}
              >
                {!isProceeding && vendorItems.length > 0 && blockedCheckout?.kind !== "in-progress" && (
                  <span className="cart-cta-shine" aria-hidden="true" />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {blockedCheckout && blockedCheckout.kind !== "settling" && !isProceeding ? (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      {blockedCheckout.kind === "stuck" ? t("tryAgain") : t("checkAgain")}
                    </>
                  ) : isProceeding ? (
                    t("processing")
                  ) : (
                    t("proceedToCheckout")
                  )}
                </span>
              </Button>
              <p className="mt-3 text-center text-xs text-gray-400 dark:text-neutral-500">
                {t("termsAndConditions")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* The picker loads its own days and slots from the server and renders
          its own empty, closed and error states, with Confirm disabled. */}
      {pickerFor && (
        <SlotPicker
          key={pickerFor}
          vendorId={vendorId}
          vendorKind={vendorKind}
          fulfillmentType={pickerFor}
          value={pickerFor === "PICKUP" ? pickupSlot : deliverySlot}
          title={t(pickerFor === "PICKUP" ? "pickupSheetTitle" : "deliveryTime")}
          confirmLabel={t(pickerFor === "PICKUP" ? "confirmPickupTime" : "confirmDeliveryTime")}
          onConfirm={(choice) => {
            (pickerFor === "PICKUP" ? pickup : delivery).setChoice(choice);
            setPickerFor(null);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}