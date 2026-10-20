"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Store, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useCart, useCartCache } from "@/hooks/queries/useCart";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { usePrefersReducedMotion } from "@/hooks/useMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { getCartVendorId } from "@/lib/cart";
import { currencySymbol } from "@/lib/currency";
import SafeImage from "@/components/shared/SafeImage";
import type { CartItem } from "@/types/cart";

/** How long an untouched "Remove" waits before folding back into the ✕. */
const ARM_MS = 5000;
/** The pill's burst plus the bar sinking away (`globals.css`, `.cart-bar-*`). */
const LEAVE_MS = 800;

/**
 * One burst of bubbles: angle (deg), distance (share of `radius`), size (px)
 * and delay (ms). Fixed rather than random, so every burst is the same shape
 * and nothing differs between renders.
 */
const BUBBLES: [number, number, number, number][] = [
  [-90, 1, 16, 0],
  [-55, 0.8, 11, 40],
  [-20, 1, 14, 15],
  [15, 0.7, 10, 60],
  [50, 0.95, 13, 25],
  [85, 0.65, 9, 50],
  [120, 1, 15, 10],
  [155, 0.8, 11, 70],
  [190, 0.95, 16, 30],
  [225, 0.75, 10, 45],
  [260, 0.9, 13, 20],
  [295, 0.7, 11, 55],
];

// Filled brand pink, a lighter pink, and an outline — so the burst reads as
// bubbles rather than confetti.
const BUBBLE_LOOKS = [
  "bg-primary/90",
  "bg-primary/50 dark:bg-pink-400/80",
  "border-2 border-primary/80",
];

/** Bubbles flying out from the middle of the parent (which must be `relative`). */
function BubbleBurst({ count, radius }: { count: number; radius: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-10">
      <span className="cart-bar-ring border-2 border-primary/60" />
      {BUBBLES.slice(0, count).map(([angle, distance, size, delay], index) => {
        const rad = (angle * Math.PI) / 180;
        const style = {
          "--bubble-x": `${Math.round(Math.cos(rad) * radius * distance)}px`,
          // A little extra rise: bubbles float up as they go.
          "--bubble-y": `${Math.round(Math.sin(rad) * radius * distance - radius * 0.25)}px`,
          "--bubble-size": `${size}px`,
          "--bubble-delay": `${delay}ms`,
        } as CSSProperties;
        return (
          <span
            key={angle}
            className={`cart-bar-bubble ${BUBBLE_LOOKS[index % BUBBLE_LOOKS.length]}`}
            style={style}
          />
        );
      })}
    </span>
  );
}

/**
 * "View cart" bar at the bottom of a store page, like the mobile app: while
 * the cart holds items from this store it shows how many, the first item
 * "& N more", and a button straight to this store's checkout.
 *
 * Reads the same cart query as the navbar badge (no extra request), so it
 * updates as soon as something is added or removed. Only active lines count —
 * the same lines checkout will charge. Totals match the cart page
 * (`itemSummary.grandTotal`).
 *
 * ## Removing this store's items
 *
 * Two taps, never one. The ✕ on the corner pops into bubbles and a "Remove"
 * pill takes the place of "View cart"; Cancel, Escape, a tap outside the bar,
 * or five seconds untouched fold it back. Remove deletes every line of this
 * store — inactive ones too, as the cart page's "delete order" does — in one
 * `/carts/delete-item` request, then the pill bursts and the bar sinks away.
 * Other stores' items are never touched.
 */
export default function ViewCartBar({
  storeId,
  storeName,
  storePhoto,
  enabled,
  hidden,
}: {
  /** The store's id as the cart keys it (Mongo `_id`). */
  storeId: string;
  /** Card title — the branch name for a branch. */
  storeName: string;
  storePhoto?: string | null;
  /** Logged in (the cart is account-only). */
  enabled: boolean;
  /** Hidden while the product popup is open (it has its own footer). */
  hidden: boolean;
}) {
  const { t } = useTranslation();
  const { data: cart } = useCart<{ items?: CartItem[] } | null>({ enabled });
  const { invalidate } = useCartCache();
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<"idle" | "armed" | "removing">("idle");
  // Counts each arming, so the ✕'s bubbles replay every time.
  const [armCount, setArmCount] = useState(0);
  // The cart the removal went through on. The bar plays its exit while the
  // cart is still that one; the refetch that follows replaces it, and the
  // exit ends by itself — nothing to reset if items are added again later.
  const [leavingCart, setLeavingCart] = useState<unknown>(null);
  const leaving = leavingCart !== null && leavingCart === cart;

  const regionRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);

  const summary = useMemo(() => {
    const storeLines = (cart?.items ?? []).filter(
      (item) => getCartVendorId(item.vendorId) === storeId,
    );
    const lines = storeLines.filter((item) => item.isActive !== false);
    if (!lines.length) return null;
    return {
      count: lines.reduce((sum, item) => sum + (item.itemSummary?.quantity ?? 0), 0),
      total: lines.reduce((sum, item) => sum + (item.itemSummary?.grandTotal ?? 0), 0),
      first: lines[0]!.name,
      more: lines.length - 1,
      // What Remove deletes: every line of this store, in the shape
      // `/carts/delete-item` expects. Plain products omit `variationSku`
      // entirely — the backend rejects null (same rule as the cart page).
      deleteTargets: storeLines.map((item) => {
        const target: { productId: string; variationSku?: string } = {
          productId: item.productId,
        };
        if (item.variationSku) target.variationSku = item.variationSku;
        return target;
      }),
      removeCount: storeLines.reduce((sum, item) => sum + (item.itemSummary?.quantity ?? 0), 0),
    };
  }, [cart, storeId]);

  const visible = enabled && !!summary && !hidden;
  const armed = visible && phase === "armed";

  const arm = () => {
    setArmCount((n) => n + 1);
    setPhase("armed");
  };

  // The pill that held the focus is gone once disarmed; the ✕ gets it back,
  // after it has rendered again (an effect, not a guess at a frame).
  const restoreFocusRef = useRef(false);
  const disarm = useCallback(() => {
    restoreFocusRef.current = true;
    setPhase("idle");
  }, []);

  useEffect(() => {
    if (phase !== "idle" || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    closeRef.current?.focus();
  }, [phase]);

  // While the bar shows, the page ends 7rem lower so it never covers the last
  // products or the footer (the bar is fixed over the content).
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "7rem";
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, [visible]);

  // Armed: Remove takes the focus, and folds back on its own if left alone or
  // if the customer taps anywhere else on the page.
  useEffect(() => {
    if (!armed) return;
    removeRef.current?.focus();
    const timer = window.setTimeout(() => {
      // Only pull the focus back if it is still on the pill being removed.
      if (document.activeElement === removeRef.current) disarm();
      else setPhase("idle");
    }, ARM_MS);
    const onPointerDown = (event: PointerEvent) => {
      if (!regionRef.current?.contains(event.target as Node)) setPhase("idle");
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [armed, disarm]);

  // Escape is Cancel, never Remove. The bar sits at z-40.
  useEscapeToClose(armed, disarm, { layer: 40 });

  const handleRemove = async () => {
    if (phase !== "armed" || !summary) return;
    setPhase("removing");

    try {
      await apiClient.delete("/carts/delete-item", { data: summary.deleteTargets });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("couldNotDeleteOrder")));
      setPhase("idle");
      // Whatever did or did not go through, show the cart as the server has it.
      await invalidate();
      return;
    }

    setLeavingCart(cart);
    setPhase("idle");
    toast.success(t("orderDeletedToast").replace("{store}", storeName));
    // Let the burst play, then re-read the cart: the bar (and the navbar
    // badge) go away with the store's last line.
    await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : LEAVE_MS));
    await invalidate();
  };

  if (!visible || !summary) return null;

  const itemsLabel = `${summary.count} ${summary.count === 1 ? t("cartBarItem") : t("cartBarItems")}`;
  const removeLabel =
    summary.removeCount === 1
      ? t("cartBarRemoveOne")
      : t("cartBarRemoveMany").replace("{n}", String(summary.removeCount));
  const confirming = armed || phase === "removing" || leaving;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <div
        ref={regionRef}
        role="region"
        aria-label={t("viewCart")}
        className={`pointer-events-auto relative mx-auto flex max-w-2xl items-center gap-3 rounded-3xl border border-border bg-card p-3 shadow-[0_-4px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_30px_rgba(0,0,0,0.5)] ${
          leaving ? "cart-bar-leave" : "animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
        }`}
      >
        {/* The ✕, half outside the corner. Arming pops it into bubbles. */}
        <span className="absolute -top-2 -right-2 size-8">
          {phase === "armed" && <BubbleBurst key={armCount} count={10} radius={44} />}
          {!confirming && (
            <button
              ref={closeRef}
              type="button"
              onClick={arm}
              aria-label={t("cartBarRemoveAria")}
              title={t("cartBarRemoveAria")}
              className="focus-ring relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-gray-500 shadow-md transition-transform duration-200 after:absolute after:-inset-2 hover:scale-110 hover:rotate-90 hover:text-primary active:scale-90 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:hover:rotate-0 dark:text-neutral-400 dark:hover:text-pink-400"
            >
              <X aria-hidden size={16} />
            </button>
          )}
        </span>

        {/* On a phone the confirm buttons need the photo's room. */}
        <div
          className={`relative size-12 shrink-0 overflow-hidden rounded-2xl border border-primary/20 bg-gray-50 sm:size-14 dark:bg-neutral-900 ${
            confirming ? "max-sm:hidden" : ""
          }`}
        >
          <SafeImage
            src={storePhoto}
            alt=""
            sizes="56px"
            fallbackIcon={<Store size={20} className="text-gray-400" />}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide whitespace-nowrap text-primary uppercase dark:text-pink-400">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary dark:bg-pink-400" />
            <span className="truncate">{itemsLabel}</span>
          </p>
          <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{storeName}</p>
          <p className="truncate text-sm text-gray-500 dark:text-neutral-400">
            {summary.first}
            {/* t() has no interpolation — the pattern carries {n} so each language orders it. */}
            {summary.more > 0 && ` ${t("cartBarAndMore").replace("{n}", String(summary.more))}`}
          </p>
        </div>

        {confirming ? (
          <div className="flex shrink-0 items-center gap-2">
            <p className="sr-only" aria-live="polite">
              {armed ? t("cartBarConfirmHint") : ""}
            </p>
            {!leaving && (
              <button
                type="button"
                onClick={disarm}
                disabled={phase === "removing"}
                className="focus-ring cursor-pointer rounded-2xl px-2 py-2 text-sm font-medium sm:px-3 text-gray-600 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-300"
              >
                {t("cancel")}
              </button>
            )}
            {/* The pill clips its countdown, so the bubbles live beside it. */}
            <span className="relative">
              <button
                ref={removeRef}
                type="button"
                onClick={handleRemove}
                disabled={phase !== "armed"}
                aria-busy={phase === "removing"}
                className={`focus-ring relative flex cursor-pointer flex-col items-center overflow-hidden rounded-2xl bg-destructive px-4 py-2 text-white shadow-lg transition-transform active:scale-[0.98] disabled:cursor-default sm:px-6 ${
                  leaving ? "cart-bar-pop-out" : "cart-bar-pop-in"
                }`}
              >
                <span className="flex items-center gap-1 text-sm font-medium">
                  {phase === "removing" ? (
                    <Loader2 aria-hidden size={16} className="animate-spin" />
                  ) : (
                    <Trash2 aria-hidden size={16} />
                  )}
                  {t("cartBarRemove")}
                </span>
                <span className="text-base font-bold tabular-nums">{removeLabel}</span>
                {armed && (
                  <span
                    aria-hidden
                    className="cart-bar-countdown absolute inset-x-0 bottom-0 h-1 bg-white/50"
                    style={{ "--arm-ms": `${ARM_MS}ms` } as CSSProperties}
                  />
                )}
              </button>
              {leaving && <BubbleBurst count={12} radius={96} />}
            </span>
          </div>
        ) : (
          <Link
            href={`/cart/checkout/${storeId}`}
            className="focus-ring flex shrink-0 flex-col items-center rounded-2xl bg-linear-to-r from-primary to-primary-hover px-4 py-2 text-white shadow-lg transition-transform hover:from-primary-hover hover:to-[#b01254] active:scale-[0.98] sm:px-6"
          >
            <span className="flex items-center gap-1 text-sm font-medium">
              {t("viewCart")}
              <ArrowRight aria-hidden size={16} />
            </span>
            <span className="text-base font-bold tabular-nums">
              {currencySymbol()}
              {summary.total.toFixed(2)}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
