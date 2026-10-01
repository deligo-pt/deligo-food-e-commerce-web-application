"use client";

import type { ReactNode } from "react";
import SafeImage from "@/components/shared/SafeImage";
import { useProductImageIndex } from "@/hooks/queries/useProductImageIndex";
import type { Coords } from "@/lib/customerCoords";

/** DeliGo's own picture, for a product whose picture cannot be found at all. */
export const DEFAULT_PRODUCT_IMAGE = "/images/default-product.png";

/**
 * A product's picture on a screen whose payload may not carry one — search
 * results, cart, checkout, payment and orders.
 *
 * 1. The payload's own picture (`src`), when it has one — no extra request.
 * 2. Otherwise the picture from the store's menu (`useProductImageIndex`),
 *    found by product id. This is the stopgap for the backend copying only
 *    `product.image` into these payloads; see that hook.
 * 3. Otherwise, or if the picture fails to load, the DeliGo default picture.
 *    The icon is the last resort, if even that fails.
 */
export default function ProductImage({
  src,
  productIds,
  vendorId,
  place,
  alt,
  sizes,
  fallbackIcon,
  className,
}: {
  src?: string | null;
  /** Every id the screen holds for the product — `_id` and/or `PROD-…`. */
  productIds: readonly (string | null | undefined)[];
  /** The store the product belongs to; the lookup reads its menu. */
  vendorId?: string | null;
  /** The store's position, when the payload has it (a search hit's `_geo`). */
  place?: Coords | null;
  alt: string;
  sizes?: string;
  fallbackIcon: ReactNode;
  className?: string;
}) {
  const own = src?.trim() || null;
  const { data: index, isFetched } = useProductImageIndex(vendorId, {
    enabled: !own,
    place,
  });
  const found = own ? null : productIds.map((id) => (id ? index?.get(id) : undefined)).find(Boolean);
  const resolved = own ?? found ?? null;

  // While the store's menu is loading, keep the neutral placeholder rather
  // than flashing the default picture and then swapping it out.
  const settledWithout = !own && (isFetched || !vendorId) && !found;

  return (
    <SafeImage
      // A new picture is a new attempt: `SafeImage` remembers a failure.
      key={resolved ?? "none"}
      src={resolved}
      alt={alt}
      sizes={sizes}
      className={className}
      fallbackIcon={fallbackIcon}
      fallbackSrc={own || found || settledWithout ? DEFAULT_PRODUCT_IMAGE : undefined}
    />
  );
}
