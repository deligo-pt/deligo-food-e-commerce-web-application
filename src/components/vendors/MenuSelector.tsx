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
  /** The menu on screen. `null` only while the list is still empty. */
  selectedMenuId: string | null;
  onSelect: (menuId: string) => void;
  lang: MenuLang;
}

/**
 * The row of pills that chooses which of the vendor's menus is on screen.
 *
 * ## Menus only
 *
 * This used to lead with an "All items" pill backed by the flat product list,
 * because menus did not cover the catalogue — 17 of 22 live products sat in no
 * section at all. That entry was retired once the vendor side committed to every
 * product belonging to a menu, at which point "All items" was just every menu
 * concatenated, sitting above a second pill row that filtered by the platform's
 * product categories. Two controls, three meanings, one screen.
 *
 * What replaced the guarantee: a vendor with **no menus** never reaches this
 * component at all — the page renders its flat product grid instead, with no
 * selector. See the `menus.length === 0` branch in `VendorDetailsPage`. That is
 * a migration fallback, not a control, and it disappears on its own once every
 * vendor has a menu.
 *
 * ## 🔴 With no menus, this renders nothing
 *
 * Not a disabled row, not an empty one — `null`. The page above is responsible
 * for what shows instead, and a control with nothing to select would only
 * shift the layout when the menus request resolves.
 *
 * ## Theme
 *
 * The pill the category tabs used to use — same radius, padding, weight,
 * uppercase, same `bg-pink-600` active state. Those tabs are gone, so this is
 * now the only pill row on the page, and the section nav below it is the
 * underline-tab form the reference lays out.
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
