"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import {
  Star,
  Truck,
  Check,
  UtensilsCrossed,
  Store,
  Moon,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import type { Vendor } from "@/types/vendor";
import { formatCuisine } from "@/lib/cuisine";
import { currencySymbol } from "@/lib/currency";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { useActiveAddressCoords } from "@/hooks/queries/useProfile";
import { useVendorsNearby } from "@/hooks/queries/useVendors";

// A product's embedded vendor. The `/products` endpoint returns the full vendor
// (location + rating), but `businessType` here is an object ({name:{en,pt},…}),
// unlike the plain string on the vendor endpoints — hence the `unknown` + the
// `businessTypeLabel` normalizer below.
interface ProductVendorRef {
  userId: string;
  businessDetails: {
    businessName: string;
    businessType?: unknown;
    restaurantCuisineType?: string[] | string;
    isStoreOpen?: boolean;
  };
  businessLocation?: {
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  // The product endpoint nests the store photo here (not at a top-level
  // `storePhoto` like the vendor endpoints do).
  documents?: { storePhoto?: string[] };
  rating?: { average: number; totalReviews: number };
}

interface Product {
  _id: string;
  name: string;
  pricing: { finalPrice: number; currency: string };
  images: string[];
  vendorId: ProductVendorRef;
  category?: { name: string };
  rating?: { average: number };
}

// Normalized card shape shared by both place sources (nearby vendors + the
// vendors that own a matched dish), so sorting/rendering is uniform.
interface PlaceVendor {
  userId: string;
  storePhoto: string[];
  businessDetails: {
    businessName: string;
    businessType: string;
    restaurantCuisineType?: string[] | string;
    isStoreOpen?: boolean;
  };
  businessLocation: {
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  rating: { average: number };
}

type SortKey = "relevance" | "distance" | "rating" | "price";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distance (km) from the user to a vendor location, or Infinity when either
// side lacks coordinates — used only to push unlocatable results to the end.
function distanceFrom(
  user: { lat: number; lng: number } | null,
  loc: { latitude?: number; longitude?: number } | undefined,
): number {
  if (!user || !loc?.latitude || !loc?.longitude) return Infinity;
  return getDistanceKm(user.lat, user.lng, loc.latitude, loc.longitude);
}

function formatTimeRange(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${Math.floor(totalMinutes)} to ${Math.ceil(totalMinutes + 10)} mins`;
  }
  const hours = totalMinutes / 60;
  if (hours < 24) {
    const low = Math.floor(hours);
    const high = Math.ceil(hours + 10 / 60);
    return low === high ? `${low} hour${low !== 1 ? 's' : ''}` : `${low} to ${high} hours`;
  }
  const days = totalMinutes / (60 * 24);
  if (days < 7) {
    const low = Math.floor(days);
    const high = Math.ceil(days + 10 / (60 * 24));
    return low === high ? `${low} day${low !== 1 ? 's' : ''}` : `${low} to ${high} days`;
  }
  const weeks = totalMinutes / (60 * 24 * 7);
  if (weeks < 4) {
    const low = Math.floor(weeks);
    const high = Math.ceil(weeks + 10 / (60 * 24 * 7));
    return low === high ? `${low} week${low !== 1 ? 's' : ''}` : `${low} to ${high} weeks`;
  }
  const months = totalMinutes / (60 * 24 * 30);
  if (months < 12) {
    const low = Math.floor(months);
    const high = Math.ceil(months + 10 / (60 * 24 * 30));
    return low === high ? `${low} month${low !== 1 ? 's' : ''}` : `${low} to ${high} months`;
  }
  const years = totalMinutes / (60 * 24 * 365);
  const low = Math.floor(years);
  const high = Math.ceil(years + 10 / (60 * 24 * 365));
  return low === high ? `${low} year${low !== 1 ? 's' : ''}` : `${low} to ${high} years`;
}

// Whether a nearby vendor's text fields match the query (name / cuisine / type /
// city / country) — the same fields the old client-side filter used.
function vendorTextMatch(v: Vendor, term: string): boolean {
  if (!term) return true;
  const name = v.businessDetails.businessName.toLowerCase();
  const cuisine = formatCuisine(v.businessDetails.restaurantCuisineType).toLowerCase();
  const type = String(v.businessDetails.businessType ?? "").toLowerCase();
  const city = v.businessLocation.city.toLowerCase();
  const country = v.businessLocation.country.toLowerCase();
  return (
    name.includes(term) ||
    cuisine.includes(term) ||
    type.includes(term) ||
    city.includes(term) ||
    country.includes(term)
  );
}

function vendorToPlace(v: Vendor, fallbackImg?: string): PlaceVendor {
  const photos = v.storePhoto?.length ? v.storePhoto : fallbackImg ? [fallbackImg] : [];
  return {
    userId: v.userId,
    storePhoto: photos,
    businessDetails: {
      businessName: v.businessDetails.businessName,
      businessType: String(v.businessDetails.businessType ?? ""),
      restaurantCuisineType: v.businessDetails.restaurantCuisineType,
      isStoreOpen: v.businessDetails.isStoreOpen,
    },
    businessLocation: {
      city: v.businessLocation.city,
      country: v.businessLocation.country,
      latitude: v.businessLocation.latitude,
      longitude: v.businessLocation.longitude,
    },
    rating: { average: v.rating?.average ?? 0 },
  };
}

const SORT_OPTIONS: { key: SortKey; labelKey: "sortRelevance" | "sortDistance" | "sortRating" | "sortPrice" }[] = [
  { key: "relevance", labelKey: "sortRelevance" },
  { key: "distance", labelKey: "sortDistance" },
  { key: "rating", labelKey: "sortRating" },
  { key: "price", labelKey: "sortPrice" },
];

export default function SearchContent() {
  const { t } = useTranslation();
  const lang = useStore((s) => s.lang);
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const term = query.toLowerCase().trim();
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>({});
  const [loadingTimes, setLoadingTimes] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<SortKey>("relevance");
  const [sortOpen, setSortOpen] = useState(false);

  // Auth is read from a cookie, which is unavailable during SSR — so the server
  // and the first client paint would disagree (hydration mismatch). `mounted`
  // is false on the server + first client render (getServerSnapshot), true
  // afterwards, via useSyncExternalStore (no setState-in-effect). Until mounted
  // we render the neutral skeleton, so server + first client render match.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const authed = mounted && !!getAccessToken();
  const searchEnabled = authed && !!term;

  const userCoords = useActiveAddressCoords();

  // Dishes: SERVER-side search (`searchTerm`) — the same search the mobile app
  // uses. Replaces the old "fetch everything, filter in JS" approach, which
  // missed matches and diverged from the app.
  const {
    data: dishes = [],
    isLoading: dishesLoading,
    error: dishesError,
  } = useQuery({
    queryKey: ["search", "products", lang, term],
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/products", {
        params: { searchTerm: query.trim(), limit: 100 },
        signal,
      });
      return (res.data?.data ?? []) as Product[];
    },
    enabled: searchEnabled,
    placeholderData: keepPreviousData,
  });

  // Places: nearby OPEN vendors for the active address — location-aware, like
  // the app. Disabled (returns nothing) when there's no active-address coords.
  const {
    data: nearby,
    isLoading: nearbyLoading,
    error: nearbyError,
  } = useVendorsNearby<Vendor>(userCoords, {
    limit: 100,
    enabled: searchEnabled,
  });
  const nearbyVendors = useMemo(() => nearby?.data ?? [], [nearby]);

  // Places are DELIVERABLE restaurants only: vendors near the active address
  // (`nearby/open`) whose name/cuisine/etc. matches the query OR that own a
  // matched dish. Far-away restaurants are intentionally NOT shown here — a
  // delivery app shouldn't surface places you can't order from (that produced
  // nonsensical "1–2 weeks" ETAs). Dishes below remain a global search.
  const places = useMemo<PlaceVendor[]>(() => {
    if (!term) return [];
    // First dish image per vendor — used as the card photo when a nearby vendor
    // has no `storePhoto`.
    const dishImageByVendor = new Map<string, string>();
    const dishOwnerIds = new Set<string>();
    for (const p of dishes) {
      const id = p.vendorId?.userId;
      if (!id) continue;
      dishOwnerIds.add(id);
      const img = p.images?.[0];
      if (img && !dishImageByVendor.has(id)) dishImageByVendor.set(id, img);
    }

    const byId = new Map<string, PlaceVendor>();
    for (const v of nearbyVendors) {
      if (!v.userId) continue;
      if (vendorTextMatch(v, term) || dishOwnerIds.has(v.userId)) {
        byId.set(v.userId, vendorToPlace(v, dishImageByVendor.get(v.userId)));
      }
    }
    return [...byId.values()];
  }, [nearbyVendors, dishes, term]);

  // Client-side sort — only reorders results (Relevance keeps server order).
  const sortedPlaces = useMemo(() => {
    const list = [...places];
    if (sortBy === "distance") {
      list.sort(
        (a, b) =>
          distanceFrom(userCoords, a.businessLocation) -
          distanceFrom(userCoords, b.businessLocation),
      );
    } else if (sortBy === "rating") {
      list.sort((a, b) => b.rating.average - a.rating.average);
    }
    // "relevance" and "price" (no vendor price) keep the merge order.
    return list;
  }, [places, sortBy, userCoords]);

  const sortedDishes = useMemo(() => {
    const list = [...dishes];
    if (sortBy === "distance") {
      list.sort(
        (a, b) =>
          distanceFrom(userCoords, a.vendorId?.businessLocation) -
          distanceFrom(userCoords, b.vendorId?.businessLocation),
      );
    } else if (sortBy === "rating") {
      list.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
    } else if (sortBy === "price") {
      list.sort(
        (a, b) => (a.pricing?.finalPrice ?? 0) - (b.pricing?.finalPrice ?? 0),
      );
    }
    return list;
  }, [dishes, sortBy, userCoords]);

  const estimateDeliveryTime = useCallback(async (place: PlaceVendor) => {
    const { latitude, longitude } = place.businessLocation;
    if (!userCoords || !latitude || !longitude) {
      setDeliveryTimes(prev => ({ ...prev, [place.userId]: t("under10Min") }));
      setLoadingTimes(prev => ({ ...prev, [place.userId]: false }));
      return;
    }

    setLoadingTimes(prev => ({ ...prev, [place.userId]: true }));
    try {
      const url = `/api/distance-matrix?originLat=${latitude}&originLng=${longitude}&destLat=${userCoords.lat}&destLng=${userCoords.lng}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
        const minutes = Math.round(data.rows[0].elements[0].duration.value / 60);
        setDeliveryTimes(prev => ({ ...prev, [place.userId]: formatTimeRange(minutes) }));
        return;
      }
      const distance = getDistanceKm(latitude, longitude, userCoords.lat, userCoords.lng);
      const estimatedMinutes = Math.round((distance / 30) * 60);
      const timeStr = estimatedMinutes < 10 ? t("under10Min") : formatTimeRange(estimatedMinutes);
      setDeliveryTimes(prev => ({ ...prev, [place.userId]: timeStr }));
    } catch (err) {
      console.error("Time estimation error", err);
      setDeliveryTimes(prev => ({ ...prev, [place.userId]: t("under10Min") }));
    } finally {
      setLoadingTimes(prev => ({ ...prev, [place.userId]: false }));
    }
  }, [userCoords, t]);

  // Estimate each place's delivery time exactly once. Guarding with a ref (not
  // just effect deps) is what prevents a re-render → re-estimate → setState →
  // re-render loop when `places`/`estimateDeliveryTime` identity changes.
  const estimatedRef = useRef<Set<string>>(new Set());
  // Re-estimate everything if the active address (and thus distances) changes.
  useEffect(() => {
    estimatedRef.current.clear();
  }, [userCoords]);
  useEffect(() => {
    for (const place of places) {
      if (estimatedRef.current.has(place.userId)) continue;
      estimatedRef.current.add(place.userId);
      estimateDeliveryTime(place);
    }
  }, [places, estimateDeliveryTime]);

  const loading =
    searchEnabled && (dishesLoading || (!!userCoords && nearbyLoading));
  const error =
    !authed && term
      ? t("pleaseLogInToSearch")
      : dishesError || nearbyError
        ? t("failedToLoadSearchResults")
        : "";

  // Show the skeleton until mounted (matches SSR) and while data loads.
  if (!mounted || loading) {
    return (
      <main className="w-full px-4 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Searching for &quot;{query}&quot;</h1>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-3xl bg-gray-200 h-80" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-full px-4 py-8 lg:px-16">
        <div className="text-red-500">{error}</div>
      </main>
    );
  }

  const totalVendors = sortedPlaces.length;
  const totalProducts = sortedDishes.length;
  const activeSortLabel = t(
    SORT_OPTIONS.find((o) => o.key === sortBy)!.labelKey,
  );

  return (
    <main className="w-full px-4 py-8 lg:px-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Search results for &quot;{query}&quot;</h1>
          <p className="text-gray-600 mt-1">
            {totalVendors} place{totalVendors !== 1 ? "s" : ""} &nbsp;
            {totalProducts} dish{totalProducts !== 1 ? "es" : ""}
          </p>
        </div>

        {/* Client-side sort — reorders results only (Relevance / Distance / Rating / Price) */}
        {(totalVendors > 0 || totalProducts > 0) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              className="flex items-center gap-2 rounded-2xl border border-[#edeeef] bg-white px-4 py-2.5 text-sm font-semibold text-[#191c1d] shadow-sm transition hover:border-[#ffd9de]"
            >
              <SlidersHorizontal size={16} className="text-[#f9186b]" />
              {activeSortLabel}
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${sortOpen ? "rotate-180" : ""}`}
              />
            </button>

            {sortOpen && (
              <>
                {/* click-away layer */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSortOpen(false)}
                  aria-hidden="true"
                />
                <ul
                  role="listbox"
                  className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-[#edeeef] bg-white py-1 shadow-xl"
                >
                  {SORT_OPTIONS.map((opt) => {
                    const selected = opt.key === sortBy;
                    return (
                      <li key={opt.key} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onClick={() => {
                            setSortBy(opt.key);
                            setSortOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-[#fff1f4] ${
                            selected ? "font-bold text-[#f9186b]" : "text-[#191c1d]"
                          }`}
                        >
                          {t(opt.labelKey)}
                          {selected && <Check size={16} className="text-[#f9186b]" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {totalVendors > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">{t("places")}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedPlaces.map((vendor) => {
              const deliveryTime = deliveryTimes[vendor.userId];
              const isTimeLoading = loadingTimes[vendor.userId];
              const displayTime = isTimeLoading ? "Calculating..." : (deliveryTime || t("under10Min"));
              // Closed stores are dimmed with a "Currently Closed" badge but
              // stay openable — the menu is browsable, only ordering is
              // withdrawn. Only an explicit `false` counts as closed.
              const isClosed = vendor.businessDetails?.isStoreOpen === false;

              const cardBody = (
                <article
                  className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border-2 border-transparent bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-300 hover:border-[#ffd9de] hover:shadow-2xl"
                >
                  <div className="relative aspect-16/10 shrink-0 overflow-hidden">
                    <SafeImage
                      src={vendor.storePhoto?.[0]}
                      alt={vendor.businessDetails.businessName}
                      sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                      className={`object-cover transition-transform duration-700 ${
                        isClosed ? "grayscale" : "group-hover:scale-110"
                      }`}
                      fallbackIcon={<Store className="h-12 w-12" />}
                    />
                    <div className="absolute left-4 top-4">
                      <span className="flex items-center gap-1.5 rounded-2xl bg-white/95 px-3 py-1.5 text-sm font-bold text-[#191c1d] shadow-lg backdrop-blur-md">
                        <Star size={16} className="text-[#f6c344]" />
                        {vendor.rating?.average ?? 0}
                      </span>
                    </div>
                    {!isClosed && (
                      <div className="absolute bottom-4 right-4">
                        <span className="flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-1.5 text-sm text-white backdrop-blur-md">
                          <Truck size={16} />
                          {displayTime}
                        </span>
                      </div>
                    )}
                    {isClosed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                        <span className="flex items-center gap-2 rounded-full bg-black/70 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
                          <Moon size={18} />
                          {t("currentlyClosed")}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3
                      className={`line-clamp-1 text-lg font-bold ${
                        isClosed ? "text-[#9aa0a6]" : "text-[#191c1d]"
                      }`}
                    >
                      {vendor.businessDetails.businessName}
                    </h3>
                    <p
                      className={`mt-1 line-clamp-2 min-h-[2.75rem] text-sm ${
                        isClosed ? "text-[#9aa0a6]" : "text-[#5a4044]"
                      }`}
                    >
                      {formatCuisine(vendor.businessDetails.restaurantCuisineType) ||
                        vendor.businessDetails.businessType}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#edeeef] pt-4 text-sm font-medium">
                      <span
                        className={`flex items-center gap-1.5 ${
                          isClosed ? "text-[#9aa0a6]" : "text-[#f9186b]"
                        }`}
                      >
                        <Truck size={16} />
                        {vendor.businessDetails.isStoreOpen ? "Open Now" : "Closed"}
                      </span>
                      <span
                        className={`flex min-w-0 items-center gap-1.5 ${
                          isClosed ? "text-[#9aa0a6]" : "text-[#f9186b]"
                        }`}
                      >
                        <Check size={16} className="shrink-0" />
                        <span className="truncate">
                          {vendor.businessLocation.city}
                          {vendor.businessLocation.city && vendor.businessLocation.country ? ", " : ""}
                          {vendor.businessLocation.country}
                        </span>
                      </span>
                    </div>
                  </div>
                </article>
              );

              return (
                <Link key={vendor.userId} href={`/vendors/${vendor.userId}`} className="block h-full">
                  {cardBody}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {totalProducts > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">{t("dishes")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedDishes.map((product) => (
              <Link key={product._id} href={`/vendors/${product.vendorId.userId}`} className="block h-full">
                <div className="group flex h-full items-center gap-4 rounded-2xl border border-[#edeeef] bg-white p-3 shadow-sm transition hover:border-[#ffd9de] hover:shadow-md cursor-pointer">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                    <SafeImage
                      src={product.images?.[0]}
                      alt={product.name}
                      sizes="80px"
                      fallbackIcon={<UtensilsCrossed className="h-7 w-7" />}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-800 line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-1">{product.vendorId?.businessDetails?.businessName || "Vendor"}</p>
                    <div className="mt-1 text-[#f9186b] font-bold text-sm">
                      {currencySymbol(product.pricing?.currency)} {product.pricing?.finalPrice?.toFixed(2) || "0.00"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {totalVendors === 0 && totalProducts === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          No results found for &quot;{query}&quot;.
        </div>
      )}
    </main>
  );
}
