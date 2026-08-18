"use client";

import { useInfiniteQuery, keepPreviousData, type InfiniteData } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useStore } from "@/stores/translationStore";
import {
  buildSearchParams,
  nextSearchOffset,
  MIN_SEARCH_TERM_LENGTH,
  SEARCH_PAGE_SIZE,
  type SearchHit,
  type SearchParams,
  type SearchResponse,
} from "@/lib/search";

export const searchKeys = {
  all: ["search"] as const,
  /**
   * Keyed by language — `name` and `cuisine` come back server-localized, so the
   * same query in `pt` is a genuinely different result set — and by the
   * canonical query string from `buildSearchParams`, which is deterministic for
   * a given input precisely so it can be used here. `offset` is excluded: it
   * identifies a page within this key, not a different query.
   */
  results: (lang: string, query: string) =>
    ["search", "results", lang, query] as const,
};

/**
 * Paged results from `GET /search`.
 *
 * ## Why an infinite query
 *
 * The endpoint pages by `offset`/`limit` and reports the real total separately
 * as `estimatedTotalHits`, so pages accumulate rather than replace. Phase 3
 * renders a "Load more" button over this rather than an auto-firing scroll
 * observer — with a real total on hand, an explicit control is honest about
 * there being more and never spends requests the user did not ask for.
 *
 * ## What this hook does not do
 *
 * It does not filter, sort, or trim what comes back. Every one of those is a
 * query parameter, assembled by `buildSearchParams`. The hook's only jobs are
 * paging, cancellation, and defending against a malformed envelope.
 *
 * ## Headers
 *
 * Both headers this endpoint cares about are already handled by `apiClient`'s
 * request interceptor: `Accept-Language` from `translationStore` (the selected
 * language, which is what the guide asks for — not the device locale), and
 * `Authorization` only when a token cookie exists. That second part is what
 * makes signed-out search work with no special-casing here. `GET /search` is
 * public but also accepts a token, so neither branch needs an exception.
 *
 * ## Cancellation
 *
 * TanStack's `signal` is handed to axios, so a superseded query aborts in
 * flight. That is what keeps a slow response for an old keystroke from
 * overwriting a newer one — a real defect in the page this replaces — and it is
 * what keeps a fast typist inside the API's 100-requests-per-60s budget.
 */
export function useSearch(
  params: SearchParams = {},
  options?: { enabled?: boolean },
) {
  const lang = useStore((s) => s.lang);

  // `offset` is supplied per page by `pageParam`, so a caller's is overwritten
  // rather than merged — the two can never disagree. `undefined` is dropped by
  // `buildSearchParams` along with every other non-finite value.
  const limit = params.limit ?? SEARCH_PAGE_SIZE;
  const pageless: SearchParams = { ...params, limit, offset: undefined };

  // Below the minimum a query is mostly noise — "p" alone matches 15 of 18
  // items. An *empty* term is not too short: it means "browse everything",
  // which is a legitimate request when only filters are set.
  const term = params.searchTerm?.trim() ?? "";
  const termTooShort = term.length > 0 && term.length < MIN_SEARCH_TERM_LENGTH;

  return useInfiniteQuery({
    queryKey: searchKeys.results(lang, buildSearchParams(pageless).toString()),
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const res = await apiClient.get("/search", {
        params: buildSearchParams({ ...pageless, offset: pageParam }),
        signal,
      });

      const raw = res.data?.data;

      // The envelope is normalized rather than trusted: a missing `hits` would
      // otherwise throw inside `getNextPageParam` and lose the whole page, and
      // `offset` falling back to `pageParam` is what keeps paging terminating
      // even if the server ever stops echoing it.
      return {
        hits: Array.isArray(raw?.hits) ? (raw.hits as SearchHit[]) : [],
        query: typeof raw?.query === "string" ? raw.query : term,
        processingTimeMs: raw?.processingTimeMs ?? 0,
        limit: raw?.limit ?? limit,
        offset: raw?.offset ?? pageParam,
        estimatedTotalHits: raw?.estimatedTotalHits ?? 0,
      } satisfies SearchResponse;
    },
    getNextPageParam: nextSearchOffset,
    enabled: (options?.enabled ?? true) && !termTooShort,
    placeholderData: keepPreviousData,
  });
}

/**
 * Every hit loaded so far, in server order.
 *
 * Concatenation only — the pages arrive ranked and are rendered in that order.
 * Nothing here re-sorts or de-duplicates: two restaurants selling a dish of the
 * same name are two results, and the server is the one that decided so.
 */
export function flattenSearchHits(
  data: InfiniteData<SearchResponse> | undefined,
): SearchHit[] {
  return data?.pages.flatMap((page) => page.hits) ?? [];
}

/**
 * The number to put in "N results" — the server's `estimatedTotalHits`, not how
 * many rows happen to be on screen.
 *
 * Read from the newest page: it is the same figure on every page, and taking
 * the last one means a filter change reflected in a fresh first page wins over
 * a stale accumulated one.
 */
export function searchTotal(
  data: InfiniteData<SearchResponse> | undefined,
): number {
  return data?.pages.at(-1)?.estimatedTotalHits ?? 0;
}
