"use client";

import { ShoppingBasket } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatEuro } from "@/lib/currency";
import type { SmallOrderFeeNudge as Nudge } from "@/lib/smallOrderFee";
import { cn } from "@/lib/utils";

/**
 * "Add 2.50 € more to avoid the 2.46 € small order fee", with a bar at
 * `grandTotal / threshold` (guide §3). Renders nothing without a nudge, so a
 * waived or disabled fee says nothing at all.
 */
export default function SmallOrderFeeNudge({
  nudge,
  className,
}: {
  nudge: Nudge | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!nudge) return null;
  const percent = Math.round(nudge.progress * 100);

  return (
    <div
      role="status"
      className={cn(
        "rounded-2xl border border-primary/20 bg-primary/5 p-3 dark:border-pink-900/40 dark:bg-pink-950/20",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-sm font-medium text-gray-900 dark:text-neutral-100">
        <ShoppingBasket size={16} className="mt-0.5 shrink-0 text-primary dark:text-pink-400" />
        <span className="min-w-0">
          {t("smallOrderFeeNudge")
            .replace("{amount}", formatEuro(nudge.differenceToFree))
            .replace("{fee}", formatEuro(nudge.fee))}
        </span>
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t("smallOrderFee")}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15 dark:bg-pink-950/60"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 dark:bg-pink-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
