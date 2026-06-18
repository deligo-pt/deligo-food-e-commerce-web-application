"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Plus, ArrowLeft, Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useLocationStore } from "@/stores/locationStore";
import { useTranslation } from "@/hooks/useTranslation";

export default function CurrentLocationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestLocation, permissionStatus } = useLocationStore();
  const [loading, setLoading] = useState(false);

  const handleCurrentLocation = async () => {
    setLoading(true);
    const granted = await requestLocation();
    setLoading(false);

    if (granted) {
      toast.success(t("locationUpdated") || "Location updated!");
    } else {
      if (permissionStatus === "denied") {
        toast.error(
          t("locationAccessDenied") ||
            "Location access is blocked. Enable it in your browser settings.",
        );
      } else {
        toast.error(
          t("couldNotDetectLocation") ||
            "Could not detect your location. Please try again.",
        );
      }
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12">
      <Toaster position="top-center" richColors />

      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-[#b0004a] transition hover:opacity-70"
        >
          <ArrowLeft size={18} />
          {t("back") || "Back"}
        </button>

        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#b0004a]/10">
            <MapPin size={36} className="text-[#b0004a]" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-[#191c1d]">
            {t("myCurrentLocation")}
          </h1>
          <p className="text-sm text-[#5a4044]">
            {t("currentLocationDescription")}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-4">
          {/* Use Current Location */}
          <button
            onClick={handleCurrentLocation}
            disabled={loading}
            className="flex items-center justify-center gap-3 rounded-2xl bg-[#b0004a] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#8c003b] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {t("detecting")}
              </>
            ) : (
              <>
                <Navigation size={20} />
                {t("useCurrentLocation")}
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
            {t("addNewAddress")}
          </button>
        </div>
      </div>
    </div>
  );
}
