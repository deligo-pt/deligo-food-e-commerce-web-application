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
import {
  useVendor,
  useVendorProducts,
  useVendorProductCategories,
} from "@/hooks/queries/useVendors";
import { groupByVendorCategories, type VendorCategory } from "@/lib/categoryModel";
import { useCategoryScrollSpy } from "@/hooks/useCategoryScrollSpy";
import CategoryNav from "./CategoryNav";
import CategorySidebar from "./CategorySidebar";
import CategoryGroup from "./CategoryGroup";
import { useLocationStore } from "@/stores/locationStore";
import { formatCuisine } from "@/lib/cuisine";
import { currencySymbol } from "@/lib/currency";
import { formatDiscountValue, hasProductDiscount } from "@/lib/productPricing";
import SafeImage from "@/components/shared/SafeImage";
import { Button } from "@/components/ui/button";

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
    // Vertical: image on top, then name, description, price. The horizontal
    // card this replaces gave its image a fixed 128px and let the text take the
    // rest — which worked at full width and stops working once the sidebar
    // takes ~260px off the grid, leaving the text column around 90px at `md`.
    // Stacking gives both the full cell width instead of splitting it.
    <div
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none ${
        storeClosed ? "" : "hover:shadow-lg dark:hover:bg-neutral-800/30"
      }`}
    >
      {/* 4:3 rather than a fixed height, so every card in a row shows the same
          crop whatever the column width works out to. */}
      <div className="relative aspect-4/3 w-full overflow-hidden">
        <SafeImage
          src={product.images?.[0]}
          alt={product.name}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className={`object-cover transition-transform duration-300 ${
            storeClosed ? "" : "group-hover:scale-[1.04]"
          }`}
          fallbackIcon={<UtensilsCrossed className="h-10 w-10" />}
        />
        {discountValue && (
          <span className="absolute left-3 top-3 rounded-full bg-pink-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {discountValue} {t("off")}
          </span>
        )}
      </div>

      {/* `flex-1` + `h-full` on the card make every card in a row the same
          height, with the price row pinned to the bottom — so a two-line name
          next to a one-line name does not leave the prices misaligned. */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold text-gray-900 dark:text-white">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-neutral-400">
          {product.description || t("deliciousMenuItem")}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-pink-600 dark:text-pink-400">
              {formatPrice(finalPrice, currency)}
            </p>
            {hasDiscount && (
              <p className="truncate text-xs text-gray-400 line-through dark:text-neutral-500">
                {formatPrice(originalPrice, currency)}
              </p>
            )}
          </div>
          <Button
            size="icon"
            onClick={() => onSelect(product.productId)}
            disabled={storeClosed}
            aria-label={storeClosed ? t("storeClosedTitle") : t("addToCart")}
            className="shrink-0 rounded-xl hover:scale-105 disabled:hover:scale-100"
          >
            <Plus size={18} />
          </Button>
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
  // The vendor's catalogue, grouped by each product's own category.
  //
  // 🔴 One request, no join. This replaced a Menu → Section hierarchy whose
  // endpoints the backend removed on 2026-08-29 (every `/menus` route now
  // answers 404, authenticated or not, and the `category-guide` confirms the
  // deletion is permanent). `category` arrives populated on every product beside
  // `finalPrice` and `productId`, so grouping needs nothing the page has not
  // already fetched — no second query, no id join, and no chance of a stub
  // product forcing a price to be recomputed here.
  //
  // Order is the order `/products` returned; see `categoryModel.ts` for why the
  // vendor's own category list is deliberately not consulted.
  // ---------------------------------------------------------------------------
  // 🔴 The vendor's own category list decides what this page shows.
  //
  // `/product-categories/open?vendorId=…` returns the categories the vendor owns
  // and has active; a product filed under anything else is not rendered. That
  // reverses the earlier rule — `category` on the product decided everything and
  // every product was shown — on instruction, once the vendor side committed to
  // requiring a category on every product.
  //
  // Public endpoint, no auth branch, and the only second request this page
  // makes. Ordering comes from the response: the schema has no `sortOrder`, so
  // the order it returns is the vendor's order.
  const { data: vendorCategories = [], isLoading: categoriesLoading } =
    useVendorProductCategories<VendorCategory>(vendor?.id, { enabled: !!vendor?.id });

  const { groups: categoryGroups, uncategorizedCount } = useMemo(
    () => groupByVendorCategories(products, vendorCategories, t("otherCategory")),
    [products, vendorCategories, t],
  );

  // Development only. Nothing is broken for the customer — those products are
  // on the page, under "Other" — so this is not an error and is never surfaced
  // to them. It is the migration metric: the group working is not the same as
  // the data being right. Zero once every product is re-filed, at which point
  // the group stops being emitted. `removeConsole` strips this from production
  // regardless; the guard states the intent rather than relying on that.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (uncategorizedCount === 0) return;
    console.warn(
      `[category] ${uncategorizedCount} of ${products.length} product(s) on vendor ${vendor?.id} ` +
        `are not in any category it owns per /product-categories/open, so they render under "Other". ` +
        `Re-file them vendor-side to give them a real heading.`,
    );
  }, [uncategorizedCount, products.length, vendor?.id]);

  // Both requests gate the catalogue. The category list decides which products
  // render, so showing the grid on products alone would flash an empty page —
  // every product filtered out — and then fill it a moment later.
  const catalogueLoading = productsLoading || categoriesLoading;

  // One scroll-spy, two views. The sidebar (lg+) and the pill row (below lg)
  // read the same `activeId` and call the same `selectGroup`, so they cannot
  // disagree about which category you are in. `navRef` is the pill row: it is
  // `display: none` from lg up, so its height measures 0 and the same scroll
  // arithmetic serves both breakpoints without a branch.
  const navRef = useRef<HTMLElement>(null);
  const { activeId, selectGroup, headerHeight } = useCategoryScrollSpy(
    categoryGroups,
    navRef,
  );

  // The sidebar shows a count per category. It is `products.length` for that
  // group — the same number `CategoryGroup` prints beside its heading, read
  // from the same array, so the two can never drift.
  const sidebarGroups = useMemo(
    () =>
      categoryGroups.map((group) => ({
        id: group.id,
        name: group.name,
        count: group.products.length,
      })),
    [categoryGroups],
  );

  // A category group draws its products with the page's own card, passed down as
  // a render prop. That is what keeps `MenuProductCard` — and with it every
  // price, discount badge and add-to-cart path — untouched by this feature.
  const renderCategoryProduct = useCallback(
    (product: Product) => (
      <MenuProductCard
        product={product}
        onSelect={handleSelectProduct}
        storeClosed={isStoreClosed}
      />
    ),
    [handleSelectProduct, isStoreClosed],
  );
  const categoryProductKey = useCallback(
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
                    <h1 className="text-2xl lg:text-display font-bold text-gray-900 dark:text-white">
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
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setIsVendorModalOpen(true)}
                      className="h-auto px-0 font-semibold"
                    >
                      {t("moreInfo")} →
                    </Button>
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

        {/* Two columns from `lg`: the category list beside the catalogue, the
            way the reference lays it out. Below `lg` the sidebar is hidden and
            the pill row inside the content column takes over, so the markup is
            one flex container at every width rather than two layouts. */}
        <div className="flex items-start gap-8">
          <CategorySidebar
            groups={sidebarGroups}
            activeId={activeId}
            onSelect={selectGroup}
            headerHeight={headerHeight}
          />

          {/* `min-w-0` so a long product name cannot push the grid wider than
              its column and force the sidebar off the screen. */}
          <section className="min-w-0 flex-1">
            {/* Jumps between the category headings below. Narrow screens only —
                hidden from `lg`, where the sidebar is the control. Never
                filters, so no product is behind it. */}
            <CategoryNav
              ref={navRef}
              groups={categoryGroups}
              activeId={activeId}
              onSelect={selectGroup}
              headerHeight={headerHeight}
            />

          {/* The skeleton is shaped like what replaces it: two groups, each a
              heading row over the same grid, using the *same* `mb-10`, `mt-4`,
              `gap-5` and column classes as `CategoryGroup`. A skeleton that
              only draws cards costs a jump the moment the headings arrive —
              content shifting under a cursor that was already moving toward
              it. Anything changed in one of these has to change in both. */}
          {catalogueLoading && (
            <div aria-hidden>
              {Array.from({ length: 2 }).map((_, group) => (
                <div key={group} className="mb-10 last:mb-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="h-7 w-40 animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800" />
                    <div className="h-5 w-16 animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800" />
                  </div>
                  <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, card) => (
                      <div
                        key={card}
                        className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-neutral-800"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {productsError && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border dark:border-red-900/30 p-6 text-center text-red-600 dark:text-red-400">
              {productsError}
            </div>
          )}

          {/* ---------------------------------------------------------------
              🔴 The whole catalogue, grouped — never filtered.

              Every product the vendor has appears here exactly once, under its
              own category, in the order `/products` returned. The bar above
              scrolls between these headings; it removes nothing, so there is no
              selected state to be wrong, no empty result to explain, and no
              second branch for "nothing matched".

              That is also why there is only one empty state left. Under menus
              there were three — no menus, no sections, no items in a section —
              because a vendor could have products the menu did not reach. A
              group exists because products were found under it, so the only way
              to see nothing here is to have nothing.
              --------------------------------------------------------------- */}
          {!catalogueLoading && !productsError && (
            categoryGroups.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border dark:border-neutral-800 p-6 text-center text-gray-500 dark:text-neutral-400">
                {t("noProductsFound")}
              </div>
            ) : (
              // Fades the grouped catalogue in over the skeleton it replaces,
              // and is a no-op under `prefers-reduced-motion: reduce`. Applied
              // to the wrapper, once, rather than per group — a stagger down a
              // list the customer is already looking at reads as lag, not
              // polish.
              //
              // This was `category-enter`, a page-local class that did the same
              // thing with a 4px lift. Phase 6 made it a system primitive; two
              // classes for one idea is how the seven pinks happened.
              <div className="motion-fade">
                {categoryGroups.map((group) => (
                  <CategoryGroup
                    key={group.id}
                    group={group}
                    renderProduct={renderCategoryProduct}
                    productKey={categoryProductKey}
                  />
                ))}
              </div>
            )
          )}
          </section>
        </div>

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