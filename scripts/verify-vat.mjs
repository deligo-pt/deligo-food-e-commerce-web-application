/**
 * Checks the fee-VAT helpers that make a price breakdown add up.
 *
 *   pnpm verify:vat
 *
 * No token, no network. `src/lib/vat.ts` is four small functions and every one
 * of them decides money that a customer reads and is charged.
 *
 * ## The property that matters
 *
 * The two fees are reported differently and both have to end up gross on
 * screen: `serviceCharge` arrives **net** with its VAT beside it, while
 * `totalDeliveryCharge` is already **gross**. `payoutSummary.grandTotal`
 * charges both with VAT, so a breakdown that shows the service fee net is short
 * by exactly the VAT and visibly fails to sum to the amount taken.
 *
 * And the caption has to agree with the figure it captions. `getServiceChargeGross`
 * and `getServiceChargeVat` both read the API's `serviceChargeVatAmount` and
 * both fall back to the standard rate the same way, so
 * `gross === net + VAT` holds whether or not the backend sent the field. That
 * identity is what most of this file asserts — a summary reading
 * "Service charge €1.23 (incl. VAT €0.00)" is the failure it exists to stop.
 *
 * Real payloads, from `GET /orders` on 2026-08-16: every one of 39 orders
 * carried `serviceCharge: 1`, `serviceChargeVatRate: 23`,
 * `serviceChargeVatAmount: 0.23`.
 */

import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

const {
  addVat,
  extractVat,
  getDeliveryVat,
  getServiceChargeGross,
  getServiceChargeVat,
  STANDARD_VAT_RATE,
} = await import(join(here, "../src/lib/vat.ts"));

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
  check("standard rate is Portugal's 23%", STANDARD_VAT_RATE === 23, STANDARD_VAT_RATE);
  near("addVat puts VAT on a net amount", addVat(1), 1.23);
  near("extractVat pulls it back out of a gross one", extractVat(1.23), 0.23);
  near("the two are inverses", extractVat(addVat(4.07)), addVat(4.07) - 4.07);
  near("extractVat of zero", extractVat(0), 0);
  near("extractVat of a negative is zero, not a credit", extractVat(-5), 0);
}

section("🔴 The service fee — reported net, charged gross");
{
  // Showing the net figure leaves the breakdown short by exactly the VAT, and
  // the summary stops summing to `payoutSummary.grandTotal`.
  near("gross on the real payload", getServiceChargeGross(REAL), 1.23);
  near("VAT on the real payload", getServiceChargeVat(REAL), 0.23);

  // The identity the caption depends on.
  check("gross === net + VAT",
    Math.abs(getServiceChargeGross(REAL) - (REAL.serviceCharge + getServiceChargeVat(REAL))) < 0.005);

  // An older deployment that omits the VAT field must not caption "€0.00"
  // beside a figure that plainly contains VAT — both helpers fall back.
  const legacy = { serviceCharge: 1 };
  near("gross falls back to the standard rate", getServiceChargeGross(legacy), 1.23);
  near("VAT falls back the same way", getServiceChargeVat(legacy), 0.23);
  check("…so the identity still holds without the field",
    Math.abs(getServiceChargeGross(legacy) - (1 + getServiceChargeVat(legacy))) < 0.005);

  // No fee, no row, no caption.
  near("no service charge → gross 0", getServiceChargeGross({ serviceCharge: 0 }), 0);
  near("no service charge → VAT 0", getServiceChargeVat({ serviceCharge: 0 }), 0);
  near("absent field → gross 0", getServiceChargeGross({}), 0);
  near("absent field → VAT 0", getServiceChargeVat({}), 0);

  // A backend that reports zero VAT is believed, not second-guessed.
  near("an explicit zero VAT is honoured",
    getServiceChargeVat({ serviceCharge: 1, serviceChargeVatAmount: 0 }), 0);
  near("…and the gross is then the net",
    getServiceChargeGross({ serviceCharge: 1, serviceChargeVatAmount: 0 }), 1);

  // A rate other than 23 must survive — the rate is the backend's to decide.
  near("a non-standard VAT amount is used as sent",
    getServiceChargeVat({ serviceCharge: 2, serviceChargeVatAmount: 0.12 }), 0.12);
}

section("Delivery — reported gross");
{
  near("uses the VAT the API sends",
    getDeliveryVat({ vatAmount: 0.12, totalDeliveryCharge: 0.62 }), 0.12);
  near("extracts it when absent", getDeliveryVat({ totalDeliveryCharge: 1.23 }), 0.23);
  near("free delivery has no VAT", getDeliveryVat({ totalDeliveryCharge: 0 }), 0);
  near("an explicit zero is honoured",
    getDeliveryVat({ vatAmount: 0, totalDeliveryCharge: 5 }), 0);
  near("an empty delivery object", getDeliveryVat({}), 0);
}

section("The whole breakdown reconciles with what was charged");
{
  // ORD-NHRJYEAID3, verbatim: itemsSubtotal 1.6 — which is GROSS, with
  // `totalTaxAmount: 0.3` already inside it, which is why the summary captions
  // that row rather than adding a separate VAT line. Service 1 + 0.23 VAT, no
  // delivery. `payoutSummary.grandTotal` = 2.83.
  const itemsSubtotal = 1.6;
  const itemsTax = 0.3;
  const delivery = { charge: 0, vatAmount: 0, totalDeliveryCharge: 0 };

  const shown =
    itemsSubtotal + getServiceChargeGross(REAL) +
    (delivery.totalDeliveryCharge ?? 0);

  near("the rows sum to the real grand total (€2.83)", shown, 2.83);
  // Adding the item VAT on top would double-count it — the mistake this
  // assertion was written with, and caught by, on the first run.
  check("the subtotal's VAT is inside it, not beside it",
    Math.abs(itemsSubtotal + itemsTax + getServiceChargeGross(REAL) - 2.83) > 0.005);
  check("the service row's caption is part of its own figure",
    getServiceChargeVat(REAL) < getServiceChargeGross(REAL));
}

section("The invoice says which rows already contain their VAT");
{
  /**
   * 🔴 Reported from a printed invoice: "Service Fee" alone, between
   * "Subtotal (incl. VAT)" and "Delivery fee (incl. VAT)".
   *
   * The figure was never wrong — `getServiceChargeGross` has been adding the
   * backend's `serviceChargeVatAmount` all along, which is exactly why the two
   * rows either side of it say so. Only the caption was missing, and the row
   * that lost it is the one a reader is least able to check: a subtotal can be
   * added up from the items above it, a service fee cannot.
   *
   * Asserted as a relationship across the three rows rather than as three
   * strings. The invoice prints exactly three gross figures, they are captioned
   * by the same convention, and that convention is per-language — "(incl. VAT)"
   * in English, "(IVA incl.)" in Portuguese. What must hold is that the three
   * agree with each other inside each dictionary, whatever the wording becomes.
   */
  const readDict = (lang) =>
    readFileSync(join(here, "..", `src/assets/translations/${lang}.ts`), "utf8");
  const GROSS_ROWS = ["invoiceSubtotal", "invoiceServiceFee", "invoiceDeliveryFee"];

  for (const lang of ["en", "pt"]) {
    const dict = readDict(lang);
    const labels = GROSS_ROWS.map((key) => {
      const m = new RegExp(`^  ${key}: "([^"]*)",`, "m").exec(dict);
      return m ? m[1] : null;
    });

    check(
      `[${lang}] every gross row on the invoice is captioned`,
      labels.every((l) => l !== null && /\(.*\)/.test(l)),
      `${GROSS_ROWS.map((k, i) => `${k}=${labels[i] ?? "MISSING"}`).join(" | ")}`,
    );

    // The parenthesised part of each, compared to the others. Three rows that
    // each say it differently is the same defect one step along.
    const captions = labels.map((l) => (l ? /\(([^)]*)\)/.exec(l)?.[1] : null));
    check(
      `[${lang}] …and all three say it the same way`,
      captions.every((c) => c && c === captions[0]),
      `captions: ${captions.join(" / ")}`,
    );
  }

  // The rows that are NOT gross must not claim to be. `invoiceTotalPrice` is
  // the pre-discount list price and `invoiceDiscount` is a deduction; captioning
  // either would be asserting something about VAT that this invoice does not
  // compute.
  for (const lang of ["en", "pt"]) {
    const dict = readDict(lang);
    const netish = ["invoiceTotalPrice", "invoiceDiscount", "invoicePay"].map((key) => {
      const m = new RegExp(`^  ${key}: "([^"]*)",`, "m").exec(dict);
      return m ? m[1] : "";
    });
    check(
      `[${lang}] no VAT caption on a row that is not a gross figure`,
      netish.every((l) => !/\(/.test(l)),
      netish.join(" | "),
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
