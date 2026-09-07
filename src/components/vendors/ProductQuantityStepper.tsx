"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { setCartLineQuantity } from "@/lib/cartLineQuantity";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

/** How long a burst of taps is collected before one request is sent.
 *
 *  Short. This delay is invisible — the number moves on the tap and the
 *  request follows — so its only job is to fold "+ + +" into one call. At 450ms
 *  it was also folding in *deliberate* single taps, leaving the cart badge
 *  half a second behind the card for no gain. */
const COMMIT_DELAY_MS = 200;

interface ProductQuantityStepperProps {
  /** Mongo `_id` — the id the cart endpoints key on. */
  productId: string;
  productName: string;
  /** The quantity the server currently holds for this line. */
  quantity: number;
  /** The store is closed: browsable, not orderable. */
  disabled?: boolean;
  /** Re-read the cart once a change has landed. Awaited, so the local number
   *  is only handed back to the server's after the refetch has resolved —
   *  otherwise the card flashes the pre-change quantity. */
  onCartChanged: () => Promise<unknown>;
}

/**
 * Add, count, and adjust — without leaving the product grid.
 *
 * ## Three states, because the card has no room for one
 *
 * A card that always showed `trash · 1 · +` would spend its width on controls
 * nobody is using. So: `+` when the product is not in the cart, the **count
 * alone** when it is and nothing is being adjusted, and the full
 * `trash · n · +` while it is. That is what pays for the smaller cards and the
 * extra column beside them.
 *
 * **Adding opens the control in one tap.** The first press adds *and*
 * expands — asking for a second press on the "1" to reach the minus is two
 * taps for one intention, and the person who has just added is the one most
 * likely to want to adjust. The collapsed count is what you come back to
 * later, not what you pass through on the way in.
 *
 * It collapses again on the next click outside itself. Not on a timer — a
 * control that folds away while somebody is deciding is a control that has to
 * be found twice.
 *
 * ## Why the trash is real here and decorative in the modal
 *
 * `ProductDetailsModal` shows the same icon at quantity 1 and disables it: the
 * dish is not in the cart yet, so there is nothing to delete and the icon only
 * says "this is the floor". On a card the line exists, so pressing it must
 * actually remove it — `setCartLineQuantity(id, 0)` issues the delete.
 *
 * ## Optimistic, then absolute
 *
 * Taps move a local number immediately and schedule one request carrying the
 * **final** value. `/carts/add-to-cart` sets rather than increments, so a late
 * response cannot corrupt the line and the burst needs no queue. Between the
 * tap and the commit the local number wins; afterwards the server's does, and
 * a rejection simply lets the server's value reappear.
 *
 * Only ever mounted for products with no variations and no add-on groups —
 * anything with a choice attached still goes through the modal, which is the
 * only place a required add-on can be satisfied.
 */
export default function ProductQuantityStepper({
  productId,
  productName,
  quantity,
  disabled = false,
  onCartChanged,
}: ProductQuantityStepperProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  /** The customer's number while a commit is outstanding; `null` means the
   *  server's is the one to show. */
  const [draft, setDraft] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const shown = draft ?? quantity;

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  // Leaving the page mid-burst must not lose the tap. The debounce exists to
  // spare the API a request per press, not to make a press conditional on
  // staying put — so an outstanding draft is flushed on the way out, without
  // awaiting: nothing is left to render the result to, and the cart is
  // re-read on the next mount anyway.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const target = draftRef.current;
      if (target === null) return;
      draftRef.current = null;
      void setCartLineQuantity(productId, target).catch(() => {});
    },
    [productId],
  );

  /**
   * Sends the outstanding draft, one request at a time.
   *
   * A loop rather than a call per tap, because two commits in flight together
   * can land out of order and the *earlier* number would win — the one case
   * absolute quantities do not save us from. While this is running, a new tap
   * only moves `draftRef`; the loop picks it up on its next turn and stops
   * when the draft and the server agree.
   */
  const commit = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPending(true);

    try {
      while (draftRef.current !== null) {
        const target = draftRef.current;
        try {
          await setCartLineQuantity(productId, target);
          if (target === 0) {
            toast.success(t("removedFromCart").replace("{product}", productName));
          }
        } catch (error) {
          // The draft is dropped rather than retried: the server's number is
          // the truth, and re-sending a value it has already refused is how a
          // card ends up arguing with the cart.
          draftRef.current = null;
          setDraft(null);
          toast.error(getApiErrorMessage(error, "Could not update the cart"));
          break;
        }

        // Wait for the refetch before handing the number back to the server's
        // copy, so the card never shows the pre-change quantity in between.
        await onCartChanged();
        if (draftRef.current === target) {
          draftRef.current = null;
          setDraft(null);
        }
      }
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, [onCartChanged, productId, productName, t]);

  const schedule = useCallback(
    (next: number) => {
      draftRef.current = next;
      setDraft(next);
      if (next === 0) setExpanded(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void commit(), COMMIT_DELAY_MS);
    },
    [commit],
  );

  /** Guests get the same treatment the modal gives them. */
  const requireAuth = useCallback(() => {
    if (getAccessToken()) return true;
    toast.error(t("pleaseLogInToAddToCart"));
    router.push("/login");
    return false;
  }, [router, t]);

  const stop = (event: React.MouseEvent) => {
    // The card's image and name open the details modal. Nothing in here should.
    event.stopPropagation();
    event.preventDefault();
  };

  if (shown <= 0) {
    return (
      <Button
        size="icon"
        onClick={(event) => {
          stop(event);
          if (!requireAuth()) return;
          // Straight into the open control. Adding and then having to press
          // the "1" to reach the minus is two taps for one intention, and the
          // second one teaches nothing — the customer who just added is the
          // customer most likely to adjust.
          setExpanded(true);
          schedule(1);
        }}
        disabled={disabled}
        aria-label={disabled ? t("storeClosedTitle") : t("addToCart")}
        className="size-9 shrink-0 rounded-xl hover:scale-105 disabled:hover:scale-100"
      >
        <Plus size={16} />
      </Button>
    );
  }

  if (!expanded) {
    return (
      <Button
        size="icon"
        onClick={(event) => {
          stop(event);
          setExpanded(true);
        }}
        disabled={disabled}
        aria-label={t("changeQuantity").replace("{product}", productName)}
        // `aria-busy` and no spinner. Swapping the count for one was the whole
        // of the "it takes a moment" complaint: the number is already correct
        // the instant it is tapped, and replacing it with a spinner turned an
        // optimistic update back into a wait.
        aria-busy={pending}
        className="size-9 shrink-0 rounded-xl tabular-nums hover:scale-105 disabled:hover:scale-100"
      >
        {shown}
      </Button>
    );
  }

  return (
    <div
      ref={rootRef}
      onClick={stop}
      aria-busy={pending}
      className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-card p-1"
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={(event) => {
          stop(event);
          schedule(shown - 1);
        }}
        disabled={disabled}
        aria-label={shown <= 1 ? t("remove") : t("decrease")}
        className={`size-8 rounded-lg ${
          shown <= 1
            ? "text-red-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
            : ""
        }`}
      >
        {shown <= 1 ? <Trash2 size={14} /> : <Minus size={14} />}
      </Button>

      <span className="w-5 text-center text-sm font-bold tabular-nums text-gray-900 dark:text-white">
        {shown}
      </span>

      <Button
        size="icon"
        onClick={(event) => {
          stop(event);
          schedule(shown + 1);
        }}
        disabled={disabled}
        aria-label={t("increase")}
        className="size-8 rounded-lg"
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}
