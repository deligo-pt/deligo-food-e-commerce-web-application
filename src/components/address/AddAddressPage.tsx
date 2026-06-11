/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ArrowLeft, CheckCircle, LocateFixed, Map, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import LocationPicker from "@/components/profile/locationPicker";
import AddressForm from "./AddressForm";
import { fetchUserProfile, updateLiveLocation } from "@/services/addressApi";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

export default function AddAddressPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addressId = searchParams.get("addressId");
  const isEditMode = !!addressId;

  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [coordinates, setCoordinates] = useState({
    lat: 23.8103,
    lng: 90.4125,
  });
  const [initialAddress, setInitialAddress] = useState<any>(null);
  const [searchValue, setSearchValue] = useState("");
  const [updatingLocation, setUpdatingLocation] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetchUserProfile();
        if (res.success && res.data) {
          const userData = res.data;
          setUserId(userData.userId);

          if (isEditMode && addressId) {
            const address = userData.deliveryAddresses?.find(
              (a: any) => a._id === addressId,
            );
            if (address) {
              setCoordinates({ lat: address.latitude, lng: address.longitude });
              setInitialAddress(address);
            }
          } else {
            const loc = userData.currentSessionLocation?.coordinates;
            if (loc?.length === 2) {
              setCoordinates({ lat: loc[1], lng: loc[0] });
            }
          }
        }
      } catch (error) {
        console.error("Failed to load profile", error);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [addressId, isEditMode]);

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.error(err);
        toast.error("Could not get your location");
      },
    );
  };

  const handleFullMap = () => {
    document
      .getElementById("map-section")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUpdateLocation = async () => {
    if (!userId) {
      toast.error("User not loaded");
      return;
    }
    setUpdatingLocation(true);
    try {
      await updateLiveLocation(userId, coordinates.lat, coordinates.lng);
      toast.success("Live location updated!");
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setUpdatingLocation(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b0004a] border-t-transparent"></div>
      </div>
    );

  return (
    <section className="bg-[#f8f9fa] py-8">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-[#b0004a]" />
          </button>
          <h1 className="text-3xl font-bold text-[#191c1d]">
            {isEditMode ? t("editAddress") : t("addNewAddress")}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Panel */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-bold text-[#191c1d]">
                  {t("confirmLocation")}
                </h2>
                <p className="text-sm text-[#5a4044]">
                  {t("confirmLocationDescription")}
                </p>
              </div>

              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={t("searchAreaPlaceholder")}
                  className="w-full rounded-full border border-[#e3bdc3] py-4 pl-12 pr-4 outline-none focus:border-[#b0004a]"
                />
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <button
                  onClick={handleUseGPS}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#b0004a] px-4 py-3 font-medium text-[#b0004a] hover:bg-[#fff2f5]"
                >
                  <LocateFixed size={18} /> {t("useGps")}
                </button>
                <button
                  onClick={handleFullMap}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#b0004a] px-4 py-3 font-medium text-[#b0004a] hover:bg-[#fff2f5]"
                >
                  <Map size={18} /> {t("fullMap")}
                </button>
              </div>

              <div id="map-section" className="mb-6">
                <LocationPicker
                  defaultCenter={coordinates}
                  searchValue={searchValue}
                  onCoordinatesChange={(lat, lng) =>
                    setCoordinates({ lat, lng })
                  }
                />
              </div>

              <button
                onClick={handleUpdateLocation}
                disabled={updatingLocation}
                className="mb-4 w-full rounded-xl bg-[#b0004a] py-4 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {updatingLocation ? t("updating") : t("updateLocation")}
              </button>

              <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                <CheckCircle className="mt-0.5 text-green-600" size={20} />
                <div>
                  <p className="font-bold text-green-800">
                    {t("locationConfirmed")}
                  </p>
                  <p className="text-sm text-green-700">
                    Lat: {coordinates.lat.toFixed(6)} | Lng:{" "}
                    {coordinates.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-7">
            <AddressForm
              coordinates={coordinates}
              initialAddress={initialAddress}
              isEditMode={isEditMode}
              userId={userId}
              addressId={addressId || undefined}
            />
          </div>
        </div>
      </div>
    </section>
  );
}