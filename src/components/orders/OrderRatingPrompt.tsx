/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRatingPromptOrders } from "@/hooks/queries/useOrders";
import { getAccessToken } from "@/lib/authCookies";
import { useLocationStore } from "@/stores/locationStore";
import {
  markRatingPromptSeen,
  pickRatingPromptOrder,
  readSeenRatingPrompts,
  type RatingPromptOrder,
} from "@/lib/ratingPrompt";
import OrderRatingDialog from "./OrderRatingDialog";

/**
 * Asks for feedback right after an order completes (4 Oct 2026).
 *
 * Mounted once in the (main) layout. It watches the customer's recent orders
 * (`useRatingPromptOrders`) and opens the rating dialog for the newest order
 * that just completed and still has something to rate. Which order qualifies,
 * and why, is in `lib/ratingPrompt.ts`.
 *
 * - **Signed-in customers only.** A guest has no orders, so this makes no
 *   request for them.
 * - **Not during checkout** (`/cart…`). A pop-up over the payment step would
 *   interrupt it; the prompt waits for the next page instead.
 * - **Not over the location prompt.** It waits until that one is closed.
 * - **One per visit.** Never a second pop-up right after the first closes.
 * - **Once per order.** It is marked seen as it opens, so closing it, "Not
 *   now", or rating all end the prompt for that order. The order card's Rate
 *   button stays available.
 */
export default function OrderRatingPrompt() {
  const pathname = usePathname() ?? "";
  const authed = typeof window !== "undefined" && Boolean(getAccessToken());
  const { data: orders } = useRatingPromptOrders<RatingPromptOrder>({ enabled: authed });

  const [open, setOpen] = useState<RatingPromptOrder | null>(null);
  // At most one prompt per visit. Two qualifying orders (a delivery last night
  // and a pickup this morning) otherwise open back to back: "Not now" on the
  // first opened the second at once, which is nagging. The next one waits for
  // the next visit (a reload or a new tab).
  const askedThisVisit = useRef(false);
  // One pop-up at a time: while the location prompt is up (a first visit, or
  // no saved address), this waits and opens after it closes.
  const locationPromptOpen = useLocationStore((state) => state.showPromptModal);
  const blocked = pathname.startsWith("/cart") || locationPromptOpen;

  // Picked here rather than during render: it reads the clock and this
  // browser's storage. Re-runs when the orders refresh, the page changes, or
  // the dialog closes.
  useEffect(() => {
    if (!authed || open || blocked || askedThisVisit.current) return;
    const candidate = pickRatingPromptOrder(orders, {
      now: Date.now(),
      seen: readSeenRatingPrompts(),
    });
    if (!candidate) return;
    markRatingPromptSeen(candidate.orderId);
    askedThisVisit.current = true;
    // Opening reacts to data arriving from the server, the case the rule's own
    // docs allow.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(candidate);
  }, [authed, open, blocked, orders]);

  if (!open) return null;

  return (
    <OrderRatingDialog
      key={open._id}
      order={open as any}
      prompt
      onClose={() => setOpen(null)}
    />
  );
}
