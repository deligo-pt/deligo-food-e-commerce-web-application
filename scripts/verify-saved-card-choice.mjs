/**
 * A saved card can be un-chosen, and the customer can still save a new one.
 *
 *   pnpm verify:saved-card
 *
 * No token, no network: the checkout markup and both translation files are read
 * off source.
 *
 * ## What this defends
 *
 * The saved-card list is a radio group with no "none of these" member, and a
 * browser will not un-check a radio. So until 27 Sep 2026 a customer who picked
 * a saved card by mistake was stuck with it: the only way back was to switch the
 * payment method away from Card and back, which clears the selection as a side
 * effect nobody could be expected to find. Picking a card also hid the "Save
 * this card" toggle, so the same customer could neither pay with a different
 * card nor save one.
 *
 * Every rule here guards a way of quietly re-closing that door:
 *
 * 1. **The second click stops clearing** — the trap returns exactly as it was.
 * 2. **Selection moves to `onClick`** — the radio still works with a mouse, and
 *    silently stops working with arrow keys, which fire `change` and no click.
 * 3. **The toggle is hidden again** behind `isInstantPayment`.
 * 4. **`saveCard` reaches the token payment.** It is a card that is already
 *    saved; the endpoint has no such field, and sending one would be a promise
 *    with nothing behind it.
 * 5. **The hint goes missing in one language**, leaving PT customers with an
 *    un-checkable radio and no word about it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const page = read("src/components/payment/PaymentPage.tsx");
const en = read("src/assets/translations/en.ts");
const pt = read("src/assets/translations/pt.ts");

/** The saved-card list only — so a `setSaveCard` elsewhere is not read as this one. */
const list = page.slice(
  page.indexOf("{savedCards.map((card) => {"),
  page.indexOf("{/* Why the button below says"),
);
/** The one-click payment call. */
const token = page.slice(
  page.indexOf("await payWithSavedCard({"),
  page.indexOf("router.replace(\"/orders\")"),
);

section("🔴 A card that was chosen by mistake can be un-chosen");
{
  check(
    "🔴 a second click on the chosen card clears it",
    /onClick=\{\(\) => \{\s*if \(isSelected\) setSelectedCardId\(null\);\s*\}\}/.test(list),
    "without this there is no way back to paying with a new card",
  );
  check(
    "🔴 and selection still happens on change, not on that click",
    /onChange=\{\(\) => setSelectedCardId\(card\.id\)\}/.test(list),
    "arrow keys move a radio group without ever firing a click",
  );
  check(
    "the way out is spelled out, only while a card is selected",
    /\{isInstantPayment && \([\s\S]{0,200}t\("deselectCardHint"\)/.test(page),
    "an un-checkable radio is not a thing customers have seen before",
  );
}

section("🔴 Saving a new card stays possible");
{
  check(
    "🔴 the Save this card toggle is not hidden by a saved-card selection",
    /\{paymentMethod === "CARD" && \(\s*<label/.test(page) &&
      !/!isInstantPayment && \(\s*<label/.test(page),
    "hiding it moved the page under the customer mid-decision",
  );
  check(
    "choosing a card no longer flips the customer's toggle off for them",
    !/setSaveCard/.test(list),
    "the toggle is theirs; nothing about a token payment reads it",
  );
  check(
    "🔴 and no saveCard is sent with a token payment",
    !/saveCard/.test(token),
    "the card is already saved and the endpoint has no such field",
  );
  check(
    "the redirect flow still sends it, and still only under CARD",
    /\.\.\.\(paymentMethod === "CARD" && \{ saveCard \}\)/.test(page),
  );
}

section("Both languages say it");
{
  for (const [name, source] of [["en", en], ["pt", pt]]) {
    check(`${name} has deselectCardHint`, /\bdeselectCardHint:/.test(source));
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
