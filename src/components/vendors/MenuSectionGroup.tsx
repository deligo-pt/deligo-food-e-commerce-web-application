"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { menuItemKey, type MenuSectionView } from "@/lib/menuModel";

/**
 * The DOM id of one section's heading.
 *
 * Lives here rather than in the nav because this is the component that renders
 * the anchor; the nav points at what this produces, not the other way round.
 * Namespaced so it cannot collide with a product id or a category name that
 * happens to be used as an id elsewhere on the page.
 */
export function sectionDomId(sectionId: string): string {
  return `menu-section-${sectionId}`;
}

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

  return (
    <div className="mb-10 last:mb-0">
      {/*
        `scroll-mt-24` is what makes the nav's `scrollIntoView` land correctly:
        the app's header is `sticky top-0`, so without a scroll margin the
        heading would come to rest underneath it.
      */}
      <h3
        id={sectionDomId(section.id)}
        className="scroll-mt-24 text-lg font-bold text-gray-900 dark:text-white"
      >
        {section.name}
      </h3>

      {section.description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
          {section.description}
        </p>
      )}

      {section.products.length === 0 ? (
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
