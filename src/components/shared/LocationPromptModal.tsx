"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, Compass } from "lucide-react";
import { useLocationStore } from "@/stores/locationStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getAccessToken } from "@/lib/authCookies";
import { apiClient } from "@/lib/apiClient";
import { addDeliveryAddress } from "@/services/addressApi";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import { Button } from "@/components/ui/button";

// Minimal shapes for the fields we read off a Google Maps geocoder result
// (the global `window.google` is untyped; this avoids `any` at the call sites).
interface GeocoderAddressComponent {
  long_name: string;
  types: string[];
}
interface GeocoderResult {
  address_components: GeocoderAddressComponent[];
  formatted_address: string;
}

async function reverseGeocode(latitude: number, longitude: number): Promise<{
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  detailedAddress: string;
}> {
  await loadGoogleMapsScript();
  if (!window.google?.maps) {
    throw new Error("Google Maps script not loaded");
  }

  return new Promise((resolve, reject) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat: latitude, lng: longitude } },
      (results: GeocoderResult[] | null, status: string) => {
        if (status !== "OK" || !results || !results[0]) {
          reject(new Error("Geocoding failed: " + status));
          return;
        }

        const comps = results[0].address_components;
        let street = "",
          city = "",
          state = "",
          country = "",
          postalCode = "",
          apartment = "";

        comps.forEach((c: GeocoderAddressComponent) => {
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
          if (c.types.includes("postal_code")) {
            postalCode = c.long_name;
          }
        });

        resolve({
          street: street || "Unknown Street",
          city: city || "Unknown City",
          state: state || "Unknown State",
          country: country || "Unknown Country",
          postalCode: postalCode || "00000",
          detailedAddress: apartment || results[0].formatted_address || street || "",
        });
      }
    );
  });
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
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-tr from-primary/20 to-[#fff2f3]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/10 opacity-75 duration-1000" />
            <span className="absolute inline-flex h-20 w-20 animate-pulse rounded-full bg-primary/15" />
            {isRequesting ? (
              <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
            ) : (
              <MapPin className="relative h-12 w-12 text-primary drop-shadow-md" />
            )}
          </div>

          <h2 className="mb-4 text-xl font-black tracking-tight text-foreground">
            {t("locationPromptTitle")}
          </h2>

          <p className="mb-8 text-base leading-relaxed text-muted-foreground font-medium px-2">
            {t("locationPromptDescription")}
          </p>

          <div className="flex w-full flex-col gap-3">
            {/* The gradient here ran from #f9186b to #f9186b — a gradient
                between a colour and itself. It is a flat brand fill, which is
                exactly what the default variant paints. */}
            <Button
              size="lg"
              onClick={handleShareLocation}
              disabled={isRequesting}
              className="w-full cursor-pointer gap-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl active:scale-[0.98]"
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
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={handleNotNow}
              disabled={isRequesting}
              className="w-full cursor-pointer rounded-2xl border-2 font-bold"
            >
              {t("notNow")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
