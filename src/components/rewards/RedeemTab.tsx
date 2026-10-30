"use client";

import { useRef, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Gift,
  LoaderCircle,
  MapPin,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { errorKeyOf, getApiErrorMessage } from "@/lib/apiClient";
import { formatEuro } from "@/lib/currency";
import { formatTimeOfDay, type CalendarDate, type TimeOfDay } from "@/lib/pickupTime";
import {
  formatPickupDay,
  formatPickupInstant,
  REWARD_PICKUP,
  rewardPickupDays,
  rewardPickupIso,
  rewardPickupTimes,
  sameDay,
} from "@/lib/rewardPickup";
import {
  useClaimReward,
  useRefreshPoints,
  useRewardCatalog,
  type RewardClaim,
  type RewardProduct,
} from "@/hooks/queries/useRewards";

type View =
  | { step: "list" }
  | { step: "claim"; reward: RewardProduct }
  | { step: "done"; reward: RewardProduct; claim: RewardClaim };

/**
 * Spending points: the catalog, then a pickup date and time, then the
 * confirmation. The confirmation is the only place a claim's reward and
 * pickup date are ever shown — there is no "my claims" API — so it says so.
 */
export default function RedeemTab({
  currentPoints,
  lang,
}: {
  /** `undefined` while the balance loads: nothing is claimable until known. */
  currentPoints: number | undefined;
  lang: "en" | "pt";
}) {
  const { t } = useTranslation();
  const catalog = useRewardCatalog();
  const [view, setViewState] = useState<View>({ step: "list" });
  const rootRef = useRef<HTMLDivElement>(null);
  // Each step starts at the top of the sheet, not wherever the last one was
  // scrolled to — the confirmation used to open half-way down.
  const setView = (next: View) => {
    setViewState(next);
    rootRef.current?.closest(".overflow-y-auto")?.scrollTo({ top: 0 });
  };
  // Set by a 409 REWARD_CLAIM_LIMIT_REACHED: the server's own message (it names
  // the limit and the year), and every Redeem button off until the modal closes.
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  if (view.step === "claim") {
    return (
      <div ref={rootRef}>
      <ClaimStep
        reward={view.reward}
        currentPoints={currentPoints ?? 0}
        lang={lang}
        onBack={() => setView({ step: "list" })}
        onClaimed={(claim) => setView({ step: "done", reward: view.reward, claim })}
        onLimit={(message) => {
          setLimitMessage(message);
          setView({ step: "list" });
        }}
        onGone={() => setView({ step: "list" })}
      />
      </div>
    );
  }

  if (view.step === "done") {
    return (
      <div ref={rootRef}>
      <DoneStep
        reward={view.reward}
        claim={view.claim}
        lang={lang}
        onDone={() => setView({ step: "list" })}
      />
      </div>
    );
  }

  if (catalog.isLoading) {
    return (
      <ul className="space-y-3" aria-hidden>
        {[1, 2].map((item) => (
          <li key={item} className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-neutral-800" />
        ))}
      </ul>
    );
  }

  if (catalog.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <TriangleAlert className="h-8 w-8 text-red-500 dark:text-red-400" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("failedToLoadRewards")}</p>
        <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const rewards = catalog.data ?? [];

  return (
    <div ref={rootRef} className="space-y-3">
      {limitMessage ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          <TriangleAlert className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          <span>{limitMessage}</span>
        </div>
      ) : null}

      {rewards.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 dark:bg-pink-950/40">
            <Gift className="h-6 w-6 text-primary dark:text-pink-400" aria-hidden />
          </div>
          <p className="font-semibold text-foreground dark:text-neutral-100">{t("noRewardsYet")}</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground dark:text-neutral-400">
            {t("noRewardsYetBody")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rewards.map((reward) => (
            <RewardCard
              key={reward._id}
              reward={reward}
              currentPoints={currentPoints}
              locked={!!limitMessage}
              onRedeem={() => setView({ step: "claim", reward })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PriceLine({ reward }: { reward: RewardProduct }) {
  const { t } = useTranslation();
  const struck = reward.regularPrice > reward.cashPrice;
  return (
    <p className="text-sm text-muted-foreground dark:text-neutral-400">
      {reward.cashPrice > 0 ? (
        t("rewardPayAtPickup").replace("{price}", formatEuro(reward.cashPrice))
      ) : (
        <span className="font-semibold text-green-700 dark:text-green-400">{t("rewardFree")}</span>
      )}
      {struck ? (
        <s className="ml-2 text-xs">{formatEuro(reward.regularPrice)}</s>
      ) : null}
    </p>
  );
}

function RewardCard({
  reward,
  currentPoints,
  locked,
  onRedeem,
}: {
  reward: RewardProduct;
  currentPoints: number | undefined;
  locked: boolean;
  onRedeem: () => void;
}) {
  const { t } = useTranslation();
  const have = currentPoints ?? 0;
  const short = Math.max(0, reward.requiredPoints - have);
  const progress = Math.min(100, Math.round((have / Math.max(1, reward.requiredPoints)) * 100));
  const canClaim = currentPoints !== undefined && short === 0 && !locked;

  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 dark:bg-pink-950/40">
          <Gift className="h-6 w-6 text-primary dark:text-pink-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground dark:text-neutral-100">{reward.name}</p>
          <PriceLine reward={reward} />
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary dark:bg-pink-950/40 dark:text-pink-400">
          {reward.requiredPoints} {t("pointsUnit")}
        </span>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={reward.requiredPoints}
        aria-valuenow={Math.min(have, reward.requiredPoints)}
        aria-label={t("rewardProgress")}
      >
        <div className="h-full rounded-full bg-primary dark:bg-pink-500" style={{ width: `${progress}%` }} />
      </div>

      <Button className="mt-3 w-full" disabled={!canClaim} onClick={onRedeem}>
        {short > 0 && !locked
          ? t("rewardNeedMorePoints").replace("{points}", String(short))
          : t("redeem")}
      </Button>
    </li>
  );
}

function ClaimStep({
  reward,
  currentPoints,
  lang,
  onBack,
  onClaimed,
  onLimit,
  onGone,
}: {
  reward: RewardProduct;
  currentPoints: number;
  lang: "en" | "pt";
  onBack: () => void;
  onClaimed: (claim: RewardClaim) => void;
  onLimit: (message: string) => void;
  onGone: () => void;
}) {
  const { t } = useTranslation();
  const claim = useClaimReward();
  const refresh = useRefreshPoints();
  const [days] = useState(() => rewardPickupDays());
  const times = rewardPickupTimes();
  const [day, setDay] = useState<CalendarDate | null>(null);
  const [time, setTime] = useState<TimeOfDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!day || !time || claim.isPending) return;
    const scheduledPickupDate = rewardPickupIso(day, time);
    // The API refuses a past date; the picker cannot produce one, but a sheet
    // left open past midnight could.
    if (new Date(scheduledPickupDate).getTime() <= Date.now()) {
      setError(t("rewardPickupDateInvalid"));
      return;
    }
    setError(null);
    claim.mutate(
      { productId: reward._id, scheduledPickupDate },
      {
        onSuccess: (data) => onClaimed(data),
        onError: (err) => {
          const key = axios.isAxiosError(err) ? errorKeyOf(err.response?.data) : undefined;
          switch (key) {
            case "REWARD_PICKUP_DATE_INVALID":
              setError(t("rewardPickupDateInvalid"));
              break;
            case "REWARD_PRODUCT_NOT_FOUND":
              void refresh.catalog();
              toast.error(t("rewardNoLongerAvailable"));
              onGone();
              break;
            case "INSUFFICIENT_POINTS_BALANCE":
              void refresh.balance();
              void refresh.history();
              setError(t("rewardNotEnoughPoints"));
              break;
            case "REWARD_CLAIM_LIMIT_REACHED":
              onLimit(getApiErrorMessage(err, t("rewardClaimFailed")));
              break;
            case "REWARD_CLAIM_CONFLICT":
              void refresh.balance();
              setError(t("rewardClaimConflict"));
              break;
            default:
              setError(getApiErrorMessage(err, t("rewardClaimFailed")));
          }
        },
      },
    );
  };

  const after = currentPoints - reward.requiredPoints;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        disabled={claim.isPending}
        className="focus-ring mb-3 flex items-center gap-1 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        {t("back")}
      </button>

      <div className="rounded-2xl border border-border p-4">
        <p className="font-semibold text-foreground dark:text-neutral-100">{reward.name}</p>
        <PriceLine reward={reward} />
        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("rewardCostsPoints")}</dt>
            <dd className="font-semibold text-red-600 dark:text-red-400">−{reward.requiredPoints}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("rewardBalanceAfter")}</dt>
            <dd className="font-semibold text-foreground">{Math.max(0, after)} {t("pointsUnit")}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("rewardPayAtOffice")}</dt>
            <dd className="font-semibold text-foreground">
              {reward.cashPrice > 0 ? formatEuro(reward.cashPrice) : t("rewardFree")}
            </dd>
          </div>
        </dl>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-semibold text-foreground">{t("rewardPickupDay")}</legend>
        {/* Scrolls sideways inside the sheet, never the page. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          {days.map((date) => {
            const label = formatPickupDay(date, lang);
            const selected = sameDay(day, date);
            return (
              <button
                key={`${date.year}-${date.month}-${date.day}`}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setDay(date);
                  setError(null);
                }}
                className={`focus-ring flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-sm transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary"
                }`}
              >
                <span className="text-xs capitalize opacity-80">{label.weekday}</span>
                <span className="font-semibold">{label.date}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-semibold text-foreground">{t("rewardPickupTime")}</legend>
        <div className="grid grid-cols-4 gap-2">
          {times.map((slot) => {
            const label = formatTimeOfDay(slot);
            const selected = !!time && time.hours === slot.hours && time.minutes === slot.minutes;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTime(slot);
                  setError(null);
                }}
                className={`focus-ring rounded-xl border py-2 text-sm font-medium tabular-nums transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <MapPin className="mt-1 h-3 w-3 shrink-0" aria-hidden />
        {t("rewardPickupNote")
          .replace("{open}", `${REWARD_PICKUP.openHour}:00`)
          .replace("{close}", `${REWARD_PICKUP.closeHour}:00`)}
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 mt-4 bg-card px-4 pb-1 pt-3 sm:-mx-6 sm:px-6">
        <Button className="w-full" size="lg" disabled={!day || !time || claim.isPending} onClick={submit}>
          {claim.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {!day || !time ? t("rewardChooseDayAndTime") : t("rewardConfirmClaim")}
        </Button>
      </div>
    </div>
  );
}

function DoneStep({
  reward,
  claim,
  lang,
  onDone,
}: {
  reward: RewardProduct;
  claim: RewardClaim;
  lang: "en" | "pt";
  onDone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-3 mt-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/20">
        <Check className="h-7 w-7 text-green-700 dark:text-green-400" aria-hidden />
      </div>
      <p className="text-xl font-bold text-foreground dark:text-neutral-50" role="status">
        {t("rewardClaimedTitle")}
      </p>
      <p className="mt-1 font-semibold text-foreground">{reward.name}</p>

      <dl className="mt-4 w-full space-y-2 rounded-2xl border border-border p-4 text-left text-sm">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-1 h-4 w-4 shrink-0 text-primary dark:text-pink-400" aria-hidden />
          <div>
            <dt className="text-muted-foreground">{t("rewardPickupOn")}</dt>
            <dd className="font-semibold text-foreground first-letter:uppercase">
              {formatPickupInstant(claim.scheduledPickupDate, lang)}
            </dd>
          </div>
        </div>
        <div className="flex justify-between gap-3 border-t border-border pt-2">
          <dt className="text-muted-foreground">{t("rewardPayAtOffice")}</dt>
          <dd className="font-semibold text-foreground">
            {claim.cashAmount > 0 ? formatEuro(claim.cashAmount) : t("rewardFree")}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("rewardPointsSpent")}</dt>
          <dd className="font-semibold text-foreground">{claim.pointsSpent} {t("pointsUnit")}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-muted-foreground">{t("rewardCollectNote")}</p>

      <Button className="mt-6 w-full" size="lg" onClick={onDone}>
        {t("done")}
      </Button>
    </div>
  );
}
