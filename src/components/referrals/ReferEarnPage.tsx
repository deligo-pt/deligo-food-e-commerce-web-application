"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, Share2, Clock3, Users, Wallet, Check } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import ReferEarnSkeleton from "./ReferEarnSkeleton";
import { toast } from "sonner";

interface ReferralResponse {
  success: boolean;
  message: string;
  data: {
    myReferralCode: string;
    summary: {
      totalInvites: number;
      successfulInvites: number;
      pendingInvites: number;
      totalEarned: number;
      currentWalletBalance: number;
      friendsRemainingForNextMilestone: number;
    };
    milestones: {
      friendsRequired: number;
      rewardType: string;
      rewardValue: number;
      isCompleted: boolean;
      isNext: boolean;
    }[];
    referralHistory: unknown[];
  };
}

export default function ReferEarnPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [referralData, setReferralData] = useState<
    ReferralResponse["data"] | null
  >(null);

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        setLoading(true);

        const response = await apiClient.get<ReferralResponse>(
          "/referrals/my-referrals",
        );

        setReferralData(response.data.data);
      } catch (error) {
        setError(
          getApiErrorMessage(error, "Failed to load referral information"),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, []);

  const handleCopy = async () => {
    if (!referralData?.myReferralCode) return;

    try {
      await navigator.clipboard.writeText(referralData.myReferralCode);

      setCopied(true);
      toast.success("Referral code copied to clipboard");

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy referral code");
    }
  };

  const handleShare = async () => {
    if (!referralData?.myReferralCode) return;

    const shareText = `Join DeliGo using my referral code: ${referralData.myReferralCode}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "DeliGo Referral",
          text: shareText,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success("Referral information copied to clipboard");
      }
    } catch (error) {
      console.error("Share failed:", error);
      toast.error("Failed to share referral code");
    }
  };

  if (loading) {
    return <ReferEarnSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-neutral-950 px-4 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 text-center shadow-md border border-neutral-200 dark:border-neutral-800 text-red-500 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-10 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 animate-fadeIn">
        {/* Breadcrumbs */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[#5a4044] dark:text-neutral-400">
          <span>{t("home")}</span>
          <span>{t("settings")}</span>
          <span className="font-semibold text-[#191c1d] dark:text-neutral-200">
            {t("referrals")}
          </span>
        </div>

        {/* Hero Section */}
        <section className="mb-10 flex justify-center">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-sm border border-neutral-200 dark:border-neutral-800 md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/40">
                <Gift className="h-8 w-8 text-pink-600 dark:text-pink-400" />
              </div>

              <h1 className="mb-5 text-2xl font-bold text-[#191c1d] dark:text-neutral-50 md:text-3xl">
                {t("yourReferralCode")}
              </h1>

              <div className="mb-6 w-full max-w-sm">
                <button
                  onClick={handleCopy}
                  className={`flex w-full items-center justify-between rounded-xl border-2 border-dashed p-4 transition-all duration-200 ${
                    copied
                      ? "border-pink-600 dark:border-pink-500 bg-pink-50 dark:bg-pink-950/10"
                      : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/30 hover:border-pink-600 dark:hover:border-pink-500"
                  }`}
                >
                  <span className="text-xl font-extrabold tracking-[0.2em] text-[#b0004a] dark:text-pink-400 md:text-2xl">
                    {referralData?.myReferralCode || t("notAvailable")}
                  </span>

                  {copied ? (
                    <Check className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  ) : (
                    <Copy className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  )}
                </button>
              </div>

              <button
                onClick={handleShare}
                className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-[#b0004a] dark:bg-pink-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-[#90003b] dark:hover:bg-pink-700 active:scale-[0.99]"
              >
                <Share2 className="h-4 w-4" />
                {t("shareCode")}
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-xl bg-white dark:bg-neutral-900 p-5 text-center shadow-sm border border-neutral-200 dark:border-neutral-800">
            <Clock3 className="mx-auto mb-3 h-8 w-8 text-[#b0004a] dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-[#b0004a] dark:text-pink-400">
              {referralData?.summary.pendingInvites ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("pendingInvites")}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-neutral-900 p-5 text-center shadow-sm border border-neutral-200 dark:border-neutral-800">
            <Users className="mx-auto mb-3 h-8 w-8 text-[#b0004a] dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-[#b0004a] dark:text-pink-400">
              {referralData?.summary.successfulInvites ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("friendsReferred")}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-neutral-900 p-5 text-center shadow-sm border border-neutral-200 dark:border-neutral-800">
            <Wallet className="mx-auto mb-3 h-8 w-8 text-[#b0004a] dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-[#b0004a] dark:text-pink-400">
              €{referralData?.summary.totalEarned ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("rewardsEarned")}
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-sm border border-neutral-200 dark:border-neutral-800 md:p-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-[#191c1d] dark:text-neutral-50 md:text-3xl">
            {t("howItWorks")}
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#b0004a] dark:bg-pink-500 text-xl font-bold text-white">
                1
              </div>

              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-neutral-100">
                {t("shareYourCode")}
              </h3>

              <p className="text-sm text-[#5a4044] dark:text-neutral-400">
                {t("shareYourCodeDescription")}
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#b0004a] dark:bg-pink-500 text-xl font-bold text-white">
                2
              </div>

              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-neutral-100">
                {t("theySignUp")}
              </h3>

              <p className="text-sm text-[#5a4044] dark:text-neutral-400">
                {t("theySignUpDescription")}
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#b0004a] dark:bg-pink-500 text-xl font-bold text-white">
                3
              </div>

              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-neutral-100">
                {t("bothGetRewards")}
              </h3>

              <p className="text-sm text-[#5a4044] dark:text-neutral-400">
                {t("bothGetRewardsDescription")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
