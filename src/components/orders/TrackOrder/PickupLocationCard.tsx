"use client";

import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatAddressFull } from "@/lib/addressFormat";

interface StoreLocation {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  detailedAddress?: string;
  latitude?: number;
  longitude?: number;
}

interface PickupLocationCardProps {
  storeName: string;
  location: StoreLocation | null;
}

/**
 * Where to go to collect the order — the pickup order's replacement for the
 * live delivery map.
 *
 * `OrderMap` exists to draw a restaurant→customer route and follow a rider
 * along it. A pickup order has no rider and no customer pin: the API sends no
 * `deliveryAddress`, no `pickupAddress`, and the order's embedded vendor has no
 * `businessLocation`. Given all-undefined coordinates the map fell back to its
 * hardcoded default and centred a Portuguese order on rural Bangladesh, which
 * is worse than no map at all.
 *
 * So this card answers the only question a collecting customer actually has —
 * where is the shop — and hands off to a real maps app for directions rather
 * than embedding a map that cannot show a route.
 */
export default function PickupLocationCard({
  storeName,
  location,
}: PickupLocationCardProps) {
  const { t } = useTranslation();

  const address = location ? formatAddressFull(location) : "";
  const hasCoordinates =
    typeof location?.latitude === "number" &&
    typeof location?.longitude === "number";

  // Prefer coordinates over the formatted address: they resolve to the exact
  // door, whereas a text search can land on a different branch of the same
  // chain. Falls back to the address when the store has no coordinates.
  const directionsQuery = hasCoordinates
    ? `${location!.latitude},${location!.longitude}`
    : address;

  const directionsUrl = directionsQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsQuery)}`
    : null;

  return (
    <div className="rounded-3xl border border-transparent bg-white p-6 shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ffd9de] dark:bg-pink-950/30">
          <MapPin className="h-6 w-6 text-primary dark:text-pink-400" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground dark:text-neutral-400">
            {t("collectFrom")}
          </p>
          <h3 className="text-xl font-bold break-words text-foreground dark:text-neutral-50">
            {storeName}
          </h3>
          {/* An empty string rather than a placeholder when the vendor lookup
              has not resolved: inventing "address unavailable" would be copy
              about our own loading state, not about the store. */}
          {address && (
            <p className="text-sm font-semibold leading-relaxed break-words text-muted-foreground dark:text-neutral-400">
              {address}
            </p>
          )}
        </div>
      </div>

      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          <Navigation className="h-4 w-4" />
          {t("getDirections")}
          <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
      )}
    </div>
  );
}
