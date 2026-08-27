/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Bike, Moon, Plus, Star, Store, UtensilsCrossed } from "lucide-react";
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
import ClosingCountdown from "./ClosingCountdown";
import { useTranslation } from "@/hooks/useTranslation";
import { useVendor, useVendorProducts } from "@/hooks/queries/useVendors";
import {
  useMenuSections,
  useVendorMenus,
} from "@/hooks/queries/useVendorMenus";
import { buildMenuView } from "@/lib/menuModel";
import MenuSelector, { type VendorMenu } from "./MenuSelector";
import MenuSectionGroup from "./MenuSectionGroup";
import MenuAvailability from "./MenuAvailability";
import { useStore } from "@/stores/translationStore";
import { useLocationStore } from "@/stores/locationStore";
import { formatCuisine } from "@/lib/cuisine";
import { currencySymbol } from "@/lib/currency";
import { formatDiscountValue, hasProductDiscount } from "@/lib/productPricing";
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
    closingDays?: string[];
    preparationTimeMinutes: number;
    restaurantCuisineType?: string[] | string;
    isStoreOpen: boolean;
    /**
     * The vendor's IANA zone, e.g. `"Europe/Lisbon"`. The backend added this
     * after `lib/storeHours.ts` hardcoded a single zone; a menu's availability
     * times are wall-clock in *this* zone, so the caption names it. Optional
     * because older vendor records may predate the field.
     */
    timezone?: string;
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
  /**
   * The Mongo id. Always present on `GET /products`, and it is the key the menu
   * sections join on — `items[].productId._id` references this, never the
   * business `productId` below. Optional here only because the rest of this
   * interface was written against the fields the card renders.
   */
  _id?: string;
  productId: string;
  name: string;
  description: string;
  images: string[];
  pricing: {
    price: number;
    discount: number;
    // Decides whether `discount` is a percentage or an amount in `currency`.
    // Reading it as a percentage either way is what showed "0.6% off" on a
    // €0.60-off product — see `@/lib/productPricing`.
    discountType?: string;
    finalPrice: number;
    currency: string;
  };
  category?: { name: string };
  // `isFeatured` is the vendor's own curation flag from GET /products. It is
  // the only merchandising signal the API exposes — there is no order-count or
  // popularity metric — so the tab is labelled "Featured" for what it is.
  meta?: { isFeatured?: boolean };
}


// Pure + module-scoped so it has a stable identity (safe as a memo dep).
// Decimal point, matching the cart, checkout, payment and invoice surfaces.
function formatPrice(price: number, currency: string) {
  return `${currency}${price.toFixed(2)}`;
}

// Memoized menu row — only re-renders when its product or the select handler
// changes, so unrelated parent state (delivery-time estimate, category tab,
// modal open/close) no longer re-renders the whole grid.
const MenuProductCard = memo(function MenuProductCard({
  product,
  onSelect,
  storeClosed = false,
}: {
  product: Product;
  onSelect: (productId: string) => void;
  // When the store is closed the menu stays browsable but nothing in the row is
  // actionable: the add button is disabled and the hover affordance is dropped,
  // so the card never invites a click it won't honour. Customers can still see
  // what's on offer, which is the point of letting them in here at all.
  storeClosed?: boolean;
}) {
  const { t } = useTranslation();
  // Guard against a product record with missing/partial pricing — an unguarded
  // access here throws during render and trips the route error boundary.
  const pricing = product.pricing;
  const originalPrice = pricing?.price ?? 0;
  const finalPrice = pricing?.finalPrice ?? 0;
  const currency = currencySymbol(pricing?.currency);
  const hasDiscount = hasProductDiscount(pricing);
  // "10%" or "€0.60" — the badge's word comes from `t("off")` beside it.
  const discountValue = formatDiscountValue(pricing, currency);

  return (
    <div
      className={`group flex overflow-hidden rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none transition ${
        storeClosed ? "" : "hover:shadow-lg dark:hover:bg-neutral-800/30"
      }`}
    >
      <div className="relative h-36 w-32 shrink-0">
        <SafeImage
          src={product.images?.[0]}
          alt={product.name}
          sizes="128px"
          fallbackIcon={<UtensilsCrossed className="h-8 w-8" />}
        />
        {discountValue && (
          <span className="absolute left-2 top-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-bold text-white">
            {discountValue} {t("off")}
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
            disabled={storeClosed}
            aria-label={storeClosed ? t("storeClosedTitle") : t("addToCart")}
            className="rounded-xl bg-pink-600 p-2 text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-neutral-700 disabled:hover:scale-100"
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
  // Which of the vendor's menus is on screen. `null` means "not chosen yet",
  // never "no menu" — the first menu is the default, resolved below rather than
  // stored, so it cannot point at a menu the next fetch no longer contains.
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  // `/vendors/<userId>?product=PROD-XXXXXX` opens straight onto that dish.
  // Search results arrive this way: a hit carries no usable vendor route of its
  // own, so `/search` resolves one from `productId` and hands the same id back
  // here, and the click lands on the dish that was clicked rather than near it.
  // Read once, as the initial state — the modal owns it from then on, so
  // closing it does not immediately reopen from a URL that has not changed.
  const searchParams = useSearchParams();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    () => searchParams.get("product"),
  );
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  // Closed vendors are openable from the listings on purpose — the menu stays
  // browsable and only ordering is withdrawn — and a store can also close while
  // this page is open. Only an explicit `false` counts as closed.
  const isStoreClosed = vendor?.businessDetails?.isStoreOpen === false;

  const handleSelectProduct = useCallback(
    (productId: string) => setSelectedProductId(productId),
    [],
  );

  // ---------------------------------------------------------------------------
  // The vendor's own menus.
  //
  // Both endpoints are public and keyed by the vendor's Mongo `_id`, which is
  // what `vendor.id` already holds — the same value the products query uses, and
  // the reason both wait on the vendor query. Sections are fetched for the
  // selected menu only: there is no batched endpoint, so loading all of them up
  // front would cost one request per menu for content behind a control the
  // customer may never touch.
  // ---------------------------------------------------------------------------
  const lang = useStore((s) => s.lang);
  const { data: menus = [] } = useVendorMenus<VendorMenu>(vendor?.id, {
    enabled: !!vendor?.id,
  });

  // A menu the vendor deactivates while this page is open would otherwise leave
  // the selection pointing at nothing. Falling back to All items is the safe
  // direction: it always has content.
  // The first menu is the default. `menus` arrives in the backend's own
  // `sortOrder` (renormalized to a gapless 0..n-1 on every vendor edit), so
  // `menus[0]` *is* the vendor's first menu — no sorting happens here.
  //
  // Derived rather than stored: a menu the vendor deactivates while this page is
  // open would otherwise leave the selection pointing at nothing, and there is
  // no longer an All-items entry to fall back to. Falling forward to the first
  // remaining menu keeps the page showing food.
  const activeMenu =
    (selectedMenuId && menus.find((menu) => menu._id === selectedMenuId)) ||
    menus[0] ||
    null;
  const activeMenuId = activeMenu?._id ?? null;

  const {
    data: rawSections = [],
    isLoading: sectionsLoading,
    error: sectionsErrorObj,
  } = useMenuSections<unknown>(activeMenuId);
  const sectionsError = sectionsErrorObj
    ? getApiErrorMessage(sectionsErrorObj, "Unable to load menu")
    : "";

  // Ordering and grouping come from the menu API; every field rendered comes
  // from `products`. The section payload's own product stub carries no
  // `finalPrice` and no business `productId`, so it is used for its ids alone.
  const menuView = useMemo(
    () => (activeMenuId ? buildMenuView(rawSections, products, lang) : []),
    [activeMenuId, rawSections, products, lang],
  );

  // Every item this menu listed that no product could be found for.
  //
  // Zero for every vendor in the catalogue today, and the one way it goes
  // non-zero is silent: `useVendorProducts` asks for at most 100 products, so a
  // vendor past that ceiling can file product #101 into a section and the join
  // finds nothing. The section then renders as empty and nobody is told why.
  const missingProductCount = useMemo(
    () => menuView.reduce((total, section) => total + section.missingCount, 0),
    [menuView],
  );

  // Surfaced in development only. Not a customer-facing error: they cannot act
  // on it, and the menu around it is still correct and still orderable. It is a
  // message for whoever is looking at this vendor wondering why a section they
  // filled looks empty. (`removeConsole` strips this from production builds
  // regardless; the guard states the intent rather than relying on that.)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (missingProductCount === 0) return;
    console.warn(
      `[menu] ${missingProductCount} item(s) in menu ${activeMenuId} reference a product missing from this vendor's product list. ` +
        `Most likely the vendor has more than the 100 products useVendorProducts fetches.`,
    );
  }, [missingProductCount, activeMenuId]);

  const handleSelectMenu = useCallback((menuId: string) => {
    setSelectedMenuId(menuId);
  }, []);

  // Arriving at a different vendor must not inherit this one's selection.
  useEffect(() => {
    setSelectedMenuId(null);
  }, [vendor?.id]);

  // A menu section draws its products with the page's own card, passed down as
  // a render prop. That is what keeps `MenuProductCard` — and with it every
  // price, discount badge and add-to-cart path — untouched by this feature.
  const renderMenuProduct = useCallback(
    (product: Product) => (
      <MenuProductCard
        product={product}
        onSelect={handleSelectProduct}
        storeClosed={isStoreClosed}
      />
    ),
    [handleSelectProduct, isStoreClosed],
  );
  const menuProductKey = useCallback(
    (product: Product) => product.productId ?? product.id,
    [],
  );

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
        <ClosingCountdown
          closingHours={vendor.businessDetails.closingHours}
          openingHours={vendor.businessDetails.openingHours}
          closingDays={vendor.businessDetails.closingDays}
          isStoreOpen={vendor.businessDetails.isStoreOpen}
        />

        {/* Hero Section */}
        <section className="mb-6">
          <div className="relative overflow-hidden rounded-3xl shadow-lg">
            <div className="relative h-62.5 md:h-90">
              <SafeImage
                src={heroImage}
                alt={vendor.businessDetails.businessName}
                priority
                sizes="100vw"
                className={`object-cover ${isStoreClosed ? "grayscale" : ""}`}
                fallbackIcon={<Store className="h-14 w-14" />}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              {/* Same treatment the listing card carries, so arriving here from
                  a dimmed card reads as continuity rather than a state change.
                  Sits above the gradient but clear of the info panel, which is
                  anchored to the bottom-left. */}
              {isStoreClosed && (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-black/40 pt-10 md:pt-16">
                  <span className="flex items-center gap-2 rounded-full bg-black/70 px-5 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
                    <Moon size={18} />
                    {t("currentlyClosed")}
                  </span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                <div className="rounded-2xl bg-white dark:bg-neutral-900 border dark:border-neutral-800 p-5 shadow-xl dark:shadow-none">
                  <div className="mb-1 flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
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

        {/* Renders nothing when this vendor has no menus, so a vendor who has
            never opened the menu builder gets exactly today's page. */}
        <MenuSelector
          menus={menus}
          selectedMenuId={activeMenuId}
          onSelect={handleSelectMenu}
          lang={lang}
        />

        {/* Annotates the selected pill, so it sits with the selector rather than
            with the sections — and so it still appears for a menu that has no
            sections to put a nav above. Renders nothing when the menu names no
            window, which is most of them. It is a caption: it gates nothing. */}
        {activeMenu && <MenuAvailability availability={activeMenu.availability} />}

        {isVendorModalOpen && (
          <VendorDetailsModal
            isOpen={isVendorModalOpen}
            onClose={() => setIsVendorModalOpen(false)}
            vendorId={vendorId}
          />
        )}

        {isStoreClosed && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-5">
            <Moon
              size={22}
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
            />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-300">
                {t("storeClosedTitle")}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-400/80">
                {t("storeClosedNotice")}
              </p>
            </div>
          </div>
        )}

        <section>
          {/* No menu-level heading. It repeated the highlighted pill directly
              above it — "HIGH QUALITY MENU" then "High quality Menu" — and the
              mobile app goes straight from the pills to the first section. The
              section headings below carry the structure on their own. */}

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

          {/* ---------------------------------------------------------------
              A menu is selected: its sections, stacked, each under its own
              heading, with the nav above jumping between them.

              🔴 Every failure here falls back to a link to All items rather
              than to a dead end. Menus are additive — when anything about them
              is unavailable the customer must still be able to reach the
              catalogue and order.
              --------------------------------------------------------------- */}
          {!productsLoading && !productsError && activeMenuId !== null && (
            <>
              {sectionsLoading && menuView.length === 0 && (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-neutral-800"
                    />
                  ))}
                </div>
              )}

              {sectionsError && (
                <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border dark:border-red-900/30 p-6 text-center text-red-600 dark:text-red-400">
                  {sectionsError}
                </div>
              )}

              {!sectionsLoading && !sectionsError && menuView.length === 0 && (
                <div className="rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border dark:border-neutral-800 p-6 text-center text-gray-500 dark:text-neutral-400">
                  {t("menuHasNoSections")}
                </div>
              )}

              {!sectionsError && menuView.length > 0 && (
                <>
                  {menuView.map((section) => (
                    <MenuSectionGroup
                      key={section.id}
                      section={section}
                      renderProduct={renderMenuProduct}
                      productKey={menuProductKey}
                    />
                  ))}

                </>
              )}
            </>
          )}

          {/* ---------------------------------------------------------------
              🔴 The vendor has no menus at all: their whole catalogue, ungrouped.

              Not a control and not "All items" — there is no pill and nothing to
              select. It is the branch that runs for a vendor who has not been
              migrated to menus yet, and it exists because the vendor-side rule
              that every product belongs to a menu is a forward promise: four of
              seven live vendors did not satisfy it on the day this shipped, and
              the frontend has no way to know when they all do. A restaurant
              with products to sell must never render a blank page.

              Once every vendor has a menu this never executes, which is exactly
              what a migration fallback should cost.
              --------------------------------------------------------------- */}
          {!productsLoading && !productsError && menus.length === 0 && (
            products.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border dark:border-neutral-800 p-6 text-center text-gray-500 dark:text-neutral-400">
                {t("noItemsFoundInCategory")}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <MenuProductCard
                    key={product.productId ?? product.id}
                    product={product}
                    onSelect={handleSelectProduct}
                    storeClosed={isStoreClosed}
                  />
                ))}
              </div>
            )
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