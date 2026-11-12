"use client";

import { Clock, Moon, PauseCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { getAvailability, type VendorWithAvailability } from "@/lib/availability";
import { backText, capitalize, cardStatusLabel, opensText } from "@/lib/storeStatusText";
import { cn } from "@/lib/utils";

/**
 * A listing card's view of the store state, shared by the home page card
 * (`RestaurantsSection`) and the vendor grid card (`VendorCard`), which draw
 * the same overlay and status line.
 *
 * `isClosed` means "no ASAP order right now" — closed by schedule *or* paused.
 * Both dim the card the same way; only the words and icon differ. A card with
 * no availability data at all is treated as open, as before.
 *
 * `when` is the time on its own ("Opens at 19:00", "Back tomorrow at 09:00"),
 * so the card can highlight it (plan.md Part 3, Phase 12). It comes from the
 * backend's `nextOpenAt` / `resumeAt`, so in a lunch–dinner break it is the
 * start of dinner. Null when the time is not known: the card then reads as it
 * always did.
 */
export function useCardStoreStatus(
  vendor: VendorWithAvailability & { businessDetails?: { timezone?: string } | null },
) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang) as "en" | "pt";
  const availability = getAvailability(vendor);
  const state = availability?.state ?? "OPEN";
  const timeZone = vendor.businessDetails?.timezone;

  const when =
    state === "PAUSED"
      ? backText(availability, t, lang, timeZone)
      : state === "CLOSED"
        ? opensText(availability, t, lang, timeZone)
        : null;

  return {
    isClosed: state !== "OPEN",
    isPaused: state === "PAUSED",
    /** The whole line, for `title` and screen readers: "Closed · opens at 19:00". */
    label: cardStatusLabel(availability, t, lang, timeZone),
    /** "Open Now" / "Closed" / "Paused". */
    word: t(state === "OPEN" ? "openNow" : state === "PAUSED" ? "paused" : "closed"),
    when: when ? capitalize(when) : null,
  };
}

type CardStoreStatus = ReturnType<typeof useCardStoreStatus>;

/**
 * The highlighted time: "🕖 Opens at 19:00". Pink for a closed store (§1.4
 * gives the brand pink to availability), amber for a pause, as everywhere a
 * pause is shown. The pink text is the darker step, `--primary-hover`: the
 * brand pink itself is below 4.5:1 on its own tint at this size.
 */
export function StoreTimeChip({
  when,
  paused,
  className,
}: {
  when: string;
  paused: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-xs font-bold tabular-nums",
        paused
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
          : "bg-primary/10 text-primary-hover dark:bg-pink-950/50 dark:text-pink-400",
        className,
      )}
    >
      <Clock size={12} aria-hidden="true" className="shrink-0" />
      <span className="wrap-anywhere">{when}</span>
    </span>
  );
}

/**
 * The white time pill on a dimmed photo: "🕖 Opens tomorrow at 09:00". Used by
 * the card overlay and the vendor page's hero, so both read the same.
 * White in both themes on purpose: it sits on a dimmed photo, not on the card
 * surface, and a dark pill disappears into a dark photo.
 */
export function StoreTimePill({ when, paused }: { when: string; paused: boolean }) {
  return (
    <span className="flex h-8 max-w-full items-center gap-2 rounded-full bg-white px-4 text-xs font-bold tabular-nums text-neutral-900 shadow-lg">
      <Clock
        size={14}
        aria-hidden="true"
        className={cn("shrink-0", paused ? "text-amber-600" : "text-primary")}
      />
      <span className="truncate">{when}</span>
    </span>
  );
}

/**
 * The dimmed overlay on the card image: "Currently Closed" / "Temporarily
 * Paused", and under it the white `StoreTimePill`.
 */
export function CardStatusOverlay({ status }: { status: CardStoreStatus }) {
  const { t } = useTranslation();
  if (!status.isClosed) return null;
  const Icon = status.isPaused ? PauseCircle : Moon;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 px-4">
      <span className="flex h-8 items-center gap-2 rounded-full bg-black/70 px-4 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
        <Icon size={14} />
        {t(status.isPaused ? "currentlyPaused" : "currentlyClosed")}
      </span>
      {status.when && <StoreTimePill when={status.when} paused={status.isPaused} />}
    </div>
  );
}

/**
 * The labelled status in the card footer: green "Open Now", muted "Closed"
 * with the opening time as a pink chip, amber "Paused" with an amber chip.
 * Never truncated — the time is the useful part — so the footer row wraps and
 * the city moves down instead.
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
    <span
      className={`flex max-w-full shrink-0 flex-wrap items-center gap-2 ${tone}`}
      title={status.label}
    >
      <span className="sr-only">{status.label}</span>
      <span aria-hidden="true" className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${dot}`} />
        <span>{status.word}</span>
      </span>
      {/* Read out once, by the sr-only label above. */}
      {status.when && (
        <span aria-hidden="true" className="contents">
          <StoreTimeChip when={status.when} paused={status.isPaused} />
        </span>
      )}
    </span>
  );
}
