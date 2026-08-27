"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { menuItemKey, type MenuSectionView } from "@/lib/menuModel";

interface MenuSectionGroupProps<P> {
  section: MenuSectionView<P>;
  /**
   * How one product is drawn. A render prop rather than an import so this
   * component never learns the product's shape — it groups and orders, and the
   * page keeps rendering its own `MenuProductCard`, unchanged and unmoved.
   */
  renderProduct: (product: P) => ReactNode;
  /** The product's own id, which this composes with the section id for a key. */
  productKey: (product: P) => string;
}

/**
 * One menu section: heading, optional description, and its products in the
 * order the vendor arranged them.
 *
 * ## An empty section is rendered, not skipped
 *
 * Sections with no items exist in live data — a vendor creates the heading
 * before filling it. Dropping such a section would misrepresent the menu the
 * vendor built: the customer would see a section count that disagrees with the
 * nav above, and a vendor checking their own storefront would think the section
 * had failed to save. It gets its heading and a muted line instead.
 *
 * ## Keys are section-scoped
 *
 * The same product legitimately appears in several sections of the same menu —
 * the live data has two products filling five sections. Keying on the product id
 * alone would hand React duplicate keys inside one render and let it reuse the
 * wrong card across sections. `menuItemKey` is what prevents that.
 *
 * The grid is the page's existing one, class for class, so a section of products
 * is visually indistinguishable from today's ungrouped grid — which is the point.
 */
export default function MenuSectionGroup<P>({
  section,
  renderProduct,
  productKey,
}: MenuSectionGroupProps<P>) {
  const { t } = useTranslation();
  const count = section.products.length;

  return (
    <div className="mb-10 last:mb-0">
      {/*
        Heading and count on one row, the count right-aligned — the arrangement
        the mobile app uses. It replaces the section description, which said
        less than the count did: "Nothing just checking" is what a vendor types
        into a field they do not want, while "2 items" is a fact about what is
        below.

        `t()` takes one key and does no interpolation, so the count is composed
        here rather than pulled from a template. Two keys, not one with an "(s)"
        — Portuguese needs "item"/"itens" and the parenthesised form reads as
        placeholder text in both languages.
      */}
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {section.name}
        </h3>
        {count > 0 && (
          <span className="shrink-0 text-sm text-gray-500 dark:text-neutral-400">
            {count} {count === 1 ? t("item") : t("items")}
          </span>
        )}
      </div>

      {count === 0 ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
          {t("noItemsInSection")}
        </div>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {section.products.map((product) => (
            <div key={menuItemKey(section.id, productKey(product))}>
              {renderProduct(product)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
