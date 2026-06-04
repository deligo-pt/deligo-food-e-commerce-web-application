"use client";

import { useEffect, useState } from "react";
import {
  Gift,
  Copy,
  Share2,
  Clock3,
  Users,
  Wallet,
  Check,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

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
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [referralData, setReferralData] =
    useState<ReferralResponse["data"] | null>(null);

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        setLoading(true);

        const response =
          await apiClient.get<ReferralResponse>(
            "/referrals/my-referrals"
          );

        setReferralData(response.data.data);
      } catch (error) {
        setError(
          getApiErrorMessage(
            error,
            "Failed to load referral information"
          )
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
      await navigator.clipboard.writeText(
        referralData.myReferralCode
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Copy failed:", error);
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
        alert("Referral information copied to clipboard");
      }
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-lg font-medium text-slate-600">
          Loading referral data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-lg text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Hero Section */}
        <section className="mb-10 flex justify-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-100">
                <Gift className="h-8 w-8 text-pink-600" />
              </div>

              <h1 className="mb-5 text-2xl font-bold text-slate-900 md:text-3xl">
                Your Referral Code
              </h1>

              <div className="mb-6 w-full max-w-sm">
                <button
                  onClick={handleCopy}
                  className={`flex w-full items-center justify-between rounded-xl border-2 border-dashed p-4 transition-all ${
                    copied
                      ? "border-pink-600 bg-pink-50"
                      : "border-slate-300 hover:border-pink-600"
                  }`}
                >
                  <span className="text-xl font-extrabold tracking-[0.2em] text-pink-600 md:text-2xl">
                    {referralData?.myReferralCode || "N/A"}
                  </span>

                  {copied ? (
                    <Check className="h-5 w-5 text-pink-600" />
                  ) : (
                    <Copy className="h-5 w-5 text-slate-500" />
                  )}
                </button>
              </div>

              <button
                onClick={handleShare}
                className="flex w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-pink-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-pink-700"
              >
                <Share2 className="h-4 w-4" />
                Share Code
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <Clock3 className="mx-auto mb-3 h-8 w-8 text-pink-600" />
            <h3 className="mb-0 text-2xl font-bold text-pink-600">
              {referralData?.summary.pendingInvites ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Invites
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <Users className="mx-auto mb-3 h-8 w-8 text-pink-600" />
            <h3 className="mb-0 text-2xl font-bold text-pink-600">
              {referralData?.summary.successfulInvites ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Friends Referred
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <Wallet className="mx-auto mb-3 h-8 w-8 text-pink-600" />
            <h3 className="mb-0 text-2xl font-bold text-pink-600">
              €{referralData?.summary.totalEarned ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Rewards Earned
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900 md:text-3xl">
            How It Works
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pink-600 text-xl font-bold text-white">
                1
              </div>

              <h3 className="mb-2 text-lg font-semibold">
                Share Your Code
              </h3>

              <p className="text-sm text-slate-600">
                Send your referral code to friends and family through social
                media, email or text.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pink-600 text-xl font-bold text-white">
                2
              </div>

              <h3 className="mb-2 text-lg font-semibold">
                They Sign Up
              </h3>

              <p className="text-sm text-slate-600">
                Your friend creates a new account using your unique referral
                code during registration.
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pink-600 text-xl font-bold text-white">
                3
              </div>

              <h3 className="mb-2 text-lg font-semibold">
                Both Get Rewards
              </h3>

              <p className="text-sm text-slate-600">
                You both receive rewards automatically after a successful
                referral.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}