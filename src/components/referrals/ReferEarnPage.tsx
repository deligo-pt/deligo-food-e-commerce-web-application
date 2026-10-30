"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Copy,
  Share2,
  Users,
  Coins,
  Check,
  Circle,
  Mail,
  MessageCircle,
  UserPen,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { isOptimizableImageHost } from "@/lib/imageHosts";
import { formatOrderDate } from "@/lib/dateFormat";
import {
  missingProfileFields,
  type MissingProfileField,
  type ProfileForCompleteness,
} from "@/lib/profileCompleteness";
import { useProfile } from "@/hooks/queries/useProfile";
import {
  hasReferralCode,
  useReferrals,
  type ReferralInvite,
} from "@/hooks/queries/useReferrals";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import ReferEarnSkeleton from "./ReferEarnSkeleton";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** The checklist line for each thing the profile still lacks. */
const MISSING_FIELD_KEYS: Record<MissingProfileField, string> = {
  firstName: "referralMissingFirstName",
  lastName: "referralMissingLastName",
  email: "referralMissingEmail",
  verifyEmail: "referralVerifyEmail",
  phone: "referralMissingPhone",
  verifyPhone: "referralVerifyPhone",
};

export default function ReferEarnPage() {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);
  const router = useRouter();
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

  // Same guard as the profile page: a guest has no referrals to load.
  useEffect(() => {
    if (!getAccessToken()) router.push("/login");
  }, [router]);

  const referrals = useReferrals();
  // The shared, cached profile — the navbar has usually fetched it already.
  const profile = useProfile<ProfileForCompleteness>();

  const referralData = referrals.data;
  const missing = missingProfileFields(profile.data);
  const apiCode = referralData?.myReferralCode;
  // Empty while the code is held back, so every use below has a real string.
  const code = missing.length === 0 && hasReferralCode(apiCode) ? apiCode.trim() : "";
  const showCode = code !== "";

  const handleCopy = async () => {
    if (!showCode) return;

    try {
      await navigator.clipboard.writeText(code);

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
    if (!showCode) return;
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

  if (referrals.isLoading || profile.isLoading) {
    return <ReferEarnSkeleton />;
  }

  const loadError = referrals.error ?? profile.error;
  if (loadError || !referralData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-neutral-950 px-4 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center shadow-md border border-border text-red-500 dark:text-red-400">
          {getApiErrorMessage(loadError, t("failedToLoadReferrals"))}
        </div>
      </div>
    );
  }

  const { summary, referralHistory = [] } = referralData;

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 transition-colors duration-200 text-gray-900 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 motion-fade">
        <Breadcrumbs
          label={t("breadcrumb")}
          className="text-xs"
          items={[
            { label: t("home"), href: "/" },
            { label: t("settings"), href: "/profile" },
            { label: t("referrals") },
          ]}
        />

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

              {/* The code is only handed out once the profile is complete —
                  both names, a verified email and a verified phone (30 Oct
                  2026). Until then the hero lists what is missing and links to
                  the form that fixes it. */}
              {!showCode ? (
                <div className="w-full max-w-sm text-left">
                  <div className="mb-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 dark:border-pink-500/30 dark:bg-pink-950/10">
                    <p className="text-sm font-semibold leading-6 text-foreground dark:text-neutral-100">
                      {missing.length > 0
                        ? t("referralCompleteProfileTitle")
                        : t("referralCodeComingSoon")}
                    </p>
                    {missing.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {missing.map((field) => (
                          <li
                            key={field}
                            className="flex items-start gap-2 text-sm leading-5 text-muted-foreground dark:text-neutral-300"
                          >
                            <Circle
                              className="mt-1 h-3 w-3 shrink-0 text-primary dark:text-pink-400"
                              aria-hidden
                            />
                            {t(MISSING_FIELD_KEYS[field])}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {missing.length > 0 ? (
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
                  ) : null}
                </div>
              ) : (
              <>
              <div className="mb-6 w-full max-w-sm">
                <button
                  onClick={handleCopy}
                  className={`focus-ring flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed p-4 transition-all duration-200 ${
                    copied
                      ? "border-primary dark:border-pink-500 bg-primary/5 dark:bg-pink-950/10"
                      : "border-border bg-white dark:bg-neutral-900/30 hover:border-primary dark:hover:border-pink-500"
                  }`}
                >
                  <span className="min-w-0 truncate text-xl font-extrabold tracking-[0.2em] text-primary dark:text-pink-400 md:text-2xl">
                    {code}
                  </span>

                  {copied ? (
                    <Check className="h-5 w-5 shrink-0 text-primary dark:text-pink-400" />
                  ) : (
                    <Copy className="h-5 w-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                  )}
                </button>
              </div>

              <div ref={shareRef} className="relative w-full max-w-sm">
                <Button
                  size="lg"
                  onClick={() => setShareOpen((open) => !open)}
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

        {/* Stats. Pending invites are no longer a card of their own — they
            are in the list below, each with its badge. */}
        <section className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
            <Users className="mx-auto mb-3 h-8 w-8 text-primary dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-primary dark:text-pink-400">
              {summary.successfulInvites ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("friendsReferred")}
            </p>
          </div>

          {/* Points, not euros: referral rewards are paid in points since the
              loyalty rewrite (Oct 2026). */}
          <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
            <Coins className="mx-auto mb-3 h-8 w-8 text-primary dark:text-pink-400" />
            <h3 className="mb-0 text-2xl font-bold text-primary dark:text-pink-400">
              {summary.totalPointsEarned ?? 0}
            </h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              {t("pointsEarned")}
            </p>
          </div>
        </section>

        {/* Your invites */}
        <section className="mb-12 rounded-2xl bg-card p-4 shadow-sm border border-border md:p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground dark:text-neutral-50">
            {t("yourInvites")}
            {referralHistory.length > 0 ? (
              <span className="ml-2 text-sm font-medium text-muted-foreground dark:text-neutral-400">
                ({referralHistory.length})
              </span>
            ) : null}
          </h2>

          {referralHistory.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 dark:bg-pink-950/40">
                <UserPlus className="h-6 w-6 text-primary dark:text-pink-400" aria-hidden />
              </div>
              <p className="font-semibold text-foreground dark:text-neutral-100">
                {t("noInvitesYet")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground dark:text-neutral-400">
                {t("noInvitesYetBody")}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {referralHistory.map((invite) => (
                <InviteRow key={invite.id} invite={invite} lang={lang} />
              ))}
            </ul>
          )}
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
                {t("youEarnPoints")}
              </h3>

              {/* Only the referrer is paid, and only after the friend's first
                  completed order. The amount is an admin setting, so it comes
                  from the API rather than the copy. */}
              <p className="text-sm text-muted-foreground dark:text-neutral-400">
                {t("youEarnPointsDescription").replace(
                  "{points}",
                  String(summary.pointsPerReferral ?? 0),
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InviteRow({ invite, lang }: { invite: ReferralInvite; lang: "en" | "pt" }) {
  const { t } = useTranslation();
  const completed = invite.status === "COMPLETED";
  const expired = invite.status === "EXPIRED";
  const initials = invite.friendName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary dark:bg-pink-950/40 dark:text-pink-400">
        {invite.friendPhoto ? (
          <Image
            src={invite.friendPhoto}
            unoptimized={!isOptimizableImageHost(invite.friendPhoto)}
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        ) : (
          initials || <Users className="h-5 w-5" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground dark:text-neutral-100">
          {invite.friendName}
        </p>
        <p className="text-xs text-muted-foreground dark:text-neutral-400">
          {t("invitedOn").replace("{date}", formatOrderDate(invite.date, lang))}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            completed
              ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
              : expired
                ? "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
          }`}
        >
          {completed
            ? t("inviteCompleted")
            : expired
              ? t("inviteExpired")
              : t("invitePending")}
        </span>
        {completed && invite.pointsEarned > 0 ? (
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">
            {t("plusPoints").replace("{points}", String(invite.pointsEarned))}
          </span>
        ) : null}
      </div>
    </li>
  );
}
