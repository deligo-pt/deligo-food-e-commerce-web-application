/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Building2, Globe, Home, MapPin, Navigation, Save } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import { addDeliveryAddress, updateLiveLocation } from "@/services/addressApi";
import { useTranslation } from "@/hooks/useTranslation";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/authCookies";

interface AddressFormProps {
  coordinates: { lat: number; lng: number } | null;
  initialAddress?: any;
  isEditMode?: boolean;
  userId?: string;
  addressId?: string;
  onSuccess?: () => void;
}

export default function AddressForm({
  coordinates,
  initialAddress,
  isEditMode = false,
  userId,
  onSuccess,
}: AddressFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const isLoggedIn = !!getAccessToken();
  const [addressType, setAddressType] = useState<"home" | "work" | "other">(
    "home"
  );
  const [formData, setFormData] = useState({
    street: "",
    detailedAddress: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const hasInitializedRef = useRef(false);

  // Initialize from initialAddress (edit mode)
  useEffect(() => {
    if (!initialAddress) return;
    setFormData({
      street: initialAddress.street || "",
      detailedAddress: initialAddress.detailedAddress || "",
      city: initialAddress.city || "",
      state: initialAddress.state || "",
      country: initialAddress.country || "",
      postalCode: initialAddress.postalCode || "",
    });
    if (initialAddress.addressType) {
      setAddressType(
        initialAddress.addressType === "OFFICE"
          ? "work"
          : initialAddress.addressType === "OTHER"
            ? "other"
            : "home"
      );
    }
    // Mark that the form is populated — geocode effect can now safely replace fields
    hasInitializedRef.current = true;
  }, [initialAddress]);

  useEffect(() => {
    if (!coordinates) return;
    if (!window.google?.maps) return;

    // In edit mode, skip until initialAddress has been loaded into the form
    if (initialAddress && !hasInitializedRef.current) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat: coordinates.lat, lng: coordinates.lng } },
      (results: any[], status: any) => {
        if (status !== "OK" || !results?.length) return;
        const comps = results[0].address_components;

        // Extract every component we care about (empty string = not present)
        let street = "",
          city = "",
          state = "",
          country = "",
          postalCode = "";

        comps.forEach((c: any) => {
          // Street: prefer "route"; fall back to "sublocality_level_1" for areas without named roads
          if (c.types.includes("route")) street = c.long_name;
          else if (!street && c.types.includes("sublocality_level_1"))
            street = c.long_name;
          if (c.types.includes("locality")) city = c.long_name;
          if (c.types.includes("administrative_area_level_1"))
            state = c.long_name;
          if (c.types.includes("country")) country = c.long_name;
          if (c.types.includes("postal_code")) postalCode = c.long_name;
        });

        // Always replace all geocoded fields — clear any that the geocoder didn't return
        setFormData((prev) => ({
          ...prev,
          street,
          city,
          state,
          country,
          postalCode,
        }));
      }
    );
  }, [coordinates, initialAddress]);

  const mapAddressTypeToBackend = (
    type: string
  ): "HOME" | "OFFICE" | "OTHER" => {
    if (type === "home") return "HOME";
    if (type === "work") return "OFFICE";
    return "OTHER";
  };

  const handleSave = async () => {
    if (!getAccessToken()) {
      toast.info("Please log in to save your address.");
      router.push("/login");
      return;
    }
    if (!coordinates) {
      toast.error("Location not detected yet. Please wait or use GPS.");
      return;
    }
    if (!formData.street.trim()) {
      toast.error("Street address is required.");
      return;
    }
    if (!formData.city.trim()) {
      toast.error("City is required.");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditMode) {
        // PATCH — update live location + primary address
        if (!userId) {
          toast.error("User not loaded. Please refresh.");
          setIsSaving(false);
          return;
        }
        await updateLiveLocation(userId, {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          geoAccuracy: 10,
          isMocked: false,
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          country: formData.country.trim(),
          postalCode: formData.postalCode.trim(),
          detailedAddress: formData.detailedAddress.trim(),
        });
      } else {
        // POST — add new delivery address
        await addDeliveryAddress({
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          country: formData.country.trim(),
          postalCode: formData.postalCode.trim(),
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          geoAccuracy: 10,
          detailedAddress: formData.detailedAddress.trim(),
          addressType: mapAddressTypeToBackend(addressType),
        });
      }

      // Notify navbar to refresh address text
      window.dispatchEvent(new Event("addressUpdated"));

      toast.success(
        isEditMode
          ? "Primary address updated successfully!"
          : "Address added successfully!"
      );
      onSuccess?.();
    } catch (error: any) {
      const serverMessage = error.response?.data?.message || error.message;
      toast.error(serverMessage || "Failed to save address. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
      <Toaster position="top-center" richColors />
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-[#191c1d]">
          {t("addressDetails")}
        </h2>
        <p className="text-sm text-[#5a4044]">
          {t("addressDetailsDescription")}
        </p>
      </div>

      {/* Address Type */}
      <div className="mb-8">
        <label className="mb-4 block text-sm font-semibold text-[#191c1d]">
          {t("labelAddressAs")}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(["home", "work", "other"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAddressType(type)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition ${addressType === type
                ? "border-[#b0004a] bg-[#fff2f5] text-[#b0004a]"
                : "border-[#e3bdc3] text-[#5a4044]"
                }`}
            >
              {type === "home" && <Home size={18} />}
              {type === "work" && <Building2 size={18} />}
              {type === "other" && <Globe size={18} />}
              {t(type)}
            </button>
          ))}
        </div>
        {isEditMode && (
          <p className="mt-2 text-xs text-gray-500">
            Note: Edit mode updates the PRIMARY address regardless of type selected.
          </p>
        )}
      </div>

      {/* Street + Detailed */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            {t("streetAddress")}
          </label>
          <div className="flex items-center rounded-xl border border-[#e3bdc3] px-4">
            <MapPin size={18} className="mr-3 text-[#5a4044]" />
            <input
              type="text"
              value={formData.street}
              onChange={(e) =>
                setFormData({ ...formData, street: e.target.value })
              }
              placeholder={t("enterStreetAddress")}
              className="h-14 w-full bg-transparent outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            {t("houseApartmentFloor")}
          </label>
          <div className="flex items-center rounded-xl border border-[#e3bdc3] px-4">
            <Building2 size={18} className="mr-3 text-[#5a4044]" />
            <input
              type="text"
              value={formData.detailedAddress}
              onChange={(e) =>
                setFormData({ ...formData, detailedAddress: e.target.value })
              }
              placeholder={t("apartmentPlaceholder")}
              className="h-14 w-full bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* City + Postal */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            {t("city")}
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder={t("enterCity")}
            className="h-14 w-full rounded-xl border border-[#e3bdc3] px-4 outline-none focus:border-[#b0004a]"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            {t("postalCode")}
          </label>
          <input
            type="text"
            value={formData.postalCode}
            onChange={(e) =>
              setFormData({ ...formData, postalCode: e.target.value })
            }
            placeholder="1000-001"
            className="h-14 w-full rounded-xl border border-[#e3bdc3] px-4 outline-none focus:border-[#b0004a]"
          />
        </div>
      </div>

      {/* State + Country */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            {t("stateRegion")}
          </label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value })
            }
            placeholder="Lisbon"
            className="h-14 w-full rounded-xl border border-[#e3bdc3] px-4 outline-none focus:border-[#b0004a]"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            {t("country")}
          </label>
          <div className="flex items-center rounded-xl border border-[#e3bdc3] px-4">
            <Globe size={18} className="mr-3 text-[#5a4044]" />
            <input
              type="text"
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              className="h-14 w-full bg-transparent outline-none"
            />
          </div>
        </div>
      </div>



      {/* Coordinates Card */}
      <div className="mb-8 rounded-2xl border border-[#e3bdc3] bg-[#fafafa] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Navigation size={18} className="text-[#b0004a]" />
          <h3 className="font-semibold text-[#191c1d]">
            {t("gpsCoordinates")}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-[#5a4044]">
              {t("latitude")}
            </p>
            <p className="rounded-lg bg-white px-4 py-3 font-mono text-sm">
              {coordinates ? coordinates.lat.toFixed(6) : "—"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-[#5a4044]">
              {t("longitude")}
            </p>
            <p className="rounded-lg bg-white px-4 py-3 font-mono text-sm">
              {coordinates ? coordinates.lng.toFixed(6) : "—"}
            </p>
          </div>
        </div>
      </div>

      {!isLoggedIn && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Not signed in.</strong> You can explore the map and pick a location, but you need to{" "}
          <button
            onClick={() => router.push("/login")}
            className="font-semibold underline hover:text-amber-900"
          >
            log in
          </button>{" "}
          to save your address.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b0004a] py-4 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        <Save size={18} />
        {!isLoggedIn
          ? "Login to Save Address"
          : isSaving
            ? t("saving")
            : isEditMode
              ? t("updateAddress")
              : t("saveAddress")}
      </button>
    </div>
  );
}