/**
 * The ⓘ VAT and delivery breakdowns on the checkout, payment and order pages.
 *
 *   pnpm verify:vat-breakdown
 *
 * No token, no network: `src/lib/vatBreakdown.ts` run on figures the test API
 * returned on 27 Oct 2026 — order ORD-HCOTHW3RAQ, and a checkout of Test Kids
 * Menu + Banana ×2 + Medium ×3 without and with a 20% voucher. The popup is a
 * table, Price | of which VAT: its bottom line must be the figure on the page
 * row it explains, to the cent, and every row's VAT must belong to its price.
 */

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { subtotalBreakdown, deliveryBreakdown } = await import(join(here, "../src/lib/vatBreakdown.ts"));
const en = (await import(join(here, "../src/assets/translations/en.ts"))).default ?? {};
const pt = (await import(join(here, "../src/assets/translations/pt.ts"))).default ?? {};
const tEn = (k) => en[k] ?? k;
const tPt = (k) => pt[k] ?? k;

let passed = 0;
let failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail === undefined ? "" : `  → ${detail}`}`); }
};
const cents = (n) => Math.round(n * 100);
const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);
/** VAT inside a gross price at a rate, to the cent. */
const vatIn = (gross, rate) => Math.round((gross - gross / (1 + rate / 100)) * 100) / 100;

const delivery = { charge: 2.47, vatRate: 23, vatAmount: 0.57, totalDeliveryCharge: 3.04, distance: 2.88 };
const service = { gross: 0.12, vat: 0.02, rate: 23 };
const kids = { name: "Test Kids Menu 01", productPricing: { taxRate: 13 }, itemSummary: { quantity: 1, totalTaxAmount: 1.73, grandTotal: 15 } };

const cases = [
  {
    name: "order ORD-HCOTHW3RAQ (Tiramisu + Small)",
    items: [{ name: "Tiramisu", productPricing: { taxRate: 13 }, itemSummary: { quantity: 1, totalTaxAmount: 1.38, grandTotal: 17 }, addons: [{ name: "Small", quantity: 1, taxRate: 6, taxAmount: 0.57, lineTotal: 10 }] }],
    rows: [[7, 0.81, 13], [10, 0.57, 6], [0.12, 0.02, 23]],
    pageSubtotal: 17.12, pageVat: 1.4, voucher: 0,
  },
  {
    name: "checkout: Test Kids Menu + Banana ×2 + Medium ×3",
    items: [kids, { name: "Banana - Large", productPricing: { taxRate: 13 }, itemSummary: { quantity: 2, totalTaxAmount: 2.92, grandTotal: 33 }, addons: [{ name: "Medium", quantity: 3, taxRate: 6, taxAmount: 0.85, lineTotal: 15 }] }],
    rows: [[15, 1.73, 13], [18, 2.07, 13], [15, 0.85, 6], [0.12, 0.02, 23]],
    pageSubtotal: 48.12, pageVat: 4.67, voucher: 0,
  },
  {
    name: "the same with the 20% voucher (−€9.60)",
    items: [
      { name: "Test Kids Menu 01", productPricing: { taxRate: 13 }, itemSummary: { quantity: 1, totalTaxAmount: 1.38, grandTotal: 12 } },
      { name: "Banana - Large", productPricing: { taxRate: 13 }, itemSummary: { quantity: 2, totalTaxAmount: 2.34, grandTotal: 26.4 }, addons: [{ name: "Medium", quantity: 3, taxRate: 6, taxAmount: 0.68, lineTotal: 12 }] },
    ],
    rows: [[12, 1.38, 13], [14.4, 1.66, 13], [12, 0.68, 6], [0.12, 0.02, 23]],
    pageSubtotal: 48.12, pageVat: 3.74, voucher: 9.6,
  },
];

for (const c of cases) {
  console.log(`\n${c.name}`);
  const b = subtotalBreakdown({ items: c.items, lang: "en", t: tEn, service, voucherDiscount: c.voucher, pageSubtotal: c.pageSubtotal });
  const got = b.rows.map((r) => [r.price, r.vat]);
  check("rows are the backend's prices and VAT", JSON.stringify(got) === JSON.stringify(c.rows.map(([p, v]) => [p, v])), JSON.stringify(got));
  check("every row's VAT belongs to its own price (rate checked)", c.rows.every(([p, v, rate]) => Math.abs(vatIn(p, rate) - v) <= 0.01));
  check("the VAT column adds up to the page's \"Incl. VAT\"", cents(b.total.vat) === cents(c.pageVat) && cents(sum(b.rows, "vat")) === cents(c.pageVat));
  if (c.voucher) {
    check("after the voucher: Price total = Subtotal − voucher", cents(b.total.price) === cents(c.pageSubtotal - c.voucher));
    check("the voucher line quotes the page", b.voucherLine === "Subtotal €48.12 − voucher €9.60 = €38.52", b.voucherLine);
    check("and says VAT is on the discounted prices", b.notes.includes(tEn("vatAfterVoucher")));
  } else {
    check("the Price column adds up to the Subtotal row", cents(b.total.price) === cents(c.pageSubtotal));
    check("no voucher line", b.voucherLine === undefined && b.total.label === tEn("subtotal"));
  }
}

console.log("\ndelivery fee");
{
  const d = deliveryBreakdown({ delivery, t: tEn });
  check("one row: €3.04, of which VAT €0.57", d.rows.length === 1 && cents(d.rows[0].price) === 304 && cents(d.rows[0].vat) === 57 && d.rows[0].rateLabel === "VAT 23%");
  check("bottom line = the Delivery Fee row", cents(d.total.price) === 304 && cents(d.total.vat) === 57);
  check("the distance is explained", d.notes[0]?.includes("2.88 km"));
}

console.log("\ncheckout page (before the fees are priced)");
{
  const b = subtotalBreakdown({ items: [kids], lang: "en", t: tEn });
  check("no service row", b.rows.length === 1);
  check("says the fees come at payment", b.notes.includes(tEn("vatFeesAtPayment")));
  check("bottom line is the cart's Final Price, €15.00 incl. €1.73", cents(b.total.price) === 1500 && cents(b.total.vat) === 173);
}

console.log("\nPortuguese");
{
  const b = subtotalBreakdown({ items: [kids], lang: "pt", t: tPt, service, voucherDiscount: 3, pageSubtotal: 15.12 });
  const d = deliveryBreakdown({ delivery, t: tPt });
  const keys = ["vatBreakdownTitle", "vatBreakdownIntro", "breakdownPrice", "breakdownVatColumn", "breakdownAfterVoucher", "breakdownVoucherLine", "vatAfterVoucher", "vatFeesAtPayment", "deliveryBreakdownOpen", "deliveryBreakdownTitle", "deliveryDistanceNote", "vatRate", "vatBreakdownOpen", "vatBreakdownDone"];
  const missing = keys.filter((k) => !en[k] || !pt[k]);
  check("every text exists in EN and PT", missing.length === 0, missing.join(", "));
  check("PT labels", b.rows[0].rateLabel === "IVA 13%" && b.title === pt.vatBreakdownTitle && d.title === pt.deliveryBreakdownTitle && b.total.label === pt.breakdownAfterVoucher);
}

console.log("\nthe service fee lives inside the Subtotal (payment and order pages)");
{
  const { readFileSync } = await import("node:fs");
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const [name, file] of [["payment page", "src/components/payment/PaymentPage.tsx"], ["order page", "src/components/orders/TrackOrder/TrackOrder.tsx"]]) {
    const src = strip(readFileSync(join(here, "..", file), "utf8"));
    check(`${name}: Subtotal = items + service fee`, /const subtotalShown = subtotal \+ serviceCharge;/.test(src) && /€\{subtotalShown\.toFixed\(2\)\}/.test(src));
    check(`${name}: its "Incl. VAT" includes the fee's VAT`, /const subtotalShownVat = subtotalVat \+ serviceChargeVat;/.test(src) && /subtotalShownVat\.toFixed\(2\)/.test(src));
    check(`${name}: no separate Service Fee row`, !/\{t\("serviceCharge"\)\}/.test(src));
  }
  // The row, its caption and the popup describe one figure: €15.12 incl. €1.75.
  const b = subtotalBreakdown({ items: [kids], lang: "en", t: tEn, service });
  check("Test Kids Menu: the popup's bottom line is the row, €15.12 incl. €1.75", cents(b.total.price) === 1512 && cents(b.total.vat) === 175);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
