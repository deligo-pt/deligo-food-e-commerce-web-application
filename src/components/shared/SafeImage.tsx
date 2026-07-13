"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

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
 */
export default function SafeImage({
  src,
  alt,
  priority,
  sizes = DEFAULT_SIZES,
  className = "object-cover",
  fallbackIcon,
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  fallbackIcon: ReactNode;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        role="img"
        aria-label={alt}
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
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
