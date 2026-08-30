"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UtensilsCrossed, SearchX } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
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
 * ## Dish results only
 *
 * The index is `food_items`; there are no restaurant documents to match, so the
 * old "Places" section is gone (§1.1). Searching a restaurant by name returns
 * its dishes — which is why every card names its restaurant.
 *
 * ## Not yet interactive
 *
 * Cards render as `<article>`, not links. A hit's `restaurantId` is a Mongo
 * `_id` that our `/vendors/:userId` routes 404 on, so a destination has to be
 * resolved from `productId` — that is Phase 5's job, along with the signed-out
 * prompt. Shipping a link that 404s in the meantime would be worse than
 * shipping none.
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
  busy,
}: {
  hit: SearchHit;
  onOpen: (hit: SearchHit) => void;
  onPrefetch: (hit: SearchHit) => void;
  busy: boolean;
}) {
  const cuisines = hit.cuisine?.map(formatCuisineLabel).filter(Boolean) ?? [];

  return (
    <article
      role="button"
      tabIndex={0}
      aria-busy={busy}
      // A hit carries no usable destination — `restaurantId` 404s against our
      // routes — so where this card leads has to be looked up from `productId`.
      // Hovering or tab-focusing starts that lookup, which means the click
      // usually resolves from cache and navigates immediately.
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

  // Click-through. A hit has no usable destination of its own (§0.3), so the
  // vendor is resolved from `productId` — warmed on hover, awaited on click.
  const { resolve, prefetch } = useProductDestination();
  const [openingProductId, setOpeningProductId] = useState<string | null>(null);

  const openHit = useCallback(
    async (hit: SearchHit) => {
      setOpeningProductId(hit.productId);
      try {
        const destination = await resolve(hit.productId);
        // `?product=` opens the menu with this dish's modal already up, so the
        // click lands on the thing that was clicked rather than near it.
        // A closed restaurant is navigated to, not blocked: the vendor page's
        // existing "Currently Closed" treatment is the honest place to say so,
        // and the menu stays browsable there (§0.5).
        router.push(
          `/vendors/${destination.vendorUserId}?product=${encodeURIComponent(hit.productId)}`,
        );
      } catch {
        toast.error(t("failedToOpenItem"));
        setOpeningProductId(null);
      }
    },
    [resolve, router, t],
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
        <div className="py-20 text-center">
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
        <div className="py-20 text-center">
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

      {hits.length === 0 ? (
        <div className="py-20 text-center">
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
      ) : (
        <>
          <ResultsGrid>
            {hits.map((hit) => (
              <DishCard
                key={hit.id}
                hit={hit}
                onOpen={openHit}
                onPrefetch={(target) => prefetch(target.productId)}
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
