"use client";

import { useMemo } from "react";
import { useActiveAddressCoords } from "@/hooks/queries/useProfile";
import { useLocationStore } from "@/stores/locationStore";
import { pickCoords, type Coords } from "@/lib/customerCoords";

/**
 * The customer's position, gathered from the three places the app keeps it.
 *
 * The order lives in `lib/customerCoords.ts` with the reasoning; this hook only
 * reads the sources. Kept apart from that module so the rules stay pure and
 * testable, and so a component cannot accidentally reach for one source and
 * miss the other two — which is how `SearchContent` ended up with a private
 * copy of this chain.
 *
 * Returns `null` when the app genuinely does not know where the customer is.
 * That is not an error: it is the case the calling screen has to handle, since
 * the endpoints that need coordinates answer 400 without them.
 */
export function useCustomerCoords(): Coords | null {
  const addressCoords = useActiveAddressCoords();
  const storedCoords = useLocationStore((s) => s.coords);
  const guestAddress = useLocationStore((s) => s.guestAddress);

  return useMemo(
    () => pickCoords(addressCoords, storedCoords, guestAddress),
    [addressCoords, storedCoords, guestAddress],
  );
}
