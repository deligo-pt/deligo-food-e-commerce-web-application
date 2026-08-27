"use client";

import { memo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { localizedText, type LocalizedText, type MenuLang } from "@/lib/menuModel";

export interface VendorMenu {
  _id: string;
  name?: LocalizedText;
  description?: LocalizedText;
  /**
   * The window the vendor says this menu is served in. Typed `unknown` because
   * it arrives in three shapes — populated, present but empty, and absent — and
   * `buildAvailabilityView` is what decides which of those is worth a caption.
   * Nothing on this page reads it as a gate; see `MenuAvailability`.
   */
  availability?: unknown;
}

interface MenuSelectorProps {
  menus: VendorMenu[];
  /** `null` means "All items" — the vendor's whole catalogue, not a menu. */
  selectedMenuId: string | null;
  onSelect: (menuId: string | null) => void;
  lang: MenuLang;
}

/**
 * The row of pills that chooses which of the vendor's menus is on screen.
 *
 * ## 🔴 "All items" is not a menu, and it is always first
 *
 * The vendor's menus routinely do not cover the vendor's catalogue. Measured on
 * the live test data: two of seven vendors have no menus at all, four menus
 * across two more have no sections, and **17 of 22 products sit in no section**.
 * A selector offering only menus would therefore hide most of the catalogue and
 * show four of seven restaurants an empty page.
 *
 * So the first entry is the flat product list the page already renders, it is
 * the default selection, and it is not derived from the menus response — it
 * cannot go missing no matter what the API says. Whatever a vendor has or has
 * not filed into a menu, every product they sell is one click away.
 *
 * ## 🔴 With no menus, this renders nothing at all
 *
 * Not a disabled row, not a lone "All items" pill with nothing to switch to —
 * `null`. A vendor who has never opened the menu builder gets exactly the page
 * they get today, with no dead control above it and no layout that shifts when
 * the menus request resolves.
 *
 * ## Theme
 *
 * Deliberately the same pill the category tabs below already use — same radius,
 * padding, weight, uppercase, same `bg-pink-600` active state. The two rows are
 * told apart by position and by the section nav's different form (underline
 * tabs), which is how the reference lays them out. Inventing a third visual
 * language for a control that does the same kind of job would be noise.
 */
const MenuSelector = memo(function MenuSelector({
  menus,
  selectedMenuId,
  onSelect,
  lang,
}: MenuSelectorProps) {
  const { t } = useTranslation();

  // The rule above, as the first statement in the component so it cannot be
  // refactored into a branch someone misses.
  if (!menus || menus.length === 0) return null;

  const pill = (active: boolean) =>
    `shrink-0 rounded-lg px-5 py-2 text-sm font-semibold uppercase transition ${
      active
        ? "bg-pink-600 text-white"
        : "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
    }`;

  return (
    <section className="mb-4 overflow-x-auto" aria-label={t("menu")}>
      <div className="flex min-w-max gap-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={selectedMenuId === null}
          className={pill(selectedMenuId === null)}
        >
          {t("allItems")}
        </button>

        {menus.map((menu) => {
          // A menu whose name is blank in both languages still has to be
          // clickable — it is a real menu with real products behind it — so it
          // falls back to the generic label rather than rendering an unlabelled
          // pill the customer cannot interpret.
          const label = localizedText(menu.name, lang) || t("menu");
          return (
            <button
              key={menu._id}
              type="button"
              onClick={() => onSelect(menu._id)}
              aria-pressed={selectedMenuId === menu._id}
              className={pill(selectedMenuId === menu._id)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
});

export default MenuSelector;
