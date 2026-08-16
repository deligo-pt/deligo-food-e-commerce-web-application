import { create } from "zustand";
import type { SupportCategory } from "@/lib/support";

/**
 * Whether the support chat window is open, and what it was opened *about*.
 *
 * A store rather than props because the openers are scattered — the Help
 * Center's Live Chat row, three topic screens, the "Still need help?" footer,
 * the payment-failure screen — and none of them own the panel, which is mounted
 * once in the `(main)` layout. Prop-drilling from a layout through four routes
 * to reach a button is the arrangement this replaces.
 *
 * ## What it deliberately does not hold
 *
 * Messages. Those are server state and live in React Query (`useSupport.ts`);
 * copying them here would give two caches to keep in step. This store holds
 * only the intent behind opening the window, which no server knows about.
 *
 * ## Not persisted
 *
 * Unlike `themeStore`, nothing here survives a reload. A half-typed prefill and
 * an open overlay are the state of a moment, and restoring them on the next
 * visit would reopen a support window nobody asked for.
 */

export interface SupportChatIntent {
  /**
   * Seeded into the composer and left editable — the way the mobile app opens
   * with `Payment Question: Unrecognized Charge` already typed.
   *
   * This carries more weight than it looks. `category` is honoured only on a
   * ticket that has never been classified, so on every subsequent conversation
   * this sentence is the only part of "which topic did they pick" that reaches
   * a human. Build it with `buildTopicPrefill`.
   */
  prefill?: string | null;
  /** Best-effort — see `sendSupportMessage`. */
  category?: SupportCategory | null;
  /** The order's Mongo `_id`, not its `ORD-…` id. Also best-effort. */
  referenceOrderId?: string | null;
}

interface SupportChatState extends SupportChatIntent {
  isOpen: boolean;
  open: (intent?: SupportChatIntent) => void;
  close: () => void;
}

const EMPTY_INTENT: Required<SupportChatIntent> = {
  prefill: null,
  category: null,
  referenceOrderId: null,
};

export const useSupportChatStore = create<SupportChatState>()((set) => ({
  isOpen: false,
  ...EMPTY_INTENT,

  // The intent is replaced wholesale, never merged: opening from "Refund
  // Status" after "Order Issues" must not inherit the previous screen's
  // `referenceOrderId`.
  open: (intent) => set({ isOpen: true, ...EMPTY_INTENT, ...intent }),

  // The intent is cleared on close so reopening from a plain "Live Chat" row
  // starts blank rather than with the last topic still typed.
  close: () => set({ isOpen: false, ...EMPTY_INTENT }),
}));

/**
 * Open and close from outside React — an event handler, a router callback, a
 * logout path. Same shape as `useLocationStore.getState().…`, which the two
 * logout handlers already use.
 */
export const openSupportChat = (intent?: SupportChatIntent) =>
  useSupportChatStore.getState().open(intent);

export const closeSupportChat = () => useSupportChatStore.getState().close();
