"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import type { DotLottie } from "@lottiefiles/dotlottie-react";
import { Button } from "@/components/ui/button";
import {
  DotLottieReact,
  holdLastFrameIfReduced,
} from "@/components/orders/TrackOrder/OrderStatusAnimation";

/**
 * One card for every payment outcome screen (8 Oct 2026): confirmed, still
 * confirming, failed, cancelled, not found. Same frame, a tinted icon per tone,
 * one main action and quieter secondary ones — so the customer always sees a
 * single clear next step. Text arrives translated; this file holds no copy.
 */
type Tone = "success" | "pending" | "error" | "neutral";

export type PaymentStateAction = {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
};

type Props = {
  tone: Tone;
  icon: LucideIcon;
  /** Spins the icon (checking states). */
  iconSpinning?: boolean;
  /**
   * A file in `public/animations/` (no extension) played once in place of the
   * icon — the success screen's "order placed" (26 Oct 2026). The icon stays
   * the fallback while the player loads.
   */
  animation?: string;
  title: string;
  body?: ReactNode;
  /** Extra content under the text: steps, an order number. */
  children?: ReactNode;
  primary?: PaymentStateAction;
  secondary?: PaymentStateAction[];
  /** The checkout id, small, for support. */
  reference?: string | null;
  referenceLabel?: string;
};

const TONES: Record<Tone, { circle: string; icon: string }> = {
  success: {
    circle: "bg-green-50 ring-green-500/10 dark:bg-green-950/30",
    icon: "text-green-600 dark:text-green-400",
  },
  pending: {
    circle: "bg-[#fff0f5] ring-primary/5 dark:bg-pink-950/30",
    icon: "text-primary dark:text-pink-400",
  },
  error: {
    circle: "bg-red-50 ring-red-500/10 dark:bg-red-950/30",
    icon: "text-red-600 dark:text-red-400",
  },
  neutral: {
    circle: "bg-gray-100 ring-gray-500/5 dark:bg-neutral-800",
    icon: "text-gray-600 dark:text-neutral-300",
  },
};

export default function PaymentStateCard({
  tone,
  icon: Icon,
  iconSpinning = false,
  animation,
  title,
  body,
  children,
  primary,
  secondary = [],
  reference,
  referenceLabel,
}: Props) {
  const colors = TONES[tone];
  // The player and its engine load on first use; until the animation is ready
  // the tick shows in its place, so the screen is never an empty gap.
  const [animationReady, setAnimationReady] = useState(false);
  const onPlayer = useCallback((player: DotLottie | null) => {
    holdLastFrameIfReduced(player);
    player?.addEventListener("load", () => setAnimationReady(true));
  }, []);
  const iconCircle = (
    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-8 ${colors.circle}`}>
      <Icon className={`h-8 w-8 ${colors.icon} ${iconSpinning ? "animate-spin" : ""}`} />
    </div>
  );
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-md sm:p-8"
      >
        {animation ? (
          <div className="relative mx-auto aspect-square w-full max-w-48" aria-hidden="true">
            {!animationReady && (
              <div className="absolute inset-0 flex items-center justify-center">{iconCircle}</div>
            )}
            <DotLottieReact
              src={`/animations/${animation}.lottie`}
              autoplay
              dotLottieRefCallback={onPlayer}
              className={`h-full w-full transition-opacity duration-300 ${animationReady ? "opacity-100" : "opacity-0"}`}
            />
          </div>
        ) : (
          iconCircle
        )}

        <h1 className="mt-6 text-xl font-bold text-gray-900 dark:text-neutral-50">{title}</h1>
        {body ? (
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">{body}</p>
        ) : null}

        {children ? <div className="mt-6">{children}</div> : null}

        {(primary || secondary.length > 0) && (
          <div className="mt-6 flex flex-col gap-2">
            {primary ? (
              <Button
                size="lg"
                onClick={primary.onClick}
                disabled={primary.disabled}
                className="cart-cta relative w-full gap-2 overflow-hidden font-semibold"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {primary.label}
                  {primary.icon ? <primary.icon className="h-5 w-5" /> : null}
                </span>
              </Button>
            ) : null}
            {secondary.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                onClick={action.onClick}
                disabled={action.disabled}
                className="w-full gap-2 font-semibold text-gray-600 hover:text-primary dark:text-neutral-400 dark:hover:text-pink-400"
              >
                {action.icon ? <action.icon className="h-4 w-4" /> : null}
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {reference ? (
          <p className="mt-6 break-all text-xs text-gray-400 dark:text-neutral-500">
            {referenceLabel}: {reference}
          </p>
        ) : null}
      </div>
    </div>
  );
}
