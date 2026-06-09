/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { Star, Truck, Heart, Check } from "lucide-react";

interface Vendor {
  userId: string;
  businessDetails: {
    businessName: string;
    businessType: string;
    restaurantCuisineType?: string;
    openingHours: string;
    closingHours: string;
    isStoreOpen: boolean;
  };
  businessLocation: {
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  storePhoto: string[];
  rating: { average: number };
}

interface Product {
  _id: string;
  name: string;
  pricing: { finalPrice: number; currency: string };
  images: string[];
  vendorId: {
    businessDetails: { businessName: string };
    userId: string;
  };
  category: { name: string };
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function getVendorCoords(vendor: Vendor): { lat: number; lng: number } | null {
  const { latitude, longitude } = vendor.businessLocation;
  return latitude && longitude ? { lat: latitude, lng: longitude } : null;
}

let cachedUserCoords: { lat: number; lng: number } | null = null;
let userPromise: Promise<{ lat: number; lng: number } | null> | null = null;

async function fetchUserPrimaryAddress() {
  if (cachedUserCoords) return cachedUserCoords;
  try {
    const token = getAccessToken();
    if (!token) return null;
    const { data } = await apiClient.get("/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const primary = data?.data?.deliveryAddresses?.find((a: any) => a.isActive === true);
    if (primary?.latitude && primary?.longitude) {
      cachedUserCoords = { lat: primary.latitude, lng: primary.longitude };
    }
    return cachedUserCoords;
  } catch (error) {
    console.error("Failed to fetch user address", error);
    return null;
  }
}

function useUserAddress() {
  const [coords, setCoords] = useState(cachedUserCoords);
  const [loading, setLoading] = useState(!cachedUserCoords);
  useEffect(() => {
    if (cachedUserCoords) {
      setCoords(cachedUserCoords);
      setLoading(false);
      return;
    }
    if (!userPromise) userPromise = fetchUserPrimaryAddress();
    userPromise.then(setCoords).finally(() => setLoading(false));
  }, []);
  return { coords, loading };
}

export default function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!!query.trim());
  const [error, setError] = useState("");
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>({});
  const [loadingTimes, setLoadingTimes] = useState<Record<string, boolean>>({});
  const { coords: userCoords, loading: userLoading } = useUserAddress();

  useEffect(() => {
    let isMounted = true;

    if (!query.trim()) {
      if (isMounted) {
        setVendors([]);
        setProducts([]);
        setError("");
        setLoading(false);
      }
      return;
    }

    const fetchResults = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError("");
      try {
        const token = getAccessToken();
        if (!token) {
          if (isMounted) setError("Please log in to search.");
          if (isMounted) setLoading(false);
          return;
        }

        const term = query.toLowerCase().trim();

        const vendorRes = await apiClient.get("/vendors/customer", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const allVendors: Vendor[] = vendorRes.data?.data || [];

        const filteredVendors = allVendors.filter((v) => {
          const name = v.businessDetails.businessName.toLowerCase();
          const cuisine = (v.businessDetails.restaurantCuisineType || "").toLowerCase();
          const type = v.businessDetails.businessType.toLowerCase();
          const city = v.businessLocation.city.toLowerCase();
          const country = v.businessLocation.country.toLowerCase();
          return (
            name.includes(term) ||
            cuisine.includes(term) ||
            type.includes(term) ||
            city.includes(term) ||
            country.includes(term)
          );
        });
        if (isMounted) setVendors(filteredVendors);

        const productRes = await apiClient.get("/products", {
          params: { limit: 100 },
          headers: { Authorization: `Bearer ${token}` },
        });
        const allProducts: Product[] = productRes.data?.data || [];

        const filteredProducts = allProducts.filter((p) => {
          const productNameMatch = p.name.toLowerCase().includes(term);
          const categoryMatch = (p.category?.name || "").toLowerCase().includes(term);
          const vendorNameMatch = (p.vendorId?.businessDetails?.businessName || "").toLowerCase().includes(term);
          return productNameMatch || categoryMatch || vendorNameMatch;
        });
        if (isMounted) setProducts(filteredProducts);
      } catch (err) {
        console.error(err);
        if (isMounted) setError("Failed to load search results.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchResults();

    return () => {
      isMounted = false;
    };
  }, [query]);

  const estimateDeliveryTime = useCallback(async (vendor: Vendor) => {
    if (!userCoords) {
      setDeliveryTimes(prev => ({ ...prev, [vendor.userId]: "Under 10 min" }));
      return;
    }
    const vendorCoords = getVendorCoords(vendor);
    if (!vendorCoords) {
      setDeliveryTimes(prev => ({ ...prev, [vendor.userId]: "Under 10 min" }));
      return;
    }

    setLoadingTimes(prev => ({ ...prev, [vendor.userId]: true }));
    try {
      const url = `/api/distance-matrix?originLat=${vendorCoords.lat}&originLng=${vendorCoords.lng}&destLat=${userCoords.lat}&destLng=${userCoords.lng}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
        const minutes = Math.round(data.rows[0].elements[0].duration.value / 60);
        setDeliveryTimes(prev => ({ ...prev, [vendor.userId]: formatTimeRange(minutes) }));
        return;
      }
      const distance = getDistanceKm(vendorCoords.lat, vendorCoords.lng, userCoords.lat, userCoords.lng);
      const estimatedMinutes = Math.round((distance / 30) * 60);
      const timeStr = estimatedMinutes < 10 ? "Under 10 min" : formatTimeRange(estimatedMinutes);
      setDeliveryTimes(prev => ({ ...prev, [vendor.userId]: timeStr }));
    } catch (err) {
      console.error("Time estimation error", err);
      setDeliveryTimes(prev => ({ ...prev, [vendor.userId]: "Under 10 min" }));
    } finally {
      setLoadingTimes(prev => ({ ...prev, [vendor.userId]: false }));
    }
  }, [userCoords]);

  useEffect(() => {
    if (!userLoading && vendors.length > 0) {
      vendors.forEach(vendor => estimateDeliveryTime(vendor));
    }
  }, [userCoords, userLoading, vendors, estimateDeliveryTime]);

  const isPageLoading = loading || userLoading;

  if (isPageLoading) {
    return (
      <main className="w-full px-4 py-8 lg:px-16">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Searching for &quot;{query}&quot;</h1>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-gray-200 h-64" />
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

  const totalVendors = vendors.length;
  const totalProducts = products.length;

  return (
    <main className="w-full px-4 py-8 lg:px-16">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Search results for &quot;{query}&quot;</h1>
        <p className="text-gray-600 mt-1">
          {totalVendors} place{totalVendors !== 1 ? "s" : ""} &nbsp;
          {totalProducts} dish{totalProducts !== 1 ? "es" : ""}
        </p>
      </div>

      {totalVendors > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Places</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {vendors.map((vendor) => {
              const deliveryTime = deliveryTimes[vendor.userId];
              const isTimeLoading = loadingTimes[vendor.userId];
              const displayTime = isTimeLoading ? "Calculating..." : (deliveryTime || "Under 10 min");

              return (
                <Link key={vendor.userId} href={`/vendors/${vendor.userId}`} className="block">
                  <article className="group overflow-hidden rounded-4xl border-2 border-transparent bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-300 hover:border-[#ffd9de] hover:shadow-2xl">
                    <div className="relative aspect-16/10 overflow-hidden">
                      <Image
                        fill
                        sizes="(max-width:1024px) 100vw, 33vw"
                        alt={vendor.businessDetails.businessName}
                        src={vendor.storePhoto?.[0] || "https://placehold.co/600x400/png"}
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute left-5 top-5">
                        <span className="flex items-center gap-1.5 rounded-2xl bg-white/95 px-4 py-2 text-sm font-bold text-[#191c1d] shadow-lg backdrop-blur-md">
                          <Star size={18} className="text-[#f6c344]" />
                          {vendor.rating?.average ?? 0}
                        </span>
                      </div>
                      <div className="absolute bottom-5 right-5">
                        <span className="flex items-center gap-2 rounded-2xl bg-black/70 px-4 py-2 text-sm text-white backdrop-blur-md">
                          <Truck size={18} />
                          {displayTime}
                        </span>
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <h3 className="line-clamp-1 text-2xl font-bold text-[#191c1d]">
                          {vendor.businessDetails.businessName}
                        </h3>
                        <Heart size={22} className="text-[#d81b60] transition-transform group-hover:scale-110" />
                      </div>
                      <p className="mb-6 text-lg text-[#5a4044]">
                        {vendor.businessDetails.restaurantCuisineType || vendor.businessDetails.businessType}
                      </p>
                      <div className="flex items-center gap-6 border-t border-[#edeeef] pt-6 text-sm font-medium text-[#5a4044]">
                        <span className="flex items-center gap-2 text-[#b0004a]">
                          <Truck size={18} />
                          {vendor.businessDetails.isStoreOpen ? "Open Now" : "Closed"}
                        </span>
                        <span className="flex items-center gap-2 text-[#b70052]">
                          <Check size={18} />
                          {vendor.businessLocation.city}, {vendor.businessLocation.country}
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {totalProducts > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Dishes</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link key={product._id} href={`/vendors/${product.vendorId.userId}`}>
                <div className="group flex items-center gap-4 rounded-2xl border bg-white p-3 shadow hover:shadow-md transition cursor-pointer">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={product.images?.[0] || "/placeholder.jpg"}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-gray-500">{product.vendorId?.businessDetails?.businessName || "Vendor"}</p>
                    <div className="mt-1 text-[#b0004a] font-bold text-sm">
                      {product.pricing?.currency || "€"} {product.pricing?.finalPrice?.toFixed(2) || "0.00"}
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