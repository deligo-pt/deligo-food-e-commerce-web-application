"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";

/**
 * The store's banner, with the homepage banner's arrival.
 *
 * ## Why this is its own file
 *
 * It carries `motion-image-in`, which scales, and §11's denylist bars a
 * transform from any file that renders a price — `VendorDetailsPage` renders
 * sixteen. The rule is file-scoped because element-scoping is not checkable
 * from source, and that coarseness is doing its job here rather than getting in
 * the way: the honest way to satisfy it is to put the transform somewhere there
 * is no price to move, not to carve out an exception.
 *
 * So this is a real boundary, not a formality. Nothing that renders money
 * belongs in this file.
 *
 * ## What it does
 *
 * The same two halves as `HeroSection`: a placeholder holds the frame until the
 * artwork has actually decoded, then dissolves while the picture resolves out
 * of a blur. Same caveat as there — it is a reveal, not a blur-up. Nothing
 * appears earlier than it did; the arrival is softened. A true blur-up needs a
 * `blurDataURL` on the vendor's `storePhoto`, which the API does not send.
 *
 * ## The floor sits under the furniture, unlike the homepage's
 *
 * On the homepage the floor covers the sponsor pill, because the placeholder
 * draws a fake pill in the same corner and a real label over a fake one gives
 * the handover away. Here the things over the banner — the closed badge, the
 * panel with the store's name and rating — are *real content that has already
 * arrived*. Covering them would hide data the customer could be reading in
 * order to hide an image they cannot. So this renders as a fragment and the
 * page keeps them stacked above it in document order.
 */
export default function VendorHeroImage({
  src,
  alt,
  dimmed = false,
}: {
  src?: string | null;
  alt: string;
  /** The store is closed, so the photo is greyed out to match its card. */
  dimmed?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <SafeImage
        src={src}
        alt={alt}
        priority
        sizes="100vw"
        dataLoaded={loaded}
        // Fires on decode, on failure, and immediately when there is no photo
        // at all — the fallback icon is the final state in that last case, and
        // a floor left shimmering over it would read as a hang.
        onSettled={() => setLoaded(true)}
        className={`motion-image-in object-cover ${dimmed ? "grayscale" : ""}`}
        fallbackIcon={<Store className="h-14 w-14" />}
      />
      <div
        aria-hidden
        data-loaded={loaded}
        className="motion-image-floor pointer-events-none absolute inset-0"
      >
        {/* `animate-pulse` animates opacity and so does the floor's fade; on one
            element the animation wins outright and the floor never dissolves. */}
        <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-neutral-800" />
      </div>
    </>
  );
}
