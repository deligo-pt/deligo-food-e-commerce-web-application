"use client";

import { forwardRef, memo, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

/**
 * The minimum a group has to be for this bar to navigate to it. Deliberately
 * narrower than `CategoryGroup<P>` so the nav never learns the product shape.
 */
export interface CategoryNavItem {
  id: string;
  name: string;
}

interface CategoryNavProps {
  groups: readonly CategoryNavItem[];
  activeId: string | null;
  onSelect: (groupId: string) => void;
  /** Measured app-header height, so this comes to rest just below it. */
  headerHeight: number;
}

/**
 * The sticky row of category pills — **the narrow-screen view only**.
 *
 * From `lg` up this is `display: none` and `CategorySidebar` takes over. That
 * is not only a style choice: the page measures this element's `offsetHeight`
 * to know how far to scroll past whatever is pinned over the content, and a
 * hidden element measures `0`, which is exactly the right answer once the
 * sidebar (which sits beside the content, not above it) is the visible control.
 * One formula, both breakpoints, no branch.
 *
 * ## 🔴 It navigates, it does not filter
 *
 * Every product on the page stays on the page. Clicking a pill scrolls to that
 * category's heading and nothing else — no product is hidden, so there is no
 * "all items" state to return to and no empty result to explain.
 *
 * ## Fewer than two groups renders nothing
 *
 * Not a disabled bar, not a single pill — `null`. A vendor with one category has
 * nothing to navigate between, and a control that cannot change anything costs
 * vertical space and invites a click that does nothing.
 *
 * ## Presentational
 *
 * The scroll-spy lives in `useCategoryScrollSpy`, called once by the page and
 * shared with the sidebar. Two copies of that logic would drift at the
 * breakpoint boundary, while scrolling, invisibly.
 */
const CategoryNav = memo(
  forwardRef<HTMLElement, CategoryNavProps>(function CategoryNav(
    { groups, activeId, onSelect, headerHeight },
    ref,
  ) {
    const { t } = useTranslation();
    const listRef = useRef<HTMLDivElement>(null);
    const pillRefs = useRef(new Map<string, HTMLButtonElement>());

    // Keep the active pill in view inside the bar. Scrolls the container's own
    // `scrollLeft` rather than calling `scrollIntoView` on the pill, which would
    // be free to scroll the page vertically as a side effect.
    useEffect(() => {
      if (!activeId) return;
      const list = listRef.current;
      const pill = pillRefs.current.get(activeId);
      if (!list || !pill) return;

      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      const target = pill.offsetLeft - (list.clientWidth - pill.clientWidth) / 2;
      list.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
    }, [activeId]);

    if (groups.length < 2) return null;

    return (
      <nav
        ref={ref}
        aria-label={t("productCategories")}
        // `top` is the measured header height, so this comes to rest directly
        // under the header instead of behind it. z-20 keeps it under the
        // header's z-50 and over the product grid.
        style={{ top: headerHeight }}
        className="sticky z-20 -mx-1 mb-6 bg-white/95 px-1 py-3 backdrop-blur lg:hidden dark:bg-neutral-950/95"
      >
        <div
          ref={listRef}
          className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((group) => {
            const isActive = group.id === activeId;
            return (
              <Button
                key={group.id}
                type="button"
                ref={(node) => {
                  if (node) pillRefs.current.set(group.id, node);
                  else pillRefs.current.delete(group.id);
                }}
                onClick={() => onSelect(group.id)}
                aria-current={isActive ? "true" : undefined}
                variant={isActive ? "default" : "outline"}
                // These pills were drawn to the `md` spec by hand before the
                // component existed; now they just ask for it. This row is
                // `lg:hidden`, so in practice it renders at the 44px mobile
                // height — which is the whole reason `md` is taller there.
                // `shrink-0` because the row scrolls horizontally.
                className="shrink-0 font-semibold uppercase"
              >
                {group.name}
              </Button>
            );
          })}
        </div>
      </nav>
    );
  }),
);

export default CategoryNav;
