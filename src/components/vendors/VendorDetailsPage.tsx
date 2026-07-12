/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bike, Plus, Star, Store, UtensilsCrossed } from "lucide-react";
import { getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useProfile, useActiveAddressCoords } from "@/hooks/queries/useProfile";
import dynamic from "next/dynamic";

// Heavy overlays — split into their own chunks that download only when opened.
const ProductDetailsModal = dynamic(() => import("./ProductDetailsModal"), {
  ssr: false,
});
const VendorDetailsModal = dynamic(() => import("./VendorDetailsModal"), {
  ssr: false,
});
import VendorDetailsSkeleton from "./VendorDetailsSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useVendor, useVendorProducts } from "@/hooks/queries/useVendors";
import { useLocationStore } from "@/stores/locationStore";
import { formatCuisine } from "@/lib/cuisine";
import { currencySymbol } from "@/lib/currency";
import SafeImage from "@/components/shared/SafeImage";

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
    restaurantCuisineType?: string[] | string;
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

// Pure + module-scoped so it has a stable identity (safe as a memo dep).
function formatPrice(price: number, currency: string) {
  return `${currency}${price.toFixed(2)}`.replace(".", ",");
}

// Memoized menu row — only re-renders when its product or the select handler
// changes, so unrelated parent state (delivery-time estimate, category tab,
// modal open/close) no longer re-renders the whole grid.
const MenuProductCard = memo(function MenuProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (productId: string) => void;
}) {
  const { t } = useTranslation();
  const hasDiscount = product.pricing.discount > 0;
  const originalPrice = product.pricing.price;
  const finalPrice = product.pricing.finalPrice;
  const currency = currencySymbol(product.pricing.currency);

  return (
    <div className="group flex overflow-hidden rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none transition hover:shadow-lg dark:hover:bg-neutral-800/30">
      <div className="relative h-36 w-32 shrink-0">
        <SafeImage
          src={product.images?.[0]}
          alt={product.name}
          sizes="128px"
          fallbackIcon={<UtensilsCrossed className="h-8 w-8" />}
        />
        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-bold text-white">
            {Math.round(product.pricing.discount)}% {t("off")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-neutral-400">
            {product.description || t("deliciousMenuItem")}
          </p>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-pink-600 dark:text-pink-400">
              {formatPrice(finalPrice, currency)}
            </p>
            {hasDiscount && (
              <p className="text-xs text-gray-400 dark:text-neutral-500 line-through">
                {formatPrice(originalPrice, currency)}
              </p>
            )}
          </div>
          <button
            onClick={() => onSelect(product.productId)}
            className="rounded-xl bg-pink-600 p-2 text-white transition hover:scale-105"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
});

interface VendorDetailsPageProps {
  vendorId: string;
}

export default function VendorDetailsPage({
  vendorId,
}: VendorDetailsPageProps) {
  const { t } = useTranslation();
  // Cached + deduped, keyed on language + auth. React Query keeps the current
  // vendor/menu on screen during a language switch (placeholderData), replacing
  // the old prevLangVersionRef silent-refetch machinery.
  const {
    data: vendor = null,
    isLoading: loading,
    error: vendorErrorObj,
  } = useVendor<Vendor>(vendorId);
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsErrorObj,
  } = useVendorProducts<Product>(vendor?.id, { enabled: !!vendor?.id });

  const error = vendorErrorObj ? getApiErrorMessage(vendorErrorObj) : "";
  const productsError = productsErrorObj
    ? getApiErrorMessage(productsErrorObj, "Unable to load menu")
    : "";
  // Category filter selection. Keyed by a stable value — the sentinels "all" /
  // "popular", or a category's (localized) name for real categories — decoupled
  // from the translated display label. A language switch remounts this page via
  // LanguageBoundary, which re-inits this back to "all", so no stale (old
  // language) selection can survive and match nothing.
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  // Defer the category filter so a tab click highlights instantly while the grid
  // re-filters in the background — keeps the tab bar responsive on large menus.
  const deferredCategory = useDeferredValue(selectedCategory);
  const handleSelectProduct = useCallback(
    (productId: string) => setSelectedProductId(productId),
    [],
  );

  // Category tabs + filtered products, memoized on their real inputs so they
  // don't recompute on every unrelated re-render (delivery-time estimate, etc.).
  const categoryTabs = useMemo(() => {
    const vendorCategoryNames =
      vendor?.availableCategories?.map((cat) => cat.name) || [];
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
    return [
      { key: "all", label: t("all") },
      { key: "popular", label: t("popular") },
      ...(vendorCategoryNames.length > 0
        ? vendorCategoryNames
        : productCategoryNames
      ).map((name) => ({ key: name, label: name })),
    ];
  }, [vendor, products, t]);

  const filteredProducts = useMemo(() => {
    if (deferredCategory === "all" || deferredCategory === "popular")
      return products;
    return products.filter((product) => {
      const productCategory = product.category?.name;
      if (!productCategory) return false;
      return productCategory.toLowerCase() === deferredCategory.toLowerCase();
    });
  }, [products, deferredCategory]);

  // Resolve delivery coords from the shared, cached profile (GPS fallback),
  // waiting on the profile query so we don't lock in a wrong estimate early.
  const authed = typeof window !== "undefined" && !!getAccessToken();
  const { isLoading: profileLoading } = useProfile({ enabled: authed });
  const activeCoords = useActiveAddressCoords();
  const { coords: geoCoords, permissionStatus } = useLocationStore();
  const userCoords = useMemo(
    () =>
      activeCoords ??
      (geoCoords ? { lat: geoCoords.latitude, lng: geoCoords.longitude } : null),
    [activeCoords, geoCoords],
  );
  const userLoading = permissionStatus === "loading" || (authed && profileLoading);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);
  const timeFetchedRef = useRef(false);


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
        setEstimatedTime(t("under10Min"));
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
              ? t("under10Min")
              : formatTimeRange(estimatedMinutes),
          );
        }
      } catch (err) {
        console.error("Time estimation error", err);
        setEstimatedTime(t("under10Min"));
      } finally {
        setLoadingTime(false);
        timeFetchedRef.current = true;
      }
    };

    fetchTime();
  }, [vendor, userCoords, userLoading, t]);

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
  const heroImage = vendor.storePhoto?.[0] || productVendorPhoto || null;

  const displayTime = loadingTime
    ? t("calculating")
    : estimatedTime || t("under10Min");

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-full px-4 py-6 lg:px-8">
        {/* Hero Section */}
        <section className="mb-6">
          <div className="relative overflow-hidden rounded-3xl shadow-lg">
            <div className="relative h-62.5 md:h-90">
              <SafeImage
                src={heroImage}
                alt={vendor.businessDetails.businessName}
                priority
                sizes="100vw"
                fallbackIcon={<Store className="h-14 w-14" />}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                <div className="rounded-2xl bg-white dark:bg-neutral-900 border dark:border-neutral-800 p-5 shadow-xl dark:shadow-none">
                  <div className="mb-1 flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {vendor.businessDetails.businessName}
                    </h1>
                    <span
                      className={`h-3 w-3 rounded-full ${vendor.businessDetails.isStoreOpen
                        ? "bg-green-500"
                        : "bg-red-500"
                        }`}
                    />
                  </div>
                  <p className="mb-4 text-sm text-gray-500 dark:text-neutral-400">
                    {formatCuisine(vendor.businessDetails.restaurantCuisineType) ||
                      vendor.businessDetails.businessType}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <button
                      onClick={() => setIsVendorModalOpen(true)}
                      className="font-semibold text-pink-600 dark:text-pink-400"
                    >
                      {t("moreInfo")} →
                    </button>
                    <div className="flex items-center gap-1">
                      <Star
                        size={16}
                        className="fill-yellow-400 text-yellow-400"
                      />
                      <span className="font-medium text-gray-900 dark:text-neutral-100">
                        {vendor.rating?.average?.toFixed(1) || "New"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 dark:text-neutral-400">
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
            {categoryTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold uppercase transition ${selectedCategory === tab.key
                  ? "bg-pink-600 text-white"
                  : "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {isVendorModalOpen && (
          <VendorDetailsModal
            isOpen={isVendorModalOpen}
            onClose={() => setIsVendorModalOpen(false)}
            vendorId={vendorId}
          />
        )}

        <section>
          <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-white">{t("menu")}</h2>

          {productsLoading && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-neutral-800"
                />
              ))}
            </div>
          )}

          {productsError && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border dark:border-red-900/30 p-6 text-center text-red-600 dark:text-red-400">
              {productsError}
            </div>
          )}

          {!productsLoading &&
            !productsError &&
            filteredProducts.length === 0 && (
              <div className="rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border dark:border-neutral-800 p-6 text-center text-gray-500 dark:text-neutral-400">
                {t("noItemsFoundInCategory")}
              </div>
            )}

          {!productsLoading &&
            !productsError &&
            filteredProducts.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <MenuProductCard
                    key={product.id}
                    product={product}
                    onSelect={handleSelectProduct}
                  />
                ))}
              </div>
            )}
        </section>

        {selectedProductId && (
          <ProductDetailsModal
            isOpen={!!selectedProductId}
            onClose={() => setSelectedProductId(null)}
            productId={selectedProductId}
          />
        )}
      </div>
    </div>
  );
}