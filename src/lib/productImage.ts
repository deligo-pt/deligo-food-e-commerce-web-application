/**
 * A product's picture, wherever it happens to live.
 *
 * The API changed from `images: [url]` to `image: url` in Sep 2026 without
 * migrating the rows behind it, so the catalogue holds both shapes at once —
 * measured 30 Sep 2026 on the Gulshan branch: "Ice Cream" carries only
 * `image`, the other eleven dishes only `images`. Reading `images[0]` alone
 * showed Ice Cream as a placeholder although its picture loads fine.
 *
 * `image` is checked first: it is the shape the API now writes, so a product
 * that carries both is showing its newer picture — the same rule, and the same
 * order, as the vendor portal's `getProductImage`, so the vendor and the
 * customer see the same photo.
 *
 * No React, so it can be checked by a script.
 */
export function getProductImage(
  product: { image?: string | null; images?: (string | null | undefined)[] | null } | null | undefined,
): string | undefined {
  return product?.image?.trim() || product?.images?.find((url) => !!url?.trim()) || undefined;
}

/**
 * A store's menu as "product id → picture", for the screens whose payload
 * carries no picture of its own.
 *
 * Search hits (`thumbnail`), cart lines and order lines (`image`) are filled
 * by the backend from `product.image` only, so every product still in the old
 * `images: [url]` shape arrives with none — measured 1 Oct 2026: 64 of 97
 * search hits, and `image: ""` on the Octopus cart line. The picture exists;
 * the payload just did not copy it. `ProductImage` looks it up here.
 *
 * Keyed by both ids a screen may hold: the Mongo `_id` (cart, orders, a search
 * hit's `id`) and the `PROD-…` business code (a search hit's `productId`).
 */
export function buildProductImageIndex(
  products:
    | readonly ({ _id?: string; id?: string; productId?: string } & NonNullable<
        Parameters<typeof getProductImage>[0]
      >)[]
    | null
    | undefined,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const product of products ?? []) {
    const url = getProductImage(product);
    if (!url) continue;
    for (const key of [product?._id, product?.id, product?.productId]) {
      if (key) index.set(key, url);
    }
  }
  return index;
}
