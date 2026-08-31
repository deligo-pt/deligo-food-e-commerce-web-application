import { cva, type VariantProps } from "class-variance-authority"

/**
 * The one place a card's shape is decided — Plan.md Phase 8.
 *
 * ## Why a `cva` export and not a `<Card>` component
 *
 * Fifty-eight files render something card-shaped, onto `<article>`,
 * `<button>`, `<div>` and `<Link>` — a vendor is an article, a shop lane is a
 * button, a cuisine is a button, a voucher is a div, a search result is a
 * Link. A component would have to accept `asChild` and forward refs to serve
 * all four, and Phase 2 already learned the lesson underneath that: a
 * component that is awkward to import is a component nobody imports.
 * `buttonVariants` is the shape that worked here, so this is the same shape.
 *
 * ## The shell only
 *
 * Radius, border, background, and what happens on hover. Not padding of the
 * *content* — a card with a full-bleed image at the top cannot pad its outer
 * box — which is why `padding` is a variant rather than part of the base, and
 * why cards with images pass `padding: "none"` and pad their body instead.
 *
 * ## What this replaced
 *
 * Four shells, three of them on the homepage within one screen of each other:
 *
 * | | radius | border | shadow | hover |
 * |---|---|---|---|---|
 * | shop card | `rounded-4xl` | `border-2 border-transparent` | permanent | pink border |
 * | cuisine tile | `rounded-2xl` | `border border-border` | `shadow-sm` | lift |
 * | vendor card | `rounded-3xl` | `border border-border` | — | lift |
 * | category tile | `rounded-3xl` | none | permanent | — |
 *
 * The pink hover border was the worst of it: `--primary` means action and
 * availability (§1.4), and a hover is neither, so a card said "selected" about
 * itself every time a pointer crossed it. A permanent shadow is the second —
 * weight already spent, leaving none to spend when the pointer does arrive.
 *
 * ## `bg-card`, and the one thing left hand-typed
 *
 * `--card` is `oklch(1 0 0)` light and `oklch(0.205 0 0)` dark, which convert
 * to `#ffffff` and `#171717` — and `#171717` is Tailwind's `neutral-900`
 * exactly. So `bg-card` is pixel-identical to the `bg-white
 * dark:bg-neutral-900` this replaces, at every call site, in both themes.
 *
 * `dark:border-neutral-800` is *not* the same trade and is deliberately still
 * spelled out here. `--border` in dark mode is `oklch(1 0 0 / 10%)` —
 * translucent white, which composites differently over a card than over an
 * image. Whether it gains an opaque dark value is §5 open question 6, and
 * until that is answered this keeps the colour the app already draws.
 */
export const cardVariants = cva(
  "rounded-3xl border border-border bg-card dark:border-neutral-800",
  {
    variants: {
      variant: {
        /** A surface. Holds content, does nothing when pointed at. */
        static: "",
        /**
         * The whole card is the control — it navigates, or it selects.
         * Lifts 4px and takes a shadow, over the 300ms the rest of the app
         * uses for a hover. `motion-press` belongs at the call site alongside
         * this, on whichever element actually receives the tap.
         */
        interactive:
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
      },
      padding: {
        /** For cards whose first child is a full-bleed image. */
        none: "",
        /** §1.2: 16 on a phone, 24 from `sm`. */
        card: "p-4 sm:p-6",
      },
    },
    defaultVariants: {
      variant: "static",
      padding: "none",
    },
  },
)

export type CardVariants = VariantProps<typeof cardVariants>
