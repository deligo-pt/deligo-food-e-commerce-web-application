"use client";

import { useState } from "react";
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Single source of truth for server state. Deduplicates identical in-flight
// requests, caches responses (so navigation reads from cache instead of
// re-hitting the API), cancels stale requests, and self-heals 429 rate-limits
// with backoff. See Light_plan.md → Phase 1.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Catalog/profile data stays "fresh" for a minute — same-session
        // navigation serves from cache with no refetch.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = axios.isAxiosError(error)
            ? error.response?.status
            : undefined;
          // Never retry client errors — except 429 (rate limit), which is
          // transient and should back off and try again.
          if (status && status >= 400 && status < 500 && status !== 429) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attempt, error) => {
          // Honour the server's Retry-After header on 429; otherwise use
          // capped exponential backoff.
          const retryAfterRaw = axios.isAxiosError(error)
            ? error.response?.headers?.["retry-after"]
            : undefined;
          const retryAfter = Number(retryAfterRaw);
          if (Number.isFinite(retryAfter) && retryAfter > 0) {
            return retryAfter * 1000;
          }
          return Math.min(1000 * 2 ** attempt, 30_000);
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always a fresh client so requests never leak between users.
    return makeQueryClient();
  }
  // Browser: reuse a single client across the app's lifetime.
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV !== "production" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
