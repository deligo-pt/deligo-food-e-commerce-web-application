"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useRevealOnScroll } from "@/hooks/useMotion";
import { categoryDomId, type CategoryGroup as Group } from "@/lib/categoryModel";

interface CategoryGroupProps<P> {
  group: Group<P>;
  /**
   * How one product is drawn. A render prop rather than an import so this
   * component never learns the product's shape — it heads and lays out, and the
   * page keeps rendering its own `MenuProductCard`, unchanged and unmoved.
   */
  renderProduct: (product: P) => ReactNode;
  /** The product's own id, used as the React key. */
  productKey: (product: P) => string;
}

/**
 * One category: its heading, its item count, and its products in the order the
 * API returned them.
 *
 * ## The heading is the scroll target
 *
 * `id={categoryDomId(group.id)}` is the anchor `CategoryNav` looks up, and
 * `scroll-mt-24` is what stops the sticky bar from covering the heading it just
 * scrolled to. Those two are the entire contract between the components — the
 * nav reads no data attribute and knows nothing else about this markup. Phase 6
 * measures that inset against the real header height.
 *
 * ## Every group has products
 *
 * Unlike the menu sections this replaced, there is no empty state here. A menu
 * section existed because a vendor created a heading, so it could legitimately
 * hold nothing; a category group exists *because* products were found under it,
 * so `group.products.length >= 1` by construction. `groupByCategory` never
 * emits an empty group, and `CategoryNav` never renders a pill that scrolls to
 * one.
 *
 * ## Keys are plain product ids
 *
 * The deleted menu version composed section id with product id, because one
 * product could appear in several sections of one menu — live data had two
 * products filling five sections — so a bare product id would have handed React
 * duplicate keys inside a single render. A product now has exactly one
 * `category`, so it appears in exactly one group, and `productId` is unique
 * across the whole catalogue (verified: no repeats in 29 of 29 live products,
 * including four distinct products all named "Organic Green Tea"). Composing a
 * key is no longer buying anything.
 *
 * ## The grid is a reveal group
 *
 * Its cards fade in 50ms apart when the group scrolls into view. Fade only —
 * no travel — because a card in this grid renders a price; see the note on the
 * grid itself. A caller that renders something with no money in it can drop
 * `data-travel="none"` and get the rise as well.
 *
 * ## Layout
 *
 * Heading left, count right — the arrangement the mobile app uses, carried over
 * class-for-class from the menu-section component this replaced, because that
 * shape was already approved. No description line: that was removed by request
 * and stays removed.
 */
export default function CategoryGroup<P>({
  group,
  renderProduct,
  productKey,
}: CategoryGroupProps<P>) {
  const { t } = useTranslation();
  const count = group.products.length;
  const [gridRef, revealed] = useRevealOnScroll<HTMLDivElement>();

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-baseline justify-between gap-4">
        {/*
          `t()` takes one key and does no interpolation, so the count is composed
          here rather than pulled from a template. Two keys, not one with an
          "(s)" — Portuguese needs "item"/"itens", and the parenthesised form
          reads as placeholder text in both languages.
        */}
        <h3
          id={categoryDomId(group.id)}
          className="scroll-mt-24 text-xl font-bold uppercase text-gray-900 dark:text-white"
        >
          {group.name}
        </h3>
        <span className="shrink-0 text-sm text-gray-500 dark:text-neutral-400">
          {count} {count === 1 ? t("item") : t("items")}
        </span>
      </div>

      {/*
        The cards arrive one after another, 50ms apart — and **without the
        rise**, which is the whole reason this is allowed here at all.

        `reveal-group` translates its children, and §11 bars a transform from
        any file that renders a price: a number that moves while it is being
        read is a number that can be misread. Every card in this grid ends in a
        price. `data-travel="none"` swaps the animation for opacity alone, so
        the sequencing survives and the objection does not apply — the variant
        satisfies the rule rather than carving an exception out of it.

        Per group rather than once for the whole catalogue, and keyed to the
        observer rather than to the fetch. Phase 6's objection to a stagger here
        was that a list the customer is already looking at appears to lag; a
        group that staggers as it scrolls into view never does, because they
        arrive together.
      */}
      <div
        ref={gridRef}
        data-revealed={revealed}
        data-travel="none"
        className="reveal-group mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {group.products.map((product) => (
          <div key={productKey(product)}>{renderProduct(product)}</div>
        ))}
      </div>
    </div>
  );
}
