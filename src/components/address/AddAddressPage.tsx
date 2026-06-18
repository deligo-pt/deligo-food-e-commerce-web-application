/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { ArrowLeft, CheckCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Toaster } from "sonner";
import LocationPicker from "@/components/profile/locationPicker";
import AddressForm from "./AddressForm";
import { fetchUserProfile } from "@/services/addressApi";
import { useRouter } from "next/navigation";
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

export default function AddAddressPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { coords: geoCoords } = useLocationStore();

  const [loading, setLoading] = useState(true);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);

  const autocompleteServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (geoCoords) {
      setCoordinates({ lat: geoCoords.latitude, lng: geoCoords.longitude });
      setLoading(false);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoordinates({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLoading(false);
        },
        async () => {
          try {
            const token = getAccessToken();
            if (token) {
              const res = await fetchUserProfile();
              const loc = res.data?.currentSessionLocation?.coordinates;
              if (loc?.length === 2) {
                setCoordinates({ lat: loc[1], lng: loc[0] });
              }
            }
          } catch {
            // silently ignore
          } finally {
            setLoading(false);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      setLoading(false);
    }
  }, [geoCoords]);

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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  };

  const handleSuggestionClick = useCallback(
    async (suggestion: Suggestion) => {
      setSearchValue(suggestion.description);
      setSuggestions([]);
      setShowSuggestions(false);

      // Reset session token after selection (billing best practice)
      sessionTokenRef.current = null;

      await ensureGoogleMaps();

      // Use Geocoder to get lat/lng for the selected place
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

  const clearSearch = () => {
    setSearchValue("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b0004a] border-t-transparent" />
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
            {t("addNewAddress")}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Panel – Map */}
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

              {/* Search with Autocomplete Suggestions */}
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
                  placeholder={t("searchAreaPlaceholder")}
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
                          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#fff2f5]">
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

              <div id="map-section" className="mb-6">
                {coordinates ? (
                  <LocationPicker
                    defaultCenter={coordinates}
                    onCoordinatesChange={(lat, lng) =>
                      setCoordinates({ lat, lng })
                    }
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center rounded-xl bg-gray-50">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b0004a] border-t-transparent" />
                      <p className="text-sm">Detecting your location…</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Card */}
              <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                <CheckCircle className="mt-0.5 text-green-600" size={20} />
                <div>
                  <p className="font-bold text-green-800">
                    {coordinates
                      ? t("locationConfirmed")
                      : "Waiting for location..."}
                  </p>
                  {coordinates && (
                    <p className="text-sm text-green-700">
                      Lat: {coordinates.lat.toFixed(6)} | Lng:{" "}
                      {coordinates.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel – Form */}
          <div className="lg:col-span-7">
            <AddressForm
              coordinates={coordinates}
              isEditMode={false}
              onSuccess={() => router.push("/saved-addresses")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
