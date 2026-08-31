"use client";

import { memo } from "react";
import { useTranslation } from "@/hooks/useTranslation";

/** One row in the sidebar. The count is the number of products rendered. */
export interface CategorySidebarItem {
  id: string;
  name: string;
  count: number;
}

interface CategorySidebarProps {
  groups: readonly CategorySidebarItem[];
  activeId: string | null;
  onSelect: (groupId: string) => void;
  /** Measured app-header height, so this comes to rest just below it. */
  headerHeight: number;
}

/**
 * The category list down the left of the vendor page, from `lg` up.
 *
 * Below `lg` this is `display: none` and `CategoryNav`'s sticky pill row takes
 * over. A 260px column on a phone is not a sidebar, it is a third of the screen
 * spent on navigation.
 *
 * ## 🔴 It navigates, it does not filter
 *
 * The reference this is modelled on is a WooCommerce facet list, where clicking
 * a category filters the grid. This one scrolls to the heading instead, and
 * every product stays on the page throughout — the standing requirement is that
 * all of them are shown. The counts come along because they are useful either
 * way, and because `CategoryGroup` already renders the same number beside its
 * heading; both read `group.products.length`, so they cannot disagree.
 *
 * ## Sticky, not fixed
 *
 * It scrolls with the page until it reaches the header, then stays. `top` is
 * the header height measured by `useCategoryScrollSpy` — the same value the pill
 * row uses, so the two views are pinned to the same line.
 *
 * ## Presentational
 *
 * `activeId` and `onSelect` come from the page's single `useCategoryScrollSpy`,
 * shared with the pill row. Neither view owns scroll state.
 */
const CategorySidebar = memo(function CategorySidebar({
  groups,
  activeId,
  onSelect,
  headerHeight,
}: CategorySidebarProps) {
  const { t } = useTranslation();

  // One category is not a list to navigate. The headings below still carry it.
  if (groups.length < 2) return null;

  return (
    <aside
      aria-label={t("productCategories")}
      style={{ top: headerHeight + 24 }}
      className="sticky hidden h-fit w-60 shrink-0 lg:block xl:w-64"
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {t("productCategories")}
        </h2>
        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-neutral-800">
          <ul className="space-y-1">
            {groups.map((group) => {
              const isActive = group.id === activeId;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(group.id)}
                    aria-current={isActive ? "true" : undefined}
                    // Deliberately not a <Button>: the category name wraps
                    // onto a second line, and every button size has a fixed
                    // height that would clip it. Bespoke shape, shared ring.
                    className={`focus-ring flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "bg-pink-50 font-semibold text-pink-600 dark:bg-pink-950/30 dark:text-pink-400"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                    }`}
                  >
                    {/* The name can be long — "APPETIZERS AND STARTERS" — and the
                        count must stay readable, so the name wraps rather than
                        pushing the count out of the row. */}
                    {/* The backend stores category names upper-cased, so this
                        is a no-op for them — it exists so the translated
                        "Other" / "Outros" heading matches them instead of
                        sitting in title case among a column of capitals.
                        Casing in CSS, not in the copy, keeps the dictionaries
                        readable and lets one rule cover both languages. */}
                    <span className="min-w-0 break-words uppercase">{group.name}</span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        isActive
                          ? "text-pink-600/70 dark:text-pink-400/70"
                          : "text-gray-400 dark:text-neutral-500"
                      }`}
                    >
                      ({group.count})
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
});

export default CategorySidebar;
