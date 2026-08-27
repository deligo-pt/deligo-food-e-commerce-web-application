/**
 * The vendor Menu → Menu Section → Product hierarchy, as a pure model.
 *
 * ## What the two new endpoints actually hand back
 *
 * `GET /menus/open/:vendorId` and `GET /menus/open/:menuId/sections` are public,
 * and they are the vendor's own menu card — a named, ordered arrangement of
 * products that is entirely separate from `ProductCategory`. A product can sit
 * in several sections at once, across several menus.
 *
 * Two properties of those responses decide everything in this file. Both were
 * measured against `api-test-food` on 2026-08-27, across all seven test
 * vendors:
 *
 * ### 1. 🔴 The populated product is a stub, not a product
 *
 * `items[].productId` is a projection carrying `_id`, `name`, `slug`,
 * `pricing`, `images` and `meta` — and **no `finalPrice`, no business
 * `productId` (`PROD-XXXXXX`), no `description`, no `category`.**
 *
 * `finalPrice` is the one the menu card prints, and computing it here from
 * `price` and `discount` is exactly the mistake `productPricing.ts` exists to
 * document: backend money is displayed as returned, never re-derived. The
 * business `productId` is what opens `ProductDetailsModal`.
 *
 * So this module treats the sections response as an **index over ids** and
 * nothing else. `buildMenuView` joins those ids against the products the page
 * already fetched from `GET /products`, and hands back the *real* product
 * objects. Ordering and grouping come from the menu API; every field rendered
 * comes from the product API. Nothing here reads a price at all.
 *
 * ### 2. `Accept-Language` does not reach this data
 *
 * It localizes the response `message` and stops there: `menu.name`,
 * `section.name` and the nested product `name` all arrive as raw
 * `{ en, pt }` objects, while `/products` returns an already-localized string.
 * The two sources disagree in shape, so `localizedText` picks the language for
 * menu and section names — and only for those. Product names are never passed
 * through it; they are already correct.
 *
 * ## Everything here is total
 *
 * The live crawl produced empty menus, empty sections, absent `availability`,
 * empty-string `pt`, and `daysOfWeek: []`. A model that throws on one of those
 * takes the restaurant page down with it, so every function below accepts
 * `unknown` and returns a usable value for any input. `verify:menu` fuzzes them
 * with the shapes that were actually observed plus the ones that plausibly
 * follow.
 */

/** The language the app is rendering in. Matches the translation store. */
export type MenuLang = "en" | "pt";

/**
 * A localized field as the menu endpoints send it.
 *
 * The union is wide on purpose. `{ en, pt }` is what ships today; a bare string
 * is what would arrive if the backend ever honours `Accept-Language` here (an
 * open question with the backend team), and that change must not break the
 * page. Everything else is defensive.
 */
export type LocalizedText =
  | { en?: string | null; pt?: string | null }
  | string
  | null
  | undefined;

/**
 * One localized field, resolved to a string that is safe to render.
 *
 * Prefers the requested language, falls back to the other, then to `""`.
 *
 * The fallback is not paranoia: `pt` comes back as `""` on real menus (Leopold's
 * "Popular", among others), and an empty string is a *miss*, not an answer —
 * treating it as one renders a nameless tab. Trimming first is what makes a
 * whitespace-only value miss too.
 *
 * Never returns `null`/`undefined`, so callers can put the result straight into
 * JSX without a `??`.
 */
export function localizedText(value: LocalizedText, lang: MenuLang): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const other: MenuLang = lang === "en" ? "pt" : "en";
  const preferred = value[lang];
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();

  const alternate = value[other];
  if (typeof alternate === "string" && alternate.trim()) return alternate.trim();

  return "";
}

/**
 * The product id a section item points at, or `null` if it points at nothing.
 *
 * `productId` is populated to an object today, so the id lives at `._id`. It is
 * read as a bare string too — that is what an unpopulated response would send,
 * and it costs one branch to survive one.
 *
 * `null` is a real possibility and not an error: the backend has not confirmed
 * what a section holds after the product underneath it is deleted, so a
 * dangling or nulled reference is assumed until told otherwise. Callers drop
 * those items rather than rendering a blank card.
 */
export function menuItemProductId(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const raw = (item as { productId?: unknown }).productId;

  if (typeof raw === "string") return raw.trim() || null;
  if (raw && typeof raw === "object") {
    const id = (raw as { _id?: unknown })._id;
    if (typeof id === "string") return id.trim() || null;
  }
  return null;
}

/**
 * A React key for one product inside one section.
 *
 * 🔴 Section-scoped, because a product legitimately appears in several sections
 * of the same menu — Leopold's two products fill five sections between them.
 * Keying on the product id alone would give React duplicate keys within a
 * single render and let it reuse the wrong card between sections.
 */
export function menuItemKey(sectionId: string, productId: string): string {
  return `${sectionId}:${productId}`;
}

/** One section of a menu, joined against the real product list. */
export interface MenuSectionView<P> {
  /** The section's Mongo `_id`. Empty string if the response omitted it. */
  id: string;
  name: string;
  description: string;
  /** Real products from `GET /products`, in the order the section listed them. */
  products: P[];
  /**
   * How many of this section's items could not be matched to a product.
   *
   * Zero for every vendor in the live crawl. It is carried anyway because the
   * one way it can go non-zero is silent: `useVendorProducts` asks for at most
   * 100 products, so a vendor past that ceiling could file product #101 into a
   * section and the join would quietly find nothing. Surfacing a count makes
   * that a number somebody can assert on rather than a gap nobody notices.
   */
  missingCount: number;
}

/** The minimum a product must carry to be joinable. Both ids are read. */
export interface JoinableProduct {
  _id?: string | null;
  productId?: string | null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(source: unknown, key: string): string {
  if (!source || typeof source !== "object") return "";
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/**
 * The join: a sections response plus the page's product list, in, renderable
 * sections out.
 *
 * ## What it does not do
 *
 * **It does not sort.** Menus, sections and items all arrive in `sortOrder`
 * ascending — the backend renormalizes every scope to a gapless `0..n-1` on
 * every create, reorder and delete, so the arrays are already in the order the
 * vendor arranged them. Re-sorting by the field here would look harmless and
 * would silently disagree with the vendor's own builder the day the backend
 * changes how it orders. Array order is copied; `sortOrder` is not read.
 *
 * **It does not filter sections.** A section with no resolvable products is
 * kept, with an empty `products` array. It is a real section the vendor
 * created — Leopold's "Dinner Items" is empty right now — and dropping it from
 * the page would misrepresent the menu rather than tidy it. The caller decides
 * how an empty section looks.
 *
 * **It does not touch pricing.** The products it returns are the ones handed
 * in, untouched.
 *
 * Products are indexed under both `_id` and the business `productId`, so a
 * future response that references either shape joins without a change here.
 */
export function buildMenuView<P extends JoinableProduct>(
  sections: unknown,
  products: readonly P[],
  lang: MenuLang,
): MenuSectionView<P>[] {
  const byId = new Map<string, P>();
  for (const product of products ?? []) {
    if (!product) continue;
    if (typeof product._id === "string" && product._id) {
      byId.set(product._id, product);
    }
    if (typeof product.productId === "string" && product.productId) {
      byId.set(product.productId, product);
    }
  }

  return asArray(sections).map((section) => {
    const matched: P[] = [];
    let missingCount = 0;

    for (const item of asArray(
      section && typeof section === "object"
        ? (section as { items?: unknown }).items
        : null,
    )) {
      const id = menuItemProductId(item);
      const product = id ? byId.get(id) : undefined;
      if (product) matched.push(product);
      else missingCount += 1;
    }

    return {
      id: readString(section, "_id"),
      name: localizedText(
        (section as { name?: LocalizedText } | null)?.name,
        lang,
      ),
      description: localizedText(
        (section as { description?: LocalizedText } | null)?.description,
        lang,
      ),
      products: matched,
      missingCount,
    };
  });
}

/**
 * The seven day codes the API uses, in the order Portugal reads a week.
 *
 * 🔴 This is the canonical order, and it is *not* the order the API sends. Live
 * menus return `daysOfWeek` as an unordered set — one real vendor sends
 * `["MON","TUE","WED","SAT","SUN","THU"]` — so any run-collapsing has to work
 * from membership, walking this list, rather than from the array's own order.
 * Walking a fixed list is also how this is done without sorting anything, which
 * keeps the "nothing in this feature reorders backend data" rule exception-free.
 */
export const WEEK_DAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

export type DayCode = (typeof WEEK_DAYS)[number];

/**
 * 🔴 Every day the vendor selected is listed. Consecutive days are **not**
 * collapsed into a range.
 *
 * This started as `Mon–Thu, Sun` for `["MON","TUE","WED","THU","SUN"]`, which is
 * correct and reads well and was still wrong: it makes the reader expand a range
 * to find out whether Tuesday is included, and it shows a shape the response
 * does not contain. The rule this app runs on is that backend data is displayed
 * as sent — the same rule that keeps prices from being recomputed — and a range
 * is a computed summary of a set. So the set is printed.
 */

/**
 * A menu's availability window, reduced to the pieces a caption needs.
 *
 * Deliberately not a formatted string: the day names are translated, `t()` takes
 * one argument and does no interpolation, and this module has no business
 * importing a dictionary. So the model decides *what* the window is and the
 * component decides how to say it.
 */
export interface AvailabilityView {
  /** All seven days — the caller may render one word instead of listing them. */
  everyDay: boolean;
  /**
   * Every day the vendor selected, in week order, deduplicated, unrecognised
   * codes dropped. Empty when the menu names no days.
   *
   * Week order rather than the array's own order because the API sends this
   * unordered — one live vendor sends `["MON","TUE","WED","SAT","SUN","THU"]`,
   * which printed positionally reads as a mistake. Reordering a *set* into the
   * order a week is read is presentation, not a reinterpretation of the data;
   * the set itself is untouched.
   */
  days: DayCode[];
  /** The backend's own `"HH:MM"` strings, or `""` when it sent none. */
  startTime: string;
  endTime: string;
  /** The vendor's IANA zone, or `""` if the vendor record carried none. */
  timezone: string;
}

/**
 * A menu's `availability`, or `null` when there is nothing worth showing.
 *
 * ## 🔴 This is a caption, never a gate
 *
 * The backend stores and returns `availability` but **does not evaluate it
 * against the clock** — a menu whose window closed at 11:30 still comes back
 * from the public endpoint at 3pm, and its products are still orderable. So
 * nothing derived from this may hide a menu, disable a product, or reorder
 * anything. A frontend that enforced the window would either hide a menu the
 * backend would happily take an order from, or show one it would refuse — and
 * which of those it did would depend on the minute the page was opened.
 *
 * ## The three shapes that occur
 *
 * Measured across every live menu: fully populated (`[MON…SUN] 10:00–22:00`),
 * present but empty (`daysOfWeek: [], startTime: "", endTime: ""`), and absent
 * altogether. The last two return `null` — a menu with no window renders no
 * caption at all, not an "Available: —" placeholder.
 *
 * A window with days but no times, or times but no days, is kept: half a window
 * is still information the vendor entered on purpose.
 *
 * ## Times are wall-clock, and are not converted
 *
 * `"10:00"` means ten in the morning *at the restaurant*. There is no instant
 * here to convert and no date to attach one to, so the strings pass through
 * untouched and the zone is named beside them. Rendering them in the viewer's
 * timezone would be the bug this comment exists to prevent.
 */
export function buildAvailabilityView(
  availability: unknown,
  timezone: string | null | undefined,
): AvailabilityView | null {
  if (!availability || typeof availability !== "object") return null;
  const source = availability as {
    daysOfWeek?: unknown;
    startTime?: unknown;
    endTime?: unknown;
  };

  const present = new Set<string>();
  for (const day of asArray(source.daysOfWeek)) {
    if (typeof day === "string") present.add(day.trim().toUpperCase());
  }

  const days = WEEK_DAYS.filter((day) => present.has(day));

  const startTime =
    typeof source.startTime === "string" ? source.startTime.trim() : "";
  const endTime =
    typeof source.endTime === "string" ? source.endTime.trim() : "";

  // Nothing the vendor filled in — no days and no hours. Render nothing.
  if (days.length === 0 && !startTime && !endTime) return null;

  return {
    // Counted from the codes actually recognised, so an unknown day code in the
    // array cannot make six days look like seven.
    everyDay: WEEK_DAYS.every((day) => present.has(day)),
    days,
    startTime,
    endTime,
    timezone: typeof timezone === "string" ? timezone.trim() : "",
  };
}

/**
 * Every product a menu's sections resolve to, de-duplicated, in first-seen
 * order.
 *
 * Not used to render the grouped body — that keeps the sections apart, which is
 * the point of the feature. It exists so a caller can answer "does this menu
 * lead anywhere at all?" without flattening the view twice, and so
 * `verify:menu` can assert the subset property: everything a menu surfaces must
 * already be in the flat product list, never something the list lacks.
 */
export function menuViewProducts<P extends JoinableProduct>(
  view: readonly MenuSectionView<P>[],
): P[] {
  const seen = new Set<P>();
  const out: P[] = [];
  for (const section of view ?? []) {
    for (const product of section?.products ?? []) {
      if (seen.has(product)) continue;
      seen.add(product);
      out.push(product);
    }
  }
  return out;
}
