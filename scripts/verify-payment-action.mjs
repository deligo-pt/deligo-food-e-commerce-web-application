/**
 * The RedUniq payment result is read from `data.code`, and from nothing else.
 *
 *   pnpm verify:payment-action
 *
 * No token, no network: `lib/paymentAction.ts` (no imports) runs directly, and
 * the API layer is read off source.
 *
 * ## What this defends (8 Oct 2026)
 *
 * The backend moved order creation to `POST /payment/reduniq/:id/action` and
 * set one rule: never decide a payment from the redirect URL or from
 * `success: true` — only `data.code`. Money is involved, so the failure modes
 * that matter are the quiet ones:
 *
 * 1. **A guess becomes "paid".** `success: true` with no code, an unknown code,
 *    a network error: none of them may ever map to `ORDER_PLACED`.
 * 2. **A guess becomes "pay again".** An unknown result may already be a paid
 *    one; offering a new payment there risks charging twice.
 * 3. **An error status hides the answer.** `/action` answers 409 with a real
 *    code (`PAYMENT_NOT_STARTED`); `create-payment-intent` answers 400 with
 *    `PAYMENT_SESSION_ACTIVE`. Throwing on those loses them.
 * 4. **Two calls at once.** StrictMode, a double tap, a refresh: a second
 *    `forceRelease` could cancel the payment the customer just started.
 * 5. **A stale or foreign pending entry** steers the return page to someone's
 *    old checkout.
 * 6. **`forceRelease` from anywhere** but the confirmed "start a new payment".
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const code = (file) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const P = await import("../src/lib/paymentAction.ts");

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

// Bodies exactly as the test backend sent them (8 Oct 2026).
const LIVE = {
  completed: { success: true, message: "This payment has already been fully processed and completed.", data: { code: "PAYMENT_COMPLETED", orderId: "6ac76eb4a5477c7f4beba572", displayOrderId: "ORD-WHXDW3FOQ3" } },
  resumed: { success: true, data: { code: "REDUNIQ_PAYMENT_SESSION_RESUMED", redirectUrl: "https://pagamentos.sandbox.reduniq.pt/gateway/redirect/1000329/x", paymentToken: "8d6b84d1c183" } },
  failed: { success: true, message: "The payment was abandoned successfully. You can start a new checkout.", data: { code: "PAYMENT_FAILED" } },
  abandoned: { success: true, data: { code: "PAYMENT_ABANDONED" } },
  notStarted409: { success: false, message: "Only an active hosted payment can be abandoned.", errorKey: "PAYMENT_ABANDON_NOT_ALLOWED", data: { code: "PAYMENT_NOT_STARTED" } },
  active400: { success: false, errorKey: "PAYMENT_ALREADY_IN_PROCESS", data: { code: "PAYMENT_SESSION_ACTIVE" } },
  created: { success: true, data: { code: "REDUNIQ_PAYMENT_SESSION_CREATED", redirectUrl: "https://pagamentos.sandbox.reduniq.pt/gateway/redirect/1000329/y", paymentToken: "fbd158bb" } },
};

section("1. Every known code reaches its screen");
{
  const read = (body) => P.readPaymentActionResponse(body);
  const completed = read(LIVE.completed);
  check("PAYMENT_COMPLETED → ORDER_PLACED", completed.state === "ORDER_PLACED");
  check("…with the order id and the ORD- number", completed.orderId === "6ac76eb4a5477c7f4beba572" && completed.displayOrderId === "ORD-WHXDW3FOQ3");
  const resumed = read(LIVE.resumed);
  check("REDUNIQ_PAYMENT_SESSION_RESUMED → IN_PROGRESS, with the page to continue", resumed.state === "IN_PROGRESS" && resumed.redirectUrl?.startsWith("https://pagamentos."));
  check("REDUNIQ_PAYMENT_SESSION_CREATED → IN_PROGRESS", read(LIVE.created).state === "IN_PROGRESS");
  check("🔴 PAYMENT_FAILED → FAILED, whatever the message says (it says \"abandoned\")", read(LIVE.failed).state === "FAILED");
  check("PAYMENT_ABANDONED → ABANDONED", read(LIVE.abandoned).state === "ABANDONED");
  check("🔴 a 409 body still answers: PAYMENT_NOT_STARTED → NOT_STARTED", read(LIVE.notStarted409).state === "NOT_STARTED");
  check("🔴 a 400 body still answers: PAYMENT_SESSION_ACTIVE → IN_PROGRESS", read(LIVE.active400).state === "IN_PROGRESS");
}

section("2. 🔴 A guess is never \"paid\"");
{
  const read = (body) => P.readPaymentActionResponse(body).state;
  check("🔴 success: true with no code → not ORDER_PLACED", read({ success: true, data: {} }) !== "ORDER_PLACED");
  check("🔴 success: true, message \"Order placed\", no code → UNREACHABLE", read({ success: true, message: "Order placed successfully!", data: { orderId: "x" } }) === "UNREACHABLE");
  check("🔴 an unknown code → VERIFYING", read({ success: true, data: { code: "PAYMENT_STATUS_UNKNOWN" } }) === "VERIFYING");
  check("lower-case or padded known code is not trusted as known", read({ data: { code: "payment_completed" } }) === "VERIFYING");
  for (const [name, body] of [["no body", null], ["an HTML error page", "<html>502</html>"], ["data: null", { data: null }], ["a number", 42]]) {
    check(`${name} → UNREACHABLE`, read(body) === "UNREACHABLE");
  }
}

section("3. 🔴 Only a known, settled outcome may start another payment");
{
  const allowed = ["NOT_STARTED", "FAILED", "ABANDONED"];
  for (const state of ["ORDER_PLACED", "IN_PROGRESS", "FAILED", "ABANDONED", "NOT_STARTED", "VERIFYING", "UNREACHABLE"]) {
    const expected = allowed.includes(state);
    check(`${expected ? "may" : "🔴 may not"} start a payment from ${state}`, P.canStartNewPayment(state) === expected);
  }
}

section("4. The pending payment survives the trip, and only the right one");
{
  const now = 1_790_000_000_000;
  const entry = { checkoutSummaryId: "6ac76e25a5477c7f4beba4ae", vendorId: "6a6aced8f9e179566170db79", deliveryNotes: "Ring twice" };
  const back = P.parsePendingOrder(P.serializePendingOrder(entry, now), now + 60_000);
  check("round trip keeps the checkout, vendor and note", back?.checkoutSummaryId === entry.checkoutSummaryId && back?.vendorId === entry.vendorId && back?.deliveryNotes === "Ring twice");
  check("🔴 the previous flow's entry (no version) is ignored", P.parsePendingOrder(JSON.stringify({ checkoutSummaryId: "old", paymentToken: "t", deliveryNotes: "" }), now) === null);
  check("🔴 …even with a fresh timestamp: only this version's entries count", P.parsePendingOrder(JSON.stringify({ checkoutSummaryId: "old", deliveryNotes: "", createdAt: now }), now) === null && P.parsePendingOrder(JSON.stringify({ v: 1, checkoutSummaryId: "old", deliveryNotes: "", createdAt: now }), now) === null);
  check("🔴 older than a day is ignored", P.parsePendingOrder(P.serializePendingOrder(entry, now), now + 25 * 3600_000) === null);
  check("a clock-skewed future entry is ignored", P.parsePendingOrder(P.serializePendingOrder(entry, now + 3600_000), now) === null);
  for (const [name, raw] of [["empty", ""], ["broken JSON", "{"], ["no checkout id", JSON.stringify({ v: 2, createdAt: now })], ["null", null]]) {
    check(`${name} → null`, P.parsePendingOrder(raw, now) === null);
  }
}

section("5. 🔴 One call at a time per checkout and intent");
{
  const flight = P.createSingleFlight();
  let runs = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const a = flight("s|release", async () => { runs++; await gate; return "first"; });
  const b = flight("s|release", async () => { runs++; return "second"; });
  check("🔴 a second call while the first is out shares it (one request)", a === b && runs === 1);
  const other = flight("s|check", async () => { runs++; return "check"; });
  check("a different intent is its own call", runs === 2 && other !== a);
  release();
  await a;
  await other;
  await flight("s|release", async () => { runs++; return "again"; });
  check("after it settles, the next call goes out fresh", runs === 3);
  await flight("boom", async () => { throw new Error("x"); }).catch(() => {});
  let afterError = false;
  await flight("boom", async () => { afterError = true; });
  check("a failed call doesn't block the next one", afterError);
}

section("6. The API layer reads the body, never throws an answer away");
{
  const api = code("src/services/paymentActionApi.ts");
  // Each function on its own, so one's catch can't vouch for the other's.
  const fn = (name) => api.slice(api.indexOf(`export function ${name}`), api.indexOf("\n}\n", api.indexOf(`export function ${name}`)));
  const readsBody = /catch \(error\) \{\s*return readPaymentActionResponse\(bodyOf\(error\)\);\s*\}/;
  check("🔴 /action's error path reads the body's code", readsBody.test(fn("callPaymentAction")) && !/throw/.test(fn("callPaymentAction")));
  check("🔴 create-payment-intent's error path reads it too", readsBody.test(fn("createPaymentSession")) && !/throw/.test(fn("createPaymentSession")));
  check("🔴 nothing in it decides from `success`", !/\.success\b/.test(api));
  check("the checkout id is encoded into the path", /\/payment\/reduniq\/\$\{encodeURIComponent\(checkoutSummaryId\)\}\/action/.test(api));
  check("🔴 only `forceRelease: true` or nothing is ever sent to /action", /release \? \{ forceRelease: true \} : \{\}/.test(api));
  check("both calls go through the one-at-a-time guard", /actionFlight\(/.test(api) && /createFlight\(/.test(api));
  check("storage failures never break a payment", (api.match(/try \{\s*(?:sessionStorage|return parsePendingOrder)/g) || []).length >= 3);
}

section("7. 🔴 forceRelease lives in one place");
{
  const files = (dir) =>
    readdirSync(join(root, dir)).flatMap((name) => {
      const path = join(dir, name);
      return statSync(join(root, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  // The model names it in its docs; the API layer sends it; the payment page
  // calls it from the customer's confirmed "Cancel and start a new payment".
  const ALLOWED = new Set(["src/lib/paymentAction.ts", "src/services/paymentActionApi.ts", "src/components/payment/PaymentPage.tsx"]);
  const offenders = files("src").filter((f) => !ALLOWED.has(f) && /forceRelease/.test(code(f))).map((f) => relative(root, join(root, f)));
  check("🔴 no other file sends forceRelease", offenders.length === 0, offenders.join(", "));

  const page = code("src/components/payment/PaymentPage.tsx");
  const uses = page.match(/forceRelease/g) || [];
  const handler = page.slice(page.indexOf("const cancelAndStartNewPayment = async"), page.indexOf("const handlePlaceOrder = async"));
  check("🔴 the payment page sends it once, from cancelAndStartNewPayment only", uses.length === 1 && /forceRelease: true/.test(handler));
  check("🔴 …which only the card's confirm button calls", (page.match(/cancelAndStartNewPayment/g) || []).length === 2 && /onCancelAndStartNew=\{cancelAndStartNewPayment\}/.test(page));
  const card = code("src/components/payment/PaymentInProgressCard.tsx");
  check("🔴 the card calls it only from the confirmation dialog's action", (card.match(/onCancelAndStartNew\(\)/g) || []).length === 1 && /<AlertDialogAction[\s\S]{0,200}onCancelAndStartNew\(\)/.test(card));
}

section("8. 🔴 The payment page never starts a second payment");
{
  const page = code("src/components/payment/PaymentPage.tsx");
  check("🔴 payments open through createPaymentSession, not a raw create-payment-intent", /createPaymentSession\(/.test(page) && !/create-payment-intent/.test(page));
  check("🔴 it redirects only on a CREATED session with a URL", /result\.state === "IN_PROGRESS" && result\.code === "REDUNIQ_PAYMENT_SESSION_CREATED" && result\.redirectUrl\) \{[\s\S]{0,400}window\.location\.href = result\.redirectUrl/.test(page));
  check("🔴 an already-open payment is offered to continue, not shown as an error", /if \(result\.state === "IN_PROGRESS"\) \{[\s\S]{0,300}applyPaymentStatus\(await callPaymentAction\(summary\._id\)\)/.test(page));
  check("🔴 while one is open or unknown, the card replaces the methods and the Pay button", /\{openPayment \? \(\s*<PaymentInProgressCard[\s\S]*?\) : \(\s*<>\s*\{\/\* Payment Methods \*\/\}/.test(read("src/components/payment/PaymentPage.tsx")));
  check("the page asks /action once per checkout on load", /useEffect\(\(\) => \{\s*if \(!summary\?\._id\) return;[\s\S]{0,200}callPaymentAction\(summary\._id\)/.test(page));
  check("🔴 Continue re-asks /action for a fresh URL instead of reusing an old one", /const continueOpenPayment = async[\s\S]{0,400}await callPaymentAction\(summary\._id\)[\s\S]{0,200}window\.location\.href = result\.redirectUrl/.test(page));
  check("🔴 the retired handle-payment-failure is not called (backend: 404)", !/handle-payment-failure/.test(page));
  check("the pending payment is saved through the versioned helper", /savePendingOrder\(\{/.test(page) && !/sessionStorage\.setItem\(\s*"pendingOrder"/.test(page));
  const en = read("src/assets/translations/en.ts"), pt = read("src/assets/translations/pt.ts");
  const keys = ["paymentInProgressTitle", "paymentInProgressBody", "continuePayment", "cancelAndStartNew", "confirmCancelPaymentTitle", "confirmCancelPaymentBody", "keepPayment", "cancelPayment", "previousPaymentCancelled", "paymentVerifyingTitle", "paymentVerifyingBody", "checkAgain", "openingSecurePayment", "paymentServiceUnreachable", "paymentCouldNotStart"];
  const missing = keys.flatMap((k) => [["en", en], ["pt", pt]].filter(([, src]) => !new RegExp(`\\b${k}:`).test(src)).map(([n]) => `${n}.${k}`));
  check("every new text exists in EN and PT", missing.length === 0, missing.join(", "));
}

section("9. 🔴 After RedUniq, /action decides — and the order is never created by us");
{
  const files = (dir) =>
    readdirSync(join(root, dir)).flatMap((name) => {
      const path = join(dir, name);
      return statSync(join(root, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const creators = files("src").filter((f) => /orders\/create-order/.test(code(f)));
  check("🔴 no file calls /orders/create-order (the backend creates the order)", creators.length === 0, creators.join(", "));

  const ret = code("src/app/(main)/cart/checkout/[vendorId]/payment/return/page.tsx");
  const success = code("src/app/payment-success/page.tsx");
  check("both return pages render PaymentResult", /<PaymentResult routeVendorId=\{vendorId\} \/>/.test(ret) && /<PaymentResult \/>/.test(success));

  const result = code("src/components/payment/PaymentResult.tsx");
  check("🔴 it reads the result from /action", /await callPaymentAction\(summaryId\)/.test(result));
  const placed = result.slice(result.indexOf('if (result.state === "ORDER_PLACED") {'), result.indexOf('if (result.state === "VERIFYING"'));
  check("🔴 tracking opens only from the ORDER_PLACED branch, by the ORD- number", (result.match(/orderTrackingPath\(/g) || []).length === 1 && /router\.replace\(orderTrackingPath\(result\)\)/.test(placed));
  check("🔴 an unknown answer is asked again (2/4/8/15 s), then \"still confirming\"", /RECHECK_DELAYS_MS = \[2000, 4000, 8000, 15000\]/.test(result) && /if \(attempt < RECHECK_DELAYS_MS\.length\) \{[\s\S]{0,200}await wait\(RECHECK_DELAYS_MS\[attempt\]\)[\s\S]{0,80}continue;/.test(result) && /setView\(\{ kind: "stuck", result \}\)/.test(result));
  const unknownViews = result.slice(result.indexOf('if (view.kind === "checking")'), result.indexOf("const { result } = view;"));
  check("🔴 the checking and still-confirming screens never offer to pay", !/goToPaymentPage|payNow|tryAgain|chooseAnotherWayToPay/.test(unknownViews));
  check("a paid order clears the pending payment and the note", /ORDER_PLACED[\s\S]{0,200}clearPendingOrder\(\)[\s\S]{0,200}removeItem\(DELIVERY_NOTES_KEY\)/.test(result));
  check("a newer check supersedes an older one (StrictMode, Check again)", /myRun !== run\.current/.test(result));

  check("🔴 the payment page's already-paid jump uses the ORD- number too", /router\.replace\(orderTrackingPath\(result\)\)/.test(code("src/components/payment/PaymentPage.tsx")));
  check("🔴 orderTrackingPath follows the ORD- number", P.orderTrackingPath({ displayOrderId: "ORD-WHXDW3FOQ3" }) === "/orders/track-order/ORD-WHXDW3FOQ3");
  check("…and without one, the orders list (the Mongo id 404s there)", P.orderTrackingPath({ displayOrderId: null }) === "/orders");
  check("paymentPagePath needs the store, or there's no way back", P.paymentPagePath("s1", "v1") === "/cart/checkout/v1/payment?checkoutId=s1" && P.paymentPagePath("s1", null) === null);

  const en = read("src/assets/translations/en.ts"), pt = read("src/assets/translations/pt.ts");
  const keys = ["checkingPayment", "checkingStepReturned", "checkingStepConfirming", "checkingStepOrder", "stillConfirmingShort", "orderPlacedTitle", "orderPlacedBody", "paymentNotFinishedTitle", "paymentNotFinishedBody", "chooseAnotherWayToPay", "paymentFailedTitle", "paymentFailedBody", "paymentCancelledTitle", "paymentCancelledBody", "stillConfirmingTitle", "stillConfirming", "paymentNotFoundTitle", "paymentNotFoundBody", "paymentUnreachableTitle", "paymentUnreachableBody", "backToCart"];
  const missing = keys.flatMap((k) => [["en", en], ["pt", pt]].filter(([, src]) => !new RegExp(`\\b${k}:`).test(src)).map(([n]) => `${n}.${k}`));
  check("every result text exists in EN and PT", missing.length === 0, missing.join(", "));
}

section("10. 🔴 A declined or cancelled payment is checked, not assumed");
{
  const files = (dir) =>
    readdirSync(join(root, dir)).flatMap((name) => {
      const path = join(dir, name);
      return statSync(join(root, path)).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const failedPage = code("src/app/payment-failed/page.tsx");
  check("🔴 /payment-failed renders PaymentResult (the URL saying \"failed\" proves nothing)", /<PaymentResult \/>/.test(failedPage));
  const resetters = files("src").filter((f) => /handle-payment-failure/.test(code(f)));
  check("🔴 nothing calls the retired handle-payment-failure", resetters.length === 0, resetters.join(", "));

  const result = code("src/components/payment/PaymentResult.tsx");
  const failedCase = result.slice(result.indexOf('case "FAILED":'), result.indexOf("default:", result.indexOf('case "FAILED":')));
  check("🔴 a decline offers Try again on the same checkout", /primary=\{\{ label: t\("tryAgain"\), onClick: goToPaymentPage/.test(failedCase));
  check("…another way to pay, landing on the methods", /chooseAnotherWayToPay"\), onClick: goToPaymentMethods/.test(failedCase) && /`\$\{paymentPage\}#\$\{PAYMENT_METHODS_ANCHOR\}`/.test(result));
  check("…and support", /contactSupport/.test(failedCase));
  const cancelled = result.slice(result.indexOf("default:", result.indexOf('case "FAILED":')));
  check("a cancelled payment offers Pay now and Back to cart", /t\("payNow"\), onClick: goToPaymentPage/.test(cancelled) && /t\("backToCart"\)/.test(cancelled));
  const page = code("src/components/payment/PaymentPage.tsx");
  check("the payment page carries the anchor, and scrolls to it once loaded", /id=\{PAYMENT_METHODS_ANCHOR\}/.test(page) && /window\.location\.hash !== `#\$\{PAYMENT_METHODS_ANCHOR\}`[\s\S]{0,200}scrollIntoView/.test(page));
}

section("11. One vocabulary on screen (Phase 5)");
{
  const pt = read("src/assets/translations/pt.ts");
  const value = (k) => (pt.match(new RegExp(`\\b${k}:\\s*"([^"]*)"`)) || [])[1] ?? "";
  // The buttons beside these texts say "Os Meus Pedidos" and "Fazer Pedido".
  const keys = ["paymentVerifyingBody", "checkingStepOrder", "orderPlacedTitle", "orderPlacedBody", "stillConfirming", "paymentNotFoundBody", "paymentUnreachableBody"];
  const off = keys.filter((k) => /encomenda/i.test(value(k)));
  check("PT payment texts say \"pedido\", like the buttons beside them", off.length === 0, off.join(", "));
  const gone = ["continueButton", "creatingYourOrder", "failedToCreateOrder", "finalizingYourOrder", "loadingPaymentDetails", "missingPaymentInfo", "missingPaymentSummary", "orderConfirmedRedirecting", "orderCreationFailed", "paymentFailedDesc", "paymentSuccessful", "returnToCart"];
  const back = gone.filter((k) => new RegExp(`\\b${k}:`).test(pt) || new RegExp(`\\b${k}:`).test(read("src/assets/translations/en.ts")));
  check("the old pages' texts stay removed (no dead copy to translate)", back.length === 0, back.join(", "));
}

section("12. 🔴 A checkout blocked by another payment gets a next step, not a red error");
{
  const cart = code("src/components/cart/CheckoutPage.tsx");
  check("🔴 it branches on CHECKOUT_PAYMENT_IN_PROGRESS by errorKey", /getApiErrorKey\(error\) === "CHECKOUT_PAYMENT_IN_PROGRESS"[\s\S]{0,120}resolveBlockedCheckout\(/.test(cart));
  check("🔴 …reads blockingCheckoutId and asks /action about it", /blockingCheckoutId[\s\S]{0,300}await callPaymentAction\(blockingId\)/.test(cart));
  const fn = cart.slice(cart.indexOf("const resolveBlockedCheckout = async"), cart.indexOf("const handleToggleSelfPickup"));
  check("🔴 an open payment → continue it on its own payment page", /result\.state === "IN_PROGRESS"\) \{\s*setBlockedCheckout\(\{ kind: "in-progress"/.test(fn) && /paymentPagePath\(blockedCheckout\.checkoutId/.test(cart));
  check("🔴 an unknown result → only Check again, no retries, no new payment", /result\.state === "VERIFYING" \|\| result\.state === "UNREACHABLE"\) \{\s*setBlockedCheckout\(\{ kind: "verifying"[\s\S]{0,120}return;/.test(fn));
  check("🔴 a settled one → bounded retries, then a way out", /for \(const delay of CHECKOUT_RETRY_DELAYS_MS\) \{[\s\S]*?\n    \}\n    setBlockedCheckout\(\{ kind: "stuck", checkoutId: blockingId/.test(fn) && !/for \(;;\)|while \(true\)/.test(fn) && /CHECKOUT_RETRY_DELAYS_MS = \[[\d, ]+\]/.test(cart));
  check("…a different error during the retries stops them and says so", /!== "CHECKOUT_PAYMENT_IN_PROGRESS"\) \{\s*setBlockedCheckout\(null\);\s*toast\.error/.test(fn));
  check("🔴 \"Your previous order was placed\" only when an ORD- number came back", /blockedCheckout\.displayOrderId\s*\?\s*t\("checkoutSettlingTitle"\)\s*:\s*t\("checkoutPreparingTitle"\)/.test(cart));
  check("🔴 this page never releases or starts a payment", !/forceRelease|createPaymentSession|create-payment-intent/.test(cart));
  const en = read("src/assets/translations/en.ts"), pt = read("src/assets/translations/pt.ts");
  const keys = ["checkoutBlockedTitle", "checkoutBlockedBody", "checkoutSettlingTitle", "checkoutSettlingBody", "checkoutPreparingTitle", "checkoutPreparingBody", "checkoutStuckTitle", "checkoutStuckBody", "viewOrder"];
  const missing = keys.flatMap((k) => [["en", en], ["pt", pt]].filter(([, src]) => !new RegExp(`\\b${k}:`).test(src)).map(([n]) => `${n}.${k}`));
  check("every blocked-checkout text exists in EN and PT", missing.length === 0, missing.join(", "));
}

section("13. 🔴 \"Page closed\" flags are reset when the page comes back");
{
  // Next.js keeps a page alive when the customer navigates away and back
  // (Activity): effects clean up on hide and run again on show, with the same
  // refs. A flag only ever set to `true` stayed true after Continue payment →
  // Back, and every blocked checkout then ended silently (8 Oct 2026).
  const cart = code("src/components/cart/CheckoutPage.tsx");
  const result = code("src/components/payment/PaymentResult.tsx");
  check("🔴 the cart page resets unmountedRef on every mount", /useEffect\(\(\) => \{\s*unmountedRef\.current = false;\s*return \(\) => \{\s*unmountedRef\.current = true;/.test(cart));
  check("🔴 the result page resets its flag on every mount", /useEffect\(\(\) => \{\s*unmounted\.current = false;\s*return \(\) => \{\s*unmounted\.current = true;/.test(result));
  check("no cleanup-only flag pattern left in either", ![cart, result].some((src) => /useEffect\(\s*\(\) => \(\) => \{\s*unmounted(Ref)?\.current = true;/.test(src)));
}

section("14. 🔴 every successful payment ends on the same animated success screen");
{
  // 26 Oct 2026: a saved-card payment used to jump to /orders with no
  // confirmation, and the success screen showed a still tick for 1.5 s.
  const page = code("src/components/payment/PaymentPage.tsx");
  const result = code("src/components/payment/PaymentResult.tsx");
  const card = code("src/components/payment/PaymentStateCard.tsx");
  const oneClick = page.slice(page.indexOf("await payWithSavedCard({"), page.indexOf("const result = await createPaymentSession("));
  check("🔴 a saved-card payment goes to the success screen", /router\.replace\(`\/payment-success\?summaryId=\$\{encodeURIComponent\(summary\._id\)\}`\)/.test(oneClick));
  check("…and never straight to the orders list", !/router\.replace\("\/orders"\)/.test(oneClick));
  check("🔴 the success screen plays the order-placed animation", /animation="order-placed"/.test(result) && /src=\{`\/animations\/\$\{animation\}\.lottie`\}/.test(card));
  check("it stays long enough to be seen before tracking opens", (() => { const m = result.match(/CONFIRMED_PAUSE_MS = (\d+)/); return !!m && Number(m[1]) >= 2500; })());
  check("reduced motion rests on the finished frame", /holdLastFrameIfReduced\(player\)/.test(card));
  check("the tick fills the space until the animation has loaded", /\{!animationReady && \(/.test(card) && /addEventListener\("load", \(\) => setAnimationReady\(true\)\)/.test(card));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
