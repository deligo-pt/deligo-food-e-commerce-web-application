"use client";

import dynamic from "next/dynamic";
import type { DotLottie } from "@lottiefiles/dotlottie-react";
import { toTimelineStatus } from "@/lib/orderTimeline";

/**
 * The player is client-only (it draws to a canvas) and loads its WASM engine
 * on first use, so it is split out of the page bundle and never server-rendered.
 * The placeholder holds the same square, so nothing shifts when it arrives.
 */
const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false, loading: () => <div className="h-full w-full" /> },
);

/**
 * One animation per order status (17 Oct 2026, the owner's mapping). Files live
 * in `public/animations/`.
 *
 * `PICKED_UP` / `ON_THE_WAY` normally show the live map with the rider moving
 * instead — `TrackOrder` only renders this for them until the rider's location
 * arrives, so the card is never an empty map.
 */
const STATUS_ANIMATION: Record<string, string> = {
  PENDING: "order-placed",
  ACCEPTED: "order-accepted",
  PREPARING: "order-preparing",
  READY_FOR_PICKUP: "order-ready",
  // After PREPARING while the system looks for a rider (seen live as
  // PREPARING → DISPATCHING → AWAITING_PARTNER): the order is waiting to be
  // collected, which is what "ready" shows.
  DISPATCHING: "order-ready",
  AWAITING_PARTNER: "order-ready",
  PICKED_UP: "order-on-the-way",
  ON_THE_WAY: "order-on-the-way",
  DELIVERED: "order-delivered",
  PICKED_UP_BY_CUSTOMER: "order-delivered",
  REJECTED: "order-error",
  CANCELLED: "order-error",
  // A pickup order nobody came for.
  NO_SHOW: "order-error",
};

/** The file for a raw backend status; an unknown one falls back to "placed". */
export function orderAnimationFor(status: string | null | undefined): string {
  return STATUS_ANIMATION[toTimelineStatus(status)] ?? "order-placed";
}

/**
 * With reduced motion the animation does not play; it rests on its last frame,
 * which is the finished picture (the first frame of several is still empty).
 */
function holdLastFrameIfReduced(player: DotLottie | null) {
  if (!player || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  player.addEventListener("load", () => {
    player.pause();
    player.setFrame(Math.max(player.totalFrames - 1, 0));
  });
}

export default function OrderStatusAnimation({
  status,
  label,
  description,
}: {
  status: string | null | undefined;
  /** The current step's own label and line, as the timeline shows them. */
  label: string;
  description: string;
}) {
  const file = orderAnimationFor(status);
  return (
    // The map's footprint, so swapping between the two at PICKED_UP keeps the
    // left column the same height beside the fixed-height timeline.
    <div
      className="relative flex h-100 md:h-125 w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-4xl bg-primary/5 px-6 shadow-xl dark:bg-pink-950/20"
      data-order-animation={file}
    >
      <div className="aspect-square w-full max-w-64 md:max-w-80" aria-hidden="true">
        <DotLottieReact
          // Keyed on the file so a status change starts the new animation
          // from its first frame instead of reusing the old player.
          key={file}
          src={`/animations/${file}.lottie`}
          loop
          autoplay
          dotLottieRefCallback={holdLastFrameIfReduced}
          className="h-full w-full"
        />
      </div>
      <div className="max-w-sm text-center" aria-live="polite">
        <p className="text-xl font-bold text-foreground dark:text-neutral-50">{label}</p>
        {description ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground dark:text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
