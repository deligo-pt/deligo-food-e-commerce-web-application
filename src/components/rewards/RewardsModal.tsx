"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock3,
  Coins,
  Gift,
  LoaderCircle,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TriangleAlert,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useTranslation } from "@/hooks/useTranslation";
import { usePointsBalance } from "@/hooks/queries/useProfile";
import {
  expiringSoon,
  pointsRowKind,
  usePointsHistory,
  type PointsHistoryRow,
  type PointsRowKind,
} from "@/hooks/queries/usePoints";
import { formatOrderDate } from "@/lib/dateFormat";
import { useStore } from "@/stores/translationStore";
import RedeemTab from "./RedeemTab";

const KIND: Record<PointsRowKind, { icon: LucideIcon; label: string }> = {
  order: { icon: ShoppingBag, label: "pointsTypeOrder" },
  welcome: { icon: Sparkles, label: "pointsTypeWelcome" },
  referral: { icon: UserPlus, label: "pointsTypeReferral" },
  adjustment: { icon: RotateCcw, label: "pointsTypeAdjustment" },
  redeem: { icon: Gift, label: "pointsTypeRedeem" },
  expired: { icon: Clock3, label: "pointsTypeExpired" },
  other: { icon: Coins, label: "pointsTypeOther" },
};

/**
 * The Reward Points tile's modal: the balance, and every movement of it.
 *
 * A bottom sheet on a phone, a centred dialog from `sm` up. Claims have no list
 * of their own — the backend has no "my claims" endpoint (30 Oct 2026) — so
 * they appear here as "Reward claimed" rows, which also keeps the Spent total
 * matched by something on screen. Redeem is the first tab.
 */
export default function RewardsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Read once per mount: "expiring in 30 days" does not need to tick.
  const [now] = useState(() => Date.now());


  // The page behind must not scroll under a sheet; focus goes in on open and
  // back to the tile on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  // Redeem first: it is what the tile is for once there are points to spend.
  const [tab, setTab] = useState<"redeem" | "history">("redeem");
  const close = () => {
    setTab("redeem");
    onClose();
  };

  // Layer 999, like the dish modal: above the sticky header (z-50).
  useEscapeToClose(open, close, { layer: 999 });

  const balance = usePointsBalance({ enabled: open });
  const history = usePointsHistory({ enabled: open });

  if (!open) return null;

  const rows = history.data?.pages.flatMap((page) => page.rows) ?? [];
  const soon = expiringSoon(rows, now);

  // Portalled to <body>: inside the profile page the sheet shares the page's
  // stacking context, and the sticky header drew over its title and ✕.
  return createPortal(
    <div className="fixed inset-0 z-999 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewards-modal-title"
        className="relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:mx-4 sm:max-w-lg sm:rounded-2xl"
      >
        {/* Grab handle — a sheet cue on phones only. */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden />

        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-6 sm:pt-6">
          <h2 id="rewards-modal-title" className="text-xl font-bold text-foreground dark:text-neutral-50">
            {t("rewardPoints")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          {/* Balance */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-pink-500 p-4 text-white sm:p-6">
            <Coins className="absolute -bottom-6 -right-6 h-28 w-28 opacity-10" aria-hidden />
            <p className="text-sm font-medium text-white/85">{t("availablePoints")}</p>
            {balance.isLoading ? (
              <div className="mt-2 h-9 w-24 animate-pulse rounded bg-white/25" />
            ) : (
              <p className="mt-1 text-display font-bold" aria-live="polite">
                {balance.data?.currentPoints ?? 0}
                <span className="ml-1 text-base font-semibold text-white/85">{t("pointsUnit")}</span>
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-sm">
              <div>
                <p className="text-white/75">{t("pointsTotalEarned")}</p>
                <p className="font-semibold">{balance.data?.totalEarned ?? 0}</p>
              </div>
              <div>
                <p className="text-white/75">{t("pointsTotalSpent")}</p>
                <p className="font-semibold">{balance.data?.totalSpent ?? 0}</p>
              </div>
            </div>
          </div>

          {balance.isError ? (
            <p className="mt-2 text-sm text-red-500 dark:text-red-400">
              {t("failedToLoadPoints")}
            </p>
          ) : null}

          {/* Expiring soon — "up to", because the API cannot say how much of a
              lot is still unspent. */}
          {soon ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              <Clock3 className="mt-1 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {t("pointsExpiringSoon")
                  .replace("{points}", String(soon.points))
                  .replace("{date}", formatOrderDate(soon.by, lang))}
              </span>
            </div>
          ) : null}

          <div
            role="tablist"
            aria-label={t("rewardPoints")}
            className="mb-4 mt-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-gray-50 p-1 dark:bg-neutral-900"
          >
            {(
              [
                { value: "redeem", label: t("redeemTab") },
                { value: "history", label: t("pointsHistory") },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={`rewards-tab-${item.value}`}
                aria-selected={tab === item.value}
                aria-controls={`rewards-panel-${item.value}`}
                onClick={() => setTab(item.value)}
                className={`focus-ring rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                  tab === item.value
                    ? "bg-card text-primary shadow-sm dark:text-pink-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Both panels stay mounted, so a half-filled claim survives a look
              at the history. */}
          <div
            role="tabpanel"
            id="rewards-panel-redeem"
            aria-labelledby="rewards-tab-redeem"
            hidden={tab !== "redeem"}
          >
            <RedeemTab currentPoints={balance.data?.currentPoints} lang={lang} />
          </div>

          <div
            role="tabpanel"
            id="rewards-panel-history"
            aria-labelledby="rewards-tab-history"
            hidden={tab !== "history"}
          >
          {history.isLoading ? (
            <ul className="divide-y divide-border" aria-hidden>
              {[1, 2, 3].map((item) => (
                <li key={item} className="flex animate-pulse items-center gap-3 py-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-neutral-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-36 rounded bg-gray-200 dark:bg-neutral-800" />
                    <div className="h-3 w-24 rounded bg-gray-200 dark:bg-neutral-800" />
                  </div>
                  <div className="h-4 w-10 rounded bg-gray-200 dark:bg-neutral-800" />
                </li>
              ))}
            </ul>
          ) : history.isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <TriangleAlert className="h-8 w-8 text-red-500 dark:text-red-400" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("failedToLoadPointsHistory")}</p>
              <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
                {t("retry")}
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 dark:bg-pink-950/40">
                <Coins className="h-6 w-6 text-primary dark:text-pink-400" aria-hidden />
              </div>
              <p className="font-semibold text-foreground dark:text-neutral-100">
                {t("noPointsYet")}
              </p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground dark:text-neutral-400">
                {t("noPointsYetBody")}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <HistoryRow key={row._id} row={row} lang={lang} />
                ))}
              </ul>
              {history.hasNextPage ? (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={history.isFetchingNextPage}
                  onClick={() => void history.fetchNextPage()}
                >
                  {history.isFetchingNextPage ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  {t("loadMore")}
                </Button>
              ) : null}
            </>
          )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HistoryRow({ row, lang }: { row: PointsHistoryRow; lang: "en" | "pt" }) {
  const { t } = useTranslation();
  const kind = pointsRowKind(row.type);
  const { icon: Icon, label } = KIND[kind];
  const credit = row.points > 0;
  // Grey for anything that is gone: an expiry, or a credit that has lapsed.
  const muted = kind === "expired" || row.isExpired;
  const tone = muted
    ? "text-muted-foreground dark:text-neutral-400"
    : credit
      ? "text-green-700 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  const chip = muted
    ? "bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-400"
    : credit
      ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
      : "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400";

  const detail = row.isExpired
    ? t("pointsLotExpired")
    : credit && row.expireDate
      ? t("pointsExpiresOn").replace("{date}", formatOrderDate(row.expireDate, lang))
      : null;

  return (
    <li className="flex items-center gap-3 py-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${chip}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground dark:text-neutral-100">
          {t(label)}
        </p>
        <p className="text-xs text-muted-foreground dark:text-neutral-400">
          {formatOrderDate(row.createdAt, lang)}
          {detail ? ` · ${detail}` : null}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-bold tabular-nums ${tone}`}>
        {credit ? `+${row.points}` : `−${Math.abs(row.points)}`}
      </span>
    </li>
  );
}
