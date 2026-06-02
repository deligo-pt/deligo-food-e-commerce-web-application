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
  Heart,
  Bell,
  Settings,
  HelpCircle,
  Globe,
  ChevronRight,
  LogOut,
  Star,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/authCookies";
import Cookies from "js-cookie";
import Image from "next/image";

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

const orderItems = [
  {
    title: "Orders",
    description: "View and track your current or past orders",
    icon: Receipt,
  },
  {
    title: "Payment Methods",
    description: "Manage your saved cards and payment accounts",
    icon: CreditCard,
  },
  {
    title: "Referrals",
    description: "Earn rewards by inviting your friends to DeliGo",
    icon: UserPlus,
  },
];

const settingItems = [
  { title: "Saved Addresses", icon: MapPin },
  { title: "Favorite Orders", icon: Heart },
  { title: "Notifications", icon: Bell },
  { title: "Account Settings", icon: Settings },
  { title: "Help Center", icon: HelpCircle },
  { title: "Available Countries", icon: Globe },
];

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: ProfileData }>("/profile");
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
  }, [router]);

  const handleLogout = () => {
    Cookies.remove(ACCESS_TOKEN_COOKIE, { path: "/" });
    Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
    router.push("/");
  };

  if (loading) {
    return (
      <section className="bg-[#f7f7f7] min-h-screen p-4 md:p-6 flex items-center justify-center">
        <div className="text-[#c1005a] text-lg">Loading profile...</div>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="bg-[#f7f7f7] min-h-screen p-4 md:p-6 flex items-center justify-center">
        <div className="text-red-500 text-lg">Error: {error || "Profile not found"}</div>
      </section>
    );
  }

  const fullName = [profile.name.firstName, profile.name.lastName].filter(Boolean).join(" ") || "Unnamed User";

  return (
    <section className="bg-[#f7f7f7] min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* LEFT */}
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-pink-100">
                    {profile.profilePhoto ? (
                      <Image
                        src={profile.profilePhoto}
                        alt="Profile"
                        className="h-full w-full rounded-full object-cover"
                        width={96}
                        height={96}
                      />
                    ) : (
                      <User className="h-10 w-10 text-pink-700" />
                    )}
                  </div>

                  <button className="absolute bottom-0 right-0 rounded-full bg-pink-700 p-2 text-white">
                    <Edit size={14} />
                  </button>
                </div>

                <h2 className="mt-4 text-xl font-bold">{fullName}</h2>

                <div className="mt-2 flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                  <Mail size={14} />
                  {profile.email}
                </div>

                <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c1005a] py-3 font-medium text-white transition hover:bg-[#a6004d]">
                  <Edit size={16} />
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white p-5 text-center shadow-sm">
                <Ticket className="mx-auto mb-2 text-[#c1005a]" />
                <h3 className="font-bold">0</h3>
                <p className="text-sm text-gray-500">Vouchers</p>
              </div>

              <div className="rounded-xl bg-white p-5 text-center shadow-sm">
                <Gift className="mx-auto mb-2 text-[#c1005a]" />
                <h3 className="font-bold">125</h3>
                <p className="text-sm text-gray-500">Reward Points</p>
              </div>
            </div>

            {/* Pro Banner */}
            <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#c1005a] to-pink-500 p-6 text-white">
              <Star className="absolute -bottom-6 -right-6 h-28 w-28 opacity-10" />

              <h3 className="text-2xl font-bold">DeliGo Pro</h3>

              <p className="mt-2 text-sm text-white/90">
                Unlock free delivery and exclusive deals on every order.
              </p>

              <button className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-medium text-[#c1005a]">
                Learn More
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Orders & Payments
              </h3>

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                {orderItems.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className={`flex cursor-pointer items-center justify-between p-5 hover:bg-gray-50 ${
                        index !== orderItems.length - 1 ? "border-b" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-pink-100 p-3">
                          <Icon className="h-5 w-5 text-[#c1005a]" />
                        </div>

                        <div>
                          <h4 className="font-semibold">{item.title}</h4>
                          <p className="text-sm text-gray-500">{item.description}</p>
                        </div>
                      </div>

                      <ChevronRight size={18} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Preferences & More
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                {settingItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex cursor-pointer items-center justify-between rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-gray-100 p-2">
                          <Icon size={18} />
                        </div>

                        <span className="font-medium">{item.title}</span>
                      </div>

                      <ChevronRight size={16} />
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-6 py-3 font-medium text-red-500 shadow-sm"
            >
              <LogOut size={18} />
              Logout
            </button>

            <p className="text-xs text-gray-400">Version 1.0.0</p>
          </div>
        </div>
      </div>
    </section>
  );
}