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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const src = (...parts) => join(here, "..", "src", ...parts);
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const { getProductImage } = await import(src("lib/productImage.ts"));

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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
