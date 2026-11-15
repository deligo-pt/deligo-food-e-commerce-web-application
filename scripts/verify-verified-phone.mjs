// `pnpm verify:verified-phone` — ordering needs a verified mobile number
// (15 Nov 2026). Runs `src/lib/verifiedPhone.ts` and checks both order pages
// are wired to it.
import { readFileSync } from "node:fs";
const { phoneState, hasVerifiedPhone, isPhoneRequiredErrorKey } = await import("../src/lib/verifiedPhone.ts");

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`); };

console.log("The rule");
check("no profile is no phone", phoneState(null) === "missing" && !hasVerifiedPhone(undefined));
check("🔴 an email-only customer has no phone (seen on /profile: null, false)", phoneState({ contactNumber: null, isContactNumberVerified: false }) === "missing");
check("an empty or blank number is no phone", phoneState({ contactNumber: "  ", isContactNumberVerified: true }) === "missing");
check("🔴 a number not verified cannot order", phoneState({ contactNumber: "+351920393687", isContactNumberVerified: false }) === "unverified");
check("a missing flag is not verified (strict)", phoneState({ contactNumber: "+351920393687" }) === "unverified");
check("a verified number can order", hasVerifiedPhone({ contactNumber: "+351920393687", isContactNumberVerified: true }));

console.log("\nBackend refusals, for when it checks too");
check("CONTACT_NUMBER_REQUIRED shows the card", isPhoneRequiredErrorKey("CONTACT_NUMBER_REQUIRED"));
check("CONTACT_NUMBER_NOT_VERIFIED shows the card", isPhoneRequiredErrorKey("CONTACT_NUMBER_NOT_VERIFIED"));
check("a malformed number is a different error", !isPhoneRequiredErrorKey("VALIDATION_CONTACT_NUMBER_INVALID"));
check("other errors are not this one", !isPhoneRequiredErrorKey("CHECKOUT_CART_EMPTY") && !isPhoneRequiredErrorKey(null));

console.log("\nBoth order pages are gated");
const checkout = readFileSync(new URL("../src/components/cart/CheckoutPage.tsx", import.meta.url), "utf8");
const payment = readFileSync(new URL("../src/components/payment/PaymentPage.tsx", import.meta.url), "utf8");
for (const [name, src] of [["checkout", checkout], ["payment", payment]]) {
  check(`🔴 ${name}: the card is on the page`, /<VerifiedPhoneCard ref=\{phoneCardRef\}/.test(src));
  check(`🔴 ${name}: the button is off without a verified phone`, /disabled=\{[^}]*!phone\.verified\}/.test(src));
  check(`${name}: the submit handler checks again`, /if \(!phone\.verified\) \{\s*showPhoneCard\(\);\s*return;/.test(src));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
