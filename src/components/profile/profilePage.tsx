"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Edit,
  Ticket,
  Gift,
  Receipt,
  CreditCard,
  UserPlus,
  MapPin,
  // Heart,
  Bell,
  Settings,
  HelpCircle,
  Globe,
  ChevronRight,
  LogOut,
  LoaderCircle,
  Star,
} from "lucide-react";
import { getApiErrorMessage } from "@/lib/apiClient";
import {
  getAccessToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/authCookies";
import Cookies from "js-cookie";
import { useCartCache } from "@/hooks/queries/useCart";
import { useInvalidateSupport } from "@/hooks/queries/useSupport";
import { closeSupportChat } from "@/stores/supportChatStore";
import { useLocationStore } from "@/stores/locationStore";
import { clearCachedFCMToken } from "@/lib/fcmToken";
import Image from "next/image";
import { isOptimizableImageHost } from "@/lib/imageHosts";
import Link from "next/link";
import ProfilePageSkeleton from "./profilePageSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useProfile,
  useOffersCount,
  useRewardPoints,
} from "@/hooks/queries/useProfile";
import { Button } from "@/components/ui/button";

interface ProfileData {
  _id: string;
  userId: string;
  role: string;
  email: string;
  status: string;
  isOtpVerified: boolean;
  profilePhoto: string;
  twoFactorEnabled: boolean;
  referralCode: string;
  name: {
    firstName: string;
    lastName: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  loginDevices: Array<{
    deviceId: string;
    deviceType: string;
    deviceName: string;
    lastLogin: string;
    isLoggedIn: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { clear: clearCartCache } = useCartCache();
  const { clear: clearSupportCache } = useInvalidateSupport();
  // Pending while the post-logout navigation is in flight — see `handleLogout`.
  const [isLoggingOut, startLogout] = useTransition();
  const [showProModal, setShowProModal] = useState(false);

  // Resolve auth after mount so SSR and the first client render agree (both
  // show the skeleton), avoiding a hydration flash.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && !!getAccessToken();

  useEffect(() => {
    if (mounted && !getAccessToken()) router.push("/login");
  }, [mounted, router]);

  // Cached + deduped: the Navbar and other pages share these same queries
  // instead of each re-fetching. This is what fixed the /profile 429 loop.
  const {
    data: profile,
    isLoading,
    error: profileError,
  } = useProfile<ProfileData>({ enabled: isLoggedIn });
  const { data: voucherCount = 0 } = useOffersCount({ enabled: isLoggedIn });
  const { data: rewardPoints = 0 } = useRewardPoints({ enabled: isLoggedIn });

  const loading = !mounted || isLoading;
  const error = profileError
    ? getApiErrorMessage(profileError, t("failedToLoadProfile"))
    : null;

  const orderItems = [
    {
      title: t("orders"),
      description: t("ordersDescription"),
      icon: Receipt,
      path: "/orders",
    },
    {
      title: t("paymentMethods"),
      description: t("paymentMethodsDescription"),
      icon: CreditCard,
      path: "/payment-methods",
    },
    {
      title: t("referrals"),
      description: t("referralsDescription"),
      icon: UserPlus,
      path: "/referrals",
    },
  ];
  const settingItems = [
    {
      title: t("manageAddresses"),
      icon: MapPin,
      path: "/saved-addresses",
    },
    // {
    //   title: t("favoriteOrders"),
    //   icon: Heart,
    //   path: "/favorite-orders",
    // },
    {
      title: t("notifications"),
      icon: Bell,
      path: "/notifications",
    },
    {
      title: t("accountSettings"),
      icon: Settings,
      path: "/account-settings",
    },
    {
      title: t("helpCenter"),
      icon: HelpCircle,
      path: "/help-center",
    },
    {
      title: t("availableCountries"),
      icon: Globe,
      path: "/available-countries",
    },
  ];

  /**
   * Signs the user out and sends them home.
   *
   * This used to remove the two cookies and nothing else, while the navbar's
   * logout also dropped the cart cache, the FCM token and the saved-address
   * flag. Signing out here therefore left the previous account's basket in the
   * query cache for whoever signed in next on the same browser. Both buttons
   * now do the same work.
   *
   * Nothing here talks to the server; the wait is `router.push("/")` loading
   * the home page, which is what the pending state covers.
   */
  const handleLogout = () => {
    if (isLoggingOut) return;
    clearCachedFCMToken();
    Cookies.remove(ACCESS_TOKEN_COOKIE, { path: "/" });
    Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
    useLocationStore.getState().setHasAutoSavedAddress(false);
    clearCartCache();
    // Dropped, not invalidated — see the same call in `Navbar`'s `handleLogout`.
    clearSupportCache();
    closeSupportChat();
    startLogout(() => {
      router.push("/");
    });
  };

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (error || !profile) {
    return (
      <section className="bg-[#f7f7f7] dark:bg-neutral-950 min-h-screen p-4 md:p-6 flex items-center justify-center text-gray-900 dark:text-neutral-100 transition-colors duration-200">
        <div className="text-red-500 dark:text-red-400 text-base">
          Error: {error || t("profileNotFound")}
        </div>
      </section>
    );
  }

  const fullName =
    [profile.name.firstName, profile.name.lastName].filter(Boolean).join(" ") ||
    t("unnamedUser");

  /* Phase 12. The skeleton above is swapped out in a single frame;
     `motion-fade` is that same swap over 300ms. Opacity only, once, and
     it opts out under prefers-reduced-motion with the rest of the set. */
  return (
    <section className="motion-fade bg-[#f7f7f7] dark:bg-neutral-950 p-4 md:p-6 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* LEFT */}
          <div className="space-y-4">
            <div className="rounded-xl bg-card p-6 shadow-sm border border-border">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 dark:bg-pink-950/40">
                    {profile.profilePhoto ? (
                      <Image
                        src={profile.profilePhoto}
                        unoptimized={!isOptimizableImageHost(profile.profilePhoto)}
                        alt="Profile"
                        className="h-full w-full rounded-full object-cover"
                        width={96}
                        height={96}
                      />
                    ) : (
                      <User className="h-10 w-10 text-primary dark:text-pink-400" />
                    )}
                  </div>
                </div>

                {/* `items-center` on the column centres this element's box, not
                    the text inside it. A name short enough to fit on one line
                    looks centred by accident; one that wraps — "Md. Samin Israk
                    2021362642" — fills the width and its lines go hard left,
                    out of line with the avatar, the email and the button.
                    `text-center` is what actually centres it. `break-words`
                    keeps a long unbroken name inside the card instead of
                    spilling past its edge. */}
                <h2 className="mt-4 text-center text-xl font-bold break-words text-gray-900 dark:text-neutral-50">
                  {fullName}
                </h2>

                {/* Same failure mode as the name: at the 320px sidebar width a
                    long address would push the pill past the card. `max-w-full`
                    holds it in, `min-w-0` + `break-all` let the text wrap inside
                    it — an email has no spaces to break on. `shrink-0` keeps the
                    icon from being squashed as it does. */}
                <div className="mt-2 flex max-w-full items-center gap-2 rounded-full bg-gray-100 dark:bg-neutral-800 px-3 py-1 text-sm text-gray-650 dark:text-neutral-300">
                  <Mail size={14} className="shrink-0" />
                  <span className="min-w-0 break-all">{profile.email}</span>
                </div>

                <Link href="/edit-profile" className="w-full">
                  {" "}
                  <span className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition">
                    <Edit size={16} />
                    {t("editProfile")}
                  </span>
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Link href="/vouchers">
                <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border transition hover:shadow-md cursor-pointer">
                  <Ticket className="mx-auto mb-2 text-primary dark:text-pink-400" />
                  <h3 className="font-bold text-gray-900 dark:text-neutral-50">{voucherCount}</h3>
                  <p className="text-sm text-gray-500 dark:text-neutral-400">{t("vouchers")}</p>
                </div>
              </Link>

              <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
                <Gift className="mx-auto mb-2 text-primary dark:text-pink-400" />
                <h3 className="font-bold text-gray-900 dark:text-neutral-50">{rewardPoints}</h3>
                <p className="text-sm text-gray-500 dark:text-neutral-400">{t("rewardPoints")}</p>
              </div>
            </div>

            {/* Pro Banner */}
            <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-primary to-pink-500 p-6 text-white shadow-sm">
              <Star className="absolute -bottom-6 -right-6 h-28 w-28 opacity-10" />

              <h3 className="text-2xl font-bold">{t("deligoPro")}</h3>

              <p className="mt-2 text-sm text-white/90">
                {t("deligoProDescription")}
              </p>

              <Button
                size="sm"
                onClick={() => setShowProModal(true)}
                className="mt-4 rounded-full bg-white text-primary hover:bg-primary/5"
              >
                {t("learnMore")}
              </Button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                {t("ordersAndPayments")}
              </h3>

              <div className="overflow-hidden rounded-xl bg-card border border-border shadow-sm">
                {orderItems.map((item, index) => {
                  const Icon = item.icon;

                  const path = item.path;
                  const content = (
                    <div
                      className={`flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors ${
                        index !== orderItems.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-primary/10 dark:bg-pink-950/40 p-3">
                          <Icon className="h-5 w-5 text-primary dark:text-pink-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-neutral-100">{item.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-neutral-400">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-400 dark:text-neutral-500" />
                    </div>
                  );

                  if (path) {
                    return (
                      <Link key={item.title} href={path}>
                        {content}
                      </Link>
                    );
                  }

                  return <div key={item.title}>{content}</div>;
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                {t("preferencesAndMore")}
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                {settingItems.map((item) => {
                  const Icon = item.icon;

                  const path = item.path;
                  const content = (
                    <div className="flex cursor-pointer items-center justify-between rounded-xl bg-card border border-border p-4 shadow-sm transition hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-gray-100 dark:bg-neutral-800 p-2 text-gray-600 dark:text-neutral-300">
                          <Icon size={18} />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-neutral-100">{item.title}</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 dark:text-neutral-500" />
                    </div>
                  );

                  if (path) {
                    return (
                      <Link key={item.title} href={path}>
                        {content}
                      </Link>
                    );
                  }

                  return <div key={item.title}>{content}</div>;
                })}
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-busy={isLoggingOut}
              className="gap-2 rounded-xl border-red-200 text-red-500 shadow-sm hover:bg-red-50 hover:text-red-500 dark:border-red-950/30 dark:text-red-400 dark:hover:bg-red-950/10"
            >
              {isLoggingOut ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <LogOut size={18} />
              )}
              {isLoggingOut ? t("loggingOut") : t("logout")}
            </Button>

            <p className="text-xs text-gray-400 dark:text-neutral-500">{t("version")} 1.0.0</p>
          </div>
        </div>
      </div>
      {showProModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowProModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary to-pink-400 px-6 pt-8 pb-8 text-center">
              <Star className="absolute -bottom-6 -right-6 h-28 w-28 opacity-10" />
              <Star className="absolute -top-4 -left-4 h-20 w-20 opacity-10" />
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                <Star className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{t("unlockExclusiveFeatures")}</h3>
              <p className="mt-2 text-sm text-white/85 leading-relaxed">
                {t("unlockExclusiveFeaturesDesc")}
              </p>
            </div>

            {/* Features list */}
            <div className="px-6 py-6 space-y-4 bg-card">
              {[
                { emoji: "🚚", key: "proFreeDelivery" },
                { emoji: "🎟️", key: "proExclusiveVouchers" },
                { emoji: "⚡", key: "proPrioritySupport" },
                { emoji: "🎁", key: "proBonusRewardPoints" },
              ].map((f) => (
                <div key={f.key} className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 dark:bg-pink-950/40 text-xl">
                    {f.emoji}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-neutral-100">{t(f.key)}</p>
                    <p className="text-sm text-gray-500 dark:text-neutral-400">{t(`${f.key}Desc`)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 bg-gray-50 dark:bg-neutral-900/80">
              <Button
                variant="secondary"
                onClick={() => setShowProModal(false)}
                className="w-full font-semibold"
              >
                {t("ok")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
