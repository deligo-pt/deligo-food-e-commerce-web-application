"use client";

import { useEffect, useState } from "react";
import { Ban, Moon, PauseCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { useAvailabilityRefresh } from "@/hooks/useAvailabilityRefresh";
import { pauseReasonText, type Availability } from "@/lib/availability";
import { msUntil } from "@/lib/serverClock";
import { backText, capitalize, formatRemaining, opensText } from "@/lib/storeStatusText";
import { vendorCopyKey, type VendorKind } from "@/lib/vendorKind";
import { DEFAULT_STORE_TIME_ZONE } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";
import { StoreTimeChip } from "@/components/vendors/CardStoreStatus";

interface StoreStatusBannerProps {
  availability: Availability | null;
  vendorKind: VendorKind;
  /** The store's IANA zone when the response sent one. */
  timeZone?: string | null;
  /** Called when `resumeAt` / `nextOpenAt` arrives, to refetch the vendor. */
  onStateChange?: () => void;
  /** The order can still be scheduled for later, so the notice says so. */
  canScheduleLater?: boolean;
  /**
   * The slot list said `VENDOR_NOT_ACCEPTING_ORDERS` (guide §2): ordering is
   * hidden for this vendor, so the notice shows even while it is open.
   */
  notAcceptingOrders?: boolean;
  /** Tighter spacing for the product popup's footer. */
  compact?: boolean;
  className?: string;
}

/**
 * The notice for a store that cannot take an order right now
 * (guide §1): renders nothing while it is `OPEN`, extended hours included.
 *
 * - `CLOSED`: "This restaurant is closed", then the time as a chip
 *   ("🕖 Opens tomorrow at 09:00", the listing card's `StoreTimeChip`).
 * - `PAUSED`: "This restaurant is temporarily paused", an amber "Back at 15:00" chip, a live
 *   countdown to `resumeAt`, and the vendor's own message when it wrote one.
 *
 * When the order can be scheduled for later (`canScheduleLater`), the notice
 * says so instead of "you can browse the menu".
 */
export default function StoreStatusBanner({
  availability,
  vendorKind,
  timeZone,
  onStateChange,
  compact = false,
  canScheduleLater = false,
  notAcceptingOrders = false,
  className,
}: StoreStatusBannerProps) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang) as "en" | "pt";
  const zone = timeZone || DEFAULT_STORE_TIME_ZONE;

  useAvailabilityRefresh(availability, () => onStateChange?.());

  const isPaused = availability?.state === "PAUSED";
  const resumeAt = isPaused ? availability.resumeAt : null;

  // Client-only, so the server render (and its clock) never disagrees.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (!resumeAt) return;
    const tick = () => setRemainingMs(msUntil(resumeAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      setRemainingMs(null);
    };
  }, [resumeAt]);

  if (notAcceptingOrders) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
          compact ? "p-3" : "p-4",
          className,
        )}
      >
        <Ban
          size={compact ? 20 : 22}
          className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
        />
        <p
          className={cn(
            "min-w-0 flex-1 font-semibold text-amber-900 dark:text-amber-300",
            compact && "text-sm",
          )}
        >
          {t(vendorCopyKey("vendorNotAcceptingOrders", vendorKind))}
        </p>
      </div>
    );
  }

  if (!availability || availability.state === "OPEN") return null;

  const when = isPaused
    ? backText(availability, t, lang, zone)
    : opensText(availability, t, lang, zone);
  const reason = pauseReasonText(availability);
  const Icon = isPaused ? PauseCircle : Moon;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <Icon
        size={compact ? 20 : 22}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold text-amber-900 dark:text-amber-300",
            compact && "text-sm",
          )}
        >
          {t(vendorCopyKey(isPaused ? "storePausedTitle" : "storeClosedTitle", vendorKind))}
          {/* The same chip as the listing card, so the time reads the same in both. */}
          {when && <span className="sr-only">. {capitalize(when)}.</span>}
        </p>
        {when && (
          <div aria-hidden="true" className="mt-2">
            <StoreTimeChip
              when={capitalize(when)}
              paused={isPaused}
              className={compact ? undefined : "text-sm"}
            />
          </div>
        )}

        {isPaused && remainingMs !== null && remainingMs > 0 && (
          <p
            suppressHydrationWarning
            className="mt-1 text-sm text-amber-900 dark:text-amber-300"
          >
            {t("orderingResumesIn")}{" "}
            <span className="font-semibold tabular-nums">{formatRemaining(remainingMs, t)}</span>
          </p>
        )}

        {/* The vendor's own words, shown as written (never translated). */}
        {reason && (
          <p className="mt-1 text-sm italic text-amber-800 wrap-anywhere dark:text-amber-400/80">
            “{reason}”
          </p>
        )}

        <p className="mt-1 text-sm text-amber-800 dark:text-amber-400/80">
          {canScheduleLater
            ? t("scheduleLaterNotice")
            : t(vendorCopyKey(isPaused ? "storePausedNotice" : "storeClosedNotice", vendorKind))}
        </p>
      </div>
    </div>
  );
}
