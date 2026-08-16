/**
 * Checks the fee-VAT helpers that make a price breakdown add up.
 *
 *   pnpm verify:tax
 *
 * No token, no network. `src/lib/tax.ts` is four small functions and every one
 * of them decides money that a customer reads and is charged.
 *
 * ## The property that matters
 *
 * The two fees are reported differently and both have to end up gross on
 * screen: `serviceCharge` arrives **net** with its VAT beside it, while
 * `totalDeliveryCharge` is already **gross**. `payoutSummary.grandTotal`
 * charges both with VAT, so a breakdown that shows the service fee net is short
 * by exactly the tax and visibly fails to sum to the amount taken.
 *
 * And the caption has to agree with the figure it captions. `getServiceChargeGross`
 * and `getServiceChargeTax` both read the API's `serviceChargeVatAmount` and
 * both fall back to the standard rate the same way, so
 * `gross === net + tax` holds whether or not the backend sent the field. That
 * identity is what most of this file asserts — a summary reading
 * "Service charge €1.23 (incl. tax €0.00)" is the failure it exists to stop.
 *
 * Real payloads, from `GET /orders` on 2026-08-16: every one of 39 orders
 * carried `serviceCharge: 1`, `serviceChargeVatRate: 23`,
 * `serviceChargeVatAmount: 0.23`.
 */

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

const {
  addTax,
  extractTax,
  getDeliveryTax,
  getServiceChargeGross,
  getServiceChargeTax,
  STANDARD_TAX_RATE,
} = await import(join(here, "../src/lib/tax.ts"));

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

/** The `orderCalculation` shape every order on the test account carries. */
const REAL = { serviceCharge: 1, serviceChargeVatRate: 23, serviceChargeVatAmount: 0.23 };

section("The rate, and the two directions of it");
{
  check("standard rate is Portugal's 23%", STANDARD_TAX_RATE === 23, STANDARD_TAX_RATE);
  near("addTax puts VAT on a net amount", addTax(1), 1.23);
  near("extractTax pulls it back out of a gross one", extractTax(1.23), 0.23);
  near("the two are inverses", extractTax(addTax(4.07)), addTax(4.07) - 4.07);
  near("extractTax of zero", extractTax(0), 0);
  near("extractTax of a negative is zero, not a credit", extractTax(-5), 0);
}

section("🔴 The service fee — reported net, charged gross");
{
  // Showing the net figure leaves the breakdown short by exactly the tax, and
  // the summary stops summing to `payoutSummary.grandTotal`.
  near("gross on the real payload", getServiceChargeGross(REAL), 1.23);
  near("tax on the real payload", getServiceChargeTax(REAL), 0.23);

  // The identity the caption depends on.
  check("gross === net + tax",
    Math.abs(getServiceChargeGross(REAL) - (REAL.serviceCharge + getServiceChargeTax(REAL))) < 0.005);

  // An older deployment that omits the VAT field must not caption "€0.00"
  // beside a figure that plainly contains tax — both helpers fall back.
  const legacy = { serviceCharge: 1 };
  near("gross falls back to the standard rate", getServiceChargeGross(legacy), 1.23);
  near("tax falls back the same way", getServiceChargeTax(legacy), 0.23);
  check("…so the identity still holds without the field",
    Math.abs(getServiceChargeGross(legacy) - (1 + getServiceChargeTax(legacy))) < 0.005);

  // No fee, no row, no caption.
  near("no service charge → gross 0", getServiceChargeGross({ serviceCharge: 0 }), 0);
  near("no service charge → tax 0", getServiceChargeTax({ serviceCharge: 0 }), 0);
  near("absent field → gross 0", getServiceChargeGross({}), 0);
  near("absent field → tax 0", getServiceChargeTax({}), 0);

  // A backend that reports zero VAT is believed, not second-guessed.
  near("an explicit zero VAT is honoured",
    getServiceChargeTax({ serviceCharge: 1, serviceChargeVatAmount: 0 }), 0);
  near("…and the gross is then the net",
    getServiceChargeGross({ serviceCharge: 1, serviceChargeVatAmount: 0 }), 1);

  // A rate other than 23 must survive — the rate is the backend's to decide.
  near("a non-standard VAT amount is used as sent",
    getServiceChargeTax({ serviceCharge: 2, serviceChargeVatAmount: 0.12 }), 0.12);
}

section("Delivery — reported gross");
{
  near("uses the VAT the API sends",
    getDeliveryTax({ vatAmount: 0.12, totalDeliveryCharge: 0.62 }), 0.12);
  near("extracts it when absent", getDeliveryTax({ totalDeliveryCharge: 1.23 }), 0.23);
  near("free delivery has no tax", getDeliveryTax({ totalDeliveryCharge: 0 }), 0);
  near("an explicit zero is honoured",
    getDeliveryTax({ vatAmount: 0, totalDeliveryCharge: 5 }), 0);
  near("an empty delivery object", getDeliveryTax({}), 0);
}

section("The whole breakdown reconciles with what was charged");
{
  // ORD-NHRJYEAID3, verbatim: itemsSubtotal 1.6 — which is GROSS, with
  // `totalTaxAmount: 0.3` already inside it, which is why the summary captions
  // that row rather than adding a separate tax line. Service 1 + 0.23 VAT, no
  // delivery. `payoutSummary.grandTotal` = 2.83.
  const itemsSubtotal = 1.6;
  const itemsTax = 0.3;
  const delivery = { charge: 0, vatAmount: 0, totalDeliveryCharge: 0 };

  const shown =
    itemsSubtotal + getServiceChargeGross(REAL) +
    (delivery.totalDeliveryCharge ?? 0);

  near("the rows sum to the real grand total (€2.83)", shown, 2.83);
  // Adding the item tax on top would double-count it — the mistake this
  // assertion was written with, and caught by, on the first run.
  check("the subtotal's tax is inside it, not beside it",
    Math.abs(itemsSubtotal + itemsTax + getServiceChargeGross(REAL) - 2.83) > 0.005);
  check("the service row's caption is part of its own figure",
    getServiceChargeTax(REAL) < getServiceChargeGross(REAL));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
