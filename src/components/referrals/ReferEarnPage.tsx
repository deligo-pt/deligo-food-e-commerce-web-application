"use client";

import { useEffect, useRef, useState } from "react";
import {
  Gift,
  Copy,
  Share2,
  Clock3,
  Users,
  Wallet,
  Check,
  ChevronRight,
  Mail,
  MessageCircle,
  UserPen,
} from "lucide-react";
import Link from "next/link";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import ReferEarnSkeleton from "./ReferEarnSkeleton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
  // The Share Code menu: WhatsApp, Email, Copy, and the device's own sheet.
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  // Before the early returns below, as every hook here must be.
  useEscapeToClose(shareOpen, () => setShareOpen(false));
  useEffect(() => {
    if (!shareOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!shareRef.current?.contains(event.target as Node)) setShareOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [shareOpen]);
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
      toast.success(t("referralCodeCopied"));

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error(t("failedToCopyReferralCode"));
    }
  };

  /**
   * The message every channel sends, in the page's language. It carries a link
   * that fills the code in on the login page (`/login?ref=`), built from the
   * site it is shared from so test and live each point at themselves. Composed
   * here rather than interpolated: `t()` takes a key and has no placeholders.
   */
  const buildShareMessage = (code: string) => {
    const link = `${window.location.origin}/login?ref=${encodeURIComponent(code)}`;
    return `${t("referralShareIntro")} ${code} — ${t("referralShareOutro")}: ${link}`;
  };

  type ShareChannel = "whatsapp" | "email" | "copy" | "device";

  const handleShare = async (channel: ShareChannel) => {
    const code = referralData?.myReferralCode;
    if (!code) return;
    setShareOpen(false);
    const message = buildShareMessage(code);

    if (channel === "whatsapp") {
      // wa.me opens the app on a phone and WhatsApp Web on a computer.
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (channel === "email") {
      window.location.assign(
        `mailto:?subject=${encodeURIComponent(t("referralShareSubject"))}&body=${encodeURIComponent(message)}`,
      );
      return;
    }
    try {
      if (channel === "device" && typeof navigator.share === "function") {
        await navigator.share({ title: t("referralShareSubject"), text: message });
        return;
      }
      await navigator.clipboard.writeText(message);
      toast.success(t("referralInfoCopied"));
    } catch (error) {
      // Closing the device's share sheet is the customer's choice, not a
      // failure: it used to raise "Failed to share" every time.
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Share failed:", error);
      toast.error(t("failedToShareReferralCode"));
    }
  };

  if (loading) {
    return <ReferEarnSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-neutral-950 px-4 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-md border border-border text-red-500 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 motion-fade">
        {/* Breadcrumbs */}
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground dark:text-neutral-400">
          <span>{t("home")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 dark:text-neutral-500" />
          <span>{t("settings")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 dark:text-neutral-500" />
          <span className="font-semibold text-foreground dark:text-neutral-200">
            {t("referrals")}
          </span>
        </div>

        {/* Hero Section */}
        <section className="mb-8 flex justify-center">
          <div className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-sm border border-border md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 dark:bg-pink-950/40">
                <Gift className="h-8 w-8 text-primary dark:text-pink-400" />
              </div>

              <h1 className="mb-4 text-2xl lg:text-display font-bold text-foreground dark:text-neutral-50">
                {t("yourReferralCode")}
              </h1>

              {/* No code yet: the account has no name. A code is only issued
                  once the profile has one, and sign-up never asks for it, so
                  email/phone accounts land here with nothing to show. Say so
                  and point at the fix, instead of "N/A" and a copy button
                  that copies nothing (17 Oct 2026). */}
              {!referralData?.myReferralCode?.trim() ? (
                <div className="w-full max-w-sm">
                  <p className="mb-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-sm font-medium leading-6 text-foreground dark:border-pink-500/30 dark:bg-pink-950/10 dark:text-neutral-200">
                    {t("referralNeedsProfile")}
                  </p>
                  <Button
                    asChild
                    size="lg"
                    className="w-full gap-2 rounded-xl font-semibold active:scale-[0.99]"
                  >
                    <Link href="/edit-profile">
                      <UserPen className="h-4 w-4" aria-hidden />
                      {t("completeProfile")}
                    </Link>
                  </Button>
                </div>
              ) : (
              <>
              <div className="mb-6 w-full max-w-sm">
                <button
                  onClick={handleCopy}
                  className={`focus-ring flex w-full items-center justify-between rounded-xl border-2 border-dashed p-4 transition-all duration-200 ${
                    copied
                      ? "border-primary dark:border-pink-500 bg-primary/5 dark:bg-pink-950/10"
                      : "border-border bg-white dark:bg-neutral-900/30 hover:border-primary dark:hover:border-pink-500"
                  }`}
                >
                  <span className="text-xl font-extrabold tracking-[0.2em] text-primary dark:text-pink-400 md:text-2xl">
                    {referralData.myReferralCode}
                  </span>

                  {copied ? (
                    <Check className="h-5 w-5 text-primary dark:text-pink-400" />
                  ) : (
                    <Copy className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  )}
                </button>
              </div>

              <div ref={shareRef} className="relative w-full max-w-sm">
                <Button
                  size="lg"
                  onClick={() => setShareOpen((open) => !open)}
                  disabled={!referralData?.myReferralCode}
                  aria-haspopup="menu"
                  aria-expanded={shareOpen}
                  className="w-full gap-2 rounded-xl font-semibold active:scale-[0.99]"
                >
                  <Share2 className="h-4 w-4" />
                  {t("shareCode")}
                </Button>

                {/* Same surface as the login page's country menu. Rendered
                    only once opened, so "More…" can ask the browser whether it
                    has a share sheet without a server/client mismatch. */}
                {shareOpen ? (
                  <div
                    role="menu"
                    aria-label={t("shareCode")}
                    className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-3xl border border-border bg-card p-2 text-left shadow-[0_24px_60px_rgba(16,24,40,0.18)] dark:shadow-none"
                  >
                    {(
                      [
                        {
                          channel: "whatsapp",
                          label: t("shareViaWhatsApp"),
                          icon: MessageCircle,
                          chip: "bg-[#25D366]/10 text-[#1da851] dark:bg-[#25D366]/15 dark:text-[#25D366]",
                        },
                        {
                          channel: "email",
                          label: t("shareViaEmail"),
                          icon: Mail,
                          chip: "bg-primary/10 text-primary dark:bg-pink-950/30 dark:text-pink-400",
                        },
                        {
                          channel: "copy",
                          label: t("copyShareMessage"),
                          icon: Copy,
                          chip: "bg-primary/10 text-primary dark:bg-pink-950/30 dark:text-pink-400",
                        },
                        ...(typeof navigator !== "undefined" && typeof navigator.share === "function"
                          ? [
                              {
                                channel: "device",
                                label: t("shareMoreOptions"),
                                icon: Share2,
                                chip: "bg-primary/10 text-primary dark:bg-pink-950/30 dark:text-pink-400",
                              },
                            ]
                          : []),
                      ] as { channel: ShareChannel; label: string; icon: typeof Mail; chip: string }[]
                    ).map(({ channel, label, icon: Icon, chip }) => (
                      <button
                        key={channel}
                        type="button"
                        role="menuitem"
                        onClick={() => void handleShare(channel)}
                        className="focus-ring flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-primary/5 dark:text-neutral-200 dark:hover:bg-pink-950/20"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${chip}`}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              </>
              )}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
            <Clock3 className="mx-auto mb-3 h-8 w-8 text-primary dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-primary dark:text-pink-400">
              {referralData?.summary.pendingInvites ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("pendingInvites")}
            </p>
          </div>

          <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
            <Users className="mx-auto mb-3 h-8 w-8 text-primary dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-primary dark:text-pink-400">
              {referralData?.summary.successfulInvites ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("friendsReferred")}
            </p>
          </div>

          <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
            <Wallet className="mx-auto mb-3 h-8 w-8 text-primary dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-primary dark:text-pink-400">
              {referralData?.summary.totalEarned ?? 0}&nbsp;€
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("rewardsEarned")}
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="rounded-2xl bg-card p-6 shadow-sm border border-border md:p-8">
          <h2 className="mb-8 text-center text-2xl lg:text-display font-bold text-foreground dark:text-neutral-50">
            {t("howItWorks")}
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary dark:bg-pink-500 text-xl font-bold text-white">
                1
              </div>

              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-neutral-100">
                {t("shareYourCode")}
              </h3>

              <p className="text-sm text-muted-foreground dark:text-neutral-400">
                {t("shareYourCodeDescription")}
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary dark:bg-pink-500 text-xl font-bold text-white">
                2
              </div>

              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-neutral-100">
                {t("theySignUp")}
              </h3>

              <p className="text-sm text-muted-foreground dark:text-neutral-400">
                {t("theySignUpDescription")}
              </p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary dark:bg-pink-500 text-xl font-bold text-white">
                3
              </div>

              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-neutral-100">
                {t("bothGetRewards")}
              </h3>

              <p className="text-sm text-muted-foreground dark:text-neutral-400">
                {t("bothGetRewardsDescription")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
