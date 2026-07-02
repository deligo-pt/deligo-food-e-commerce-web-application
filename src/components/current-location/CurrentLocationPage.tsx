/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, X, Navigation, MapPin, Plus, Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import LocationPicker from "@/components/profile/locationPicker";
import AddressForm from "@/components/address/AddressForm";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocationStore } from "@/stores/locationStore";
import { getAccessToken } from "@/lib/authCookies";

const GOOGLE_API_URL = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_LOCATION_API_KEY}&libraries=places`;

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export default function CurrentLocationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const isLoggedIn = typeof window !== "undefined" ? !!getAccessToken() : false;
  const { guestAddress, coords } = useLocationStore();

  // Redirect logged-in users to home or profile
  useEffect(() => {
    if (isLoggedIn) {
      router.replace("/");
    }
  }, [isLoggedIn, router]);

  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(() => {
    if (guestAddress) {
      return { lat: guestAddress.latitude, lng: guestAddress.longitude };
    }
    if (coords) {
      return { lat: coords.latitude, lng: coords.longitude };
    }
    return null;
  });

  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);

  const autocompleteServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Initialize GPS location if guestAddress is not set
  useEffect(() => {
    if (guestAddress) return;
    if (coords) {
      setCoordinates({
        lat: coords.latitude,
        lng: coords.longitude,
      });
      return;
    }
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoordinates({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          // Keep null so we don't prefill defaults
        }
      );
    }
  }, [guestAddress, coords]);

  // Click outside to hide suggestions dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ensure Google Maps places API script is loaded
  const ensureGoogleMaps = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[src^="https://maps.googleapis.com"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve());
        return;
      }
      setIsLoadingMaps(true);
      const script = document.createElement("script");
      script.src = GOOGLE_API_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsLoadingMaps(false);
        resolve();
      };
      document.body.appendChild(script);
    });
  }, []);

  // Fetch places suggestions
  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim() || query.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      await ensureGoogleMaps();

      if (!autocompleteServiceRef.current) {
        autocompleteServiceRef.current =
          new window.google.maps.places.AutocompleteService();
      }
      if (!sessionTokenRef.current) {
        sessionTokenRef.current =
          new window.google.maps.places.AutocompleteSessionToken();
      }

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: query,
          sessionToken: sessionTokenRef.current,
        },
        (predictions: any[], status: string) => {
          if (
            status !== window.google.maps.places.PlacesServiceStatus.OK ||
            !predictions?.length
          ) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
          }

          const mapped: Suggestion[] = predictions.map((p: any) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? "",
          }));

          setSuggestions(mapped);
          setShowSuggestions(true);
        },
      );
    },
    [ensureGoogleMaps],
  );

  // Search input change handler with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  };

  // Suggestion click handler to update coordinates via Geocoder
  const handleSuggestionClick = useCallback(
    async (suggestion: Suggestion) => {
      setSearchValue(suggestion.description);
      setSuggestions([]);
      setShowSuggestions(false);

      sessionTokenRef.current = null;

      await ensureGoogleMaps();

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { placeId: suggestion.placeId },
        (results: any[], status: string) => {
          if (status !== "OK" || !results?.length) return;
          const loc = results[0].geometry.location;
          const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
          setCoordinates({ lat, lng });
        },
      );
    },
    [ensureGoogleMaps],
  );

  // Clear search input
  const clearSearch = () => {
    setSearchValue("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Use Current Location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(
        t("geolocationNotSupported") ||
        "Geolocation is not supported by your browser.",
      );
      return;
    }

    setLoadingCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        toast.success(t("currentLocationLoadedOnMap"));
        setLoadingCurrentLocation(false);
      },
      (err) => {
        setLoadingCurrentLocation(false);
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

  if (isLoggedIn) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b0004a] border-t-transparent" />
      </div>
    );
  }

  return (
    <section className="bg-[#f8f9fa] py-8">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Page Title */}
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm transition hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-[#b0004a]" />
          </button>
          <h1 className="text-3xl font-bold text-[#191c1d]">
            {t("myCurrentLocation") || "My Current Location"}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Panel */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Quick Instant GPS Update Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-xl font-bold text-[#191c1d]">
                {t("myCurrentLocation") || "My Current Location"}
              </h2>
              <p className="text-sm text-[#5a4044] mb-4">
                {t("currentLocationDescription") || "Use your device's GPS to update your delivery location instantly."}
              </p>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={loadingCurrentLocation}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#b0004a] px-6 py-4 text-base font-semibold text-white shadow-md transition-all hover:bg-[#8c003b] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingCurrentLocation ? (
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
            </div>

            {/* Interactive Location Confirmation Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-bold text-[#191c1d]">
                  {t("confirmLocation") || "Confirm Location"}
                </h2>
                <p className="text-sm text-[#5a4044]">
                  {t("confirmLocationDescription") || "Search for your location or drag the marker to target your address."}
                </p>
              </div>

              {/* Autocomplete Search input */}
              <div ref={searchContainerRef} className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10"
                  size={18}
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={handleSearchChange}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder={t("searchAreaPlaceholder") || "Search area..."}
                  className="w-full rounded-full border border-[#e3bdc3] py-4 pl-12 pr-10 outline-none focus:border-[#b0004a]"
                  autoComplete="off"
                />
                {searchValue && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#e3bdc3] bg-white shadow-xl">
                    {suggestions.map((s, idx) => (
                      <li key={s.placeId}>
                        <button
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#fff2f5] ${idx !== suggestions.length - 1
                            ? "border-b border-[#f5e0e5]"
                            : ""
                            }`}
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff2f5]">
                            <Search size={13} className="text-[#b0004a]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-[#191c1d]">
                              {s.mainText}
                            </span>
                            {s.secondaryText && (
                              <span className="block truncate text-xs text-[#5a4044]">
                                {s.secondaryText}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Location Picker Map */}
              <div id="map-section" className="mb-6">
                <LocationPicker
                  defaultCenter={coordinates || undefined}
                  onCoordinatesChange={(lat, lng) =>
                    setCoordinates({ lat, lng })
                  }
                />
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-7">
            <AddressForm
              coordinates={coordinates}
              initialAddress={guestAddress}
              isEditMode={true}
              isGuestMode={true}
              onSuccess={() => router.push("/")}
            />
          </div>
        </div>

        {/* Divider + Add New Address */}
        <div className="mt-10">
          <hr className="border-t border-[#e3bdc3]" />
          <div className="mt-6 flex items-center justify-center">
            <Link
              href="/add-address"
              className="inline-flex items-center gap-2 rounded-full bg-[#b0004a] px-8 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#8c003b] active:scale-95"
            >
              <span className="text-xl font-bold leading-none">+</span>
              {t("addNewAddress")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
