/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { CheckCircle, Loader2, Navigation, Search } from "lucide-react";
import ClearFilterButton from "@/components/shared/ClearFilterButton";
import { useEffect, useRef, useState, useCallback } from "react";
import { Toaster, toast } from "sonner";
import LocationPicker from "@/components/profile/locationPicker";
import AddressForm from "./AddressForm";
import { fetchUserProfile } from "@/services/addressApi";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocationStore } from "@/stores/locationStore";
import { getAccessToken } from "@/lib/authCookies";
import { Button } from "@/components/ui/button";

const GOOGLE_API_URL = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;

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
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);
  // Bumped by "Use Current Location" to ask the form to fill from the pin. The
  // page already opens on the device's position, and a desktop browser often
  // re-reads the identical coordinates — so a coordinate change alone is not a
  // reliable signal that the customer asked for this.
  const [prefillRequestId, setPrefillRequestId] = useState(0);

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

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t("geolocationNotSupported"));
      return;
    }

    setLoadingCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        setPrefillRequestId((id) => id + 1);
        toast.success(t("currentLocationLoadedOnMap"));
        setLoadingCurrentLocation(false);
      },
      (err) => {
        setLoadingCurrentLocation(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? t("locationAccessDenied")
            : t("couldNotDetectLocation"),
        );
      },
      // maximumAge: 0 — a cached fix would defeat the point of pressing this.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );

  return (
    <section className="bg-[#f8f9fa] dark:bg-neutral-950 py-8 min-h-screen transition-colors duration-200">
      <Toaster position="top-center" richColors />
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-display font-bold text-foreground dark:text-neutral-50">
            {t("addNewAddress")}
          </h1>
        </div>

        {/* Stacked, not side by side: locating the address on the map is the
            part that decides everything below it, so it gets the full width and
            comes first. The form follows underneath, filled in from whatever
            the customer picks up here. */}
        <div className="flex flex-col gap-6">
          {/* Map + GPS — full width */}
          <div className="flex flex-col gap-6">
            {/* The one-tap way to fill the form from where the customer is
                standing. The page opens on the device's position but no longer
                writes it into the fields unasked, so this is what turns that
                position into an answer — matched to the same card on the edit
                and current-location pages. */}
            <div className="rounded-2xl bg-card border border-transparent dark:border-neutral-800 p-6 shadow-sm dark:shadow-none">
              <h2 className="mb-2 text-xl font-bold text-foreground dark:text-neutral-50">
                {t("myCurrentLocation")}
              </h2>
              <p className="mb-4 text-sm text-muted-foreground dark:text-neutral-400">
                {t("currentLocationDescription")}
              </p>
              <Button
                type="button"
                size="lg"
                onClick={handleUseCurrentLocation}
                disabled={loadingCurrentLocation}
                className="w-full gap-3 rounded-2xl font-semibold shadow-md active:scale-[0.98]"
              >
                {loadingCurrentLocation ? (
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
              </Button>
            </div>

            <div className="rounded-2xl bg-card border border-transparent dark:border-neutral-800 p-6 shadow-sm dark:shadow-none">
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-bold text-foreground dark:text-neutral-50">
                  {t("confirmLocation")}
                </h2>
                <p className="text-sm text-muted-foreground dark:text-neutral-400">
                  {t("confirmLocationDescription")}
                </p>
              </div>

              {/* Search with Autocomplete Suggestions */}
              <div ref={searchContainerRef} className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 z-10"
                  size={18}
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={handleSearchChange}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder={t("searchAreaPlaceholder")}
                  className="w-full rounded-full border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 py-4 pl-12 pr-8 outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:border-primary dark:focus:border-primary"
                  autoComplete="off"
                />
                {searchValue && <ClearFilterButton onClear={clearSearch} />}

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#e3bdc3] dark:border-neutral-800 bg-card shadow-xl dark:shadow-none">
                    {suggestions.map((s, idx) => (
                      <li key={s.placeId}>
                        <button
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className={`focus-ring flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#fff2f5] dark:hover:bg-neutral-800/50 ${idx !== suggestions.length - 1
                            ? "border-b border-[#f5e0e5] dark:border-neutral-800"
                            : ""
                            }`}
                        >
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff2f5] dark:bg-primary/10">
                            <Search size={13} className="text-primary" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground dark:text-neutral-200">
                              {s.mainText}
                            </span>
                            {s.secondaryText && (
                              <span className="block truncate text-xs text-muted-foreground dark:text-neutral-400">
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
                <LocationPicker
                  defaultCenter={coordinates || undefined}
                  onCoordinatesChange={(lat, lng) =>
                    setCoordinates({ lat, lng })
                  }
                />
              </div>

              {/* Status Card */}
              <div className="flex items-start gap-3 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-4">
                <CheckCircle className="mt-0.5 text-green-600 dark:text-green-500" size={20} />
                <div>
                  <p className="font-bold text-green-800 dark:text-green-400">
                    {coordinates
                      ? t("locationConfirmed")
                      : "Waiting for location..."}
                  </p>
                  {coordinates && (
                    <p className="text-sm text-green-700 dark:text-green-500">
                      Lat: {coordinates.lat.toFixed(6)} | Lng:{" "}
                      {coordinates.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form – full width, below the map */}
          <div>
            {/* Blank form on open: the pin is seeded from the device's current
                position, which is a guess about where the new address is, not
                the address itself. Filling six fields from it hands the customer
                someone else's answer to check rather than their own to write —
                and a wrong prefill is easy to save without noticing. Choosing a
                place in the search box or dragging the pin still autofills. */}
            <AddressForm
              coordinates={coordinates}
              isEditMode={false}
              prefillFromOpeningLocation={false}
              prefillRequestId={prefillRequestId}
              onSuccess={() => router.push("/saved-addresses")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
