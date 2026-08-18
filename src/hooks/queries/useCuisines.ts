"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useStore } from "@/stores/translationStore";

export const cuisineKeys = {
  all: ["cuisines"] as const,
  /** Server-localized `name`, so the language is part of the identity. */
  open: (lang: string) => ["cuisines", "open", lang] as const,
};

/** One entry in the cuisine filter row. */
export interface Cuisine {
  /** The value `?cuisine=` wants — `"indian-food"`. Never the display name. */
  slug: string;
  /** Localized for display — `"INDIAN FOOD"` / `"COMIDA INDIANA"`. */
  name: string;
  imageUrl: string | null;
}

interface RawCuisine {
  slug?: unknown;
  name?: unknown;
  imageUrl?: unknown;
}

/**
 * The cuisines the search filter offers, from `GET /categories/cuisine/open`.
 *
 * ## Why this endpoint
 *
 * `Customer_Search.md` says to "ask backend for the current list of valid
 * cuisine slugs", and the guide does not mention that an endpoint for it
 * already exists. It does, it is public, and it honours `Accept-Language`,
 * returning both halves of the pair that the guide's sharpest pitfall is about:
 *
 * > `cuisine` in the response is display text, `?cuisine=` in the request is a
 * > slug — they're deliberately different values; don't feed one back into the
 * > other.
 *
 * Taking both from the same object is what makes that mistake unavailable. A
 * hardcoded list would have to be kept in step with the backend by hand and
 * would silently 0-hit the day a cuisine is renamed, because an unknown slug
 * returns an empty result rather than an error.
 *
 * ## Caching
 *
 * The catalogue changes on the order of never, so an hour of `staleTime` avoids
 * refetching a fixed list on every visit to the search page. Keyed by language;
 * `keepPreviousData` holds the chips in place through a language switch instead
 * of collapsing the filter row.
 */
export function useCuisines(options?: { enabled?: boolean }) {
  const lang = useStore((s) => s.lang);

  return useQuery({
    queryKey: cuisineKeys.open(lang),
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/categories/cuisine/open", {
        // The catalogue is 7 entries; this is headroom, not pagination.
        params: { limit: 100 },
        signal,
      });

      const raw = (res.data?.data ?? []) as RawCuisine[];

      // Entries without both halves are dropped — a chip with no slug cannot
      // filter and a chip with no label cannot be read. This is malformed-record
      // defence, not a business filter: the `/open` endpoint has already decided
      // which cuisines are live, and that judgement is not second-guessed here.
      return raw.reduce<Cuisine[]>((list, item) => {
        const slug = typeof item.slug === "string" ? item.slug.trim() : "";
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (slug && name) {
          list.push({
            slug,
            name,
            imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
          });
        }
        return list;
      }, []);
    },
    enabled: options?.enabled ?? true,
    staleTime: 60 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
