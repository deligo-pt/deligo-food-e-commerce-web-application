"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, Compass } from "lucide-react";
import { useLocationStore } from "@/stores/locationStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getAccessToken } from "@/lib/authCookies";
import { apiClient } from "@/lib/apiClient";
import { addDeliveryAddress } from "@/services/addressApi";

async function reverseGeocode(latitude: number, longitude: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
    { headers: { "Accept-Language": "en" } },
  );
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
    "Unknown Street";

  const city =
    addr.city ??
    addr.town ??
    addr.village ??
    addr.county ??
    addr.suburb ??
    "Unknown City";

  return {
    street,
    city,
    state: addr.state ?? "Unknown State",
    country: addr.country ?? "Unknown Country",
    postalCode: addr.postcode ?? "00000",
    detailedAddress: data?.display_name ?? street,
  };
}

async function checkLoggedInWithNoAddresses(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!getAccessToken()) return false;

  try {
    const res = await apiClient.get("/profile");
    const deliveryAddresses: unknown[] =
      res.data?.data?.deliveryAddresses ?? [];
    return deliveryAddresses.length === 0;
  } catch {
    return false;
  }
}

async function autoSaveLocationAsAddress(latitude: number, longitude: number) {
  const addressFields = await reverseGeocode(latitude, longitude);
  await addDeliveryAddress({
    ...addressFields,
    latitude,
    longitude,
    addressType: "HOME",
  });
  window.dispatchEvent(new Event("addressUpdated"));
}

export default function LocationPromptModal() {
  const { t } = useTranslation();
  const {
    showPromptModal,
    coords,
    permissionStatus,
    initLocation,
    requestLocation,
    setShowPromptModal,
    setPermissionStatus,
    setIsAutoSavingAddress,
  } = useLocationStore();

  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    initLocation();
  }, [initLocation]);

  useEffect(() => {
    if (permissionStatus !== "granted" || !coords) return;
    const { hasAutoSavedAddress, setHasAutoSavedAddress } =
      useLocationStore.getState();
    if (hasAutoSavedAddress) return;
    if (!getAccessToken()) return;
    setHasAutoSavedAddress(true);
    setIsAutoSavingAddress(true);

    (async () => {
      try {
        const shouldSave = await checkLoggedInWithNoAddresses();
        if (shouldSave) {
          await autoSaveLocationAsAddress(coords.latitude, coords.longitude);
        }
      } catch (err) {
        console.error("Failed to auto-save location as delivery address:", err);
      } finally {
        setIsAutoSavingAddress(false);
      }
    })();
  }, [permissionStatus, coords, setIsAutoSavingAddress]);

  if (!showPromptModal) return null;

  const handleShareLocation = async () => {
    setIsRequesting(true);
    await requestLocation();
    setIsRequesting(false);
  };

  const handleNotNow = () => {
    setShowPromptModal(false);
    setPermissionStatus("denied");
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      {/* Backdrop blur overlay */}
      <div
        className="absolute inset-0 bg-[#191c1d]/60 backdrop-blur-md transition-opacity duration-500"
        onClick={handleNotNow}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-4xl bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-gray-100 transition-all duration-300 transform scale-100 animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center text-center">
          {/* Animated illustration */}
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-tr from-[#ffd9de] to-[#fff2f3]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffd9de]/50 opacity-75 duration-1000" />
            <span className="absolute inline-flex h-20 w-20 animate-pulse rounded-full bg-[#ffd9de]/70" />
            {isRequesting ? (
              <Loader2 className="relative h-12 w-12 animate-spin text-[#b0004a]" />
            ) : (
              <MapPin className="relative h-12 w-12 text-[#b0004a] drop-shadow-md" />
            )}
          </div>

          <h2 className="mb-4 text-3xl font-black tracking-tight text-[#191c1d]">
            {t("locationPromptTitle")}
          </h2>

          <p className="mb-8 text-[16px] leading-relaxed text-[#5a4044] font-medium px-2">
            {t("locationPromptDescription")}
          </p>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={handleShareLocation}
              disabled={isRequesting}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-linear-to-r from-[#b0004a] to-[#d81b60] py-4 text-base font-bold text-white shadow-lg shadow-[#b0004a]/20 transition-all hover:opacity-95 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRequesting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {t("calculating")}
                </>
              ) : (
                <>
                  <Compass size={20} className="animate-pulse" />
                  {t("shareLocation")}
                </>
              )}
            </button>

            <button
              onClick={handleNotNow}
              disabled={isRequesting}
              className="w-full cursor-pointer rounded-2xl border-2 border-[#edeeef] py-4 text-base font-bold text-[#5a4044] hover:bg-[#f8f9fa] hover:text-[#191c1d] transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("notNow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
