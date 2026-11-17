/**
 * How the checkout applies, chooses and removes an offer.
 *
 *   pnpm verify:offers
 *
 * No token, no network. The API's behaviour below was established by calling
 * it live on 20 Sep 2026 with the owner's session, against the contract in
 * `customer-offer-api.md`:
 *
 *   POST /offers/validate-apply-offer { checkoutId, offerIdentifier }
 *     • `offerIdentifier: ""`  → "Offer removed successfully." — the discount
 *       goes, the free reward line goes, `offer.isApplied` is false, and the
 *       **checkoutId stays the same**.
 *     • a CUSTOMER_CHOICE offer without `selectedReward` → 400 "Please select
 *       a reward product for this offer."
 *     • `selectedReward.variationSku` must match the option exactly → 400
 *       "The selected reward variation does not match the configured option."
 *     • `selectedReward` on an offer that takes none → 400 "A selected reward
 *       is not applicable for this offer."
 *
 * ## Why these rules are worth a script
 *
 * Removing an offer used to be impossible: the page rebuilt the whole checkout
 * from the cart to shake the discount off, which minted a new `checkoutId`,
 * abandoned the old checkout, and had to be kept clear of the address flow.
 * That workaround is deleted. If anyone reintroduces it — or drops the empty
 * identifier, or sends `selectedReward` unconditionally — the checkout breaks
 * in ways that only show up against the live API with a real offer applied.
 */

import { readFileSync } from "node:fs";
import { register } from "node:module";
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

const page = read("src/components/payment/PaymentPage.tsx");
const en = read("src/assets/translations/en.ts");
const pt = read("src/assets/translations/pt.ts");

section("Removing an offer is one call, on the same checkout");
{
  check(
    "🔴 removal sends an empty identifier to the apply endpoint",
    /offerIdentifier: ""/.test(page),
    'the API un-applies on "" and returns the checkout as it was',
  );
  check(
    "🔴 removing no longer rebuilds the checkout from the cart",
    !/const removeOffer[\s\S]{0,600}apiClient\.post\("\/checkout"/.test(page),
    "the old workaround minted a new checkoutId on every removal",
  );
  check(
    "removal keeps the customer on the page",
    !/const removeOffer[\s\S]{0,600}router\.replace/.test(page),
    "navigating away was part of the workaround, not of removing an offer",
  );
  check(
    "the response replaces the summary",
    /const removeOffer[\s\S]{0,600}setSummary\(res\.data\.data\)/.test(page),
    "the call returns the whole recalculated checkout — nothing needs refetching",
  );
}

section("A customer-choice offer carries the customer's choice");
{
  check(
    "the choice is sent only when the offer asks for one",
    /\.\.\.\(reward[\s\S]{0,160}selectedReward:/.test(page),
    "an unexpected selectedReward is refused: 'A selected reward is not applicable for this offer.'",
  );
  check(
    "the variation goes with it, and only when the option has one",
    /reward\.variationSku \? \{ variationSku: reward\.variationSku \} : \{\}/.test(page),
    "a wrong or invented variation is refused by the API",
  );
  check(
    "🔴 only CUSTOMER_CHOICE offers show a picker",
    /reward\?\.type !== "CUSTOMER_CHOICE"/.test(page),
    "SAME_PRODUCT and FIXED_PRODUCT decide the free item themselves",
  );
  check(
    "an unchosen customer-choice offer cannot be applied",
    /Boolean\(rewardOptionsOf\(offer\)\) &&\s*rewardChoice\?\.offerId !== offer\._id/.test(page),
    "the API would answer 'Please select a reward product for this offer.'",
  );
  check(
    "a reward option is keyed by product *and* variation",
    /variationSku\s*\?\s*`\$\{option\.productId\}::\$\{option\.variationSku\}`/.test(page),
    "the same product in two variations is two different rewards",
  );
  check(
    "switching offers clears the choice",
    /setRewardChoice\(null\)/.test(page),
    "a selectedReward belongs to one offer's option list",
  );
}

section("The free item is visible as a free item");
{
  check(
    "a reward line is labelled, not silently priced at zero",
    /isPromoRewardLine && \(/.test(page) && /t\("freeWithOffer"\)/.test(page),
    "an unexplained extra line reads as something the customer forgot ordering",
  );
  check(
    "its price reads free rather than €0.00",
    /item\.isPromoRewardLine\s*\?\s*t\("free"\)/.test(page),
  );
  check(
    "the copy exists in both languages",
    /freeWithOffer:/.test(en) &&
      /freeWithOffer:/.test(pt) &&
      /chooseYourFreeItem:/.test(en) &&
      /chooseYourFreeItem:/.test(pt),
  );
}

section("Offers without a promo code");
{
  check(
    "🔴 the discount row prints no code when there is none",
    /appliedOffer\.code\s*\?\s*`\$\{resolveLocalized\(appliedOffer\.title, lang\)\} \(\$\{appliedOffer\.code\}\)`/.test(
      page,
    ),
    'a buy-and-reward offer has no code, and the row read "dfdsfdsf (undefined)" on screen',
  );
  check(
    "the applied pill's code chip is conditional too",
    /\{appliedOffer\.code && \(/.test(page),
  );
  check(
    "a buy-and-reward offer says what it gives",
    /buyAndRewardSummary/.test(page) && /buyAndRewardSummary:/.test(en),
    '"Buy 2, get 1 free" — the discount value means nothing on this kind',
  );
}

section("A welcome offer the customer has used is not offered again");
{
  // `GET /offers` is not personalised: on 17 Nov 2026 it still listed Tasca do
  // Bairro's 50% welcome offer as `isEligible: true, usageCount: 0` to a
  // customer whose order ORD-CDKN43IVA9 had used it. The store card, Vouchers,
  // the Profile count and the checkout's offer list all kept showing it.
  const { welcomeOfferUsage, isUsedWelcomeOffer, NO_WELCOME_OFFER_USAGE } = await import(
    join(here, "../src/lib/firstOrderOffer.ts")
  );
  const A = "6a6aced8f9e179566170db79";
  const B = "6a6ad6f1f9e179566170dcba";
  // Shapes as `?fields=` returns them (measured).
  const welcome = (status, vendor = A, extra = {}) => ({
    orderStatus: status,
    statusHistory: [{ status: "PENDING" }, ...(extra.accepted ? [{ status: "ACCEPTED" }] : []), { status }],
    offer: {
      isApplied: true,
      offerApplied: {
        isFirstOrder: true,
        firstOrderScope: extra.scope ?? "VENDOR",
        firstOrderVendorId: extra.scope === "GLOBAL" ? undefined : vendor,
        firstOrderPolicy: { maxRestores: extra.maxRestores ?? 2 },
      },
    },
  });
  const plain = (status) => ({ orderStatus: status, offer: { isApplied: false } });

  const used = (orders) => welcomeOfferUsage(orders);
  check(
    "🔴 the measured case: a NO_SHOW order with the welcome offer uses it up",
    used([plain("DELIVERED"), welcome("NO_SHOW")]).vendors.has(A),
  );
  check("a delivered or in-progress order uses it up", used([welcome("DELIVERED")]).vendors.has(A) && used([welcome("PENDING")]).vendors.has(A));
  check(
    "earlier orders without the offer don't use it (the backend counts use, not orders)",
    !used([plain("DELIVERED"), plain("PICKED_UP_BY_CUSTOMER")]).vendors.has(A),
  );
  check("a store rejection gives it back", !used([welcome("REJECTED")]).vendors.has(A));
  check("a cancel before the store accepted gives it back", !used([welcome("CANCELED")]).vendors.has(A));
  check("a cancel after the store accepted does not", used([welcome("CANCELED", A, { accepted: true })]).vendors.has(A));
  check(
    "given back only up to maxRestores times",
    !used([welcome("REJECTED"), welcome("REJECTED")]).vendors.has(A) &&
      used([welcome("REJECTED"), welcome("REJECTED"), welcome("REJECTED")]).vendors.has(A) &&
      used([welcome("REJECTED", A, { maxRestores: 0 })]).vendors.has(A),
  );
  check("per store: using store A's offer leaves store B's open", !used([welcome("DELIVERED")]).vendors.has(B));
  check(
    "the platform-wide offer is tracked on its own",
    used([welcome("DELIVERED", A, { scope: "GLOBAL" })]).global && !used([welcome("DELIVERED")]).global,
  );

  const usage = used([welcome("DELIVERED")]);
  const offerOf = (vendorId, scope = "VENDOR") => ({ vendorId, eligibility: { type: "FIRST_ORDER", scope } });
  check(
    "isUsedWelcomeOffer matches a list row by its store (string or populated)",
    isUsedWelcomeOffer(offerOf(A), usage) && isUsedWelcomeOffer(offerOf({ _id: A }), usage) && !isUsedWelcomeOffer(offerOf(B), usage),
  );
  check(
    "…and never hides an ordinary offer",
    !isUsedWelcomeOffer({ vendorId: A, eligibility: null }, usage) && !isUsedWelcomeOffer({ vendorId: A }, usage),
  );
  check("with no usage known, nothing is hidden", !isUsedWelcomeOffer(offerOf(A), NO_WELCOME_OFFER_USAGE));

  const hook = read("src/hooks/queries/useStoreWelcomeOffers.ts");
  const orders = read("src/hooks/queries/useOrders.ts");
  const vouchers = read("src/components/vouchers/VouchersPageContent.tsx");
  const profile = read("src/hooks/queries/useProfile.ts");
  check(
    "🔴 the store cards drop a used store's offer, and wait for the answer first",
    /useWelcomeOfferUsage/.test(hook) && /open\.delete\(vendorId\)/.test(hook) && /!ready\) return EMPTY/.test(hook),
  );
  check(
    "usage is one projected read, refreshed with the orders",
    /fields: WELCOME_OFFER_USAGE_FIELDS/.test(orders) && /welcomeOfferUsage: \["orders",/.test(orders),
  );
  check("the Vouchers page leaves a used welcome offer out", /isUsedWelcomeOffer\(offer, usage\)/.test(vouchers));
  check("the Profile voucher count leaves it out too", /isUsedWelcomeOffer\(offer, usage\)/.test(profile));
  check(
    "the checkout's offer list leaves it out",
    /offerList\.filter\(\(offer\) => !isUsedWelcomeOffer\(offer, welcomeOfferUsage\)\)/.test(page),
  );
}

section("The guard is wired in");
{
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  check(
    "`verify:offers` is a script someone can run",
    typeof scripts["verify:offers"] === "string",
    "a guard nothing calls passes forever",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
