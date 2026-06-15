/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Bike, Plus, Star } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import ProductDetailsModal from "./ProductDetailsModal";
import VendorDetailsModal from "./VendorDetailsModal";
import VendorDetailsSkeleton from "./VendorDetailsSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
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
    return low === high
      ? `${low} hour${low !== 1 ? "s" : ""}`
      : `${low} to ${high} hours`;
  }
  const days = totalMinutes / (60 * 24);
  if (days < 7) {
    const low = Math.floor(days);
    const high = Math.ceil(days + 10 / (60 * 24));
    return low === high
      ? `${low} day${low !== 1 ? "s" : ""}`
      : `${low} to ${high} days`;
  }
  const weeks = totalMinutes / (60 * 24 * 7);
  if (weeks < 4) {
    const low = Math.floor(weeks);
    const high = Math.ceil(weeks + 10 / (60 * 24 * 7));
    return low === high
      ? `${low} week${low !== 1 ? "s" : ""}`
      : `${low} to ${high} weeks`;
  }
  const months = totalMinutes / (60 * 24 * 30);
  if (months < 12) {
    const low = Math.floor(months);
    const high = Math.ceil(months + 10 / (60 * 24 * 30));
    return low === high
      ? `${low} month${low !== 1 ? "s" : ""}`
      : `${low} to ${high} months`;
  }
  const years = totalMinutes / (60 * 24 * 365);
  const low = Math.floor(years);
  const high = Math.ceil(years + 10 / (60 * 24 * 365));
  return low === high
    ? `${low} year${low !== 1 ? "s" : ""}`
    : `${low} to ${high} years`;
}

let cachedUserCoords: { lat: number; lng: number } | null = null;
let userPromise: Promise<{ lat: number; lng: number } | null> | null = null;

async function fetchUserPrimaryAddress() {
  if (cachedUserCoords) return cachedUserCoords;
  // Only call profile API if user is authenticated
  const token = getAccessToken();
  if (!token) return null;
  try {
    const { data } = await apiClient.get("/profile");
    const primary = data?.data?.deliveryAddresses?.find(
      (a: any) => a.isActive === true,
    );
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

interface Vendor {
  id: string;
  _id?: string; // returned by open endpoint instead of id
  userId: string;
  businessDetails: {
    businessName: string;
    businessType: string;
    openingHours: string;
    closingHours: string;
    preparationTimeMinutes: number;
    restaurantCuisineType?: string;
    isStoreOpen: boolean;
  };
  businessLocation?: {
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  storePhoto?: string[];
  availableCategories?: { _id: string; name: string; icon: string }[];
  rating?: { average: number; totalReviews: number };
}

interface Product {
  id: string;
  productId: string;
  name: string;
  description: string;
  images: string[];
  pricing: {
    price: number;
    discount: number;
    finalPrice: number;
    currency: string;
  };
  category?: { name: string };
}

interface VendorDetailsPageProps {
  vendorId: string;
}

export default function VendorDetailsPage({
  vendorId,
}: VendorDetailsPageProps) {
  const { t } = useTranslation();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  const { coords: userCoords, loading: userLoading } = useUserAddress();
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);
  const timeFetchedRef = useRef(false);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const token = getAccessToken();

        if (token) {
          // Authenticated: search paginated /vendors/customer
          let foundVendor: Vendor | null = null;
          let currentPage = 1;
          while (!foundVendor) {
            const { data } = await apiClient.get(
              `/vendors/customer?page=${currentPage}&limit=50`,
            );
            const vendors: Vendor[] = data.data;
            if (vendors.length === 0) break;
            foundVendor = vendors.find((v) => v.userId === vendorId) || null;
            if (foundVendor) break;
            if (currentPage >= (data.meta?.totalPage || 1)) break;
            currentPage++;
          }
          if (!foundVendor) throw new Error("Vendor not found");
          setVendor(foundVendor);
        } else {
          // Unauthenticated: use the dedicated open single-vendor endpoint
          const { data } = await apiClient.get(
            `/vendors/nearby/open/${vendorId}`,
          );
          const raw = data.data;
          // Normalize _id → id so downstream (product fetch, etc.) works uniformly
          const vendor: Vendor = { ...raw, id: raw.id ?? raw._id ?? "" };
          setVendor(vendor);
        }
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [vendorId]);

  useEffect(() => {
    if (!vendor) return;

    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const token = getAccessToken();

        if (token) {
          // Authenticated: use protected endpoint
          const { data } = await apiClient.get(
            `/products?vendorId=${vendor.id}&limit=100`,
          );
          setProducts(data.data || []);
        } else {
          // Unauthenticated: use open public endpoint
          // Step 1: get total count for this vendor
          const countRes = await apiClient.get(
            `/products/open?vendorId=${vendor.id}&page=1&limit=1`,
          );
          const total = countRes.data.meta?.total || 10;
          // Step 2: fetch all products in one request
          const { data } = await apiClient.get(
            `/products/open?vendorId=${vendor.id}&page=1&limit=${total}`,
          );
          setProducts(data.data || []);
        }
      } catch (err) {
        setProductsError(getApiErrorMessage(err, "Unable to load menu"));
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, [vendor]);

  useEffect(() => {
    if (!vendor || userLoading) return;
    if (timeFetchedRef.current) return;

    const fetchTime = async () => {
      const vendorCoords =
        vendor.businessLocation?.latitude && vendor.businessLocation?.longitude
          ? {
              lat: vendor.businessLocation.latitude,
              lng: vendor.businessLocation.longitude,
            }
          : null;

      if (!vendorCoords || !userCoords) {
        setEstimatedTime("Under 10 min");
        timeFetchedRef.current = true;
        return;
      }

      setLoadingTime(true);
      try {
        const url = `/api/distance-matrix?originLat=${vendorCoords.lat}&originLng=${vendorCoords.lng}&destLat=${userCoords.lat}&destLng=${userCoords.lng}`;
        const res = await fetch(url);
        const data = await res.json();

        if (
          data.status === "OK" &&
          data.rows?.[0]?.elements?.[0]?.status === "OK"
        ) {
          const minutes = Math.round(
            data.rows[0].elements[0].duration.value / 60,
          );
          setEstimatedTime(formatTimeRange(minutes));
        } else {
          const distance = getDistanceKm(
            vendorCoords.lat,
            vendorCoords.lng,
            userCoords.lat,
            userCoords.lng,
          );
          const estimatedMinutes = Math.round((distance / 30) * 60);
          setEstimatedTime(
            estimatedMinutes < 10
              ? "Under 10 min"
              : formatTimeRange(estimatedMinutes),
          );
        }
      } catch (err) {
        console.error("Time estimation error", err);
        setEstimatedTime("Under 10 min");
      } finally {
        setLoadingTime(false);
        timeFetchedRef.current = true;
      }
    };

    fetchTime();
  }, [vendor, userCoords, userLoading]);

  useEffect(() => {
    timeFetchedRef.current = false;
    setEstimatedTime(null);
    setLoadingTime(false);
  }, [vendor?.id]);

  if (loading) {
    return <VendorDetailsSkeleton />;
  }

  if (error || !vendor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center text-red-500">
        {error || "Vendor not found"}
      </div>
    );
  }

  const productVendorPhoto =
    (products[0] as any)?.vendorId?.documents?.storePhoto?.[0];
  const heroImage =
    vendor.storePhoto?.[0] || productVendorPhoto || "/placeholder-store.jpg";

  const displayTime = loadingTime
    ? "Calculating..."
    : estimatedTime || "Under 10 min";

  const vendorCategoryNames =
    vendor.availableCategories?.map((cat) => cat.name) || [];
  const productCategoryNames =
    vendorCategoryNames.length === 0
      ? [
          ...new Set(
            products
              .map((p) => p.category?.name)
              .filter((n): n is string => !!n),
          ),
        ]
      : [];
  const categories = [
    "All",
    "POPULAR",
    ...(vendorCategoryNames.length > 0
      ? vendorCategoryNames
      : productCategoryNames),
  ];

  const filteredProducts = products.filter((product) => {
    if (selectedCategory === "All" || selectedCategory === "POPULAR")
      return true;
    const productCategory = product.category?.name;
    if (!productCategory) return false;
    return productCategory.toLowerCase() === selectedCategory.toLowerCase();
  });

  const formatPrice = (price: number, currency: string) => {
    return `${currency}${price.toFixed(2)}`.replace(".", ",");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="mx-auto max-w-full px-4 py-6 lg:px-8">
        {/* Hero Section */}
        <section className="mb-6">
          <div className="relative overflow-hidden rounded-3xl shadow-lg">
            <div className="relative h-62.5 md:h-90">
              <Image
                src={heroImage}
                alt={vendor.businessDetails.businessName}
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                <div className="rounded-2xl bg-white p-5 shadow-xl">
                  <div className="mb-1 flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {vendor.businessDetails.businessName}
                    </h1>
                    <span
                      className={`h-3 w-3 rounded-full ${
                        vendor.businessDetails.isStoreOpen
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                  </div>
                  <p className="mb-4 text-sm text-gray-500">
                    {vendor.businessDetails.restaurantCuisineType ||
                      vendor.businessDetails.businessType}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <button
                      onClick={() => setIsVendorModalOpen(true)}
                      className="font-semibold text-pink-600"
                    >
                      {t("moreInfo")} →
                    </button>
                    <div className="flex items-center gap-1">
                      <Star
                        size={16}
                        className="fill-yellow-400 text-yellow-400"
                      />
                      <span className="font-medium">
                        {vendor.rating?.average?.toFixed(1) || "New"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Bike size={16} />
                      <span>{displayTime}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 overflow-x-auto">
          <div className="flex min-w-max gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-pink-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        <VendorDetailsModal
          isOpen={isVendorModalOpen}
          onClose={() => setIsVendorModalOpen(false)}
          vendorId={vendorId}
        />

        <section>
          <h2 className="mb-6 text-xl font-bold text-gray-900">{t("menu")}</h2>

          {productsLoading && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-2xl bg-gray-100"
                />
              ))}
            </div>
          )}

          {productsError && (
            <div className="rounded-2xl bg-red-50 p-6 text-center text-red-600">
              {productsError}
            </div>
          )}

          {!productsLoading &&
            !productsError &&
            filteredProducts.length === 0 && (
              <div className="rounded-2xl bg-gray-50 p-6 text-center text-gray-500">
                {t("noItemsFoundInCategory")}
              </div>
            )}

          {!productsLoading &&
            !productsError &&
            filteredProducts.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => {
                  const hasDiscount = product.pricing.discount > 0;
                  const originalPrice = product.pricing.price;
                  const finalPrice = product.pricing.finalPrice;
                  const currency = product.pricing.currency || "€";

                  return (
                    <div
                      key={product.id}
                      className="group flex overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg"
                    >
                      <div className="relative h-36 w-32 shrink-0">
                        <Image
                          src={
                            product.images?.[0] || "/placeholder-product.jpg"
                          }
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                        {hasDiscount && (
                          <span className="absolute left-2 top-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-bold text-white">
                            {Math.round(product.pricing.discount)}% {t("off")}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {product.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                            {product.description ||
                              t("deliciousMenuItem")}
                          </p>
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                          <div>
                            <p className="text-xl font-bold text-pink-600">
                              {formatPrice(finalPrice, currency)}
                            </p>
                            {hasDiscount && (
                              <p className="text-xs text-gray-400 line-through">
                                {formatPrice(originalPrice, currency)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setSelectedProductId(product.productId)
                            }
                            className="rounded-xl bg-pink-600 p-2 text-white transition hover:scale-105"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </section>

        <ProductDetailsModal
          isOpen={!!selectedProductId}
          onClose={() => setSelectedProductId(null)}
          productId={selectedProductId || ""}
        />
      </div>
    </div>
  );
}