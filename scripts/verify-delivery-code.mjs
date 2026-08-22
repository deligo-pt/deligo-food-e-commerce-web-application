/**
 * Guards the delivery code the rider verifies at the door.
 *
 *   pnpm verify:delivery-code
 *
 * No token, no network. Like `verify:profile-form`, there is no pure function
 * to exercise — the rule lives in a JSX condition and a prop type — so this
 * reads the source and asserts its shape. Every failure below is invisible to
 * `tsc`, `eslint` and the build.
 *
 * ## What the backend sends
 *
 * `GET /orders/:orderId` returns, on delivery orders:
 *
 *     "deliveryOtp": {
 *       "code": "300873",
 *       "generatedAt": "2026-08-20T09:46:55.805Z",
 *       "verifiedAt": "2026-08-20T13:31:02.283Z",
 *       "verifiedBy": "...",
 *       "attempts": 0
 *     }
 *
 * The rider types the code into their own app and that verification is what
 * moves the order to `DELIVERED`.
 *
 * ## The two rules
 *
 * **Gate on the field, not on the status.** In a captured order `generatedAt`
 * matched the `PICKED_UP` history entry to the millisecond — one status before
 * `ON_THE_WAY` — so a status check hides the code while the rider is leaving
 * the restaurant. And `verifiedAt` matched the `DELIVERED` entry the same way,
 * so testing it is what clears a spent code on the same five-second poll that
 * completes the order, with no second condition to keep in sync.
 *
 * **The code is a string, end to end.** The first real pickup code came back
 * `"087275"` — six characters, leading zero. Any numeric coercion renders
 * `87275`, and the customer reads five digits to a rider whose check then
 * fails, with nothing on screen to explain why. `"300873"` survives a round
 * trip; the next one may not.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const CARD = readFileSync(
  join(here, "../src/components/orders/TrackOrder/DeliveryCodeCard.tsx"),
  "utf8",
);
const TRACK = readFileSync(
  join(here, "../src/components/orders/TrackOrder/TrackOrder.tsx"),
  "utf8",
);
const EN = readFileSync(join(here, "../src/assets/translations/en.ts"), "utf8");
const PT = readFileSync(join(here, "../src/assets/translations/pt.ts"), "utf8");

/**
 * The card with its comments removed.
 *
 * The coercion checks below have to read code only: this file's own prose names
 * `Number()` while explaining why never to use it, and a guard that its own
 * documentation trips is a guard nobody can write the documentation for.
 */
const CARD_CODE = CARD.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

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

function section(title) {
  console.log(`\n${title}`);
}

/** The line that decides whether the card renders, or `null`. */
function gate() {
  const marker = "<DeliveryCodeCard";
  const at = TRACK.indexOf(marker);
  if (at === -1) return null;
  // Back up to the opening of the JSX expression that wraps it.
  const open = TRACK.lastIndexOf("{", at);
  if (open === -1) return null;
  return TRACK.slice(open, at);
}

section("The card renders on the field, not on the status");
{
  check("the card is used at all", TRACK.includes("<DeliveryCodeCard"));
  check("it is imported", TRACK.includes('from "./DeliveryCodeCard"'));

  const g = gate();
  check("the gate is found", g !== null);

  // Both halves. Without the first the card renders empty on every pickup
  // order and every order placed before the field existed; without the second
  // a spent code sits on a delivered order for anyone to read out.
  check(
    "it requires a code to exist",
    g !== null && /order\.deliveryOtp\?\.code/.test(g),
  );
  check(
    "it requires the code to be unverified",
    g !== null && /!order\.deliveryOtp\??\.verifiedAt/.test(g),
  );

  // The whole point of gating on the field: the code predates `ON_THE_WAY`.
  check(
    "the gate does not test orderStatus",
    g !== null && !g.includes("orderStatus"),
    g === null ? undefined : g.trim(),
  );
  for (const status of ["ON_THE_WAY", "PICKED_UP", "ASSIGNED", "DELIVERED"]) {
    check(
      `the gate does not name ${status}`,
      g !== null && !g.includes(status),
    );
  }

  // A pickup order has no rider to hand a code to, and carries `pickup.code`
  // instead. The two must never both be on screen.
  check("it is excluded from pickup orders", g !== null && /!isPickup/.test(g));
  check(
    "it passes the code straight through",
    /<DeliveryCodeCard code=\{order\.deliveryOtp\.code\}/.test(TRACK),
  );
}

section("The code is a string, not a number");
{
  check("the prop is typed string", /code: string;/.test(CARD_CODE));

  // The `"087275"` trap. Each of these silently drops a leading zero.
  for (const [label, pattern] of [
    ["Number(", /\bNumber\(/],
    ["parseInt", /\bparseInt\b/],
    ["parseFloat", /\bparseFloat\b/],
    ["unary +", /\+code\b/],
    ["toLocaleString", /\.toLocaleString\(/],
  ]) {
    check(`the card never uses ${label}`, !pattern.test(CARD_CODE));
  }

  // Rendering per character is what draws the boxes; doing it by splitting the
  // string is what keeps every character, including a leading zero.
  check(
    "the digits are split from the string",
    /code\.split\(""\)/.test(CARD_CODE),
  );
  check("digits do not reflow as it re-renders", CARD_CODE.includes("tabular-nums"));
}

section("A screen reader hears digits, not a quantity");
{
  // Six separate boxes read aloud are six unrelated digits; the boxes are
  // hidden and one spelled-out label speaks for them.
  check("the boxes are hidden from assistive tech", CARD_CODE.includes('aria-hidden="true"'));
  check(
    "the code is spelled out for assistive tech",
    /code\.split\(""\)\.join\(" "\)/.test(CARD_CODE),
  );
  check("the copy button is labelled", CARD_CODE.includes('aria-label={t("copyCode")}'));
}

section("Both locales carry the copy");
{
  for (const key of ["yourDeliveryCode", "giveCodeToRider"]) {
    check(`${key} exists in en`, new RegExp(`${key}: "`).test(EN));
    check(`${key} exists in pt`, new RegExp(`${key}: "`).test(PT));
    // A pt dictionary quietly holding english has shipped before.
    check(
      `the pt ${key} is not the en one`,
      (PT.match(new RegExp(`${key}: "([^"]*)"`)) ?? [])[1] !==
        (EN.match(new RegExp(`${key}: "([^"]*)"`)) ?? [])[1],
    );
    check(`the card uses ${key}`, CARD_CODE.includes(`t("${key}")`));
  }
}

section("What is deliberately not shown");
{
  // A customer reading "attempts: 2" learns only that something went wrong,
  // with no action available to them.
  check("the attempt count is not surfaced", !CARD_CODE.includes("attempts"));
  check("the verifier's id is not surfaced", !CARD_CODE.includes("verifiedBy"));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
