"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UtensilsCrossed, SearchX } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import ShareButton from "@/components/shared/ShareButton";
import { productShareText, productShareUrl, type ShareData } from "@/lib/share";
import { currencySymbol } from "@/lib/currency";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useSearch,
  flattenSearchHits,
  searchTotal,
} from "@/hooks/queries/useSearch";
import { useCuisines } from "@/hooks/queries/useCuisines";
import { useActiveAddressCoords } from "@/hooks/queries/useProfile";
import SearchFilters, {
  type FilterPatch,
} from "@/components/search/SearchFilters";
import { useProductDestination } from "@/hooks/queries/useProductDestination";
import { toast } from "sonner";
import {
  formatCuisineLabel,
  formatRestaurantLabel,
  type SearchHit,
  type SearchSortBy,
  type SearchSortOrder,
} from "@/lib/search";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/components/ui/card";
import VendorCard, { type Vendor } from "@/components/vendors/VendorCard";
import { useVendorSearch } from "@/hooks/queries/useVendors";
import { useLocationStore } from "@/stores/locationStore";

/**
 * `/search` — results from the backend's Meilisearch index.
 *
 * See `Plan.md` → "Customer Search — Implementation Plan", Phase 3.
 *
 * ## What this page deliberately does not do
 *
 * It does not filter, sort, rank, or re-price anything. Every one of those is a
 * query parameter that `useSearch` sends and the backend answers; this file
 * turns `hits` into cards and nothing more. The page it replaces fetched 100
 * products and did all four in the browser, which is why its result count, its
 * ordering and its matching all disagreed with the mobile app.
 *
 * The one arithmetic here is `hits.length` for the skeleton — everything a user
 * reads, including the result count, comes from the response.
 *
 * ## Two sections, two sources
 *
 * The search index is `food_items` — dishes only, with no vendor documents in
 * it — so it can never answer "which restaurant is called Tasca?". That is why
 * every dish card names its restaurant, and why the places row above the grid
 * comes from a different endpoint entirely (`useVendorSearch`, which asks
 * `/vendors/nearby/open?searchTerm=`). Neither list is filtered, sorted or
 * ranked here; each backend decides its own answer.
 *
 * ## Where a card leads
 *
 * Cards render as `<article>`, not links, and open through `router.push`. A
 * hit's `restaurantId` is the store's Mongo id — which is what the store route
 * takes as of 24 Sep 2026 (`lib/vendorId.ts`), so the tap navigates with no
 * lookup in front of it. It did not always: the routes used to key on the
 * `V-…` userId, and the destination had to be resolved from `productId`. That
 * hop survives only as the fallback for a hit without a `restaurantId`.
 */

/** How many skeleton cards to show before the first response arrives. */
const SKELETON_COUNT = 8;

/** Cuisine chips per card before the rest are summarised as "+N". */
const CUISINE_CHIP_LIMIT = 3;

/**
 * Query length at which an empty result starts explaining prefix matching.
 *
 * Short queries come up empty for ordinary reasons and the hint would be noise;
 * by four characters a user has typed enough that "we do not search inside
 * words" is the likelier explanation than a typo.
 */
const PREFIX_HINT_MIN_LENGTH = 4;

function isSortBy(value: string | null): value is SearchSortBy {
  return value === "price" || value === "rating";
}

function isSortOrder(value: string | null): value is SearchSortOrder {
  return value === "asc" || value === "desc";
}

function DishCard({
  hit,
  onOpen,
  onPrefetch,
  onShareData,
  busy,
}: {
  hit: SearchHit;
  onOpen: (hit: SearchHit) => void;
  onPrefetch: (hit: SearchHit) => void;
  /** The dish's link — its store looked up first, since a hit does not carry it. */
  onShareData: (hit: SearchHit) => Promise<ShareData>;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const cuisines = hit.cuisine?.map(formatCuisineLabel).filter(Boolean) ?? [];

  return (
    <article
      role="button"
      tabIndex={0}
      aria-busy={busy}
      // Hovering or tab-focusing warms the destination, for the one case that
      // still needs looking up: a hit that arrived without a `restaurantId`.
      // With one — every hit today — the prefetch is a no-op and the click
      // navigates on the spot.
      onMouseEnter={() => onPrefetch(hit)}
      onFocus={() => onPrefetch(hit)}
      onClick={() => onOpen(hit)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(hit);
        }
      }}
      /* Phase 8. A fifth shell — `rounded-2xl`, a grey border, `shadow-sm`,
         and the pink hover border again. The focus ring stays local: this is a
         div with `role="button"`, so it needs one spelled out. */
      className={cn(
        cardVariants({ variant: "interactive" }),
        "flex h-full cursor-pointer flex-col overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        busy && "opacity-60",
      )}
    >
      <div className="relative aspect-4/3 shrink-0 overflow-hidden bg-gray-50 dark:bg-neutral-800">
        <SafeImage
          src={hit.thumbnail}
          alt={hit.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          fallbackIcon={<UtensilsCrossed className="h-8 w-8" />}
        />
        {/* Starts the store lookup on press-down, so the link is usually
            ready by the time the click lands — the same lookup hovering the
            card already warms. */}
        <ShareButton
          className="absolute right-2 top-2"
          label={`${t("share")} ${hit.name}`}
          onPrepare={() => onPrefetch(hit)}
          getShareData={() => onShareData(hit)}
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-semibold text-foreground dark:text-neutral-50">
          {hit.name}
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground dark:text-neutral-400">
          {formatRestaurantLabel(hit)}
        </p>

        {/* Capped for layout, not filtered — one restaurant carries seven
            cuisines, which would push the price off the card. The overflow is
            counted rather than dropped silently, and the full list is the
            element's title. */}
        {cuisines.length > 0 && (
          <ul
            className="mt-2 flex flex-wrap gap-1.5"
            title={cuisines.join(", ")}
          >
            {cuisines.slice(0, CUISINE_CHIP_LIMIT).map((cuisine) => (
              <li
                key={cuisine}
                className="rounded-full bg-[#fff1f4] px-2 py-0.5 text-xs font-medium text-primary dark:bg-neutral-800 dark:text-pink-400"
              >
                {cuisine}
              </li>
            ))}
            {cuisines.length > CUISINE_CHIP_LIMIT && (
              <li className="px-1 py-0.5 text-xs font-medium text-muted-foreground dark:text-neutral-400">
                +{cuisines.length - CUISINE_CHIP_LIMIT}
              </li>
            )}
          </ul>
        )}

        {/* Rendered exactly as the API sent it — the backend owns the money. */}
        <div className="mt-auto pt-3 font-bold text-primary dark:text-pink-500">
          {currencySymbol(hit.currency)} {hit.price?.toFixed(2) ?? "0.00"}
        </div>
      </div>
    </article>
  );
}

function ResultsGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

export default function SearchContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = searchParams.get("q")?.trim() ?? "";

  // Filter state lives in the URL, so a filtered search is shareable and
  // back/forward works without a store to keep in step.
  const cuisine = searchParams.get("cuisine")?.trim() ?? "";
  const sortByParam = searchParams.get("sortBy");
  const sortOrderParam = searchParams.get("sortOrder");
  const sortBy = isSortBy(sortByParam) ? sortByParam : undefined;
  const sortOrder = isSortOrder(sortOrderParam) ? sortOrderParam : undefined;
  const minPrice = searchParams.get("minPrice")?.trim() ?? "";
  const maxPrice = searchParams.get("maxPrice")?.trim() ?? "";
  const radius = Number(searchParams.get("radius"));
  const radiusInMeters = Number.isFinite(radius) && radius > 0 ? radius : null;
  const isAvailable = searchParams.get("available") === "1";
  const isHalal = searchParams.get("halal") === "1";

  // Coordinates are resolved per viewer rather than read from the URL — see the
  // note in `SearchFilters`. The saved delivery address is preferred because it
  // needs no permission prompt and is where the food would actually go; the
  // browser is the fallback for guests and for anyone without one.
  const addressCoords = useActiveAddressCoords();
  const [browserCoords, setBrowserCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const coords = addressCoords ?? browserCoords;

  /**
   * Where to look for places.
   *
   * `/vendors/nearby/open` is a proximity endpoint first, so the places row
   * needs somewhere to be near — and it should not have to ask for it. The
   * filters' own `coords` are only resolved once the viewer presses "Near me",
   * so relying on them alone would mean a guest never saw a place at all. The
   * location store already holds what the navbar is showing (the browser
   * position, or the address a guest chose), and the saved delivery address
   * still wins when there is one.
   *
   * With neither, this stays `null` and the query is disabled: the row is
   * absent rather than empty, which is the honest shape for "we do not know
   * where you are" as opposed to "nothing near you matches".
   */
  const storedCoords = useLocationStore((s) => s.coords);
  const guestAddress = useLocationStore((s) => s.guestAddress);
  const placeCoords =
    coords ??
    (storedCoords
      ? { lat: storedCoords.latitude, lng: storedCoords.longitude }
      : guestAddress
        ? { lat: guestAddress.latitude, lng: guestAddress.longitude }
        : null);

  const { data: places = [] } = useVendorSearch<Vendor>(placeCoords, query);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setBrowserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => setLocationDenied(true),
    );
  }, []);

  /**
   * Writes a patch of parameters to the URL. `null` removes a key.
   *
   * `replace`, not `push`: adjusting a filter is refining one search, not
   * navigating to a new page, and pushing would bury the back button under
   * every chip the user tried.
   *
   * Paging resets itself — `offset` is never in the URL, so a changed parameter
   * changes the query key and `useInfiniteQuery` starts again from its
   * `initialPageParam`. There is nothing to reset by hand.
   */
  const applyPatch = useCallback(
    (patch: FilterPatch) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams],
  );

  /** Drops every filter but keeps the search term — clearing that is the navbar's job. */
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [router, pathname, query]);

  // A filter on its own is a legitimate search — "everything halal under €10"
  // needs no words. Only a page with nothing asked for at all shows the prompt.
  const hasCriteria =
    query.length > 0 ||
    cuisine.length > 0 ||
    minPrice.length > 0 ||
    maxPrice.length > 0 ||
    isAvailable ||
    isHalal ||
    (radiusInMeters !== null && coords !== null);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSearch(
    {
      searchTerm: query || undefined,
      cuisine: cuisine || undefined,
      sortBy,
      sortOrder,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      // The triple is passed only when a radius is chosen *and* coordinates
      // exist. `buildSearchParams` would drop a partial one anyway, but not
      // building it is clearer than relying on that.
      lat: radiusInMeters !== null ? coords?.lat : undefined,
      lng: radiusInMeters !== null ? coords?.lng : undefined,
      radiusInMeters: coords ? (radiusInMeters ?? undefined) : undefined,
      isAvailable: isAvailable ? true : undefined,
      isHalal: isHalal ? true : undefined,
    },
    { enabled: hasCriteria },
  );

  // Click-through. `restaurantId` is the store's id and the store route takes
  // it, so the common path costs nothing; `useProductDestination` is the
  // fallback for a hit that has none.
  const { resolve, prefetch } = useProductDestination();
  const [openingProductId, setOpeningProductId] = useState<string | null>(null);

  const vendorIdFor = useCallback(
    async (hit: SearchHit): Promise<string> =>
      hit.restaurantId || (await resolve(hit.productId)).vendorId,
    [resolve],
  );

  // A shared dish lands where a clicked one does: its store, with the dish up.
  const shareDataFor = useCallback(
    async (hit: SearchHit): Promise<ShareData> => {
      const vendorId = await vendorIdFor(hit);
      return {
        title: hit.name,
        text: productShareText(t("shareItemIntro"), hit.name, formatRestaurantLabel(hit)),
        url: productShareUrl(window.location.origin, vendorId, hit.productId),
      };
    },
    [vendorIdFor, t],
  );

  const openHit = useCallback(
    async (hit: SearchHit) => {
      setOpeningProductId(hit.productId);
      try {
        const vendorId = await vendorIdFor(hit);
        // `?product=` opens the menu with this dish's modal already up, so the
        // click lands on the thing that was clicked rather than near it.
        // A closed restaurant is navigated to, not blocked: the vendor page's
        // existing "Currently Closed" treatment is the honest place to say so,
        // and the menu stays browsable there (§0.5).
        router.push(
          `/vendors/${vendorId}?product=${encodeURIComponent(hit.productId)}`,
        );
      } catch {
        toast.error(t("failedToOpenItem"));
        setOpeningProductId(null);
      }
    },
    [vendorIdFor, router, t],
  );

  const filterBar = (
    <SearchFilters
      values={{
        cuisine,
        sortBy: sortBy ?? null,
        sortOrder: sortOrder ?? null,
        minPrice,
        maxPrice,
        radiusInMeters,
        isAvailable,
        isHalal,
      }}
      onChange={applyPatch}
      onClear={clearFilters}
      hasCoords={coords !== null}
      onRequestLocation={requestLocation}
      locationDenied={locationDenied}
    />
  );

  const hits = flattenSearchHits(data);
  const total = searchTotal(data);

  // The slug's display name, looked up rather than derived. Un-hyphenating
  // `indian-food` into "Indian Food" would be inventing a label the backend
  // already publishes — and inventing it wrongly for `pt`, where the same slug
  // reads "Comida Indiana". A slug we cannot resolve falls back to itself.
  const { data: cuisines } = useCuisines({ enabled: cuisine.length > 0 });
  const cuisineLabel = cuisine
    ? formatCuisineLabel(
        cuisines?.find((entry) => entry.slug === cuisine)?.name ?? cuisine,
      )
    : "";

  // Nothing asked for — opening `/search` directly, or the navbar's clear
  // button wiping the term. A prompt, not "0 results for ''".
  if (!hasCriteria) {
    return (
      <main className="w-full px-4 py-8 lg:px-16">
        {/* Shown even with nothing asked for, so browsing can start from a
            filter rather than requiring a word to be typed first. */}
        {filterBar}
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground dark:text-neutral-50">
            {t("searchPromptTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground dark:text-neutral-400">
            {t("searchPromptHint")}
          </p>
        </div>
      </main>
    );
  }

  if (isPending) {
    return (
      <main className="w-full px-4 py-8 lg:px-16">
        {filterBar}
        {/* A filter-only search has no term to echo, and "Searching for ''" is
            worse than no subtitle at all. */}
        <h1 className="mb-6 text-2xl font-bold text-foreground dark:text-neutral-50">
          {query ? (
            <>
              {t("searchingFor")} &ldquo;{query}&rdquo;
            </>
          ) : (
            t("loadingSearch")
          )}
        </h1>
        <ResultsGrid>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl bg-gray-200 dark:bg-neutral-800"
            />
          ))}
        </ResultsGrid>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="w-full px-4 py-8 lg:px-16">
        {filterBar}
        <div className="py-16 text-center">
          <p className="text-muted-foreground dark:text-neutral-400">
            {t("failedToLoadSearchResults")}
          </p>
          <Button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-2xl font-semibold"
          >
            {t("tryAgain")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full px-4 py-8 lg:px-16">
      {filterBar}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground dark:text-neutral-50">
          {query ? (
            <>
              {t("searchResultsFor")} &ldquo;{query}&rdquo;
            </>
          ) : (
            t("searchPromptTitle")
          )}
        </h1>
        {/* The server's total, not `hits.length` — that is only what has been
            paged in so far, and reporting it was the old page's counting bug. */}
        <p className="mt-1 text-muted-foreground dark:text-neutral-400">
          {total} {total === 1 ? t("resultLabel") : t("resultsLabel")}
        </p>
      </div>

      {/* Places first: someone typing a restaurant's name wants the
          restaurant, and its dishes are directly underneath. */}
      {places.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-foreground dark:text-neutral-50">
            {t("placesSectionTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {places.map((place) => (
              <VendorCard
                key={place.id ?? place.userId}
                vendor={place}
                userCoords={placeCoords}
              />
            ))}
          </div>
        </section>
      )}

      {hits.length === 0 && places.length === 0 ? (
        <div className="py-16 text-center">
          <SearchX
            className="mx-auto h-10 w-10 text-gray-300 dark:text-neutral-600"
            aria-hidden="true"
          />
          <p className="mt-4 font-semibold text-foreground dark:text-neutral-50">
            {t("noResultsFound")}
          </p>
          {/* Says which criteria produced the emptiness. With single-select
              cuisine (§1.2) an over-narrow filter is the likelier cause than a
              genuinely missing dish, so both are named. */}
          <p className="mt-1 text-sm text-muted-foreground dark:text-neutral-400">
            {query && <>&ldquo;{query}&rdquo;</>}
            {query && cuisineLabel && " · "}
            {cuisineLabel}
          </p>
          <p className="mt-3 text-sm text-muted-foreground dark:text-neutral-400">
            {t("noResultsHint")}
          </p>
          {/* Meilisearch matches word *prefixes*: "izza" finds nothing, though
              "Pizza" is right there. A user who types into the middle of a word
              otherwise concludes the catalogue is empty rather than that the
              search works differently than they assumed. Held back until the
              query is long enough that a typo is the less likely explanation. */}
          {query.length >= PREFIX_HINT_MIN_LENGTH && (
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground dark:text-neutral-400">
              {t("prefixMatchHint")}
            </p>
          )}
        </div>
      ) : hits.length === 0 ? null : (
        <>
          {places.length > 0 && (
            <h2 className="mb-4 text-xl font-bold text-foreground dark:text-neutral-50">
              {t("dishesSectionTitle")}
            </h2>
          )}
          <ResultsGrid>
            {hits.map((hit) => (
              <DishCard
                key={hit.id}
                hit={hit}
                onOpen={openHit}
                onPrefetch={(target) => {
                  if (!target.restaurantId) prefetch(target.productId);
                }}
                onShareData={shareDataFor}
                busy={openingProductId === hit.productId}
              />
            ))}
          </ResultsGrid>

          {/* Explicit, not an intersection observer: with a real total on hand
              a button is honest about there being more, and it never spends a
              request the user did not ask for against the 100/60s budget. */}
          {hasNextPage && (
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-2xl font-semibold shadow-sm"
              >
                {isFetchingNextPage ? t("loading") : t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
