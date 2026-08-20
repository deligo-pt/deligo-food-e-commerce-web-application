import { create } from "zustand";

/**
 * "The customer asked to rate this order" — an intent handed from wherever the
 * ask happened to `/orders`, which owns the only rating modal in the app.
 *
 * ## Why a store and not `/orders?rate=ORD-…`
 *
 * `/orders` is a statically rendered route, and deliberately so: reading a
 * search param there would opt the whole route out of static rendering for the
 * sake of one transient value (see the comment on `OrdersPage`'s search term).
 * This is not a location either — it is not worth bookmarking, sharing or
 * restoring on reload, it is a single click's worth of intent.
 *
 * Set on click, read once by `OrdersPage`, cleared immediately. If it is not
 * consumed — the customer opened the link in a new tab, so this store starts
 * empty there — nothing breaks: they land on their orders and the card offers
 * the same Rate button.
 */
interface OrderRatingStore {
  /** The human-facing `ORD-…` id, matched against `order.orderId`. */
  pendingRatingOrderId: string | null;
  requestOrderRating: (orderId: string) => void;
  clearOrderRatingRequest: () => void;
}

export const useOrderRatingStore = create<OrderRatingStore>((set) => ({
  pendingRatingOrderId: null,

  requestOrderRating: (orderId) => set({ pendingRatingOrderId: orderId }),

  clearOrderRatingRequest: () => set({ pendingRatingOrderId: null }),
}));
