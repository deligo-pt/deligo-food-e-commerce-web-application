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
 *   1. the redirect flow's return page (`/payment/return`) — `create-order`
 *   2. the alternate success route (`SuccessContent`) — `create-order`
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
  outgoingDeliveryNotes,
} = await import(join(here, "../src/lib/deliveryNotes.ts"));

const payment = read("src/components/payment/PaymentPage.tsx");
const cart = read("src/components/cart/CheckoutPage.tsx");
const ret = read("src/app/(main)/cart/checkout/[vendorId]/payment/return/page.tsx");
const success = read("src/components/payment/SuccessContent.tsx");
const en = read("src/assets/translations/en.ts");
const pt = read("src/assets/translations/pt.ts");

section("The box is where the app puts it");
{
  check(
    "the payment page renders the instructions field",
    /t\("riderInstructions"\)/.test(payment) &&
      /id="rider-instructions"/.test(payment),
    "the app shows it on this screen, under the delivery address",
  );
  check(
    "🔴 it is drawn only for a delivery",
    // Asserted as the condition it is under, not as a position in the file.
    // The first version of this rule pinned the box between the address and
    // the distance panel, and went red the moment the two were laid out as a
    // row — which is a layout decision, not the rule. What must stay true is
    // that a collected order never renders a box for instructing a rider it
    // does not have, and that `handlePlaceOrder` sends nothing when it is a
    // pickup even if one was typed before the customer switched.
    /\{!isPickup && \([\s\S]{0,900}id="rider-instructions"/.test(payment) &&
      /isPickup: summary\.fulfillmentType === "PICKUP"/.test(payment),
    "a collected order has no rider to instruct",
  );
  check(
    "it shares the row with the distance panel rather than the address",
    (() => {
      const box = payment.indexOf('id="rider-instructions"');
      const distance = payment.indexOf('{t("distanceAndTime")}');
      // Same test for both: the nearest two-column wrapper above each of them
      // must be the *same* one — which is what "side by side in one row"
      // means, and stays true however the row is restyled.
      const gridAbove = (index) => payment.lastIndexOf("md:grid-cols-2", index);
      return (
        box > 0 &&
        distance > 0 &&
        distance < box &&
        gridAbove(box) === gridAbove(distance) &&
        gridAbove(box) > payment.indexOf('{t("deliveryTo")}')
      );
    })(),
    "under the address it doubled the right column's height and pushed the fee off a phone screen",
  );
  check(
    "it says it is optional, and the label is bound to the field",
    /\(\{t\("optional"\)\}\)/.test(payment) &&
      /htmlFor="rider-instructions"/.test(payment),
  );
  check(
    "the typing cap is the shared one, not a number typed twice",
    /maxLength=\{MAX_RIDER_INSTRUCTIONS\}/.test(payment),
  );
  check(
    "the copy exists in both languages",
    /riderInstructions:/.test(en) &&
      /riderInstructions:/.test(pt) &&
      /riderInstructionsPlaceholder:/.test(en) &&
      /riderInstructionsPlaceholder:/.test(pt),
  );
}

section("🔴 It survives the hop to the page that creates the order");
{
  check(
    "the cart page stores what was typed",
    /sessionStorage\.setItem\(\s*DELIVERY_NOTES_KEY/.test(cart),
    "`/checkout` has no field for it, so it cannot ride on the summary",
  );
  check(
    "the payment page reads it back",
    /sessionStorage\.getItem\(DELIVERY_NOTES_KEY\)/.test(payment),
    "otherwise the customer types it twice, or believes they already did",
  );
  check(
    "🔴 the storage key is the constant, never a literal",
    // Scoped to `sessionStorage` on purpose. `searchParams.get("deliveryNotes")`
    // on the return page is a different namespace — that spelling is the
    // gateway's, not ours, and renaming our key must not silently rename what
    // we read off the URL.
    ![payment, cart, ret, success].some((file) =>
      /sessionStorage\.(get|set|remove)Item\(\s*["']deliveryNotes["']/.test(file),
    ),
    "`sessionStorage` is one global namespace; two spellings of one key is a silent drop",
  );
  check(
    "it is cleared once the order exists",
    /sessionStorage\.removeItem\(DELIVERY_NOTES_KEY\)/.test(ret),
    "otherwise the next order inherits the last one's note",
  );
}

section("🔴 Every path that creates an order carries it");
{
  check(
    "the redirect flow no longer hard-codes an empty note",
    !/deliveryNotes: ""/.test(payment),
    'this was `deliveryNotes: ""` from the day the file was written',
  );
  check(
    "the pending order carries what the customer typed",
    /deliveryNotes: notes,/.test(payment),
  );
  check(
    "🔴 one-click sends it on the call that creates the order",
    /payWithSavedCard\(\{[\s\S]{0,900}deliveryNotes: notes/.test(payment),
    "this path never reaches our `create-order`, so the note travels here or not at all",
  );
  check(
    "one-click omits it when there is nothing to say",
    /\.\.\.\(notes \? \{ deliveryNotes: notes \} : \{\}\)/.test(payment),
    "a silent customer must make the request this endpoint has always received",
  );
  check(
    "the return page sends it",
    /deliveryNotes: deliveryNotes \|\| ""/.test(ret),
  );
  check(
    "🔴 the alternate success route sends it too",
    /deliveryNotes: notes,/.test(success),
    "it creates the order without having seen the box — the path most likely to be forgotten",
  );
  check(
    "both are trimmed through the one helper",
    /outgoingDeliveryNotes\(/.test(payment) && /outgoingDeliveryNotes\(/.test(cart),
  );
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
    "the key is the one the order field is called",
    DELIVERY_NOTES_KEY === "deliveryNotes",
  );
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
