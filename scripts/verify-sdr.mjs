/**
 * The container deposit (SDR) on the customer side — product, cart, payment,
 * order.
 *
 *   pnpm verify:sdr
 *
 * No token, no network. `src/lib/sdr.ts` is run directly; the screens are read
 * as source, because the rules that matter are about which number is added to
 * which, and none of them is visible to `tsc`, `eslint` or the build.
 *
 * ## The rule this exists for (sdr.md §3)
 *
 * - The **cart** `grandTotal` does NOT include the deposit. Show it beside the
 *   cart total ("plus deposit", "added at payment"), never folded in.
 * - The **checkout / order** `payoutSummary.grandTotal` DOES include it. A row
 *   for it is fine; adding it to the total again shows more than is charged.
 * - `409 CHECKOUT_TOTALS_CHANGED` (deposit changed after the checkout was
 *   priced) is answered by refreshing the summary and showing it, never by a
 *   red failure or a silent retry.
 *
 * Shapes come from the test API on 18 Oct 2026 (deposit switched off, so every
 * amount is 0) and from order `ORD-M7TBUAAGYB` on the vendor side (€0.15).
 */

import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(here, "..", file), "utf8");
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const sdr = await import(join(here, "../src/lib/sdr.ts"));
const action = await import(join(here, "../src/lib/paymentAction.ts"));

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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (title) => console.log(`\n${title}`);

// ─── lib/sdr.ts ──────────────────────────────────────────────────────────────
section("§1 lib/sdr.ts — every shape of \"no deposit\" reads as none");
{
  const { productDeposit, lineDeposit, cartDepositTotal, orderDepositTotal } = sdr;
  const none = { unit: 0, total: 0, containers: 0 };
  check("product, live today (flagged, deposit off)", productDeposit({ sdr: { applicable: true, depositAmount: 0, currency: "EUR" } }) === 0);
  check("product, not applicable", productDeposit({ sdr: { applicable: false, depositAmount: 0.15 } }) === 0);
  check("product, no sdr object (a fields= projection without it)", productDeposit({}) === 0);
  check("product, €0.15", productDeposit({ sdr: { applicable: true, depositAmount: 0.15 } }) === 0.15);
  check("cart line, live today", same(lineDeposit({ sdr: { applicable: false, unitDeposit: 0, lineTotal: 0 } }), none));
  check(
    "cart line without a containers field derives the count",
    same(lineDeposit({ sdr: { applicable: true, unitDeposit: 0.15, lineTotal: 0.3 } }), { unit: 0.15, total: 0.3, containers: 2 }),
  );
  check(
    "checkout line keeps the containers it was given",
    same(lineDeposit({ sdr: { applicable: true, containers: 3, unitDeposit: 0.15, lineTotal: 0.45 } }), { unit: 0.15, total: 0.45, containers: 3 }),
  );
  check("cart total, live today", cartDepositTotal({ cartCalculation: { sdrTotal: 0 } }) === 0);
  check("cart total rounds float noise to the cent", cartDepositTotal({ cartCalculation: { sdrTotal: 0.30000000000000004 } }) === 0.3);
  check("order with no deposit fields", orderDepositTotal({ payoutSummary: { grandTotal: 11.66 } }) === 0);
  check("order like ORD-M7TBUAAGYB (€0.15)", orderDepositTotal({ payoutSummary: { grandTotal: 10.31, sdr: { amount: 0.15 } } }) === 0.15);
  check(
    "bad input never throws and never shows money",
    same([productDeposit(null), orderDepositTotal(undefined), lineDeposit({ sdr: { applicable: true, unitDeposit: -1, lineTotal: Number.NaN } }).total], [0, 0, 0]),
  );
}

section("§1b add-on deposits (25 Oct 2026) — counted into the line, per add-on unit");
{
  const { productDeposit, addonDeposit, lineDeposit } = sdr;
  // Shapes from the test API: product "Banana" ×2 with the "Tissue" add-on
  // "Medium" ×3, every item one container at €0.10.
  const cartLine = {
    sdr: { applicable: true, containerCount: 1, totalContainers: 2, unitDeposit: 0.1, depositPerUnit: 0.1, lineTotal: 0.2 },
    addons: [{ quantity: 3, sdr: { applicable: true, containerCount: 1, totalContainers: 3, unitDeposit: 0.1, depositPerUnit: 0.1, lineTotal: 0.3 } }],
  };
  const checkoutLine = {
    sdr: { applicable: true, containerCount: 1, containers: 2, unitDeposit: 0.1, lineTotal: 0.2 },
    addons: [{ quantity: 3, sdr: { applicable: true, containerCount: 1, unitDeposit: 0.1, lineTotal: 0.3 } }],
  };
  check("cart line: product + add-on", same(lineDeposit(cartLine), { unit: 0.1, total: 0.5, containers: 5 }), JSON.stringify(lineDeposit(cartLine)));
  check("checkout line: add-on containers derived", same(lineDeposit(checkoutLine), { unit: 0.1, total: 0.5, containers: 5 }), JSON.stringify(lineDeposit(checkoutLine)));
  check(
    "add-on deposit on a product without one",
    same(lineDeposit({ sdr: { applicable: false }, addons: [checkoutLine.addons[0], { sdr: { applicable: false } }] }), { unit: 0.1, total: 0.3, containers: 3 }),
  );
  check("line without add-ons is unchanged", same(lineDeposit({ sdr: checkoutLine.sdr }), { unit: 0.1, total: 0.2, containers: 2 }));
  check("add-on option, 1 container", addonDeposit({ sdr: { applicable: true, containerCount: 1, unitDeposit: 0.1, depositAmount: 0.1 } }) === 0.1);
  check("add-on option, 6 containers", addonDeposit({ sdr: { applicable: true, containerCount: 6, unitDeposit: 0.1 } }) === 0.6);
  check("add-on option, SDR off", addonDeposit({ sdr: { applicable: false, containerCount: 1, unitDeposit: 0.1 } }) === 0);
  check("product with containerCount 2", productDeposit({ sdr: { applicable: true, containerCount: 2, unitDeposit: 0.1, depositAmount: 0.1 } }) === 0.2);
}

// ─── screens read through lib/sdr ───────────────────────────────────────────
const files = {
  modal: stripComments(read("src/components/vendors/ProductDetailsModal.tsx")),
  card: stripComments(read("src/components/vendors/VendorDetailsPage.tsx")),
  row: stripComments(read("src/components/cart/CartProductRow.tsx")),
  store: stripComments(read("src/components/cart/CartStoreCard.tsx")),
  checkout: stripComments(read("src/components/cart/CheckoutPage.tsx")),
  payment: stripComments(read("src/components/payment/PaymentPage.tsx")),
  order: stripComments(read("src/components/orders/TrackOrder/TrackOrder.tsx")),
  invoice: stripComments(read("src/lib/invoice.ts")),
};

section("§2 every screen reads the deposit through lib/sdr.ts");
{
  const DIRECT = /\.sdr\??\.(depositAmount|unitDeposit|lineTotal|amount|containers)|sdrTotal\b(?!\s*\?:)/;
  for (const [name, src] of Object.entries(files)) {
    check(`${name}: imports from lib/sdr`, /from "(@\/lib|\.)\/sdr"/.test(src));
    check(`${name}: never reads an sdr field directly`, !DIRECT.test(src), (src.match(DIRECT) || [])[0]);
  }
}

section("§2b add-ons named with their own deposit (order page, invoice)");
{
  const { addonLineDeposit } = sdr;
  check("an add-on line's own deposit", same(addonLineDeposit({ sdr: { applicable: true, containerCount: 1, unitDeposit: 0.1, lineTotal: 0.1 } }), { unit: 0.1, total: 0.1, containers: 1 }));
  check("an add-on without SDR has none", addonLineDeposit({ sdr: { applicable: false } }).total === 0 && addonLineDeposit(undefined).total === 0);
  check("order page lists each item's add-ons", /item\.addons\.map\(/.test(files.order) && /resolveAddonName\(addon\.name/.test(files.order));
  check("order page: an SDR add-on shows its deposit", /addonLineDeposit\(addon\)/.test(files.order));
  check("order page: the container count never splits", /whitespace-nowrap">\s*\(\{lineDeposit\(item\)\.containers\}/.test(files.order));
  check("invoice: an SDR add-on row shows its deposit", /addonLineDeposit\(addon\)/.test(files.invoice));
}

section("§3 🔴 cart totals exclude the deposit — shown beside, never folded in");
{
  check("product modal: Add to Cart keeps the food total", /const total = subtotal;/.test(files.modal) && !/(total|subtotal)\s*\+\s*(depositPerItem|depositTotal|addonsDeposit)/.test(files.modal));
  check("product modal: says \"plus deposit\" under the button", /t\("sdrPlusDeposit"\)/.test(files.modal));
  check("checkout step: Final Price is the cart's own total", /€\{summary\.total\.toFixed\(2\)\}/.test(files.checkout));
  // Exactly the items' own total — any other right-hand side (a deposit added
  // on the same line, a second +=) is what this guards against.
  check(
    "checkout step: deposit kept apart from the total",
    /acc\.deposit \+= lineDeposit\(item\)\.total;/.test(files.checkout) &&
      ((files.checkout.split("const summary = useMemo(")[1] || "").split("}, [vendorItems]);")[0].match(/acc\.total \+=[^;]*;/g) || []).join() ===
        "acc.total += item.itemSummary.grandTotal;" &&
      !/summary\.total\s*\+\s*summary\.deposit/.test(files.checkout),
  );
  check("checkout step: deposit row says it is added at payment", /t\("sdrAddedAtPayment"\)/.test(files.checkout));
  check("store card: the active total excludes it", !/activeTotal\s*\+\s*activeDeposit/.test(files.store) && /t\("sdrContainerDepositAtPayment"\)/.test(files.store));
}

section("§4 🔴 checkout and order totals already include it — never added again");
{
  check("payment page: Total to Pay is payoutSummary.grandTotal", /const orderTotal = payoutSummary\.grandTotal;/.test(files.payment));
  check("payment page: nothing adds the deposit to it", !/orderTotal\s*\+\s*depositTotal|grandTotal\s*\+\s*depositTotal|depositTotal\s*\+\s*orderTotal/.test(files.payment));
  check("payment page: a deposit row of its own", /t\("sdrDeposit"\)/.test(files.payment) && /depositTotal > 0 &&/.test(files.payment));
  check("order page: Total Amount is payoutSummary.grandTotal", /const grandTotal = payout\.grandTotal \|\| 0;/.test(files.order));
  check("order page: nothing adds the deposit to it", !/grandTotal\s*\+\s*depositTotal|depositTotal\s*\+\s*grandTotal/.test(files.order));
  check("order page: a deposit row of its own", /t\("sdrDeposit"\)/.test(files.order) && /depositTotal > 0 &&/.test(files.order));
  check("invoice: Pay is payoutSummary.grandTotal", /const grandTotal = order\.payoutSummary\?\.grandTotal \?\? 0;/.test(files.invoice) && /money\(grandTotal, tValueX/.test(files.invoice));
  check("invoice: nothing adds the deposit to it", !/grandTotal\s*\+\s*depositTotal|depositTotal\s*\+\s*grandTotal/.test(files.invoice));
  check("invoice: a deposit row in the totals, and room for it in the panel", /totalRow\(t\("sdrDeposit"\), depositTotal\)/.test(files.invoice) && /\(depositTotal > 0 \? 1 : 0\)/.test(files.invoice));
  check("invoice: per-item note carries no amount in the Total column", /if \(deposit\.total > 0\) \{[\s\S]{0,260}doc\.text\(/.test(files.invoice) && !/if \(deposit\.total > 0\) \{[\s\S]{0,300}money\(/.test(files.invoice));
}

section("§5 409 CHECKOUT_TOTALS_CHANGED refreshes, never fails or retries silently");
{
  const r = action.readPaymentActionResponse({
    success: false,
    message: "Checkout totals changed.",
    errorKey: "CHECKOUT_TOTALS_CHANGED",
    data: null,
  });
  check("the payment reader keeps the errorKey of a refusal without data.code", r.errorKey === "CHECKOUT_TOTALS_CHANGED");
  check("…also when it only sits under err", action.readPaymentActionResponse({ err: { errorKey: "CHECKOUT_TOTALS_CHANGED" } }).errorKey === "CHECKOUT_TOTALS_CHANGED");
  check("hosted payment path handles it before the state switch", /result\.errorKey === "CHECKOUT_TOTALS_CHANGED"/.test(files.payment));
  check("saved-card path handles it in its catch", /getApiErrorKey\(err\) === "CHECKOUT_TOTALS_CHANGED"/.test(files.payment));
  check("it refreshes the summary on the server", /\/checkout\/summary\/\$\{summary\._id\}\/refresh/.test(files.payment));
  check("then shows the new total with a note, not a red failure", /setTotalsChanged\(true\)/.test(files.payment) && /t\("checkoutTotalsChanged"\)/.test(files.payment));
}

section("§6 every SDR string exists in English and Portuguese");
{
  const en = read("src/assets/translations/en.ts");
  const pt = read("src/assets/translations/pt.ts");
  for (const key of ["sdrDeposit", "sdrDepositShort", "sdrPerItem", "sdrPlusDeposit", "sdrExplanation", "sdrAddedAtPayment", "sdrContainerDepositAtPayment", "checkoutTotalsChanged"]) {
    const re = new RegExp(`\\n  ${key}:\\s*\\n?\\s*"`);
    check(`${key} in en and pt`, re.test(en) && re.test(pt));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
