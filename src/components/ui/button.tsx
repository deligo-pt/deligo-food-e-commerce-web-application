import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * The one place button padding is decided — Plan.md Phase 2.
 *
 * ## Three sizes, fixed
 *
 * | size | height | side padding | text |
 * |---|---|---|---|
 * | `sm` | 32 | 12 | 14 |
 * | `default` | 44 on mobile, 40 from `sm` | 16 | 14 |
 * | `lg` | 48 | 20 | 14 |
 *
 * `default` is taller on phones on purpose. This is a phone-first app and 40px
 * is under every published touch-target minimum; from the `sm` breakpoint,
 * where there is a pointer, it settles to the 40 the scale asks for. `sm` stays
 * 32 at every width because it is a dense, secondary control — a filter chip, an
 * inline action beside text — not a primary tap target. Reach for `default`
 * when a phone user has to hit it.
 *
 * Text is 14px at every size. A button whose label changes size with its box is
 * two decisions where one will do, and it was how `text-[0.8rem]` — the single
 * off-scale font size in the codebase — got in here.
 *
 * ## What was removed, and why
 *
 * The old sizes were `h-6`/`h-7`/`h-8`/`h-9` — a 24-to-36px range in which the
 * *default* was 32px. There were also `xs` and `icon-xs` steps, and every size
 * carried `has-data-[icon=inline-*]` rules that shaved its own padding when an
 * icon sat at an edge. Padding that varies by content is not fixed padding, and
 * the whole point of this component is that the answer is the same every time.
 * Both are gone. A control that genuinely needs to be smaller than `sm` is not a
 * button in the design-system sense; leave it as bespoke markup and give it the
 * shared `focus-ring` class from `globals.css`.
 *
 * ## Hover darkens, it does not fade
 *
 * `hover:bg-primary/80` washed the brand pink toward the page behind it and
 * *lowered* the contrast of the white label at the moment of interaction.
 * `--primary-hover` mixes toward black instead: the label stays legible and it
 * reads as a press. Phase 4 gave that mix a token name, because 25 call sites
 * were spelling the same darker pink as a literal.
 *
 * White on `#f9186b` measures 3.91:1 — over the 3:1 needed for large text and
 * UI, under the 4.5:1 for a 14px label. Kept, because it is what the app has
 * always rendered from its inline literals and changing it would restyle every
 * pink surface at once. Revisit by adding a darker `--primary-strong` for
 * text-bearing fills; `--primary` stays canonical for accents and borders.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-[color-mix(in_oklch,var(--primary),black_18%)]",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 gap-2 px-3",
        default: "h-11 gap-2 px-4 sm:h-10",
        lg: "h-12 gap-2 px-5",
        "icon-sm": "size-8",
        icon: "size-11 sm:size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
