import Image from "next/image";

/**
 * The DeliGo logo, in the one presentation that suits the surface behind it.
 *
 * The artwork is an app-icon style tile whose field is the brand pink
 * (#F9186B) — the colour is part of the mark, not a backdrop we supply. So it
 * needs no white plate on white or dark surfaces (it clears 3.9:1 and 4.6:1
 * respectively on its own); wrapping it in one frames a container inside a
 * container and reads as a sticker rather than the logo.
 *
 * The one case the tile genuinely cannot handle is a brand-pink background —
 * pink on pink measures 1.01:1, invisible. That is what the white plates
 * around the site were working around. `variant="mark"` is the proper answer:
 * the same artwork with the pink field lifted out, so the white mark sits
 * directly on the gradient with nothing boxed around it.
 */
type LogoVariant = "tile" | "mark";

// Intrinsic pixel dimensions of each asset. The mark is cropped flush to the
// glyph — any leftover canvas would be invisible padding that silently widens
// whatever gap the logo sits in.
const ASSETS: Record<LogoVariant, { src: string; w: number; h: number }> = {
  tile: { src: "/deligo-logo.png", w: 120, h: 120 },
  mark: { src: "/deligo-mark-white.png", w: 94, h: 67 },
};

export default function Logo({
  size,
  variant = "tile",
  className = "",
  priority = false,
  alt = "DeliGo",
}: {
  /**
   * Rendered width in px; height follows the asset's aspect ratio. The sources
   * are 120px and 94px wide, so going far above that will soften.
   *
   * When overriding the size in CSS, set the width only (`w-24 h-auto`) — the
   * mark is 94x67, and forcing a square box on it distorts the glyph.
   */
  size: number;
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
  /** Pass "" where the logo is decorative and the surrounding text names it. */
  alt?: string;
}) {
  const asset = ASSETS[variant];
  return (
    <Image
      src={asset.src}
      alt={alt}
      width={size}
      height={Math.round((size * asset.h) / asset.w)}
      priority={priority}
      // A percentage radius keeps the tile the same shape at every size, so the
      // navbar mark and the footer mark are recognisably one thing. The
      // knockout has no field to round.
      className={[variant === "tile" ? "rounded-[22%]" : "", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
