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
import { Bike, Moon, Plus, Star, UtensilsCrossed } from "lucide-react";
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
import { getVendorKind, vendorCopyKey, type VendorKind } from "@/lib/vendorKind";
import {
  useVendor,
  useVendorProducts,
  useVendorProductCategories,
} from "@/hooks/queries/useVendors";
import {
  groupByVendorCategories,
  isSellableProduct,
  type VendorCategory,
} from "@/lib/categoryModel";
import { useCategoryScrollSpy } from "@/hooks/useCategoryScrollSpy";
import CategoryNav from "./CategoryNav";
import CategorySidebar from "./CategorySidebar";
import CategoryGroup from "./CategoryGroup";
import { useLocationStore } from "@/stores/locationStore";
import { formatCuisine } from "@/lib/cuisine";
import { currencySymbol } from "@/lib/currency";
import { formatDiscountValue, hasProductDiscount } from "@/lib/productPricing";
import SafeImage from "@/components/shared/SafeImage";
import ShareButton from "@/components/shared/ShareButton";
import { productIdFromParam, productShareText, productShareUrl } from "@/lib/share";
import { isLegacyVendorUserId } from "@/lib/vendorId";
import { useLegacyVendorRedirect } from "@/hooks/queries/useLegacyVendorRedirect";
import VendorHeroImage from "./VendorHeroImage";
import ProductQuantityStepper from "./ProductQuantityStepper";
import { useCartQuantities } from "@/hooks/useCartQuantities";
import { useCartCache } from "@/hooks/queries/useCart";
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
  /**
   * Both arrive on `GET /products` already — verified against the live list:
   * every one of the 45 products carries `variations` and `addonGroups`, so
   * the card can decide whether a dish is addable in one tap without a second
   * request per card.
   */
  variations?: { name: string; options: unknown[] }[];
  /** ObjectIds only; the groups themselves (and their `minSelectable`) come
   *  from `/add-ons/:id`, which the modal fetches and a card must not. */
  addonGroups?: string[];
  // `isFeatured` is the vendor's own curation flag from GET /products. It is
  // the only merchandising signal the API exposes — there is no order-count or
  // popularity metric — so the tab is labelled "Featured" for what it is.
  meta?: { isFeatured?: boolean };
}

/**
 * Can this dish go into the cart from the grid, in one tap?
 *
 * Only when there is nothing to choose. A variation is an unanswered question
 * — which size, which plate — and an add-on group may carry
 * `minSelectable > 0`, which the modal refuses to add without. Reading that
 * limit means one `/add-ons/:id` request per group, per card, so the card does
 * not read it: a product with any add-on group keeps the `+` that opens the
 * modal.
 *
 * On the live catalogue that is 30 of 45 products addable inline, 12 held back
 * by variations and 3 by add-on groups.
 */
function isOneTapAddable(product: Product): boolean {
  return !product.variations?.length && !product.addonGroups?.length;
}


// Pure + module-scoped so it has a stable identity (safe as a memo dep).
// Decimal point, matching the cart, checkout, payment and invoice surfaces.
function formatPrice(price: number, currency: string) {
  return `${currency}${price.toFixed(2)}`;
}

// Memoized menu row — only re-renders when its product, its cart quantity or
// the handlers change, so unrelated parent state (delivery-time estimate,
// category tab, modal open/close) no longer re-renders the whole grid.
const MenuProductCard = memo(function MenuProductCard({
  product,
  onSelect,
  cartQuantity,
  onCartChanged,
  storeClosed = false,
  vendorKind = "partner",
  vendorId,
  storeName,
}: {
  product: Product;
  onSelect: (productId: string) => void;
  /** How many of this line the cart holds. `0` when it holds none. */
  cartQuantity: number;
  /** Awaited by the stepper, so its optimistic number survives until the
   *  refetch it triggered has actually landed. */
  onCartChanged: () => Promise<unknown>;
  // When the store is closed the menu stays browsable but nothing in the row is
  // actionable: the add button is disabled and the hover affordance is dropped,
  // so the card never invites a click it won't honour. Customers can still see
  // what's on offer, which is the point of letting them in here at all.
  storeClosed?: boolean;
  /** Restaurant, store or neither — decides what the closed label calls it. */
  vendorKind?: VendorKind;
  /** The store's id from the route — the one the share link needs. */
  vendorId: string;
  /** Named in the shared line, when the store record has loaded. */
  storeName?: string;
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
  // The cart endpoints key on the Mongo `_id`; the business `productId`
  // (PROD-XXXX) is rejected as an "Invalid Id". The modal is opened by the
  // business id, because that is what `/products/:id` and the `?product=` deep
  // link both take — so the card carries both, deliberately.
  const cartId = product._id ?? product.productId;
  const oneTap = isOneTapAddable(product);

  return (
    // Vertical: image on top, then name and price. The description line was
    // removed by request — it is in the details modal, and dropping it is most
    // of what lets the card shrink and the grid gain a column.
    /*
      The whole card opens the detail — image, name, price, the padding
      between them. Everything except the quantity control, which stops the
      click before it gets here (see `ProductQuantityStepper`).

      A `div` with an `onClick` and no `role`, deliberately. This is the
      "clickable card" pattern: the card itself is a convenience for pointers,
      and the **name below is a real `<button>`** carrying the same action —
      so the card is one tab stop, announces itself as a button named after
      the dish, and works on Enter. Making the card the button instead would
      nest the stepper's buttons inside it, which is invalid and lands
      keyboard focus somewhere no browser agrees on.

      Still openable while the store is closed: reading a dish is not ordering
      it, and the modal disables its own add button.
    */
    <div
      onClick={() => onSelect(product.productId)}
      className={`group flex h-full flex-col cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition dark:shadow-none ${
        storeClosed ? "" : "hover:shadow-lg dark:hover:bg-neutral-800/30"
      }`}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden">
        <SafeImage
          src={product.images?.[0]}
          alt={product.name}
          // Four columns at the widest breakpoint, two on a phone.
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover transition-transform duration-300 ${
            storeClosed ? "" : "group-hover:scale-[1.04]"
          }`}
          fallbackIcon={<UtensilsCrossed className="h-8 w-8" />}
        />
        {discountValue && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            {discountValue} {t("off")}
          </span>
        )}
        {/* Opposite the discount badge, so the two never meet. Shares the
            dish's own deep link — the store with this dish already open —
            and stays available while the store is closed: showing someone a
            dish is not ordering it. */}
        <ShareButton
          className="absolute right-2 top-2"
          label={`${t("share")} ${product.name}`}
          getShareData={() => ({
            title: product.name,
            text: productShareText(t("shareItemIntro"), product.name, storeName),
            url: productShareUrl(window.location.origin, vendorId, product.productId),
          })}
        />
      </div>

      {/* `flex-1` + `h-full` on the card make every card in a row the same
          height, with the price row pinned to the bottom — so a two-line name
          next to a one-line name does not leave the prices misaligned. */}
      <div className="flex flex-1 flex-col p-3">
        {/* The card's keyboard equivalent. It carries the same action as the
            card around it, so a pointer and a Tab key reach the detail the
            same way — and `text-start` because a button centres its text. */}
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">
          <button
            type="button"
            onClick={(event) => {
              // The card behind it would otherwise fire the same handler twice.
              event.stopPropagation();
              onSelect(product.productId);
            }}
            className="cursor-pointer text-start"
          >
            {product.name}
          </button>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-primary dark:text-pink-400">
              {formatPrice(finalPrice, currency)}
            </p>
            {hasDiscount && (
              <p className="truncate text-xs text-gray-400 line-through dark:text-neutral-500">
                {formatPrice(originalPrice, currency)}
              </p>
            )}
          </div>

          {/*
            One tap only where there is nothing to ask. A dish with a variation
            or an add-on group keeps the `+` that opens the modal — it is the
            only place a size can be chosen or a required add-on satisfied, and
            a card that added one blind would build a cart line the customer
            never agreed to.
          */}
          {oneTap ? (
            <ProductQuantityStepper
              productId={cartId}
              productName={product.name}
              quantity={cartQuantity}
              disabled={storeClosed}
              vendorKind={vendorKind}
              onCartChanged={onCartChanged}
            />
          ) : (
            <Button
              size="icon"
              onClick={() => onSelect(product.productId)}
              disabled={storeClosed}
              aria-label={
                storeClosed
                  ? t(vendorCopyKey("storeClosedTitle", vendorKind))
                  : t("addToCart")
              }
              className="size-9 shrink-0 rounded-xl hover:scale-105 disabled:hover:scale-100"
            >
              <Plus size={16} />
            </Button>
          )}
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
  const { t, i18n } = useTranslation();
  // A link shared before 24 Sep 2026 carries the store's `V-…` userId, which
  // every vendor endpoint now answers 400 on. It is resolved and the URL
  // replaced rather than fetched — see `useLegacyVendorRedirect` — so the
  // vendor query is held back for exactly as long as that is in flight.
  const isLegacyLink = isLegacyVendorUserId(vendorId);
  // Cached + deduped, keyed on language + auth. React Query keeps the current
  // vendor/menu on screen during a language switch (placeholderData), replacing
  // the old prevLangVersionRef silent-refetch machinery.
  const {
    data: vendor = null,
    isLoading: loading,
    error: vendorErrorObj,
  } = useVendor<Vendor>(vendorId, { enabled: !isLegacyLink });
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsErrorObj,
  } = useVendorProducts<Product>(vendor?.id, { enabled: !!vendor?.id });

  const error = vendorErrorObj ? getApiErrorMessage(vendorErrorObj) : "";
  const productsError = productsErrorObj
    ? getApiErrorMessage(productsErrorObj, "Unable to load menu")
    : "";
  // `/vendors/<vendorId>?product=PROD-XXXXXX` opens straight onto that dish.
  // Search results arrive this way: a hit carries no usable vendor route of its
  // own, so `/search` resolves one from `productId` and hands the same id back
  // here, and the click lands on the dish that was clicked rather than near it.
  // Read once, as the initial state — the modal owns it from then on, so
  // closing it does not immediately reopen from a URL that has not changed.
  const searchParams = useSearchParams();
  // Only the id: a link pasted together with its share message carries the
  // message in this parameter too (see `productIdFromParam`).
  const productParam = productIdFromParam(searchParams.get("product"));
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    () => productParam,
  );
  // An aged link resolves through the dish it points at, which is why this
  // sits below the parameter it needs. It does nothing at all for a current
  // link.
  const { resolving: resolvingLegacyLink } = useLegacyVendorRedirect(
    vendorId,
    productParam,
  );
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  // Closed vendors are openable from the listings on purpose — the menu stays
  // browsable and only ordering is withdrawn — and a store can also close while
  // this page is open. Only an explicit `false` counts as closed.
  const isStoreClosed = vendor?.businessDetails?.isStoreOpen === false;
  // Restaurant, store, or neither — the vendor's own record decides the words
  // on the closed banner and on the disabled add buttons.
  const vendorKind = getVendorKind(vendor?.businessDetails?.businessType);
  // A string rather than the vendor object, so the memoised cards compare it
  // by value and a vendor refetch does not re-render the whole grid.
  const storeName = vendor?.businessDetails?.businessName;

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
  // makes. Its order is not used: the schema has no `sortOrder`, and since
  // 25 Sep 2026 the page sorts these alphabetically itself.
  const { data: vendorCategories = [], isLoading: categoriesLoading } =
    useVendorProductCategories<VendorCategory>(vendor?.id, { enabled: !!vendor?.id });

  // `i18n.language` decides the collation, so a language switch re-sorts rather
  // than leaving Portuguese names ordered the English way.
  // The guest product endpoint returns the vendor's inactive dishes too, and a
  // menu must not offer something the vendor has switched off. Filtered here
  // rather than inside the grouping, which is contracted never to drop a
  // product it is handed.
  const sellableProducts = useMemo(
    () => products.filter(isSellableProduct),
    [products],
  );

  // Ids the menu is showing, for the `?product=` deep link to check itself
  // against. Both id shapes, because a shared link carries the business
  // `productId` while the cards key on `_id`.
  const sellableProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const product of sellableProducts) {
      const p = product as { productId?: string; _id?: string };
      if (p.productId) ids.add(p.productId);
      if (p._id) ids.add(p._id);
    }
    return ids;
  }, [sellableProducts]);

  const { groups: categoryGroups, uncategorizedCount } = useMemo(
    () =>
      groupByVendorCategories(
        sellableProducts,
        vendorCategories,
        t("otherCategory"),
        i18n.language,
      ),
    [sellableProducts, vendorCategories, t, i18n.language],
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

  // Signed in? The cart only exists for an account, so a guest's grid renders
  // every card in its `+` state and the query is never fired. Declared here
  // rather than beside the profile query below because the card needs it.
  const authed = typeof window !== "undefined" && !!getAccessToken();

  // One cart read for the whole grid. Each card receives a number, so a change
  // to one line re-renders one card — see `useCartQuantities`.
  const cartQuantities = useCartQuantities(authed);
  const { invalidate: invalidateCart } = useCartCache();

  // A category group draws its products with the page's own card, passed down as
  // a render prop. That is what keeps `MenuProductCard` — and with it every
  // price, discount badge and add-to-cart path — untouched by this feature.
  const renderCategoryProduct = useCallback(
    (product: Product) => (
      <MenuProductCard
        product={product}
        onSelect={handleSelectProduct}
        cartQuantity={cartQuantities.get(product._id ?? product.productId) ?? 0}
        onCartChanged={invalidateCart}
        storeClosed={isStoreClosed}
        vendorKind={vendorKind}
        vendorId={vendorId}
        storeName={storeName}
      />
    ),
    [
      cartQuantities,
      handleSelectProduct,
      invalidateCart,
      isStoreClosed,
      vendorKind,
      vendorId,
      storeName,
    ],
  );
  const categoryProductKey = useCallback(
    (product: Product) => product.productId ?? product.id,
    [],
  );

  // Resolve delivery coords from the shared, cached profile (GPS fallback),
  // waiting on the profile query so we don't lock in a wrong estimate early.
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

  // The skeleton also covers the moment an aged link is being resolved: the
  // vendor query is disabled then, so `loading` is false and the "not found"
  // below would flash before the redirect lands.
  if (loading || resolvingLegacyLink) {
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
              {/* The banner and its placeholder, extracted. It carries
                  `motion-image-in`, which scales, and §11 bars a transform from
                  a file that renders a price — this one renders sixteen. The
                  boundary is the point: nothing that renders money goes in
                  `VendorHeroImage`. */}
              <VendorHeroImage
                src={heroImage}
                alt={vendor.businessDetails.businessName}
                dimmed={isStoreClosed}
              />
              {/* Everything below stays stacked above the placeholder in
                  document order. The gradient, the closed badge and the info
                  panel are content that has already arrived; covering them to
                  hide an image that has not would trade a real thing for an
                  absent one. */}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              {/* Same treatment the listing card carries, so arriving here from
                  a dimmed card reads as continuity rather than a state change.
                  Sits above the gradient but clear of the info panel, which is
                  anchored to the bottom-left. */}
              {isStoreClosed && (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-black/40 pt-8 md:pt-16">
                  <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
                    <Moon size={18} />
                    {t("currentlyClosed")}
                  </span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                <div className="rounded-2xl bg-card border p-4 shadow-xl dark:shadow-none">
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
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
            <Moon
              size={22}
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500"
            />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-300">
                {t(vendorCopyKey("storeClosedTitle", vendorKind))}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-400/80">
                {t(vendorCopyKey("storeClosedNotice", vendorKind))}
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
              heading row over the same grid, using the *same* `mb-8`, `mt-4`,
              `gap-4` and column classes as `CategoryGroup`. A skeleton that
              only draws cards costs a jump the moment the headings arrive —
              content shifting under a cursor that was already moving toward
              it. Anything changed in one of these has to change in both. */}
          {catalogueLoading && (
            <div aria-hidden>
              {Array.from({ length: 2 }).map((_, group) => (
                <div key={group} className="mb-8 last:mb-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="h-7 w-40 animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800" />
                    <div className="h-5 w-16 animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
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
              <div className="rounded-2xl bg-gray-50 dark:bg-neutral-900/50 border p-6 text-center text-gray-500 dark:text-neutral-400">
                {t("noProductsFound")}
              </div>
            ) : (
              // Phase 6 faded the whole catalogue in here, once, and said why:
              // "a stagger down a list the customer is already looking at reads
              // as lag, not polish." Browser round 6 was asked for the stagger
              // anyway, and the objection is answered rather than overruled —
              // the sequencing is now per *group* and fires when that group
              // scrolls into view, so nothing cascades down a menu already on
              // screen. See `CategoryGroup`.
              //
              // The wrapper's own fade is gone with it. Fading a container while
              // its children animate inside it pays for one arrival twice.
              <div>
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

        {/* A `?product=` link to a dish the vendor has since switched off opens
            nothing: the menu no longer lists it, and a modal over an empty
            menu would sell it anyway. Only ids the page is actually showing
            can open. */}
        {selectedProductId && sellableProductIds.has(selectedProductId) && (
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