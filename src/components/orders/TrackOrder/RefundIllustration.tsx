import Image from "next/image";

/**
 * The money-bag artwork the mobile app shows above "Refund In Progress",
 * shipped as `public/refund.png` so web and mobile use the same picture.
 *
 * The file is fully opaque with a white background, so it sits on an explicit
 * white tile rather than the banner's own surface — invisible in light mode,
 * and in dark mode a deliberate plate instead of a bare white rectangle
 * butting up against the card.
 *
 * Decorative: the banner's heading and description carry the meaning, so the
 * alt text is empty and it is hidden from assistive tech.
 */
export default function RefundIllustration({
  // The image sizes itself off the tile, so the default has to set a height —
  // an empty className would render it at its intrinsic 670px.
  className = "h-20",
}: {
  className?: string;
}) {
  return (
    <div className={`shrink-0 overflow-hidden rounded-2xl bg-white ${className}`}>
      <Image
        src="/refund.png"
        alt=""
        aria-hidden="true"
        width={670}
        height={570}
        priority={false}
        className="h-full w-auto object-contain"
      />
    </div>
  );
}
