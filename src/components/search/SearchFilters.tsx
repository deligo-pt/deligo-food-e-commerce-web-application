"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useCuisines } from "@/hooks/queries/useCuisines";
import { formatCuisineLabel } from "@/lib/search";

/**
 * The filter and sort controls above the search results.
 *
 * See `Plan.md` → "Customer Search — Implementation Plan", Phase 4.
 *
 * ## Every control is a query parameter
 *
 * Nothing here narrows a list that has already been fetched. Each control
 * writes to the URL, `SearchContent` reads the URL, and `useSearch` turns that
 * into `?cuisine=`, `?sortBy=`, `?minPrice=` and so on. The backend decides what
 * comes back; this component only decides what to ask for.
 *
 * That is also why changing anything resets paging: a filter change is a
 * different query, not a different page of the same one.
 *
 * ## Why coordinates are not in the URL
 *
 * The plan called for filter state to live in the URL so a search is shareable,
 * and it does — except the "near me" radius, where only the *radius* is stored
 * and the coordinates are resolved per viewer at render time. A shared link then
 * means "within 5km of you", which is both the useful reading and the one that
 * does not put someone's home coordinates in a URL they paste into a chat.
 */

/** Radii offered by the "Near me" control, in metres. */
const RADIUS_CHOICES = [2000, 5000, 10000] as const;

/** The sort options, and the parameters each one sends. */
const SORT_OPTIONS = [
  { id: "relevance", labelKey: "sortRelevance", sortBy: null, sortOrder: null },
  { id: "price-asc", labelKey: "sortPriceLowToHigh", sortBy: "price", sortOrder: "asc" },
  { id: "price-desc", labelKey: "sortPriceHighToLow", sortBy: "price", sortOrder: "desc" },
  // Ships because the parameter is real, but it will look inert on test data:
  // every product in the catalogue has `rating: 0` (§7 Q27).
  { id: "rating-desc", labelKey: "sortRatingHighToLow", sortBy: "rating", sortOrder: "desc" },
] as const;

export type SearchFilterValues = {
  cuisine: string;
  sortBy: string | null;
  sortOrder: string | null;
  minPrice: string;
  maxPrice: string;
  radiusInMeters: number | null;
  isAvailable: boolean;
  isHalal: boolean;
};

/** A patch of URL parameters; `null` removes the key. */
export type FilterPatch = Record<string, string | null>;

function Dropdown({
  label,
  active,
  children,
}: {
  label: string;
  active: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
          active
            ? "border-[#f9186b] bg-[#fff1f4] text-[#f9186b] dark:border-pink-600 dark:bg-neutral-800 dark:text-pink-400"
            : "border-[#edeeef] bg-white text-[#191c1d] hover:border-[#ffd9de] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:border-neutral-700"
        }`}
      >
        {label}
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={close}
            aria-hidden="true"
          />
          <div className="absolute left-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-[#edeeef] bg-white py-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
        checked
          ? "border-[#f9186b] bg-[#fff1f4] text-[#f9186b] dark:border-pink-600 dark:bg-neutral-800 dark:text-pink-400"
          : "border-[#edeeef] bg-white text-[#191c1d] hover:border-[#ffd9de] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50 dark:hover:border-neutral-700"
      }`}
    >
      {checked && <Check size={16} />}
      {label}
    </button>
  );
}

export default function SearchFilters({
  values,
  onChange,
  onClear,
  hasCoords,
  onRequestLocation,
  locationDenied,
}: {
  values: SearchFilterValues;
  onChange: (patch: FilterPatch) => void;
  onClear: () => void;
  /** Whether a lat/lng is available at all — from the active address or the browser. */
  hasCoords: boolean;
  onRequestLocation: () => void;
  locationDenied: boolean;
}) {
  const { t } = useTranslation();
  const { data: cuisines = [] } = useCuisines();

  // The price boxes are typed into, so they hold local text and commit on blur
  // or Enter. Committing per keystroke would fire a request per digit — "1",
  // "12", "125" are three different searches, two of them meaningless.
  const [minPrice, setMinPrice] = useState(values.minPrice);
  const [maxPrice, setMaxPrice] = useState(values.maxPrice);

  // Re-sync when the URL changes from outside this component (back/forward, or
  // "Clear filters"). Comparing before setting keeps this from fighting typing.
  const lastCommitted = useRef({ min: values.minPrice, max: values.maxPrice });
  useEffect(() => {
    if (lastCommitted.current.min !== values.minPrice) {
      lastCommitted.current.min = values.minPrice;
      setMinPrice(values.minPrice);
    }
    if (lastCommitted.current.max !== values.maxPrice) {
      lastCommitted.current.max = values.maxPrice;
      setMaxPrice(values.maxPrice);
    }
  }, [values.minPrice, values.maxPrice]);

  const commitPrice = () => {
    lastCommitted.current = { min: minPrice, max: maxPrice };
    onChange({
      minPrice: minPrice.trim() || null,
      maxPrice: maxPrice.trim() || null,
    });
  };

  const activeSort =
    SORT_OPTIONS.find(
      (o) => o.sortBy === values.sortBy && o.sortOrder === values.sortOrder,
    ) ?? SORT_OPTIONS[0];

  const priceActive = !!(values.minPrice || values.maxPrice);
  const radiusActive = values.radiusInMeters !== null;

  const anyActive =
    !!values.cuisine ||
    activeSort.id !== "relevance" ||
    priceActive ||
    radiusActive ||
    values.isAvailable ||
    values.isHalal;

  return (
    <div className="mb-6 space-y-4">
      {/* Cuisine — single-select. The API's `?cuisine=` takes exactly one slug;
          `sushi,kebab` and every other multi-value syntax returns zero hits with
          no error, so offering multi-select would silently show "no results"
          for a perfectly valid pair (§0.4, §1.2). */}
      {cuisines.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group">
          <button
            type="button"
            onClick={() => onChange({ cuisine: null })}
            aria-pressed={!values.cuisine}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              !values.cuisine
                ? "bg-[#f9186b] text-white"
                : "bg-white text-[#191c1d] ring-1 ring-[#edeeef] hover:ring-[#ffd9de] dark:bg-neutral-900 dark:text-neutral-50 dark:ring-neutral-800"
            }`}
          >
            {t("allCuisines")}
          </button>

          {cuisines.map((cuisine) => {
            const selected = values.cuisine === cuisine.slug;
            return (
              <button
                key={cuisine.slug}
                type="button"
                onClick={() =>
                  onChange({ cuisine: selected ? null : cuisine.slug })
                }
                aria-pressed={selected}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selected
                    ? "bg-[#f9186b] text-white"
                    : "bg-white text-[#191c1d] ring-1 ring-[#edeeef] hover:ring-[#ffd9de] dark:bg-neutral-900 dark:text-neutral-50 dark:ring-neutral-800"
                }`}
              >
                {/* `name` from the same object the `slug` came from, so a
                    display string can never be sent as a filter value. */}
                {formatCuisineLabel(cuisine.name)}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Sort. `sortBy` is never sent without an explicit `sortOrder` — the
            server's own default is `desc`, which is wrong for price (§0.2). */}
        <Dropdown
          label={`${t("sortLabel")}: ${t(activeSort.labelKey)}`}
          active={activeSort.id !== "relevance"}
        >
          {(close) => (
            <ul role="listbox">
              {SORT_OPTIONS.map((option) => {
                const selected = option.id === activeSort.id;
                return (
                  <li key={option.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({
                          sortBy: option.sortBy,
                          sortOrder: option.sortOrder,
                        });
                        close();
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-[#fff1f4] dark:hover:bg-neutral-800 ${
                        selected
                          ? "font-bold text-[#f9186b] dark:text-pink-400"
                          : "text-[#191c1d] dark:text-neutral-50"
                      }`}
                    >
                      {t(option.labelKey)}
                      {selected && <Check size={16} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Dropdown>

        <Dropdown label={t("priceLabel")} active={priceActive}>
          {() => (
            <div className="flex items-center gap-2 p-3">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                placeholder={t("priceMin")}
                aria-label={t("priceMin")}
                className="w-full rounded-xl border border-[#edeeef] px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
              />
              <span className="text-[#5a4044] dark:text-neutral-400">–</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                placeholder={t("priceMax")}
                aria-label={t("priceMax")}
                className="w-full rounded-xl border border-[#edeeef] px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
              />
            </div>
          )}
        </Dropdown>

        {/* Near me. The lat/lng/radius triple is all-or-nothing: a partial one
            is silently ignored by the server (§0.2), so with no coordinates the
            radii are not offered at all — the control asks for permission
            instead of pretending to filter. */}
        <Dropdown
          label={
            radiusActive
              ? `${t("nearMe")}: ${(values.radiusInMeters ?? 0) / 1000} km`
              : t("nearMe")
          }
          active={radiusActive}
        >
          {(close) => (
            <div>
              {!hasCoords ? (
                <div className="p-3">
                  <p className="text-sm text-[#5a4044] dark:text-neutral-400">
                    {locationDenied
                      ? t("locationDenied")
                      : t("nearMeUnavailable")}
                  </p>
                  {!locationDenied && (
                    <button
                      type="button"
                      onClick={() => {
                        onRequestLocation();
                        close();
                      }}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f9186b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#d4145b]"
                    >
                      <MapPin size={16} />
                      {t("useMyLocation")}
                    </button>
                  )}
                </div>
              ) : (
                <ul role="listbox">
                  {[null, ...RADIUS_CHOICES].map((radius) => {
                    const selected = values.radiusInMeters === radius;
                    return (
                      <li
                        key={radius ?? "any"}
                        role="option"
                        aria-selected={selected}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onChange({
                              radius: radius === null ? null : String(radius),
                            });
                            close();
                          }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition hover:bg-[#fff1f4] dark:hover:bg-neutral-800 ${
                            selected
                              ? "font-bold text-[#f9186b] dark:text-pink-400"
                              : "text-[#191c1d] dark:text-neutral-50"
                          }`}
                        >
                          {radius === null
                            ? t("anyDistance")
                            : `${radius / 1000} km`}
                          {selected && <Check size={16} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Dropdown>

        {/* "In stock", never "Open now". `isAvailable` is product stock and does
            not exclude closed restaurants (§0.5) — the label must not claim it
            does. */}
        <Toggle
          label={t("inStockOnly")}
          checked={values.isAvailable}
          onChange={(next) => onChange({ available: next ? "1" : null })}
        />

        {/* Restaurant-level certification, which is what the copy says. It is
            not a property of the dish. */}
        <Toggle
          label={t("halalCertifiedRestaurants")}
          checked={values.isHalal}
          onChange={(next) => onChange({ halal: next ? "1" : null })}
        />

        {anyActive && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[#5a4044] transition hover:text-[#f9186b] dark:text-neutral-400 dark:hover:text-pink-400"
          >
            <X size={16} />
            {t("clearFilters")}
          </button>
        )}

        <SlidersHorizontal
          size={16}
          className="order-first text-[#f9186b] dark:text-pink-500"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
