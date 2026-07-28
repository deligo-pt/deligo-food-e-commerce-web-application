/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import Logo from "@/components/shared/Logo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MapPin,
  ChevronDown,
  Search,
  ShoppingCart,
  Bell,
  User,
  LogOut,
  Plus,
  Check,
} from "lucide-react";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

import {
  getAccessToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../../lib/authCookies";
import { useCart, useCartCache } from "@/hooks/queries/useCart";
import { getCartVendorId } from "@/lib/cart";
import type { CartResponse } from "@/types/cart";
import { useLocationStore } from "@/stores/locationStore";
import { updateLiveLocation } from "@/services/addressApi";
import { clearCachedFCMToken } from "@/lib/fcmToken";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "@/hooks/useTranslation";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import {
  formatAddressFull,
  formatAddressLine1,
  formatAddressLine2,
  formatAddressSummary,
} from "@/lib/addressFormat";
import { useProfile, useInvalidateProfile } from "@/hooks/queries/useProfile";
import {
  useUnreadNotificationCount,
  useInvalidateUnreadCount,
} from "@/hooks/queries/useNotifications";

type NavAddress = {
  _id?: string;
  isActive?: boolean;
  street?: string;
  detailedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
};
type NavProfile = {
  userId?: string;
  profilePhoto?: string | null;
  name?: { firstName?: string };
  deliveryAddresses?: NavAddress[];
};

export default function Navbar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [updatingAddressId, setUpdatingAddressId] = useState<string | null>(null);
  const [addressText, setAddressText] = useState("Add Address");
  const [primaryAddressId, setPrimaryAddressId] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRefMobile = useRef<HTMLDivElement>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!getAccessToken();
  });

  // Badge count: cached query that polls at 60s and pauses on hidden tabs.
  const { data: unreadCount = 0 } = useUnreadNotificationCount({
    enabled: isLoggedIn,
  });
  const invalidateUnreadCount = useInvalidateUnreadCount();

  // The badge reads the same cart query the cart and checkout pages read, so
  // the number on the icon and the contents of the page cannot disagree. It
  // used to be a separate store with its own fetch, which is how a cart deleted
  // server-side could stay on screen with a confident count above it.
  const { data: cart } = useCart<CartResponse | null>({ enabled: isLoggedIn });
  const { clear: clearCartCache } = useCartCache();
  const vendorCount = useMemo(() => {
    // Logged out, the query is disabled but its last data is still cached —
    // gate on the session so a signed-out navbar can't show the old basket.
    if (!isLoggedIn) return 0;
    return new Set((cart?.items ?? []).map((item) => getCartVendorId(item.vendorId)))
      .size;
  }, [isLoggedIn, cart]);
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
  // Shared, cached profile query — no longer re-fetched on every navigation.
  const { data: profile } = useProfile<NavProfile>({ enabled: isLoggedIn });
  const invalidateProfile = useInvalidateProfile();

  const deliveryAddresses = profile?.deliveryAddresses ?? [];

  // The location button opens the saved-address dropdown for logged-in users;
  // guests have nothing saved, so it takes them straight to add a location.
  const handleLocationButtonClick = () => {
    if (!isLoggedIn) {
      router.push(addressHref);
      return;
    }
    setShowLocationDropdown((v) => !v);
  };

  // Picking an address makes it the active/primary one (same endpoint the
  // Saved Addresses page uses), then refreshes the shared profile everywhere.
  const handleSelectAddress = async (addressId?: string) => {
    if (!addressId) return;
    const target = deliveryAddresses.find((a) => a._id === addressId);
    if (target?.isActive) {
      setShowLocationDropdown(false);
      return;
    }
    try {
      setUpdatingAddressId(addressId);
      await apiClient.patch(`/customers/toggle-delivery-address-status/${addressId}`);
      await invalidateProfile();
      window.dispatchEvent(new Event("addressUpdated"));
      toast.success(t("activeAddressUpdated"));
      setShowLocationDropdown(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("failedToUpdateActiveAddress")));
    } finally {
      setUpdatingAddressId(null);
    }
  };

  // Derive the navbar's logged-in display state from the shared profile data.
  useEffect(() => {
    if (!isLoggedIn || !profile) return;

    const activeAddress = profile.deliveryAddresses?.find(
      (addr) => addr.isActive === true,
    );
    const firstAddress = profile.deliveryAddresses?.[0];
    const resolved = activeAddress || firstAddress;

    if (resolved) {
      // Summary, not the full address: this is the collapsed trigger button and
      // it is width-capped. The whole address lives in the dropdown below it.
      const label = formatAddressSummary(resolved);
      if (label) setAddressText(label);
      setPrimaryAddressId(resolved._id || null);
    } else {
      setPrimaryAddressId(null);
    }

    setProfilePhoto(profile.profilePhoto || null);
    setFirstName(profile.name?.firstName || null);
  }, [isLoggedIn, profile]);

  // One-time sync of a guest-entered address into the account after login.
  // Uses the already-fetched profile's userId (no extra /profile request).
  useEffect(() => {
    if (!isLoggedIn || !profile?.userId) return;
    const guestAddressStr =
      typeof window !== "undefined"
        ? localStorage.getItem("deligo_guest_address")
        : null;
    if (!guestAddressStr) return;

    (async () => {
      try {
        const guestAddressObj = JSON.parse(guestAddressStr);
        await updateLiveLocation(profile.userId!, {
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
      } catch (syncErr) {
        console.error("Failed to sync guest address in Navbar:", syncErr);
      }
    })();
  }, [isLoggedIn, profile?.userId]);

  useEffect(() => {
    if (isLoggedIn) return;

    if (guestAddress) {
      const label = formatAddressSummary(guestAddress);
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
        await loadGoogleMapsScript();
        if (cancelled) return;
        if (!window.google?.maps) return;

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat: coords.latitude, lng: coords.longitude } },
          (results: any, status: any) => {
            if (cancelled) return;
            if (status !== "OK" || !results || !results[0]) {
              return;
            }

            const comps = results[0].address_components;
            let street = "",
              city = "",
              state = "",
              country = "",
              apartment = "";

            comps.forEach((c: any) => {
              if (c.types.includes("subpremise") || c.types.includes("premise")) {
                apartment = c.long_name;
              }
              if (c.types.includes("route")) {
                street = c.long_name;
              } else if (!street && c.types.includes("sublocality_level_1")) {
                street = c.long_name;
              }
              if (c.types.includes("locality")) {
                city = c.long_name;
              }
              if (c.types.includes("administrative_area_level_1")) {
                state = c.long_name;
              }
              if (c.types.includes("country")) {
                country = c.long_name;
              }
            });

            const streetPart = street || apartment || "";
            const cityPart = city || state || country || "";
            const label =
              streetPart && cityPart
                ? `${streetPart}, ${cityPart}`
                : streetPart || cityPart || results[0].formatted_address || "Add Address";

            if (label) setAddressText(label);
          }
        );
      } catch (err) {
        console.error("Failed to load Google Maps or geocode inside Navbar:", err);
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
        await invalidateProfile();
        setIsAddressRefetching(false);
      }
    };
    window.addEventListener("addressUpdated", handleAddressUpdate);
    return () =>
      window.removeEventListener("addressUpdated", handleAddressUpdate);
  }, [isLoggedIn, invalidateProfile]);

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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        locationDropdownRef.current?.contains(target) ||
        locationDropdownRefMobile.current?.contains(target)
      ) {
        return;
      }
      setShowLocationDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close the location dropdown whenever the route changes.
  useEffect(() => {
    setShowLocationDropdown(false);
  }, [pathname]);

  // Refresh the badge instantly when a notification is read/received elsewhere
  // (FCM push or the notifications page) instead of polling aggressively.
  useEffect(() => {
    const handleNotificationsUpdate = () => invalidateUnreadCount();
    window.addEventListener("notificationsUpdated", handleNotificationsUpdate);
    return () =>
      window.removeEventListener(
        "notificationsUpdated",
        handleNotificationsUpdate,
      );
  }, [invalidateUnreadCount]);

  // No per-navigation cart fetch here any more: `useCart` re-reads on mount,
  // window focus and reconnect, and every cart mutation invalidates it, so this
  // observer stays current on its own.

  const handleLogout = () => {
    clearCachedFCMToken();
    Cookies.remove(ACCESS_TOKEN_COOKIE, { path: "/" });
    Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
    useLocationStore.getState().setHasAutoSavedAddress(false);
    clearCartCache();
    setIsLoggedIn(false);
    setFirstName(null);
    setProfilePhoto(null);
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

  // Shared dropdown body: the saved-address list + "Add New Address" and a
  // link to manage them. Used by both the desktop and mobile location buttons.
  const locationPanel = (
    <>
      <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
        {t("savedAddresses")}
      </p>
      <div className="max-h-64 overflow-y-auto">
        {deliveryAddresses.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">
            {t("noSavedAddressesFound")}
          </p>
        ) : (
          deliveryAddresses.map((addr) => {
            const active = addr.isActive;
            const line2 = formatAddressLine2(addr);
            return (
              <button
                key={addr._id}
                type="button"
                onClick={() => handleSelectAddress(addr._id)}
                disabled={updatingAddressId === addr._id}
                title={formatAddressFull(addr)}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-neutral-700/50 disabled:opacity-60 ${
                  active ? "bg-pink-50 dark:bg-pink-950/20" : ""
                }`}
              >
                <MapPin
                  size={18}
                  className={`mt-0.5 shrink-0 ${
                    active
                      ? "text-[#f9186b] dark:text-pink-400"
                      : "text-gray-400 dark:text-neutral-500"
                  }`}
                />
                {/* Both lines, wrapped rather than truncated: this list is how
                    the customer tells two saved addresses apart, and the parts
                    that distinguish them (apartment, postal code) are exactly
                    what a one-line ellipsis used to cut off. */}
                <span className="min-w-0 flex-1">
                  <span className="block break-words">
                    {formatAddressLine1(addr)}
                  </span>
                  {line2 && (
                    <span className="mt-0.5 block break-words text-xs text-gray-500 dark:text-neutral-400">
                      {line2}
                    </span>
                  )}
                </span>
                {updatingAddressId === addr._id ? (
                  <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#f9186b]/40 border-t-[#f9186b]" />
                ) : active ? (
                  <Check
                    size={16}
                    className="mt-0.5 shrink-0 text-[#f9186b] dark:text-pink-400"
                  />
                ) : null}
              </button>
            );
          })
        )}
      </div>
      <div className="mt-1 border-t border-gray-100 dark:border-neutral-700 pt-1">
        <Link
          href="/add-address"
          onClick={() => setShowLocationDropdown(false)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#f9186b] dark:text-pink-400 hover:bg-gray-100 dark:hover:bg-neutral-700/50"
        >
          <Plus size={18} className="shrink-0" />
          {t("addNewAddress")}
        </Link>
        <Link
          href="/saved-addresses"
          onClick={() => setShowLocationDropdown(false)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700/50"
        >
          <MapPin size={18} className="shrink-0" />
          {t("manageAddresses")}
        </Link>
      </div>
    </>
  );

  return (
    <header className="sticky top-0 z-50 bg-[#f9186b] text-white transition-all duration-300 dark:bg-[#f9186b] px-4 py-3 lg:px-16 lg:py-4">
      {/* Desktop Layout & Mobile Row 1 */}
      <div className="flex w-full items-center justify-between gap-2">
        {/* Brand / Logo */}
        <div className="flex min-w-0 items-center gap-4 xl:gap-8">
          {/* This is the home link, so it gets real affordances: the mark lifts
              on hover, settles on press, and shows a focus ring for keyboard
              users. `group` drives both children from the one hover. */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9186b]"
          >
            {/* The header is #f9186b, so the pink tile would vanish into it.
                The knockout is the mark itself in white — no plate needed, and
                white on #f9186b is 3.9:1. */}
            <Logo
              size={38}
              variant="mark"
              priority
              alt="DeliGo Logo"
              className="transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
            />
            <span className="text-xl font-black tracking-tight md:text-2xl">
              DeliGo
            </span>
          </Link>

          {/* Desktop-only location button. Capped width + truncation so a long
              address ellipsizes instead of squeezing the search bar. Opens a
              dropdown of saved addresses instead of navigating to an edit page. */}
          <div
            ref={locationDropdownRef}
            className="relative hidden min-w-0 lg:block lg:max-w-[220px] xl:max-w-[280px]"
          >
            <button
              suppressHydrationWarning
              onClick={handleLocationButtonClick}
              aria-haspopup="menu"
              aria-expanded={showLocationDropdown}
              className="cursor-pointer flex w-full min-w-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[#fff2f3] transition-all hover:bg-white/20"
            >
              <MapPin size={20} className="shrink-0" />
              <span className="min-w-0 truncate">
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
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 transition-transform ${
                  showLocationDropdown ? "rotate-180" : ""
                }`}
              />
            </button>
            {isLoggedIn && showLocationDropdown && (
              <div className="absolute left-0 z-50 mt-2 w-80 rounded-xl bg-white dark:bg-neutral-800 py-2 text-[#191c1d] dark:text-neutral-100 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                {locationPanel}
              </div>
            )}
          </div>
        </div>

        {/* Desktop-only Search Bar. min-w floor guarantees a usable input width
            regardless of how long the location label is. */}
        <div className="mx-4 hidden flex-1 lg:block lg:min-w-[240px] xl:mx-8 xl:min-w-[340px]">
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-4 text-black/60" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={localSearchTerm}
              onChange={onSearchChange}
              onKeyDown={onKeyDown}
              className="w-full rounded-full border-0 bg-[#ffffff] dark:bg-neutral-800 py-2.5 pl-12 pr-4 text-base text-[#191c1d] dark:text-white outline-none ring-0 placeholder:text-black/45 dark:placeholder:text-white/40 focus:ring-2 focus:ring-[#f9186b]/50 transition-colors"
            />
          </div>
        </div>

        {/* Actions (Desktop and Mobile) */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-2 lg:gap-6">
          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:gap-4">
            {/* Language toggle: styled to match the Bell/Cart icon buttons so it
                sits inline with the other actions on every screen size. */}
            <LanguageSwitcher />
            <Link href="/notifications">
              <button className="relative rounded-full p-1.5 text-white transition-colors hover:bg-white/10 sm:p-2">
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#f9186b] ring-2 ring-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>

            <Link href="/cart">
              <button className="relative rounded-full p-1.5 text-white transition-colors hover:bg-white/10 sm:p-2">
                <ShoppingCart size={22} />
                {vendorCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#f9186b] ring-2 ring-white">
                    {vendorCount > 9 ? "9+" : vendorCount}
                  </span>
                )}
              </button>
            </Link>
          </div>

          <div className="relative min-w-0" ref={dropdownRef}>
            <button
              onClick={handleAccountClick}
              className="flex min-w-0 items-center gap-2 rounded-full p-1.5 text-white transition-colors hover:bg-white/10 sm:gap-3"
            >
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border-2 border-white/20 bg-[#edeeef] flex items-center justify-center sm:h-9 sm:w-9">
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
                      <circle cx="18" cy="14" r="6" fill="#f9186b" />
                      <ellipse cx="18" cy="30" rx="10" ry="7" fill="#f9186b" />
                    </svg>
                  )
                ) : (
                  <User size={22} className="text-[#f9186b]" />
                )}
              </div>
              <span className="min-w-0 max-w-[84px] truncate text-sm font-semibold leading-5 sm:max-w-[140px]">
                {mounted && isLoggedIn && firstName ? firstName : t("account")}
              </span>
            </button>
            {isLoggedIn && showAccountDropdown && (
              <div className="absolute right-0 z-50 mt-2 w-48 rounded-md bg-white dark:bg-neutral-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 transition-all">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700/50 transition-colors"
                  onClick={() => setShowAccountDropdown(false)}
                >
                  <User size={16} />
                  {t("profile")}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-neutral-700/50 transition-colors"
                >
                  <LogOut size={16} />
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only Row 2: Search Bar */}
      <div className="mt-3 w-full lg:hidden">
        <div className="relative flex items-center">
          <Search size={18} className="absolute left-4 text-black/60" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={localSearchTerm}
            onChange={onSearchChange}
            onKeyDown={onKeyDown}
            className="w-full rounded-full border-0 bg-[#ffffff] dark:bg-neutral-800 py-2.5 pl-12 pr-4 text-base text-[#191c1d] dark:text-white outline-none ring-0 placeholder:text-black/45 dark:placeholder:text-white/40 focus:ring-2 focus:ring-[#f9186b]/50 transition-colors"
          />
        </div>
      </div>

      {/* Mobile-only Row 3: Location (goes after second row) */}
      <div className="mt-2.5 w-full lg:hidden">
        <div ref={locationDropdownRefMobile} className="relative w-full">
          <button
            suppressHydrationWarning
            onClick={handleLocationButtonClick}
            aria-haspopup="menu"
            aria-expanded={showLocationDropdown}
            className="cursor-pointer flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-2 text-[#fff2f3] transition-all hover:bg-white/20"
          >
            <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
              <MapPin size={18} className="shrink-0" />
              <span className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap">
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
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform ${
                showLocationDropdown ? "rotate-180" : ""
              }`}
            />
          </button>
          {isLoggedIn && showLocationDropdown && (
            <div className="absolute left-0 right-0 z-50 mt-2 rounded-xl bg-white dark:bg-neutral-800 py-2 text-[#191c1d] dark:text-neutral-100 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
              {locationPanel}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
