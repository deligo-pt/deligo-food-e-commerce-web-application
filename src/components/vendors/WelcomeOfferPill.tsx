"use client";

import { Gift } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStoreWelcomeOffers } from "@/hooks/queries/useStoreWelcomeOffers";
import { formatEuro } from "@/lib/currency";

/**
 * "🎁 50% off 1st order" in the top-right corner of a store card's photo — the
 * one corner the rating (top-left) and delivery time (bottom-right) leave
 * free. Same 32px fully-round pill as those two; green, the app's discount
 * colour. Renders nothing for a store without a welcome offer.
 */
export default function WelcomeOfferPill({ vendorId }: { vendorId: string | undefined }) {
  const { t } = useTranslation();
  const offers = useStoreWelcomeOffers();
  const offer = vendorId ? offers.get(vendorId) : undefined;
  if (!offer) return null;

  const amount =
    offer.offerType === "PERCENT" && offer.discountValue > 0
      ? `${offer.discountValue}%`
      : offer.offerType === "FLAT" && offer.discountValue > 0
        ? formatEuro(offer.discountValue)
        : null;

  const label = amount ? t("firstOrderCardBadge").replace("{amount}", amount) : t("firstOrderBadge");
  const detail =
    (amount
      ? t("firstOrderCardTitle").replace("{amount}", amount)
      : t("firstOrderCardTitleGeneric")) +
    (offer.minOrderAmount > 0
      ? ` ${t("firstOrderCardMin").replace("{min}", formatEuro(offer.minOrderAmount))}`
      : "");

  return (
    <div className="absolute right-3 top-3 max-w-[60%]">
      <span
        title={detail}
        className="flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-green-600 px-3 text-xs font-bold text-white shadow-lg dark:bg-green-500 dark:text-neutral-950"
      >
        <Gift size={14} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
        <span className="sr-only">{detail}</span>
      </span>
    </div>
  );
}
