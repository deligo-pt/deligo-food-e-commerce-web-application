/**
 * Rider instructions — the box, and the four ways an order gets created.
 *
 *   pnpm verify:rider-instructions
 *
 * No token, no network.
 *
 * ## What was wrong
 *
 * The cart page had a "Delivery Instructions" textarea whose own comment said
 * it was "local-only state and is not sent to /checkout". It was true: the
 * customer typed a line for the courier, pressed Proceed, and the text was
 * dropped on unmount. Meanwhile the payment page has been sending
 * `deliveryNotes: ""` to `create-order` since it was written.
 *
 * So the field existed on the order all along and nothing ever filled it.
 *
 * ## Why this needs a guard rather than a commit message
 *
 * An order can be created by **four** different paths in this app, and a note
 * that reaches three of them is worse than one that reaches none — it works
 * when you test it and vanishes for the customer who pays the other way:
 *
 *   1. the redirect flow (card, wallets). Until 8 Oct 2026 the return pages
 *      created the order with `create-order` and sent the note on it. Now the
 *      backend creates the order itself once RedUniq confirms the payment, and
 *      no payment endpoint accepts `deliveryNotes` yet (`plan.md`, Phase 0):
 *      the note waits in the pending order until one does, and is cleared
 *      once the order is placed (`PaymentResult`)
 *   2. (was the alternate success route, `SuccessContent` — removed with
 *      `create-order`; `/payment-success` now renders `PaymentResult` too)
 *   3. one-click with a saved card — the order is created **by the payment
 *      endpoint**, so the note has to travel on that call or not at all
 *   4. pickup — which has no rider, and must send nothing
 *
 * The rules below are what keeps those four in step, plus the one that made
 * the whole thing possible: the text survives a full page load through a
 * payment gateway, so it lives in `sessionStorage` under one key rather than in
 * React state under four spellings.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(here, "..", file), "utf8");
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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

const {
  DELIVERY_NOTES_KEY,
  MAX_RIDER_INSTRUCTIONS,
  MAX_VENDOR_INSTRUCTIONS,
  checkoutNotesBody,
  outgoingDeliveryNotes,
  outgoingVendorInstructions,
} = await import(join(here, "../src/lib/deliveryNotes.ts"));

const payment = read("src/components/payment/PaymentPage.tsx");
const cart = read("src/components/cart/CheckoutPage.tsx");
const result = read("src/components/payment/PaymentResult.tsx");
const en = read("src/assets/translations/en.ts");
const pt = read("src/assets/translations/pt.ts");

section("🔴 The cart page sends both notes with the checkout (15 Oct 2026)");
{
  const code = stripComments(cart);
  const create = code.match(/const createCheckout = async[\s\S]*?\n {4}\};/)?.[0] ?? "";
  check(
    "🔴 `POST /checkout` carries them, through the one helper",
    /apiClient\.post\("\/checkout"/.test(create) &&
      /\.\.\.checkoutNotesBody\(\{\s*deliveryNotes: instructions,\s*vendorInstructions: vendorNote,\s*isPickup: isSelfPickup,?\s*\}\)/.test(create),
    "the backend stores both on the checkout; nothing else carries them now",
  );
  check(
    "the old sessionStorage hop is gone",
    !/sessionStorage\.setItem\(\s*DELIVERY_NOTES_KEY/.test(code),
    "the checkout holds the notes; a second copy in the browser can only disagree with it",
  );
  check(
    "🔴 the rider box is drawn only for a delivery",
    /\{!isSelfPickup && \([\s\S]{0,800}id="rider-instructions"/.test(code),
    "a collected order has no rider to instruct",
  );
  check(
    "the note for the restaurant or store is drawn for pickup too, named for the vendor",
    /id="vendor-instructions"/.test(code) &&
      /t\(vendorCopyKey\("noteForVendor", vendorKind\)\)/.test(code) &&
      !/\{!isSelfPickup && \([\s\S]{0,300}id="vendor-instructions"/.test(code),
  );
  check(
    "both boxes use the shared caps",
    /maxLength=\{MAX_RIDER_INSTRUCTIONS\}/.test(code) && /maxLength=\{MAX_VENDOR_INSTRUCTIONS\}/.test(code),
  );
}

section("🔴 The payment page shows them back and never sends them to a payment call");
{
  const code = stripComments(payment);
  check(
    "it reads them from the checkout",
    /summary\.deliveryNotes/.test(code) && /summary\.vendorInstructions/.test(code),
  );
  check(
    "no editable copy here — Edit goes back to the cart page",
    !/<textarea[\s\S]{0,200}rider-instructions/.test(code) && /href=\{editNotesHref\}/.test(code),
    "no call edits notes on an existing checkout, and rebuilding it would drop a voucher",
  );
  check(
    "🔴 the rider line is hidden on a pickup",
    /const riderNote = isPickup \? "" :/.test(code) && /\{!isPickup && \([\s\S]{0,200}t\("riderInstructions"\)/.test(code),
  );
  check(
    "🔴 changing the address keeps the notes",
    /toggle-delivery-address-status[\s\S]{0,600}apiClient\.post\("\/checkout", \{\s*useCart: true,\s*\.\.\.checkoutNotesBody\(\{\s*deliveryNotes: summary\?\.deliveryNotes,\s*vendorInstructions: summary\?\.vendorInstructions,?\s*\}\)/.test(code),
    "a rebuilt checkout starts without them",
  );
  const call = code.match(/payWithSavedCard\(\{[\s\S]*?\}\);/)?.[0] ?? "";
  check(
    "🔴 one-click does NOT send the note — the endpoint rejects the key",
    call !== "" && !/deliveryNotes/.test(call),
    "pay-with-saved-token answers 400 \"Unrecognized key(s) in object: 'deliveryNotes'\"",
  );
  check(
    "🔴 …and the payload type cannot carry it",
    !/deliveryNotes/.test(stripComments(read("src/types/payment.ts")).match(/interface PayWithSavedCardPayload \{[\s\S]*?\n\}/)?.[0] ?? "deliveryNotes"),
  );
  const intent = code.match(/createPaymentSession\(\{[\s\S]*?\}\);/)?.[0] ?? "";
  check(
    "🔴 the hosted payment call does not send it either",
    intent !== "" && !/deliveryNotes|vendorInstructions/.test(intent),
  );
  check(
    "the return page still clears the old session key",
    /sessionStorage\.removeItem\(DELIVERY_NOTES_KEY\)/.test(result),
    "a note left by an older build must not linger",
  );
}

section("Every label is translated");
{
  const keys = [
    "deliveryInstructions", "riderInstructions", "riderInstructionsPlaceholder", "instructions", "edit", "noInstructions",
    "noteForVendorRestaurant", "noteForVendorStore", "noteForVendorPartner",
    "noteForVendorPlaceholderRestaurant", "noteForVendorPlaceholderStore", "noteForVendorPlaceholderPartner",
  ];
  const missing = keys.filter((k) => !new RegExp(`\\n  ${k}:`).test(en) || !new RegExp(`\\n  ${k}:`).test(pt));
  check("en and pt both have every key", missing.length === 0, missing.join(", "));
}

section("The model, executed");
{
  check(
    "whitespace is not an instruction",
    outgoingDeliveryNotes("   ") === "" &&
      outgoingDeliveryNotes(null) === "" &&
      outgoingDeliveryNotes(undefined) === "",
    "three spaces would reach a courier as a blank line",
  );
  check(
    "the text is trimmed, not reformatted",
    outgoingDeliveryNotes("  ring twice  ") === "ring twice",
  );
  check(
    "🔴 pickup sends nothing at all",
    outgoingDeliveryNotes("leave at the door", { isPickup: true }) === "",
    "a note left over from a delivery the customer switched away from must not follow them to a counter",
  );
  check(
    "a pasted essay is cut to the cap",
    outgoingDeliveryNotes("x".repeat(500)).length === MAX_RIDER_INSTRUCTIONS,
    "`maxLength` stops typing, not pasting",
  );
  check(
    "the cap is a courier's line, not a message",
    MAX_RIDER_INSTRUCTIONS > 0 && MAX_RIDER_INSTRUCTIONS <= 300,
    String(MAX_RIDER_INSTRUCTIONS),
  );
  check(
    "the old session key is still known, so it can be cleared",
    DELIVERY_NOTES_KEY === "deliveryNotes",
  );
  check(
    "the note for the vendor is trimmed and capped, and kept on pickup",
    outgoingVendorInstructions("  no onions  ") === "no onions" &&
      outgoingVendorInstructions("x".repeat(500)).length === MAX_VENDOR_INSTRUCTIONS,
  );
  const both = checkoutNotesBody({ deliveryNotes: " ring ", vendorInstructions: " no onions " });
  check("🔴 the checkout body carries both, trimmed", both.deliveryNotes === "ring" && both.vendorInstructions === "no onions");
  check(
    "🔴 nothing to say sends no keys at all",
    Object.keys(checkoutNotesBody({ deliveryNotes: "  ", vendorInstructions: "" })).length === 0,
    "a customer who types nothing makes the request the endpoint has always received",
  );
  const pickup = checkoutNotesBody({ deliveryNotes: "ring", vendorInstructions: "no onions", isPickup: true });
  check("🔴 pickup drops the rider note, keeps the vendor note", !("deliveryNotes" in pickup) && pickup.vendorInstructions === "no onions");
}

section("The guard is wired in");
{
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  check(
    "`verify:rider-instructions` is a script someone can run",
    typeof scripts["verify:rider-instructions"] === "string",
    "a guard nothing calls passes forever",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
