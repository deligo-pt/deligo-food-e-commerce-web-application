/**
 * Which id a vendor is addressed by — and which one it used to be.
 *
 * No React, so `pnpm verify:vendor-id` can run every rule here without a
 * browser.
 *
 * ## The change
 *
 * Every vendor document carries two ids: a Mongo `_id` (mirrored as `id`) and
 * a business `userId` shaped `V-XXXXXXXX`. Until 24 Sep 2026 the customer API
 * keyed on the **userId** — `/vendors/customer/V-PIYE3122` answered, and the
 * Mongo id 404'd — so that is the id this app put in its routes.
 *
 * The backend has since reversed it. Verified against the test API on
 * 24 Sep 2026, with and without a token:
 *
 * | call                              | `V-…`                        | object id |
 * | --------------------------------- | ---------------------------- | --------- |
 * | `GET /vendors/nearby/open/:id`    | 400 "The provided ID is invalid." | 200 |
 * | `GET /vendors/customer/:id`       | 400 same                     | 200 |
 * | `GET /products?vendorId=`         | 400 same                     | 200 |
 * | `GET /products/open?vendorId=`    | 400 same                     | 200 |
 * | `GET /product-categories/open?vendorId=` | 400 "A vendorId is required…" | 200 |
 *
 * That last message is the invalid-id path wearing the missing-id message, and
 * it is worth knowing: a `V-…` there does not look like a bad id, it looks
 * like a bad request.
 *
 * So the object id is now the only id that resolves anywhere, and it is the id
 * our `/vendors/:vendorId` route takes. `userId` is still returned on every
 * vendor payload — it is a display/business id now, not a lookup key. Nothing
 * here should reach for it again.
 *
 * ## What did not change
 *
 * Products are still addressed by their business `productId` (`PROD-XXXXXX`):
 * `GET /products/open/PROD-N7DE6R` answers, `GET /products/open/<product _id>`
 * 404s. `?product=` in a share link is that id, and it stays.
 */

/** A vendor reference as any of the endpoints hand it over. */
export interface VendorIdentifiers {
  id?: string | null;
  _id?: string | null;
  userId?: string | null;
}

/** 24 hex characters — what Mongo ids look like, and nothing else does. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** A `V-XXXXXXXX` / `SV-XXXXXXXX` business id. Both prefixes are in use. */
const LEGACY_USER_ID = /^S?V-[A-Z0-9]+$/i;

export function isVendorObjectId(value: string | null | undefined): boolean {
  return typeof value === "string" && OBJECT_ID.test(value);
}

/**
 * A link written before the change — `/vendors/V-PIYE3122`. Shared links live
 * in other people's chats, so the store page resolves these rather than 404ing
 * on them; see `useLegacyVendorRedirect`.
 */
export function isLegacyVendorUserId(value: string | null | undefined): boolean {
  return typeof value === "string" && LEGACY_USER_ID.test(value);
}

/**
 * The id to put in a URL for this vendor. `/vendors/nearby/open` returns `id`,
 * a few populated documents carry only `_id`, and both are the same value.
 *
 * Returns `""` when neither is present, which callers turn into the listing
 * rather than a `/vendors/undefined` that reads as "this store is gone".
 */
export function vendorRouteId(vendor: VendorIdentifiers | null | undefined): string {
  return vendor?.id ?? vendor?._id ?? "";
}

/** Where a vendor card points: its store page, or the listing if it has no id. */
export function vendorHref(vendor: VendorIdentifiers | null | undefined): string {
  const id = vendorRouteId(vendor);
  return id ? `/vendors/${encodeURIComponent(id)}` : "/vendors";
}

/**
 * A product as the product endpoints return it, for the one field that says
 * whose it is. Populated on some routes, a bare id on others.
 */
export interface ProductVendorRef {
  vendorId?: string | VendorIdentifiers | null;
}

/** The owning vendor's object id, `""` when the product does not say. */
export function productVendorId(product: ProductVendorRef | null | undefined): string {
  const ref = product?.vendorId;
  if (typeof ref === "string") return ref;
  return vendorRouteId(ref);
}

/**
 * The products on this page that are actually **this store's**.
 *
 * ## Why a store page has to check
 *
 * On 27 Sep 2026 the customer product endpoints began filtering by proximity,
 * and proximity **overrides `vendorId`**: `/products/open?vendorId=<Tasca>`
 * with coordinates answered with 30 products belonging to *five* vendors, 19 of
 * them other restaurants'. Nothing about the response says so — the items are
 * well-formed, they simply are not this store's, and they land in the trailing
 * "Other" group because their categories are not in this store's category list.
 *
 * The page already knows which store it is rendering, so it never has to trust
 * the server's filtering to answer that. This is the check that should have
 * been here from the beginning; `?vendorId=` merely made it look unnecessary.
 *
 * ## A product that does not say whose it is, is kept
 *
 * Dropping those instead would be the more aggressive read, and the more
 * dangerous one: a route that omits `vendorId` *because it already filtered
 * server-side* would empty the store page completely. Letting an unattributed
 * product through is no worse than today. Every product on `/products/open`
 * does carry the field, so this is a guard against a shape we have not seen,
 * not against the one that broke.
 */
export function ownedBy<T>(products: readonly T[], vendorId: string | null | undefined): T[] {
  if (!vendorId) return [...products];
  return products.filter((product) => {
    const owner = productVendorId(product as ProductVendorRef);
    return owner === "" || owner === vendorId;
  });
}
