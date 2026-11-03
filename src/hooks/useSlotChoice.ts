"use client";

import { useState } from "react";
import { useCheckoutSlots } from "@/hooks/queries/useCheckoutSlots";
import { getApiErrorKey } from "@/lib/apiClient";
import type { ChosenSlot, FulfillmentType } from "@/types/slots";

interface UseSlotChoiceOptions {
  vendorId: string | null | undefined;
  fulfillmentType: FulfillmentType;
  /** True while this fulfilment type is the one being checked out. */
  active: boolean;
}

/**
 * One fulfilment type's slot on the checkout page: today's list (can anything
 * be booked at all?), the customer's confirmed choice, and that choice checked
 * against a fresh list of its own day.
 *
 * Pickup and delivery each get their own, because their lead times differ: a
 * pickup slot is not a valid delivery slot.
 */
export function useSlotChoice({ vendorId, fulfillmentType, active }: UseSlotChoiceOptions) {
  // Today's slots. Shares its cache with the picker's own "today" request.
  const today = useCheckoutSlots({ vendorId, fulfillmentType });
  const todayKey = getApiErrorKey(today.error);

  /**
   * Can this type be booked at all? A store (three bookable days) stays
   * bookable when today is empty; the picker then offers the next day. While
   * the list loads, or after a network error, it is assumed bookable and the
   * picker shows the real state.
   */
  const canSchedule = today.data
    ? today.data.slots.length > 0 || today.data.allowedDates.to !== today.data.allowedDates.from
    : !today.isLoading && todayKey !== "VENDOR_NOT_ACCEPTING_ORDERS";

  // What the customer last confirmed. Read through `slot`, which discards it
  // once the server stops listing it.
  const [choice, setChoice] = useState<ChosenSlot | null>(null);

  // The chosen day, refetched while it matters (every 3 min and on focus), so
  // a slot that passed or was withdrawn is noticed before Proceed.
  const chosenDay = useCheckoutSlots({
    vendorId,
    fulfillmentType,
    date: choice?.date ?? null,
    enabled: active && !!choice,
  });

  /**
   * The chosen slot, or null once the server stops listing it. Derived, not
   * cleared by an effect: a customer can choose 14:30, leave the tab and come
   * back at 14:40, and the row then asks again instead of failing at the
   * backend.
   */
  const slot =
    choice &&
    (!chosenDay.data || chosenDay.data.slots.some((s) => s.startTime === choice.slot.startTime))
      ? choice
      : null;

  return { today, todayKey, canSchedule, slot, setChoice };
}

/**
 * What the vendor page may offer (guide §1, §2):
 *
 * - `notAcceptingOrders`: the slot list answered `VENDOR_NOT_ACCEPTING_ORDERS`,
 *   so ordering is hidden for this vendor whatever its open state. Today's
 *   delivery list is asked for this even while the store is open; it is the
 *   same cached request checkout makes, so it costs nothing extra there.
 * - `canScheduleLater`: a store that is closed or paused right now can still
 *   be ordered from for later — today's delivery or pickup list has a slot, or
 *   the store books more than one day. False while the lists load and for
 *   guests (the endpoint is customer-only), so ordering stays blocked until it
 *   is known to be possible.
 */
export function useVendorOrdering(
  vendorId: string | null | undefined,
  { authed, isStoreClosed }: { authed: boolean; isStoreClosed: boolean },
) {
  const delivery = useCheckoutSlots({ vendorId, fulfillmentType: "DELIVERY", enabled: authed });
  const pickup = useCheckoutSlots({
    vendorId,
    fulfillmentType: "PICKUP",
    enabled: authed && isStoreClosed,
  });
  const notAcceptingOrders =
    authed &&
    [delivery.error, pickup.error].some(
      (error) => getApiErrorKey(error) === "VENDOR_NOT_ACCEPTING_ORDERS",
    );
  const bookable = (data: typeof delivery.data) =>
    !!data && (data.slots.length > 0 || data.allowedDates.to !== data.allowedDates.from);
  const canScheduleLater =
    authed && isStoreClosed && !notAcceptingOrders && (bookable(delivery.data) || bookable(pickup.data));
  return { canScheduleLater, notAcceptingOrders };
}
