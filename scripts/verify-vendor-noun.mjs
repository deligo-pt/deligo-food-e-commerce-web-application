/**
 * What the app calls a vendor, and whether it can still call a shop a
 * restaurant.
 *
 *   pnpm verify:vendor-noun
 *
 * No token, no network.
 *
 * ## The bug this locks shut
 *
 * A customer looking at shampoo in a cosmetics store was told **"This
 * restaurant is closed — you can browse the menu"**: two wrong nouns in one
 * sentence, in both languages, on `deligo.pt/vendors/V-ZSBZVQMF`. Every
 * "closed" message in the app was written for restaurants and rendered for
 * every vendor type on the platform.
 *
 * `src/lib/vendorKind.ts` decides the noun from the vendor's own
 * `businessDetails.businessType`, which the API sends in two different shapes
 * (a string on the vendor lists, an object on `/products/open/:id` — both
 * measured live on 19 Sep 2026). This script checks the decision, checks that
 * the copy exists for all three kinds in both languages, and checks that no
 * screen has gone back to a single hardcoded noun.
 *
 * ## Why Portuguese decides the shape of the fix
 *
 * The obvious fix — one sentence with a `{vendor}` slot — cannot work:
 * *o restaurante* is masculine and *a loja* feminine, so the article and the
 * adjective both change ("Este restaurante está fechado" against "Esta loja
 * está fechada"). The keys carry the kind as a suffix instead.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const src = (...parts) => join(here, "..", "src", ...parts);
const read = (file) => readFileSync(file, "utf8");

const { getVendorKind, vendorCopyKey } = await import(src("lib/vendorKind.ts"));
const en = await import(src("assets/translations/en.ts"));
const pt = await import(src("assets/translations/pt.ts"));
const EN = en.default ?? en;
const PT = pt.default ?? pt;

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

const section = (title) => console.log(`\n${title}`);

section("The kind comes from the vendor's own record");
{
  check("a restaurant is a restaurant", getVendorKind("RESTAURANT") === "restaurant");
  check("a store is a store", getVendorKind("STORE") === "store");
  check(
    "the object shape `/products/open/:id` sends is read too",
    getVendorKind({ slug: "store", name: { en: "STORE", pt: "LOJA" } }) === "store" &&
      // Each half on its own: a payload that carries only one of the two must
      // still be read, and dropping either branch must fail here.
      getVendorKind({ slug: "restaurant" }) === "restaurant" &&
      getVendorKind({ name: { en: "STORE" } }) === "store",
    "measured live: the vendor lists send a string, the product endpoint an object",
  );
  check(
    "a grocery or shop type counts as a store",
    getVendorKind("grocery-store") === "store" && getVendorKind("SHOP") === "store",
  );
  check(
    "🔴 an absent type is nobody's restaurant",
    getVendorKind(undefined) === "partner" && getVendorKind(null) === "partner",
    "some endpoints populate four fields of businessDetails; guessing 'restaurant' there is the original bug with better odds",
  );
  check(
    "a type we have not seen is not guessed",
    getVendorKind("PHARMACY") === "partner",
  );
}

section("The copy exists for every kind, in both languages");
{
  const bases = ["storeClosedTitle", "storeClosedNotice", "storeClosedCannotOrder"];
  const kinds = ["restaurant", "store", "partner"];
  const missing = [];
  for (const base of bases) {
    for (const kind of kinds) {
      const key = vendorCopyKey(base, kind);
      if (!EN[key]) missing.push(`en.${key}`);
      if (!PT[key]) missing.push(`pt.${key}`);
    }
  }
  check("all nine keys are translated twice", missing.length === 0, missing.join(", "));

  check(
    "the store copy says products, not menu",
    /products/i.test(EN.storeClosedNoticeStore) &&
      !/menu/i.test(EN.storeClosedNoticeStore) &&
      /produtos/i.test(PT.storeClosedNoticeStore),
    "a shop has no menu to browse",
  );
  check(
    "🔴 Portuguese agrees with itself",
    PT.storeClosedTitleStore.includes("Esta loja") &&
      PT.storeClosedTitleStore.includes("fechada") &&
      PT.storeClosedTitleRestaurant.includes("Este restaurante"),
    "a {vendor} slot would produce 'Este loja está fechado' for half the platform",
  );
}

section("🔴 No screen calls every vendor a restaurant");
{
  const screens = [
    "components/vendors/ProductDetailsModal.tsx",
    "components/vendors/VendorDetailsPage.tsx",
    "components/vendors/ProductQuantityStepper.tsx",
  ].map((file) => [file, read(src(file))]);

  for (const [file, source] of screens) {
    check(
      `${file.split("/").pop()} resolves the noun per vendor`,
      /vendorCopyKey\(/.test(source),
      "the closed copy must be chosen from the vendor's kind",
    );
    check(
      `${file.split("/").pop()} has no single-noun closed key left`,
      !/t\("storeClosed(Title|Notice|CannotOrder)"\)/.test(source),
    );
  }

  const client = read(src("lib/apiClient.ts"));
  check(
    "the API client's closed message is vendor-neutral",
    /This partner is closed/.test(client) && !/This restaurant is closed/.test(client),
    "that layer sees an error code, not a vendor — and the string was English-only for both languages",
  );

  const orderCopy = [EN.waitingRestaurantConfirmation, EN.restaurantAcceptedOrder,
    EN.restaurantPreparingMeal, EN.orderWasRejected, EN.restaurantAddressPending,
    EN.restaurant, EN.searchOrdersPlaceholder];
  check(
    "the order screens name no restaurant",
    orderCopy.every((line) => !/restaurant/i.test(String(line))),
    orderCopy.filter((line) => /restaurant/i.test(String(line))).join(" | "),
  );
  const orderCopyPt = [PT.waitingRestaurantConfirmation, PT.restaurantAcceptedOrder,
    PT.restaurantPreparingMeal, PT.orderWasRejected, PT.restaurantAddressPending,
    PT.restaurant, PT.searchOrdersPlaceholder];
  check(
    "nor in Portuguese",
    orderCopyPt.every((line) => !/restaurante/i.test(String(line))),
    orderCopyPt.filter((line) => /restaurante/i.test(String(line))).join(" | "),
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
