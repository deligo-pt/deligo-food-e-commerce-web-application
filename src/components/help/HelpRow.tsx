"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * Tints for the icon circle.
 *
 * Per-row rather than uniform, because the app's Contact Support list is the
 * one place in this product that is not all pink: chat is pink, mail is blue,
 * phone is green. The Browse Topics rows below it are pink throughout, so
 * `pink` is the default and the other two are the exception they look like.
 */
const TINTS = {
  pink: "bg-primary/5 text-primary dark:bg-pink-950/40 dark:text-pink-400",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
} as const;

export interface HelpRowProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  tint?: keyof typeof TINTS;
  /** Internal route, or a `mailto:`/`tel:` target. */
  href?: string | null;
  onClick?: () => void;
  /** Unread count. `0` or absent renders nothing — never a "0" pill. */
  badge?: number;
}

const SHELL =
  "group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md dark:hover:border-pink-500/30 dark:hover:shadow-none";

/**
 * One tappable row: tinted icon circle, title, description, chevron.
 *
 * The app draws Contact Support, Browse Topics, the payment topics and the
 * Manage Account actions identically, so they share this rather than four
 * near-copies — which is what the grid-of-cards version of this page had turned
 * into.
 */
export default function HelpRow({
  icon: Icon,
  title,
  description,
  tint = "pink",
  href,
  onClick,
  badge,
}: HelpRowProps) {
  const body = (
    <>
      <span
        aria-hidden
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${TINTS[tint]}`}
      >
        <Icon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-foreground dark:text-neutral-50">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground dark:text-neutral-400">
            {description}
          </span>
        )}
      </span>

      {/* Only when there is something to count. A "0" pill is worse than no
          pill: it draws the eye to say nothing happened. */}
      {!!badge && badge > 0 && (
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white dark:bg-pink-600">
          {badge > 99 ? "99+" : badge}
        </span>
      )}

      <ChevronRight
        aria-hidden
        className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-primary dark:text-neutral-600 dark:group-hover:text-pink-400"
      />
    </>
  );

  // `mailto:` and `tel:` are not routes — handing them to `next/link` would ask
  // the router to prefetch a protocol it cannot navigate.
  if (href && /^(mailto|tel):/.test(href)) {
    return (
      <a href={href} className={SHELL}>
        {body}
      </a>
    );
  }

  if (href) {
    return (
      <Link href={href} className={SHELL}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`focus-ring ${SHELL} cursor-pointer`}>
      {body}
    </button>
  );
}
