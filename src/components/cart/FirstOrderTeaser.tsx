"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, Gift, Phone } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { formatEuro } from "@/lib/currency";
import { firstOrderTeaser } from "@/lib/firstOrderOffer";
import { cn } from "@/lib/utils";
import type { CartFirstOrderOffer } from "@/types/offer";

/**
 * The store's welcome offer, from the cart's `firstOrderOffer`
 * (`first-order-offers.md` §6.1). An estimate only: the payment page shows the
 * real amount (`orderCalculation.totalOfferDiscount`). Renders nothing when
 * there is no offer or it was already used.
 *
 * `compact` is the one-line version for the store card on `/cart`.
 */
export default function FirstOrderTeaser({
  offer,
  compact = false,
  className,
}: {
  offer: CartFirstOrderOffer | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const teaser = firstOrderTeaser(offer);
  if (teaser.kind === "hidden") return null;

  const code = teaser.kind === "code" || teaser.kind === "locked" ? teaser.code : undefined;

  let text: string;
  switch (teaser.kind) {
    case "estimate":
      text = t("firstOrderTeaserEstimate").replace("{amount}", formatEuro(teaser.discount));
      break;
    case "code":
      text = t("firstOrderTeaserCode")
        .replace("{code}", teaser.code)
        .replace("{amount}", formatEuro(teaser.discount ?? 0));
      break;
    case "locked":
      text = t("firstOrderTeaserLocked");
      break;
    case "verifyPhone":
      text = t("firstOrderTeaserVerifyPhone");
      break;
  }

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div
      role="status"
      className={cn(
        "rounded-2xl border border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100",
        compact ? "px-3 py-2" : "p-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Gift size={16} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
        <div className="min-w-0 flex-1">
          {!compact && (
            <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
              {t("firstOrderBadge")} · {t("firstOrderOncePerCustomer")}
            </span>
          )}
          <p className={cn("break-words", compact ? "text-xs font-medium" : "text-sm font-medium")}>
            {/* The phone and "add more" sentences already name the offer. */}
            {compact && (teaser.kind === "estimate" || teaser.kind === "code") && (
              <span className="font-bold">{t("firstOrderBadge")}: </span>
            )}
            {text}
          </p>

          {(code || teaser.kind === "verifyPhone") && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {code && (
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={`${t("copyCode")}: ${code}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-dashed border-green-400 bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-green-800 hover:bg-green-100 dark:border-green-700 dark:bg-green-950/60 dark:text-green-200 dark:hover:bg-green-900/50"
                >
                  <span className="truncate">{code}</span>
                  {copied ? <Check size={14} className="shrink-0" /> : <Copy size={14} className="shrink-0" />}
                </button>
              )}
              {teaser.kind === "verifyPhone" && (
                <Link
                  href="/edit-profile"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                >
                  <Phone size={14} />
                  {t("firstOrderVerifyPhoneAction")}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
