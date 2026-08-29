"use client";

import { forwardRef, memo, useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";

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
              <button
                key={group.id}
                type="button"
                ref={(node) => {
                  if (node) pillRefs.current.set(group.id, node);
                  else pillRefs.current.delete(group.id);
                }}
                onClick={() => onSelect(group.id)}
                aria-current={isActive ? "true" : undefined}
                // Plan.md §1.3: 40px tall, 16px side padding, 14px text — the
                // `md` button size, so this row matches every other control on
                // the page once that sweep lands, and clears the 40px touch
                // target it previously missed.
                className={`inline-flex h-10 shrink-0 items-center rounded-lg px-4 text-sm font-semibold uppercase transition focus-visible:ring-2 focus-visible:ring-pink-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-neutral-950 ${
                  isActive
                    ? "bg-pink-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {group.name}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }),
);

export default CategoryNav;
