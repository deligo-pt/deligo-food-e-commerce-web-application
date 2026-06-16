"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Plus } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useLocationStore } from "@/stores/locationStore";

export default function CurrentLocationPage() {
  const router = useRouter();
  const { requestLocation, permissionStatus } = useLocationStore();
  const [loading, setLoading] = useState(false);

  const handleCurrentLocation = async () => {
    setLoading(true);
    const granted = await requestLocation();
    setLoading(false);

    if (granted) {
      toast.success("Location updated!");
    } else {
      if (permissionStatus === "denied") {
        toast.error(
          "Location access is blocked. Enable it in your browser settings."
        );
      } else {
        toast.error("Could not detect your location. Please try again.");
      }
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Toaster position="top-center" richColors />

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#b0004a]/10">
            <MapPin size={32} className="text-[#b0004a]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Current Location
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Choose how you want to set your delivery location
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-4">
          {/* Current Location */}
          <button
            onClick={handleCurrentLocation}
            disabled={loading}
            className="flex items-center justify-center gap-3 rounded-2xl border-2 border-[#b0004a] bg-[#b0004a] px-6 py-4 text-base font-semibold text-white transition-all hover:bg-[#8c0039] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Navigation size={20} />
            )}
            {loading ? "Detecting location…" : "Current Location"}
          </button>

          {/* Add New Address */}
          <button
            onClick={() => router.push("/add-address")}
            className="flex items-center justify-center gap-3 rounded-2xl border-2 border-[#b0004a] bg-white px-6 py-4 text-base font-semibold text-[#b0004a] transition-all hover:bg-[#b0004a]/5 dark:bg-transparent dark:hover:bg-[#b0004a]/10"
          >
            <Plus size={20} />
            Add New Address
          </button>
        </div>
      </div>
    </div>
  );
}
