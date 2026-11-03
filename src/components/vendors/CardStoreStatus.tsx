"use client";

import { Moon, PauseCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { getAvailability, type VendorWithAvailability } from "@/lib/availability";
import { cardStatusLabel } from "@/lib/storeStatusText";

/**
 * A listing card's view of the store state, shared by the home page card
 * (`RestaurantsSection`) and the vendor grid card (`VendorCard`), which draw
 * the same overlay and status line.
 *
 * `isClosed` means "no ASAP order right now" — closed by schedule *or* paused.
 * Both dim the card the same way; only the words and icon differ. A card with
 * no availability data at all is treated as open, as before.
 */
export function useCardStoreStatus(
  vendor: VendorWithAvailability & { businessDetails?: { timezone?: string } | null },
) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang) as "en" | "pt";
  const availability = getAvailability(vendor);
  const state = availability?.state ?? "OPEN";

  return {
    isClosed: state !== "OPEN",
    isPaused: state === "PAUSED",
    label: cardStatusLabel(availability, t, lang, vendor.businessDetails?.timezone),
  };
}

type CardStoreStatus = ReturnType<typeof useCardStoreStatus>;

/** The dimmed overlay and badge on the card image: "Currently Closed" / "Temporarily Paused". */
export function CardStatusOverlay({ status }: { status: CardStoreStatus }) {
  const { t } = useTranslation();
  if (!status.isClosed) return null;
  const Icon = status.isPaused ? PauseCircle : Moon;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
      <span className="flex h-8 items-center gap-2 rounded-full bg-black/70 px-4 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
        <Icon size={14} />
        {t(status.isPaused ? "currentlyPaused" : "currentlyClosed")}
      </span>
    </div>
  );
}

/**
 * The labelled status in the card footer: green "Open Now", muted "Closed ·
 * opens at 11:00", amber "Paused · back at 15:00". Never truncated — the time
 * is the useful part — so the footer row wraps and the city moves down instead.
 */
export function CardStatusLine({ status }: { status: CardStoreStatus }) {
  const tone = status.isPaused
    ? "text-amber-600 dark:text-amber-400"
    : status.isClosed
      ? "text-[#9aa0a6] dark:text-neutral-500"
      : "text-success";
  const dot = status.isPaused
    ? "bg-amber-500"
    : status.isClosed
      ? "bg-[#9aa0a6] dark:bg-neutral-600"
      : "bg-success";

  return (
    <span className={`flex max-w-full shrink-0 items-center gap-2 ${tone}`} title={status.label}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span className="wrap-anywhere">{status.label}</span>
    </span>
  );
}
