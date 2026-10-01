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
