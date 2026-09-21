"use client";

import { useEffect, useRef } from "react";

/**
 * The hand-built modals open right now. Only the one drawn on top answers
 * Escape, so one key press closes one layer.
 *
 * "On top" is the **layer** first — the overlay's z-index — and only then the
 * most recently opened. Opening order alone was the first version, and it was
 * wrong where it mattered: a first-time visitor on a shared dish link gets the
 * location prompt (z-9999) *and* the dish (z-999), and the dish opens later
 * because it waits for its data. Newest-first closed the dish hidden behind
 * the prompt.
 *
 * Module state on purpose: it is the page's stack, not any one component's,
 * and it lives exactly as long as the modals in it (each removes itself when
 * it closes or unmounts).
 */
type OpenModal = { id: symbol; layer: number; order: number };
const openModals: OpenModal[] = [];
let opened = 0;

/** The modal drawn on top: highest layer, then the newest in it. */
function topModal(): symbol | undefined {
  let top: OpenModal | undefined;
  for (const modal of openModals) {
    if (!top || modal.layer > top.layer || (modal.layer === top.layer && modal.order > top.order)) {
      top = modal;
    }
  }
  return top?.id;
}

/**
 * Escape closes this modal — exactly as its ✕ does, and nothing more.
 *
 * For the hand-built overlays (`fixed inset-0`). The library's dialogs
 * (`@/components/ui/dialog`, `alert-dialog`, Radix) do this themselves and do
 * not need it.
 *
 * ## The rules
 *
 * - **Only the top modal closes.** Two open, one Escape: the upper one goes,
 *   the lower one stays. Opening order is stacking order.
 * - **A library dialog on top wins.** Radix handles Escape during capture and
 *   marks the event handled (`defaultPrevented`); this listener runs later, sees
 *   that, and leaves the modal underneath alone.
 * - **`disabled` while something is in flight** — placing an order, deleting
 *   the account, saving an address — exactly when the ✕ is disabled too. A key
 *   press must not close a modal the mouse is not allowed to.
 * - **Not mid-composition.** An Escape that cancels an IME (a phone keyboard,
 *   Japanese input) belongs to the text field, not to the modal.
 *
 * `layer` is the overlay's z-index (`z-50` → 50, the default). It must match
 * the class — `verify:escape` reads both and fails if they drift.
 *
 * `onClose` and `disabled` are read when the key is pressed, not when the modal
 * opened, so the latest ones always apply without re-registering.
 */
export function useEscapeToClose(
  open: boolean,
  onClose: () => void,
  options?: { disabled?: boolean; layer?: number },
) {
  const layer = options?.layer ?? 50;
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(Boolean(options?.disabled));

  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = Boolean(options?.disabled);
  });

  useEffect(() => {
    if (!open) return;

    const id = Symbol("modal");
    openModals.push({ id, layer, order: ++opened });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      if (event.defaultPrevented) return;
      if (topModal() !== id) return;
      // Claimed even while disabled: a busy modal on top must not let the
      // key fall through to the one underneath.
      event.preventDefault();
      if (disabledRef.current) return;
      onCloseRef.current();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openModals.findIndex((modal) => modal.id === id);
      if (index !== -1) openModals.splice(index, 1);
    };
  }, [open, layer]);
}
