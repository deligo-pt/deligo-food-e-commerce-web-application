/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/lib/apiClient";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MapPin,
  ChevronDown,
  Search,
  ShoppingCart,
  Menu,
  Bell,
  User,
  LogOut,
} from "lucide-react";
import Cookies from "js-cookie";

import {
  getAccessToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../../lib/authCookies";
import { useCartStore } from "@/stores/cartStore";
import { useLocationStore } from "@/stores/locationStore";
import { updateLiveLocation } from "@/services/addressApi";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "@/hooks/useTranslation";

export default function Navbar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [addressText, setAddressText] = useState("Add Address");
  const [primaryAddressId, setPrimaryAddressId] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!getAccessToken();
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const { vendorCount, fetchCart } = useCartStore();
  const { coords, permissionStatus, isAutoSavingAddress, guestAddress } = useLocationStore();
  const [guestGeocoding, setGuestGeocoding] = useState(false);
  const [isAddressRefetching, setIsAddressRefetching] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const addressHref = !mounted
    ? "/add-address"
    : isLoggedIn && primaryAddressId
      ? `/edit-address/${primaryAddressId}`
      : isLoggedIn
        ? "/add-address"
        : "/current-location";
  const fetchProfile = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await apiClient.get("/profile");
      const profile = res.data?.data;

      const activeAddress = profile?.deliveryAddresses?.find(
        (addr: any) => addr.isActive === true,
      );

      const firstAddress = profile?.deliveryAddresses?.[0];
      const resolved = activeAddress || firstAddress;

      if (resolved) {
        const street = resolved.street || resolved.detailedAddress || "";
        const city = resolved.city || "";
        const label = street && city ? `${street}, ${city}` : street || city;
        if (label) setAddressText(label);
        setPrimaryAddressId(resolved._id || null);
      } else {
        setPrimaryAddressId(null);
      }

      setProfilePhoto(profile?.profilePhoto || null);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchProfile();

      const guestAddressStr = typeof window !== "undefined" ? localStorage.getItem("deligo_guest_address") : null;
      if (guestAddressStr) {
        (async () => {
          try {
            const guestAddressObj = JSON.parse(guestAddressStr);
            const profileRes = await apiClient.get("/profile");
            const userId = profileRes.data?.data?.userId;
            if (userId) {
              await updateLiveLocation(userId, {
                latitude: guestAddressObj.latitude,
                longitude: guestAddressObj.longitude,
                geoAccuracy: 10,
                isMocked: false,
                street: guestAddressObj.street,
                city: guestAddressObj.city,
                state: guestAddressObj.state,
                country: guestAddressObj.country,
                postalCode: guestAddressObj.postalCode,
                detailedAddress: guestAddressObj.detailedAddress,
              });
              localStorage.removeItem("deligo_guest_address");
              useLocationStore.getState().setGuestAddress(null);
              window.dispatchEvent(new Event("addressUpdated"));
            }
          } catch (syncErr) {
            console.error("Failed to sync guest address in Navbar:", syncErr);
          }
        })();
      }
    }
  }, [isLoggedIn, pathname, fetchProfile]);

  useEffect(() => {
    if (isLoggedIn) return;

    if (guestAddress) {
      const street = guestAddress.street || guestAddress.detailedAddress || "";
      const city = guestAddress.city || "";
      const label = street && city ? `${street}, ${city}` : street || city;
      if (label) {
        setAddressText(label);
        return;
      }
    }

    if (!coords || permissionStatus !== "granted") {
      setAddressText("Add Address");
      return;
    }

    let cancelled = false;
    setGuestGeocoding(true);
    (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
          { headers: { "Accept-Language": "en" } },
        );
        if (cancelled) return;
        const data = await res.json();
        const addr = data?.address ?? {};

        const street =
          addr.road ??
          addr.pedestrian ??
          addr.footway ??
          addr.path ??
          addr.suburb ??
          addr.neighbourhood ??
          data?.display_name?.split(",")?.[0] ??
          null;

        const city =
          addr.city ??
          addr.town ??
          addr.village ??
          addr.county ??
          addr.suburb ??
          addr.state ??
          null;

        const label =
          street && city
            ? `${street}, ${city}`
            : (street ?? city ?? data?.display_name?.split(",")[0] ?? null);

        if (!cancelled && label) setAddressText(label);
      } catch {
        // silently ignore — addressText stays as "Add Address"
      } finally {
        if (!cancelled) setGuestGeocoding(false);
      }
    })();
    return () => {
      cancelled = true;
      setGuestGeocoding(false);
    };
  }, [isLoggedIn, coords, permissionStatus, guestAddress]);

  useEffect(() => {
    const handleAddressUpdate = async () => {
      if (isLoggedIn) {
        // Keep spinner active while re-fetching so there's no "Add Address" flash
        setIsAddressRefetching(true);
        await fetchProfile();
        setIsAddressRefetching(false);
      }
    };
    window.addEventListener("addressUpdated", handleAddressUpdate);
    return () =>
      window.removeEventListener("addressUpdated", handleAddressUpdate);
  }, [isLoggedIn, fetchProfile]);

  // Instantly reflect profile photo changes when the user saves from the edit profile form
  useEffect(() => {
    const handlePhotoUpdate = (e: Event) => {
      const photo = (e as CustomEvent<{ profilePhoto: string | null }>).detail
        .profilePhoto;
      setProfilePhoto(photo);
    };
    window.addEventListener("profilePhotoUpdated", handlePhotoUpdate);
    return () =>
      window.removeEventListener("profilePhotoUpdated", handlePhotoUpdate);
  }, []);

  const handleSearch = useCallback(() => {
    if (localSearchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(localSearchTerm.trim())}`);
    }
  }, [localSearchTerm, router]);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchTerm(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (value.trim()) {
        router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }
    }, 500);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      handleSearch();
    }
  };

  useEffect(() => {
    if (pathname !== "/search") {
      setLocalSearchTerm("");
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname !== "/search") {
        setLocalSearchTerm("");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const tokenExists = !!getAccessToken();
    setIsLoggedIn((prev) => {
      if (prev === tokenExists) return prev;
      return tokenExists;
    });
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await apiClient.get(
          "/notifications/my-notifications",
          {
            params: { limit: 100 },
          },
        );
        const notifications = response.data?.data || [];
        const unread = notifications.filter((n: any) => !n.isRead).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error("Failed to fetch notifications count:", error);
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchCart();
    }
  }, [isLoggedIn, pathname, fetchCart]);

  const handleLogout = () => {
    Cookies.remove(ACCESS_TOKEN_COOKIE, { path: "/" });
    Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
    useLocationStore.getState().setHasAutoSavedAddress(false);
    setIsLoggedIn(false);
    setShowAccountDropdown(false);
    router.push("/");
  };

  const handleAccountClick = () => {
    if (!isLoggedIn) {
      router.push("/login");
    } else {
      setShowAccountDropdown(!showAccountDropdown);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#b0004a] text-white transition-all duration-300 dark:bg-[#d81b60]">
      <div className="flex w-full items-center justify-between px-4 py-4 lg:px-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-1">
            <Image
              src="/deligoLogo.png"
              alt="DeliGo Logo"
              width={40}
              height={40}
              priority
            />
            <span className="text-[20px] font-black md:text-[24px]">
              DeliGo
            </span>
          </Link>

          <Link href={addressHref}>
            <button
              suppressHydrationWarning
              className="hidden cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[#fff2f3] transition-all hover:bg-white/20 lg:flex"
            >
              <MapPin size={20} />
              {!mounted ? (
                "Add Address"
              ) : isLoggedIn && (isAutoSavingAddress || isAddressRefetching) ? (
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  role="status"
                  aria-label="Saving address"
                />
              ) : !isLoggedIn &&
                !guestAddress &&
                (permissionStatus === "loading" || guestGeocoding) ? (
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  role="status"
                  aria-label="Locating"
                />
              ) : (
                addressText
              )}
              <ChevronDown size={16} />
            </button>
          </Link>
        </div>

        <div className="mx-8 hidden flex-1 md:block">
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-4 text-black/60" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={localSearchTerm}
              onChange={onSearchChange}
              onKeyDown={onKeyDown}
              className="w-full rounded-full border-0 bg-[#ffffff] py-2.5 pl-12 pr-4 text-[16px] text-[#191c1d] outline-none ring-0 placeholder:text-black/45 focus:ring-2 focus:ring-[#dd2269]/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/notifications">
              <button className="relative rounded-full p-2 text-white transition-colors hover:bg-white/10">
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#b70052] text-[10px] font-medium text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>

            <Link href="/cart">
              <button className="relative rounded-full p-2 text-white transition-colors hover:bg-white/10">
                <ShoppingCart size={22} />
                {vendorCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#b70052] text-[10px] font-medium text-white">
                    {vendorCount > 9 ? "9+" : vendorCount}
                  </span>
                )}
              </button>
            </Link>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleAccountClick}
              className="flex items-center gap-3 rounded-full p-1.5 text-white transition-colors hover:bg-white/10"
            >
              <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-white/20 bg-[#edeeef] flex items-center justify-center">
                {!mounted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 36 36"
                    className="h-full w-full"
                  >
                    <circle cx="18" cy="18" r="18" fill="#edeeef" />
                    <circle cx="18" cy="14" r="6" fill="#c8cdd0" />
                    <ellipse cx="18" cy="30" rx="10" ry="7" fill="#c8cdd0" />
                  </svg>
                ) : isLoggedIn ? (
                  profilePhoto ? (
                    <Image
                      alt="User avatar"
                      className="h-full w-full object-cover"
                      height={36}
                      width={36}
                      src={profilePhoto}
                    />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 36 36"
                      className="h-full w-full"
                    >
                      <circle cx="18" cy="18" r="18" fill="#f9e4ec" />
                      <circle cx="18" cy="14" r="6" fill="#b0004a" />
                      <ellipse cx="18" cy="30" rx="10" ry="7" fill="#b0004a" />
                    </svg>
                  )
                ) : (
                  <User size={22} className="text-[#b0004a]" />
                )}
              </div>
              <span className="hidden text-[14px] font-semibold leading-5 xl:block">
                {t("account")}
              </span>
            </button>
            {isLoggedIn && showAccountDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowAccountDropdown(false)}
                >
                  <User size={16} />
                  {t("profile")}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  <LogOut size={16} />
                  {t("logout")}
                </button>
              </div>
            )}
          </div>

          <button className="text-white lg:hidden">
            <Menu size={26} />
          </button>
        </div>
      </div>
    </header>
  );
}
