"use client";

import { useSyncExternalStore } from "react";
import { getAccessToken } from "@/lib/authCookies";

/**
 * Whether there is a signed-in customer, safe to read during render.
 *
 * The token lives in a cookie, which the server cannot see and the client can.
 * Reading it during the first render would make the two paints disagree and
 * throw a hydration error, so this reports `false` on the server and on the
 * first client render, then the truth.
 *
 * `useSyncExternalStore` with a no-op subscribe rather than an effect: the repo
 * forbids state-syncing effects, and this is exactly the "value that is
 * different after mount" case the hook exists for.
 *
 * It is a snapshot, not a subscription — nothing re-runs when the cookie
 * changes. That is fine for gating a query or a click, and would not be for a
 * live session indicator.
 *
 * The same three lines were inline in `SearchContent`, `PaymentMethods` and
 * every Help Center screen before this; those older call sites still have their
 * own copies and can adopt this when they are next touched.
 */
export function useAuthed(): boolean {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return mounted && !!getAccessToken();
}
