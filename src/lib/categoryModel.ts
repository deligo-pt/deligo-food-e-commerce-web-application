/**
 * The vendor page's Product → Category grouping, as a pure model.
 *
 * ## What replaced the menus
 *
 * `GET /menus/open/:vendorId` and `GET /menus/open/:menuId/sections` were
 * removed from the backend. Both now answer `404 API Not Found !!`, and so does
 * the authenticated `/menus` — verified against `api-test-food` on 2026-08-29
 * with a valid bearer token, in a run where `/products/open` and
 * `/categories/businessCategory/open` returned 200 from the same host. The
 * backend's `category-guide` confirms this is a deletion, not a migration
 * window: the Menu/MenuSection system "was removed from the codebase on
 * 2026-08-29 and is not part of the category model". The 404s will not reverse.
 *
 * What took its place is a field on the product itself:
 *
 * ```json
 * "category": { "_id": "6a92d641…", "name": "FAST FOOD TESTING", "id": "6a92d641…" }
 * ```
 *
 * Present on 29 of 29 live products, anonymous and authenticated alike; never
 * `null`, never absent. `Product.category` is a **required** field per the
 * backend doc — which makes the defensive branches below legacy guards rather
 * than live paths. They stay: a document that predates the requirement must not
 * take a restaurant's page down, and must not vanish from it either.
 *
 * `additionalCategories` is not read here. The doc removed it on the same day —
 * "a product has a single canonical category only" — and what still appears in
 * the payload (9 of 29 products) is legacy documents.
 *
 * ## 🟢 Why this file is a tenth of the size of what it replaced
 *
 * The deleted `menuModel.ts` was 392 lines, almost all of them a join. The menu
 * section payload handed back a *stub* product — `_id`, `name` as `{ en, pt }`,
 * `slug`, raw `pricing`, and no `finalPrice`, no business `productId`, no
 * `description` — so the ids had to be resolved against `GET /products` to
 * avoid re-deriving a price from that stub, which is the mistake
 * `productPricing.ts` documents.
 *
 * `category` arrives **on the real product object**, beside `finalPrice`,
 * `productId`, `images` and `description`. So there is still no join, no
 * unjoinable-item count, and nothing here reads a price at all — the second
 * request this page makes is for the vendor's category list, not for the
 * products' own fields.
 *
 * ## 🔴 The label localizes; the grouping must not
 *
 * `ProductCategory.name` is *stored* as `{ en, pt }`, but the API resolves it
 * server-side and sends a plain string. Same vendor, same request, one header
 * apart:
 *
 * ```
 * Accept-Language: en  →  FAST FOODS · BEVERAGES · FOOD
 * Accept-Language: pt  →  FAST FOOD  · BEBIDAS   · COMIDA
 * ```
 *
 * The `_id` is byte-identical across both. So **grouping keys on `_id` and the
 * name is only ever rendered** — switching language re-labels every heading
 * while the groups, their order and their contents stay exactly where they
 * were. Nothing here unwraps `{ en, pt }`, and nothing should start: the field
 * arrives already resolved, and `apiClient` sends `Accept-Language` from the
 * current language on every request while `useVendorProducts` keys its query on
 * `lang`, so a switch refetches rather than serving stale labels.
 *
 * ## 🔴 The vendor's own category list is the authority — but nothing is dropped
 *
 * `GET /product-categories/open?vendorId=…` returns the categories a vendor
 * owns and has active. Those are the groups, in that order, under those names.
 *
 * A product filed under anything else — a legacy platform category, or nothing
 * readable at all — lands in a single **trailing "Other" group**. It is not
 * shown under a category the vendor does not own, and it is not hidden either.
 *
 * That is the resolution of two instructions given in sequence. First: *"the
 * products which are not in the category, do not show them […] this update make
 * this categories required in the vendor side."* Then: *"the items which does
 * not have any categories, add them under Other categories."* The first rejects
 * showing a sea-food dish under `BEVERAGES`; the second rejects losing it. A
 * trailing group satisfies both — the wrong label is gone, the product is not.
 *
 * The scale is why it matters. Measured across all seven live vendors on
 * 2026-08-29: 22 of 34 products sit outside their own vendor's category list,
 * and three vendors — Restaurante Bom, Sumu's Bites, Apex — own no category that
 * any of their products use. Without this group those three render an empty
 * page. Sumu's owns `PIZZA`, `PASTA` and `CHEESE PIZZA`, all empty, while all
 * five of its products are filed elsewhere.
 *
 * `uncategorizedCount` is reported in development so the migration stays
 * visible: the group working is not the same as the data being right.
 *
 * ## Order is copied, never computed
 *
 * Groups come out in **the order the endpoint returned them**, and products stay
 * in the order `/products` gave them. Nothing here sorts, because there is
 * nothing to sort by: the ProductCategory schema carries no `sortOrder` and no
 * `priority` (confirmed by the backend doc), so the response order *is* the
 * vendor's order as far as this page is concerned.
 *
 * ## Everything here is total
 *
 * Every function accepts `unknown` and returns a usable value for any input.
 * `verify:category` fuzzes them with the shapes observed live plus the ones
 * that plausibly follow.
 */

/**
 * The trailing group for products the vendor's own category list does not cover.
 *
 * A sentinel rather than an empty string so it cannot collide with a real key:
 * category ids are 24-character hex.
 */
export const UNCATEGORIZED_GROUP_ID = "__uncategorized__";

/** The category object as `GET /products` populates it. */
export interface ProductCategoryRef {
  _id?: string | null;
  /** Mongoose's virtual, sent alongside `_id` and identical to it. */
  id?: string | null;
  name?: string | null;
}

/** The only thing this module needs to know about a product. */
export interface CategorizedProduct {
  category?: ProductCategoryRef | null;
}

/**
 * One category and the products filed under it.
 *
 * There is no `count` field on purpose: it would be `products.length` stored
 * twice, and the copy is free to drift from the array it describes. Callers
 * read `group.products.length`, which cannot.
 *
 * There is no `slug` either. `/product-categories/open` sends one, but the
 * category populated onto a product carries `_id`, `id` and `name` and nothing
 * else — and that endpoint is never called (see the ordering note above).
 * `categoryDomId` derives scroll targets from `id`, which every group has.
 */
export interface CategoryGroup<P> {
  /**
   * Stable key: the category id, a `name:`-derived key, or the sentinel. Does
   * not change with language — see the localization note above.
   */
  id: string;
  /**
   * Rendered verbatim: never re-cased, never truncated, and never localized
   * here — it arrives already resolved for the request's `Accept-Language`.
   *
   * 🔴 **Guaranteed non-empty.** A group with products but a blank heading is a
   * dead pill in the nav and an unlabelled block on the page, so a group whose
   * name reads blank takes the caller's `fallbackName` instead.
   */
  name: string;
  products: P[];
}

/** Trimmed string, or `null` for anything that is not usable text. */
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The `category` object on a product, or `null` if there isn't one. */
function categoryRef(product: unknown): ProductCategoryRef | null {
  if (!product || typeof product !== "object") return null;
  const raw = (product as { category?: unknown }).category;
  if (!raw || typeof raw !== "object") return null;
  return raw as ProductCategoryRef;
}

/**
 * The id a product's category groups under, or `null` if it groups under none.
 *
 * `_id` is what every live product carries; `id` is Mongoose's virtual, read as
 * a fallback because it costs one branch and covers a projection that drops
 * `_id`.
 *
 * Falling back to a **name-derived key** matters: a category object with a name
 * and no id still names a real group, and sending it to "uncategorized" would
 * throw away the one piece of information it has. The key is lowercased so two
 * spellings of one name merge; the *displayed* name stays whatever the first
 * product spelled it (see `groupByCategory`).
 *
 * That fallback key is the one thing here that is **not** language-stable: the
 * name localizes, so the same category would key differently in `en` and `pt`.
 * It is left as-is rather than hardened, because it can only fire on a category
 * object with no `_id` and no `id`, which the backend's required `ObjectId` ref
 * cannot produce. If it ever did fire, a language switch would change the group
 * id, `CategoryNav` would find its stored id missing, and it would fall back to
 * the first pill — degraded, not broken. See the derivation in that component.
 */
export function productCategoryId(product: unknown): string | null {
  const ref = categoryRef(product);
  if (!ref) return null;

  const id = text(ref._id) ?? text(ref.id);
  if (id) return id;

  const name = text(ref.name);
  return name ? `name:${name.toLowerCase()}` : null;
}

/**
 * A product's category name, exactly as the backend spelled it, or `""`.
 *
 * No casing applied. Live values are already upper case (`FOOD`, `FAST FOODS`,
 * `FRUITS & VEGETABLES`) and re-casing them here would put the frontend in
 * charge of a string the vendor typed.
 */
export function productCategoryName(product: unknown): string {
  const ref = categoryRef(product);
  return ref ? text(ref.name) ?? "" : "";
}

/** One entry from `GET /product-categories/open?vendorId=…`. */
export interface VendorCategory {
  _id?: string | null;
  id?: string | null;
  name?: string | null;
}

export interface VendorCategoryView<P> {
  /**
   * Owned categories that have at least one product, in the endpoint's order,
   * followed by the "Other" group when anything landed in it.
   */
  groups: CategoryGroup<P>[];
  /**
   * How many products ended up in "Other" — i.e. are not in any category their
   * vendor owns.
   *
   * They are on the page, so this is not an error and is never shown to
   * customers. It exists so a developer seeing a large "Other" group is told the
   * number rather than counting cards, and so the migration has a metric. Zero
   * once every product has been re-filed, at which point the group stops being
   * emitted at all.
   */
  uncategorizedCount: number;
}

/**
 * Bucket a vendor's products into the categories that vendor owns, with a
 * trailing group for everything else.
 *
 * All three arguments come from outside and all three are typed loosely,
 * because all three have been observed empty in live data: a vendor with no
 * categories, a category with no products, and a product whose category the
 * vendor does not own.
 *
 * `fallbackName` labels the trailing group. It is a parameter rather than a
 * `t()` call because this module is pure — no React, no translation store — and
 * the page that renders the group is the thing that knows the language.
 *
 * Rules, each one a guard in `verify:category`:
 *
 * - **Order is the category list's order**, copied. Never sorted. The "Other"
 *   group is always last, whatever position its products appeared in.
 * - **Names come from the category list**, not from the product's embedded
 *   copy. Two sources carry a name; the owned list is the authority, so a stale
 *   name on an old product document cannot reach the screen.
 * - **An owned category with no products is omitted.** It is a dead scroll
 *   target and a `(0)` row in the sidebar.
 * - **No product is ever dropped.** Every input product comes back in exactly
 *   one group. Losing one silently is the `NO_SHOW` failure shape: no error, no
 *   count, no empty state, just an item that is not there.
 * - Products keep the order `/products` gave them, inside every group.
 */
export function groupByVendorCategories<P extends CategorizedProduct>(
  products: readonly P[] | null | undefined,
  categories: readonly VendorCategory[] | null | undefined,
  fallbackName: string,
): VendorCategoryView<P> {
  const productList = Array.isArray(products) ? products : [];
  const categoryList = Array.isArray(categories) ? categories : [];

  const groups: CategoryGroup<P>[] = [];
  const byId = new Map<string, CategoryGroup<P>>();

  for (const category of categoryList) {
    if (!category || typeof category !== "object") continue;
    const id = text(category._id) ?? text(category.id);
    // A category with no usable id cannot be a scroll target and cannot match a
    // product, so it is not a category this page can render.
    if (!id || byId.has(id)) continue;

    const group: CategoryGroup<P> = {
      id,
      // A blank name would render an unlabelled heading and a dead sidebar row.
      // Falling back to the name a product embedded is better than either.
      name: text(category.name) ?? "",
      products: [],
    };
    byId.set(id, group);
    groups.push(group);
  }

  const uncategorized: P[] = [];
  for (const product of productList) {
    const id = productCategoryId(product);
    const group = id ? byId.get(id) : undefined;
    if (!group) {
      uncategorized.push(product);
      continue;
    }
    if (!group.name) group.name = productCategoryName(product);
    group.products.push(product);
  }

  const rendered = groups.filter((group) => group.products.length > 0);

  // Appended last regardless of where its products appeared, so a first product
  // the vendor has not re-filed cannot push an "Other" heading to the top of
  // their storefront. Omitted entirely when empty, which is what a fully
  // migrated vendor looks like.
  if (uncategorized.length > 0) {
    rendered.push({
      id: UNCATEGORIZED_GROUP_ID,
      name: fallbackName,
      products: uncategorized,
    });
  }

  return { groups: rendered, uncategorizedCount: uncategorized.length };
}

/**
 * The DOM id of a group's heading — the anchor `CategoryNav` scrolls to.
 *
 * Category ids are hex and safe as-is, but name-derived keys and the sentinel
 * are not, so everything outside `[A-Za-z0-9_-]` is replaced. The `category-`
 * prefix keeps these out of the way of ids the rest of the page owns.
 *
 * Two different group ids can only collide here if they differ solely in
 * characters that get replaced, which no live id does.
 */
export function categoryDomId(groupId: string): string {
  const safe = String(groupId ?? "").replace(/[^A-Za-z0-9_-]/g, "-");
  return `category-${safe}`;
}
