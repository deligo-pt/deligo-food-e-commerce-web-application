/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Navigation, MapPin, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { updateLiveLocation } from "@/services/addressApi";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  addressId: string;
}

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

export default function EditAddressPage({ addressId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    apiClient
      .get("/profile")
      .then((res) => setUserId(res.data?.data?.userId ?? ""))
      .catch(() => { });
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(
        t("geolocationNotSupported") ||
          "Geolocation is not supported by your browser.",
      );
      return;
    }
    if (!userId) {
      toast.error(
        t("profileNotLoadedYet") ||
          "User profile not loaded yet. Please wait a moment.",
      );
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const addressFields = await reverseGeocode(latitude, longitude);

          await updateLiveLocation(userId, {
            latitude,
            longitude,
            geoAccuracy: 10,
            isMocked: false,
            street: addressFields.street,
            city: addressFields.city,
            state: addressFields.state,
            country: addressFields.country,
            postalCode: addressFields.postalCode,
            detailedAddress: addressFields.detailedAddress,
          });
          window.dispatchEvent(new Event("addressUpdated"));

          toast.success(
            t("locationUpdated") || "Primary address updated successfully!",
          );
          router.push("/saved-addresses");
        } catch (err) {
          toast.error(getApiErrorMessage(err, "Failed to update location."));
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(
            t("locationAccessDenied") ||
              "Location access denied. Please enable it in your browser settings.",
          );
        } else {
          toast.error(
            t("couldNotDetectLocation") ||
              "Could not detect your location. Please try again.",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      {/* Back button */}
      <div className="mb-10 w-full max-w-md">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-[#b0004a] transition hover:opacity-70"
        >
          <ArrowLeft size={18} />
          {t("back") || "Back"}
        </button>

        {/* Icon + Title */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#b0004a]/10">
            <MapPin size={36} className="text-[#b0004a]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-[#191c1d]">
            {t("myCurrentLocation") || "My Current Location"}
          </h1>
          <p className="text-sm text-[#5a4044]">
            {t("currentLocationDescription") ||
              "Use your device's GPS to update your delivery location instantly."}
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex w-full max-w-md flex-col gap-4">
        {/* Use Current Location */}
        <button
          onClick={handleUseCurrentLocation}
          disabled={loading}
          className="flex items-center justify-center gap-3 rounded-2xl bg-[#b0004a] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#8c003b] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              {t("detecting") || "Detecting location…"}
            </>
          ) : (
            <>
              <Navigation size={20} />
              {t("useCurrentLocation") || "Use Current Location"}
            </>
          )}
        </button>

        {/* Add New Address */}
        <button
          onClick={() => router.push("/add-address")}
          disabled={loading}
          className="flex items-center justify-center gap-3 rounded-2xl border-2 border-[#b0004a] bg-white px-6 py-4 text-base font-semibold text-[#b0004a] transition-all hover:bg-[#b0004a]/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={20} />
          {t("addNewAddress") || "Add New Address"}
        </button>
      </div>
    </div>
  );
}
