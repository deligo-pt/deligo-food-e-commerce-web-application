"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { isOptimizableImageHost } from "@/lib/imageHosts";

// Sensible default for a responsive card image in a 1/2/3-column grid.
const DEFAULT_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";

/**
 * Fills its (relative, sized) parent with a remote image, but falls back to a
 * themed icon box when the URL is missing or the image fails to load — so a
 * broken/absent image never renders as raw `alt` text.
 *
 * Always pass `sizes` matching the rendered box (e.g. a fixed `"96px"` thumb or
 * a responsive grid cell); it defaults to a 1/2/3-column card so mobile never
 * downloads a desktop-width image.
 *
 * A host `next.config.ts` doesn't know about is served unoptimized rather than
 * optimized: `next/image` *throws* on those during render, which the `onError`
 * fallback below never sees because the component never mounts — the error
 * boundary eats the whole route instead. See `@/lib/imageHosts`.
 */
export default function SafeImage({
  src,
  alt,
  priority,
  sizes = DEFAULT_SIZES,
  className = "object-cover",
  fallbackIcon,
  onSettled,
  dataLoaded,
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  fallbackIcon: ReactNode;
  /**
   * Called once the image has either decoded or failed — the signal a
   * placeholder needs in order to get out of the way.
   *
   * One callback for both outcomes on purpose. A caller holding a shimmer up
   * until the picture arrives has to be told when it is *not* going to arrive,
   * or it shimmers forever, which reads as a hang rather than as a missing
   * image. The two cases are distinguishable from the render — the fallback
   * icon is on screen — so a second callback would buy nothing.
   *
   * Fires immediately for a missing `src`, where the fallback is the final
   * state from the first frame.
   */
  onSettled?: () => void;
  /**
   * Mirrored onto the `<img>` as `data-loaded`, for a caller whose CSS keys a
   * reveal off it (`.motion-image-in`). Passed rather than tracked here because
   * the placeholder and the image are two elements and one state; owning it in
   * the caller keeps them from disagreeing.
   */
  dataLoaded?: boolean;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        role="img"
        aria-label={alt}
        // A ref callback rather than an effect: this branch is also reached on
        // the very first render when `src` is absent, and the repo forbids
        // state-syncing effects. `onSettled` is expected to be idempotent —
        // the caller's is a set-once flag.
        ref={onSettled ? () => void onSettled() : undefined}
        className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-300 dark:text-neutral-600"
      >
        {fallbackIcon}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      unoptimized={!isOptimizableImageHost(src)}
      data-loaded={dataLoaded}
      onLoad={onSettled}
      onError={() => {
        setErrored(true);
        // The fallback branch above calls this too, on the render that follows.
        // Calling it here as well means a caller that only wants "stop waiting"
        // is told at the moment of failure rather than one render later.
        onSettled?.();
      }}
      className={className}
    />
  );
}
