/**
 * A product's picture is read from both shapes the API stores.
 *
 *   pnpm verify:product-image
 *
 * No token, no network.
 *
 * ## The bug this locks shut
 *
 * The store page and the dish popup read only `images[0]`, so a product saved
 * after the API moved to a single `image` field showed a placeholder although
 * its picture loads — "Ice Cream" on the Gulshan branch, 30 Sep 2026.
 */

import { register } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const src = (...parts) => join(here, "..", "src", ...parts);
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const { getProductImage, buildProductImageIndex } = await import(src("lib/productImage.ts"));

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail === undefined ? "" : `  → ${detail}`}`);
  }
}

const NEW = "https://storage-test.deligo.pt/…/ice-cream.webp";
const OLD = "https://storage-test.deligo.pt/…/soup.webp";

console.log("\nWhich field is read");
check("🔴 the newer `image` field alone is read", getProductImage({ image: NEW }) === NEW, "Ice Cream on Gulshan carries only this");
check("the older `images[0]` alone is read", getProductImage({ images: [OLD] }) === OLD);
check(
  "🔴 with both, `image` wins — the vendor portal's order",
  getProductImage({ image: NEW, images: [OLD] }) === NEW,
  "main Tasca's Chicken Soup carries different pictures in the two",
);
check(
  "blank values are skipped, not rendered as an empty src",
  getProductImage({ image: "  ", images: ["", OLD] }) === OLD &&
    getProductImage({ image: "", images: [] }) === undefined &&
    getProductImage(null) === undefined,
);

console.log("\n🔴 Both surfaces use it");
for (const [label, file] of [
  ["the store page's dish card", "components/vendors/VendorDetailsPage.tsx"],
  ["the dish popup", "components/vendors/ProductDetailsModal.tsx"],
]) {
  const code = stripComments(readFileSync(src(file), "utf8"));
  check(
    `🔴 ${label}`,
    /src=\{getProductImage\(product\)\}/.test(code) && !/src=\{product\.images\?\.\[0\]\}/.test(code),
  );
}

console.log("\n🔴 Screens whose payload has no picture look it up (1 Oct 2026)");
{
  const index = buildProductImageIndex([
    { _id: "m1", productId: "PROD-A", images: [OLD] },
    { _id: "m2", productId: "PROD-B", image: NEW },
    { _id: "m3", productId: "PROD-C" },
  ]);
  check(
    "🔴 the menu index answers by Mongo id and by PROD- code, old shape included",
    index.get("m1") === OLD && index.get("PROD-A") === OLD && index.get("m2") === NEW,
    "cart and order lines hold the Mongo id; a search hit holds both",
  );
  check("a product with no picture is not in the index", !index.has("m3") && !index.has("PROD-C"));

  const hook = stripComments(readFileSync(src("hooks/queries/useProductImageIndex.ts"), "utf8"));
  check(
    "🔴 one lookup per store, asked from the store's own position",
    /queryKey: \["product-image-index", vendorId \?\? ""\]/.test(hook) &&
      /vendorCoords\(res\.data\?\.data\)/.test(hook) &&
      /withCoords\(\{ vendorId, limit: 100 \}, place\)/.test(hook),
    "asked from the customer's position, a distant store answers an empty menu",
  );
  const component = stripComments(readFileSync(src("components/shared/ProductImage.tsx"), "utf8"));
  check(
    "🔴 the lookup only runs when the payload has no picture",
    /useProductImageIndex\(vendorId, \{\s*enabled: !own,/.test(component),
    "a payload with its own picture must cost nothing",
  );
  check(
    "the DeliGo default picture is the fallback, and exists",
    /fallbackSrc=\{own \|\| found \|\| settledWithout \? DEFAULT_PRODUCT_IMAGE : undefined\}/.test(component) &&
      existsSync(join(here, "..", "public", "images", "default-product.png")),
  );

  for (const [label, file] of [
    ["search results", "app/(main)/search/SearchContent.tsx"],
    ["cart rows", "components/cart/CartProductRow.tsx"],
    ["checkout", "components/cart/CheckoutPage.tsx"],
    ["payment", "components/payment/PaymentPage.tsx"],
    ["order cards", "components/orders/OrderCard.tsx"],
    ["the rating dialog", "components/orders/OrdersPage.tsx"],
  ]) {
    const code = stripComments(readFileSync(src(file), "utf8"));
    check(
      `🔴 ${label} use ProductImage with a product id and a store`,
      /<ProductImage[\s\S]{0,200}productIds=\{\[[^\]]+\]\}[\s\S]{0,80}vendorId=\{/.test(code) &&
        !/<SafeImage\s+src=\{(item\.image|hit\.thumbnail|image)\}/.test(code),
      "a bare SafeImage on these fields shows the grey icon for every old-shape product",
    );
  }
  check(
    "search passes the hit's own _geo as the store position",
    /place=\{hasLocation\(hit\) \? \{ lat: hit\._geo\.lat, lng: hit\._geo\.lng \} : null\}/.test(
      stripComments(readFileSync(src("app/(main)/search/SearchContent.tsx"), "utf8")),
    ),
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
