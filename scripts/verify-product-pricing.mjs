/**
 * Checks that a product discount is applied the way the backend applies it.
 *
 *   pnpm verify:product-pricing
 *
 * No token, no network. The numbers below are the live API's, recorded on
 * 2026-08-17.
 *
 * ## What this is defending
 *
 * `pricing.discount` means two different things depending on
 * `pricing.discountType`, and for a long time nothing in the project read that
 * field — `grep -rn discountType src` matched only a type declaration. Every
 * call site multiplied by `(1 - discount / 100)`, so a FLAT €0.60 discount was
 * rendered as 0.6% and Chocolate Salami's Large option showed €1.99 where the
 * cart charged €1.40.
 *
 * The base price was never affected: `pricing.finalPrice` comes pre-computed
 * and the code already used it. Only the **variation options** are the client's
 * to calculate, which is exactly the case with no backend figure to fall back on
 * — and so the case worth pinning here.
 *
 * The two FLAT rows come from `GET /carts/view-cart` with both variations of
 * `PROD-W61R90` in the basket at once. Large is the row that matters: at
 * `originalPrice 2, discount 0.6 → unitPrice 1.4` it rules out "the flat amount
 * scales with the option price" and "the option inherits the base finalPrice",
 * which the Medium row alone (1 → 0.4) cannot distinguish.
 */

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

const { applyProductDiscount, formatDiscountValue, hasProductDiscount } =
  await import(join(here, "../src/lib/productPricing.ts"));

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

const near = (name, got, want) =>
  check(name, Math.abs(got - want) < 0.005, `${got} (wanted ~${want})`);

function section(title) {
  console.log(`\n${title}`);
}

/** Chocolate Salami, `PROD-W61R90` — €1 base, €0.60 off, options at 1 and 2. */
const FLAT = { price: 1, discount: 0.6, discountType: "FLAT", finalPrice: 0.4 };
/** Pepperoni Feast Pizza, `PROD-IQE1S9` — options at 12.99 and 16.99. */
const PCT = { price: 12.99, discount: 10, discountType: "PERCENTAGE", finalPrice: 11.69 };

section("🔴 FLAT — the amount comes off the option, not a percentage of it");
{
  // Both verbatim from the cart with both variations in the basket.
  near("Medium (€1 option) → €0.40", applyProductDiscount(1, FLAT), 0.4);
  near("Large (€2 option) → €1.40", applyProductDiscount(2, FLAT), 1.4);

  // The bug, stated as its own assertion so it can't quietly return.
  check(
    "not read as 0.6% — Large must not be €1.99",
    Math.abs(applyProductDiscount(2, FLAT) - 2 * (1 - 0.6 / 100)) > 0.005,
    `${applyProductDiscount(2, FLAT)}`,
  );

  // The two alternatives the Medium row alone can't rule out.
  check(
    "the discount does not scale with the option price",
    Math.abs(applyProductDiscount(2, FLAT) - 0.8) > 0.005,
  );
  check(
    "an option does not inherit the base finalPrice",
    Math.abs(applyProductDiscount(2, FLAT) - FLAT.finalPrice) > 0.005,
  );

  // Assumption, not a measurement — no product in the catalogue discounts by
  // more than an option costs. A negative price is never the better guess.
  near("clamped at zero", applyProductDiscount(0.5, FLAT), 0);
}

section("PERCENTAGE — unchanged behaviour");
{
  near("the base agrees with the API's finalPrice", applyProductDiscount(12.99, PCT), 11.69);
  near("a dearer option scales", applyProductDiscount(16.99, PCT), 15.291);
  near("100% off is free", applyProductDiscount(9, { discount: 100, discountType: "PERCENTAGE" }), 0);
}

section("No discount, and discounts we don't understand");
{
  near("zero discount leaves the price alone", applyProductDiscount(15, { discount: 0, discountType: "PERCENTAGE" }), 15);
  near("absent pricing leaves the price alone", applyProductDiscount(15, undefined), 15);
  // Conservative on purpose: guessing "percentage" for an unknown type is how
  // the FLAT bug happened, and overstating a saving is the worse failure.
  near("an unknown type is not guessed at", applyProductDiscount(15, { discount: 5, discountType: "BUY_ONE_GET_ONE" }), 15);
  near("a discount with no type at all", applyProductDiscount(15, { discount: 5 }), 15);

  check("no badge without a usable discount", !hasProductDiscount({ discount: 5 }));
  check("no badge at zero", !hasProductDiscount({ discount: 0, discountType: "FLAT" }));
  check("badge for FLAT", hasProductDiscount(FLAT));
  check("badge for PERCENTAGE", hasProductDiscount(PCT));
}

section("The badge says which kind it is");
{
  check("FLAT reads as money", formatDiscountValue(FLAT, "€") === "€0.60", formatDiscountValue(FLAT, "€"));
  check("PERCENTAGE reads as a rate", formatDiscountValue(PCT, "€") === "10%", formatDiscountValue(PCT, "€"));
  // The whole visible symptom, in one line.
  check(
    "a €0.60 discount never renders as '0.6%'",
    formatDiscountValue(FLAT, "€") !== "0.6%",
  );
  // A fractional rate is the backend's claim to make, not ours to round.
  check(
    "a fractional percentage is printed as sent",
    formatDiscountValue({ discount: 12.5, discountType: "PERCENTAGE" }, "€") === "12.5%",
  );
  check("nothing to show → no badge", formatDiscountValue({ discount: 0 }, "€") === null);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
