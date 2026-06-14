/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Building2, Globe, Home, MapPin, Navigation, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import {
  addDeliveryAddress,
  updateDeliveryAddress,
  updateLiveLocation,
} from "@/services/addressApi";
import { useTranslation } from "@/hooks/useTranslation";

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
  addressId,
  onSuccess,
}: AddressFormProps) {
  const { t } = useTranslation();
  const [addressType, setAddressType] = useState<"home" | "work" | "other">(
    "home",
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

  // Initialize from initialAddress (edit mode) only when it changes
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
            : "home",
      );
    }
  }, [initialAddress]);

  // Reverse geocode when coordinates change (map moved or GPS used)
  useEffect(() => {
    if (!coordinates) return;
    if (!window.google?.maps) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat: coordinates.lat, lng: coordinates.lng } },
      (results: any[], status: any) => {
        if (status !== "OK" || !results?.length) return;
        const comps = results[0].address_components;
        let street = "",
          city = "",
          state = "",
          country = "",
          postalCode = "";
        comps.forEach((c: any) => {
          if (c.types.includes("route")) street = c.long_name;
          if (c.types.includes("locality")) city = c.long_name;
          if (c.types.includes("administrative_area_level_1"))
            state = c.long_name;
          if (c.types.includes("country")) country = c.long_name;
          if (c.types.includes("postal_code")) postalCode = c.long_name;
        });
        setFormData((prev) => ({
          ...prev,
          street: street,
          city: city,
          state: state,
          country: country,
          postalCode: postalCode,
        }));
      },
    );
  }, [coordinates]);

  const mapAddressTypeToBackend = (
    type: string,
  ): "HOME" | "OFFICE" | "OTHER" => {
    if (type === "home") return "HOME";
    if (type === "work") return "OFFICE";
    return "OTHER";
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error("User not loaded. Please refresh.");
      return;
    }
    if (!coordinates) {
      toast.error("Location not detected yet. Please wait or use GPS.");
      return;
    }

    setIsSaving(true);
    try {
      await updateLiveLocation(userId, coordinates.lat, coordinates.lng);
      const payload = {
        street: formData.street,
        detailedAddress: formData.detailedAddress,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postalCode: formData.postalCode,
        longitude: coordinates.lng,
        latitude: coordinates.lat,
        geoAccuracy: 5,
        addressType: mapAddressTypeToBackend(addressType),
      };
      if (isEditMode && addressId) {
        await updateDeliveryAddress(addressId, payload);
      } else {
        await addDeliveryAddress(payload);
      }

      toast.success(
        isEditMode
          ? "Address updated successfully!"
          : "Address added successfully!",
      );
      onSuccess?.();
    } catch (error: any) {
      if (error.response && error.response.data) {
        console.error(
          "Server error response data:",
          JSON.stringify(error.response.data, null, 2),
        );
      } else {
        console.error("Unexpected error:", error);
      }
      const serverMessage = error.response?.data?.message || error.message;
      toast.error(
        serverMessage ||
          "Failed to save address. Please check the console for details.",
      );
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

      {/* Address Label */}
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
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition ${
                addressType === type
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
            // placeholder="Enter city"
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

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b0004a] py-4 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        <Save size={18} />
        {isSaving
          ? t("saving")
          : isEditMode
            ? t("updateAddress")
            : t("saveAddress")}
      </button>
    </div>
  );
}