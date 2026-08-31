import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The head of a content section — Plan.md Phase 9.
 *
 * ## 🔴 There are two heading roles, and `<h2>` is not the discriminator
 *
 * The phase was planned from a count: `<h2>` spelled three ways, 24 × `text-2xl`,
 * 16 × `text-xl`, 8 × `text-2xl lg:text-display`, so settle on the third. Reading
 * the call sites instead of counting them says otherwise. Those `<h2>`s do two
 * different jobs:
 *
 * - **A section heading** tops a band of content on a page — "Near you", "Shop
 *   on Deligo", "How it works", a terms chapter. It is `text-2xl lg:text-display`
 *   and it is what this component renders.
 * - **A panel head** titles a card, a dialog, a form group — "Saved cards",
 *   "Address details", "App settings". At 32px on a desktop those shout over the
 *   page heading above them. They are `text-xl`, and they are *not* this
 *   component.
 *
 * Sweeping every `<h2>` to one size would have made a dialog title the size of a
 * page title. The rule is the role, not the tag.
 *
 * ## Why a component and not a class
 *
 * `cardVariants` is a `cva` export because a card is a *shape* applied to four
 * different elements. A section heading is the opposite: fixed markup — an
 * accent rule, an `<h2>`, an optional action to its right — repeated verbatim
 * nine times on the homepage alone. Markup that repeats wants a component.
 *
 * ## `loading` is the point, not a convenience
 *
 * Phase 5 #2 exists because a skeleton that drifts from its live content *is*
 * the layout shift, and Phases 5, 6 and 7 each found another pair that had
 * drifted. Rendering both halves from one component makes that drift
 * structurally impossible rather than merely asserted — the accent rule, the
 * margins and the alignment cannot differ between them, because there is only
 * one copy of each.
 *
 * ## The accent rule
 *
 * `accent` defaults on. Whether the rule belongs above every `<h2>` in the app
 * or is browse-page decoration is §5 open question 5 and still yours to answer
 * — but it is a one-line change *here* now, rather than an edit to every
 * section in the app, which is what this component was extracted to make true.
 */
export function SectionHeading({
  children,
  action,
  accent = true,
  loading = false,
  skeletonWidth = "w-48",
}: {
  /** The heading text. Omitted when `loading`. */
  children?: ReactNode
  /** Rendered at the far right — a "View all" link, a filter control. */
  action?: ReactNode
  /** The 4px brand rule above the heading. */
  accent?: boolean
  /** Draw the skeleton of this exact heading instead of the heading. */
  loading?: boolean
  /** Width of the skeleton's title block. Cosmetic; it is a left-aligned bar. */
  skeletonWidth?: string
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        {accent && (
          <span
            aria-hidden="true"
            className={cn(
              "mb-3 block h-1 w-6 rounded-full",
              loading ? "bg-primary/30" : "bg-primary",
            )}
          />
        )}
        {loading ? (
          <div
            className={cn(
              "h-8 animate-pulse rounded-full bg-gray-200 lg:h-10 dark:bg-neutral-800",
              skeletonWidth,
            )}
          />
        ) : (
          <h2 className="text-2xl font-bold text-foreground lg:text-display dark:text-neutral-100">
            {children}
          </h2>
        )}
      </div>
      {action}
    </div>
  )
}
