/**
 * Checks what the cancel dialog actually sends to the API.
 *
 *   pnpm verify:cancel-reason
 *
 * No token, no network. `src/lib/cancelReason.ts` decides one thing: given a
 * selected option and whatever is in the free-text box, what string goes into
 * `PATCH /orders/:orderId/cancel`.
 *
 * ## Why it is worth a script
 *
 * The failure modes are silent and customer-visible. That string is stored on
 * the order as `cancelReason` **and** as the note on the `CANCELED` entry in
 * `statusHistory`, which the tracking timeline renders back to the customer and
 * the vendor reads in their app. Send an option id by mistake and a real person
 * reads `TAKING_TOO_LONG`; send an untrimmed empty box and the API answers with
 * a Zod validation error the form should have prevented. Neither shows up in
 * `tsc`, `eslint` or the build.
 *
 * The API's own behaviour was established by probing it live on 2026-08-15: it
 * accepts any non-empty string (lengths 1–5000, emoji, newlines, accents, HTML
 * all pass) and rejects a missing, empty or non-string `reason` with a Zod
 * error on `body.reason`. There is no server-side enum — the option list is a
 * frontend affordance, which is exactly why nothing but this file guards it.
 *
 * Type stripping and the resolve hook work the same way as
 * `verify-notification-header.mjs`.
 */

import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));

const { CANCEL_REASON_OPTIONS, OTHER_CANCEL_REASON, resolveCancelReason } =
  await import(join(here, "../src/lib/cancelReason.ts"));

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

/** English copy, taken from `en.ts` — the strings a customer actually sends. */
const EN = {
  cancelReasonChangedMind: "Changed my mind",
  cancelReasonMistake: "Ordered by mistake",
  cancelReasonTooLong: "Taking too long",
  cancelReasonOther: "Other",
};
const t = (key) => EN[key] ?? key;

section("The option list");
{
  check("has four options", CANCEL_REASON_OPTIONS.length === 4,
    CANCEL_REASON_OPTIONS.length);
  check("ends with Other, as the mobile app lists them",
    CANCEL_REASON_OPTIONS.at(-1).id === OTHER_CANCEL_REASON);
  check("every option has a distinct id",
    new Set(CANCEL_REASON_OPTIONS.map((o) => o.id)).size === 4);
  check("every option has a distinct label key",
    new Set(CANCEL_REASON_OPTIONS.map((o) => o.labelKey)).size === 4);
  check("every label key resolves to real copy, not the key itself",
    CANCEL_REASON_OPTIONS.every((o) => t(o.labelKey) !== o.labelKey),
    CANCEL_REASON_OPTIONS.filter((o) => t(o.labelKey) === o.labelKey)
      .map((o) => o.labelKey).join(", "));
}

section("🔴 A preset sends its copy — never its id");
{
  // The whole point. An id reaching the API is read by a human twice over.
  const sent = CANCEL_REASON_OPTIONS
    .filter((o) => o.id !== OTHER_CANCEL_REASON)
    .map((o) => resolveCancelReason(o.id, "", t));

  check("all three presets resolve to something",
    sent.every((value) => typeof value === "string" && value.length > 0),
    JSON.stringify(sent));
  check("no id leaks into the sent string",
    sent.every((value) =>
      !CANCEL_REASON_OPTIONS.some((o) => value.includes(o.id))),
    JSON.stringify(sent));
  check("the copy is what goes",
    resolveCancelReason("TAKING_TOO_LONG", "", t) === "Taking too long",
    resolveCancelReason("TAKING_TOO_LONG", "", t));
  check("a preset ignores anything left in the free-text box",
    resolveCancelReason("CHANGED_MY_MIND", "leftover typing", t) ===
      "Changed my mind");
}

section("Other sends the customer's words");
{
  check("typed text is sent",
    resolveCancelReason(OTHER_CANCEL_REASON, "restaurant never called", t) ===
      "restaurant never called");
  check("and is trimmed",
    resolveCancelReason(OTHER_CANCEL_REASON, "  spaced out  ", t) ===
      "spaced out");
  check("the word Other itself is never sent",
    resolveCancelReason(OTHER_CANCEL_REASON, "mine", t) !== "Other");
  check("accented Portuguese survives intact",
    resolveCancelReason(OTHER_CANCEL_REASON, "não gostei da demora", t) ===
      "não gostei da demora");
}

section("Nothing sendable → null, which is what disables the button");
{
  check("no option chosen", resolveCancelReason(null, "", t) === null);
  check("no option chosen, even with text typed",
    resolveCancelReason(null, "already typed this", t) === null);
  check("Other with an empty box",
    resolveCancelReason(OTHER_CANCEL_REASON, "", t) === null);

  // 🔴 The API rejects a whitespace-only reason with a Zod `too_small` error.
  // A form that can submit one shows a validation failure it should have
  // prevented, on a screen the customer is already unhappy on.
  check("Other with a whitespace-only box",
    resolveCancelReason(OTHER_CANCEL_REASON, "   \n\t  ", t) === null);

  check("an option id this build does not know",
    resolveCancelReason("SOME_REMOVED_OPTION", "", t) === null);
  check("undefined selection", resolveCancelReason(undefined, "", t) === null);
}

section("A preset whose copy went missing is refused, not sent blank");
{
  // If a dictionary loses a key, `t` may return something empty. Sending that
  // is a guaranteed 400 — better to leave the button disabled.
  const blank = () => "   ";
  check("blank copy resolves to null",
    resolveCancelReason("CHANGED_MY_MIND", "", blank) === null);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
