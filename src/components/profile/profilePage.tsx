/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
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
  Star,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import {
  getAccessToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/authCookies";
import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import ProfilePageSkeleton from "./profilePageSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

interface Offer {
  _id: string;
  isActive: boolean;
  isDeleted: boolean;
}
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
interface PointsResponse {
  currentPoints: number;
  totalEarned: number;
  totalSpent: number;
}

export default function AccountPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voucherCount, setVoucherCount] = useState(0);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [showProModal, setShowProModal] = useState(false);

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
      title: t("savedAddresses"),
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

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchVoucherCount = async () => {
      try {
        const response = await apiClient.get("/offers");

        const offers = response.data?.data || [];

        const activeOffers = offers.filter(
          (offer: Offer) => offer.isActive && !offer.isDeleted,
        );

        setVoucherCount(activeOffers.length);
      } catch (error) {
        console.error("Failed to fetch vouchers", error);
      }
    };
    const fetchRewardPoints = async () => {
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: PointsResponse;
        }>("/points/my-points");

        const points = response.data?.data?.currentPoints || 0;

        setRewardPoints(points);
      } catch (error) {
        console.error("Failed to fetch reward points", error);
      }
    };
    const fetchProfile = async () => {
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: ProfileData;
        }>("/profile");
        if (response.data.success) {
          setProfile(response.data.data);
        } else {
          setError("Failed to load profile");
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    fetchVoucherCount();
    fetchRewardPoints();
  }, [router]);

  const handleLogout = () => {
    Cookies.remove(ACCESS_TOKEN_COOKIE, { path: "/" });
    Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
    router.push("/");
  };

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (error || !profile) {
    return (
      <section className="bg-[#f7f7f7] dark:bg-neutral-950 min-h-screen p-4 md:p-6 flex items-center justify-center text-gray-900 dark:text-neutral-100 transition-colors duration-200">
        <div className="text-red-500 dark:text-red-400 text-lg">
          Error: {error || "Profile not found"}
        </div>
      </section>
    );
  }

  const fullName =
    [profile.name.firstName, profile.name.lastName].filter(Boolean).join(" ") ||
    "Unnamed User";

  return (
    <section className="bg-[#f7f7f7] dark:bg-neutral-950 p-4 md:p-6 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* LEFT */}
          <div className="space-y-4">
            <div className="rounded-xl bg-white dark:bg-neutral-900 p-6 shadow-sm border border-gray-100 dark:border-neutral-800">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/40">
                    {profile.profilePhoto ? (
                      <Image
                        src={profile.profilePhoto}
                        alt="Profile"
                        className="h-full w-full rounded-full object-cover"
                        width={96}
                        height={96}
                      />
                    ) : (
                      <User className="h-10 w-10 text-pink-700 dark:text-pink-400" />
                    )}
                  </div>
                </div>

                <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-neutral-50">{fullName}</h2>

                <div className="mt-2 flex items-center gap-2 rounded-full bg-gray-100 dark:bg-neutral-800 px-3 py-1 text-sm text-gray-650 dark:text-neutral-300">
                  <Mail size={14} />
                  {profile.email}
                </div>

                <Link href="/edit-profile" className="w-full">
                  {" "}
                  <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c1005a] hover:bg-[#a6004d] dark:hover:bg-[#d6116c] py-3 font-medium text-white transition">
                    <Edit size={16} />
                    {t("editProfile")}
                  </button>
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Link href="/vouchers">
                <div className="rounded-xl bg-white dark:bg-neutral-900 p-5 text-center shadow-sm border border-gray-100 dark:border-neutral-800 transition hover:shadow-md cursor-pointer">
                  <Ticket className="mx-auto mb-2 text-[#c1005a] dark:text-pink-400" />
                  <h3 className="font-bold text-gray-900 dark:text-neutral-50">{voucherCount}</h3>
                  <p className="text-sm text-gray-500 dark:text-neutral-400">{t("vouchers")}</p>
                </div>
              </Link>

              <div className="rounded-xl bg-white dark:bg-neutral-900 p-5 text-center shadow-sm border border-gray-100 dark:border-neutral-800">
                <Gift className="mx-auto mb-2 text-[#c1005a] dark:text-pink-400" />
                <h3 className="font-bold text-gray-900 dark:text-neutral-50">{rewardPoints}</h3>
                <p className="text-sm text-gray-500 dark:text-neutral-400">{t("rewardPoints")}</p>
              </div>
            </div>

            {/* Pro Banner */}
            <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#c1005a] to-pink-500 p-6 text-white shadow-sm">
              <Star className="absolute -bottom-6 -right-6 h-28 w-28 opacity-10" />

              <h3 className="text-2xl font-bold">{t("deligoPro")}</h3>

              <p className="mt-2 text-sm text-white/90">
                {t("deligoProDescription")}
              </p>

              <button
                onClick={() => setShowProModal(true)}
                className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-medium text-[#c1005a] transition hover:bg-pink-50"
              >
                {t("learnMore")}
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                {t("ordersAndPayments")}
              </h3>

              <div className="overflow-hidden rounded-xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm">
                {orderItems.map((item, index) => {
                  const Icon = item.icon;

                  const path = item.path;
                  const content = (
                    <div
                      className={`flex cursor-pointer items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors ${
                        index !== orderItems.length - 1 ? "border-b border-gray-100 dark:border-neutral-800" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-pink-100 dark:bg-pink-950/40 p-3">
                          <Icon className="h-5 w-5 text-[#c1005a] dark:text-pink-400" />
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
                    <div className="flex cursor-pointer items-center justify-between rounded-xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 p-5 shadow-sm transition hover:shadow-md">
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

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-950/30 bg-white dark:bg-neutral-900 px-6 py-3 font-medium text-red-500 dark:text-red-400 shadow-sm hover:bg-red-50 dark:hover:bg-red-950/10 transition"
            >
              <LogOut size={18} />
              {t("logout")}
            </button>

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
          <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#c1005a] to-pink-400 px-6 pt-8 pb-10 text-center">
              <Star className="absolute -bottom-6 -right-6 h-28 w-28 opacity-10" />
              <Star className="absolute -top-4 -left-4 h-20 w-20 opacity-10" />
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                <Star className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Unlock Exclusive Features</h3>
              <p className="mt-2 text-sm text-white/85 leading-relaxed">
                Use the app regularly and place more orders to unlock and enjoy these exclusive features.
              </p>
            </div>

            {/* Features list */}
            <div className="px-6 py-6 space-y-4 bg-white dark:bg-neutral-900">
              {[
                { emoji: "🚚", title: "Free Delivery", desc: "Enjoy free delivery on every order" },
                { emoji: "🎟️", title: "Exclusive Vouchers", desc: "Access member-only discount codes" },
                { emoji: "⚡", title: "Priority Support", desc: "Skip the queue with dedicated support" },
                { emoji: "🎁", title: "Bonus Reward Points", desc: "Earn 2× points on every purchase" },
              ].map((f) => (
                <div key={f.title} className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50 dark:bg-pink-950/40 text-xl">
                    {f.emoji}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-neutral-100">{f.title}</p>
                    <p className="text-sm text-gray-500 dark:text-neutral-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 dark:border-neutral-800 px-6 py-4 bg-gray-50 dark:bg-neutral-900/80">
              <button
                onClick={() => setShowProModal(false)}
                className="w-full rounded-lg bg-gray-100 dark:bg-neutral-800 py-2.5 text-sm font-semibold text-gray-600 dark:text-neutral-300 transition hover:bg-gray-200 dark:hover:bg-neutral-700"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
