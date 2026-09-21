/**
 * Escape closes modals — the hand-built ones, one at a time, safely.
 *
 *   pnpm verify:escape
 *
 * No browser. Driven live on 21 Sep 2026 (see the plan's notes): the dish
 * modal closes on Escape; with two open, only the top one does.
 *
 * ## What this defends
 *
 * The library's dialogs close on Escape already; the app's hand-built
 * overlays (`fixed inset-0`) did not — or, in three places, each listened on
 * its own, so one key press closed every modal that happened to be open.
 * One hook now owns the key, and these rules keep it that way:
 *
 * 1. **Every hand-built modal uses it** — found by what a file *does* (renders
 *    a full-screen overlay), not by a list someone has to remember. The few
 *    exceptions are named, with the reason.
 * 2. **Only the top one closes**, a library dialog on top wins, and no file
 *    listens for Escape on its own any more.
 * 3. **Escape is the safe answer.** Cancel, never "Remove session"; "Not now",
 *    never an address; and nothing at all while the modal is busy.
 * 4. **Hooks stay above early returns, and `"use client"` stays first.** The
 *    second is how this change nearly broke the cuisine strip: that file opens
 *    with a commented-out old version, and an import placed after a commented
 *    line landed above the directive.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const SRC = join(ROOT, "src");
const read = (file) => readFileSync(join(ROOT, file), "utf8");
const rel = (file) => relative(ROOT, file);
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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

function tsxUnder(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxUnder(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const files = tsxUnder(SRC).map((file) => ({
  path: rel(file),
  code: stripComments(readFileSync(file, "utf8")),
}));

const hook = stripComments(read("src/hooks/useEscapeToClose.ts"));

/**
 * Full-screen overlays that are **not** modals of ours, with the reason. Any
 * other file that renders `fixed inset-0` must use the hook.
 */
const NOT_OURS = new Map([
  ["src/components/ui/alert-dialog.tsx", "the library's alert dialog — Radix closes it on Escape"],
  ["src/components/support/SupportChatDialog.tsx", "a Radix Dialog — closes on Escape by itself"],
  ["src/components/search/SearchFilters.tsx", "an invisible click-catcher behind a dropdown, not a modal"],
]);

section("🔴 One hook, and it behaves");
{
  check(
    "only the top modal answers",
    /if \(topModal\(\) !== id\) return;/.test(hook),
    "without it, one Escape closes every modal that is open",
  );
  check(
    "🔴 'top' is the layer first, then the newest",
    /modal\.layer > top\.layer \|\| \(modal\.layer === top\.layer && modal\.order > top\.order\)/.test(hook),
    "newest-first closed the dish modal hidden *behind* the location prompt on a first visit to a shared link (found driving it, 21 Sep 2026)",
  );
  check(
    "a library dialog on top wins",
    /if \(event\.defaultPrevented\) return;/.test(hook),
    "Radix handles Escape during capture and marks it handled; the modal underneath must leave it",
  );
  check("an IME's Escape belongs to the text field", /event\.isComposing/.test(hook));
  check(
    "🔴 a busy modal on top swallows the key rather than passing it down",
    hook.indexOf("event.preventDefault();") > -1 &&
      hook.indexOf("event.preventDefault();") < hook.indexOf("if (disabledRef.current) return;"),
    "otherwise a disabled top modal would let Escape close the one beneath it",
  );
  check(
    "a modal leaves the stack when it closes or unmounts",
    /document\.removeEventListener\("keydown", onKeyDown\)/.test(hook) &&
      /openModals\.splice\(index, 1\)/.test(hook),
  );
  check(
    "the latest onClose and disabled apply, without re-registering",
    /onCloseRef\.current = onClose;/.test(hook) &&
      /disabledRef\.current = Boolean\(options\?\.disabled\);/.test(hook) &&
      /\}, \[open, layer\]\);/.test(hook),
  );
}

section("🔴 Every hand-built modal uses it");
{
  const overlays = files.filter(
    (file) => /fixed inset-0/.test(file.code) && !NOT_OURS.has(file.path),
  );
  const without = overlays.filter((file) => !/useEscapeToClose\(/.test(file.code));
  check(
    `every full-screen overlay closes on Escape (${overlays.length} files)`,
    overlays.length >= 10 && without.length === 0,
    `no Escape in: ${without.map((f) => f.path).join(", ")}`,
  );
  const staleExceptions = [...NOT_OURS.keys()].filter(
    (path) => !files.some((file) => file.path === path && /fixed inset-0/.test(file.code)),
  );
  check(
    "every exception still describes an overlay",
    staleExceptions.length === 0,
    `listed but no overlay: ${staleExceptions.join(", ")}`,
  );
  check(
    "no file listens for Escape on its own",
    files
      .filter((file) => /["']Escape["']/.test(file.code))
      .every((file) =>
        ["src/hooks/useEscapeToClose.ts", "src/components/orders/OrderSearchBar.tsx"].includes(file.path),
      ),
    "a private listener closes its modal whatever is on top — the bug three files had. (The order search box keeps its own: there Escape clears the search, it closes nothing.)",
  );
  const paymentHooks = (files.find((f) => f.path === "src/components/payment/PaymentPage.tsx")?.code.match(/useEscapeToClose\(/g) ?? []).length;
  check("all three of the payment page's sheets", paymentHooks === 3, `${paymentHooks} found`);
  const loginHooks = (files.find((f) => f.path === "src/components/auth/LoginPage.tsx")?.code.match(/useEscapeToClose\(/g) ?? []).length;
  check("both of the login page's", loginHooks === 2, `${loginHooks} found`);
}

section("🔴 Each modal's layer is its real z-index");
{
  // Per file: the z-index of its overlays, and the layers its hooks declare
  // (50 unless stated). They must be the same set.
  const drift = files
    .filter((file) => /useEscapeToClose\(/.test(file.code) && /fixed inset-0 z-\d+/.test(file.code))
    .filter((file) => {
      const zs = new Set([...file.code.matchAll(/fixed inset-0 z-(\d+)/g)].map((m) => Number(m[1])));
      const calls = [...file.code.matchAll(/useEscapeToClose\(([\s\S]*?)\);/g)].map((m) => m[1]);
      const layers = new Set(calls.map((call) => Number((call.match(/layer: (\d+)/) ?? [, 50])[1])));
      return [...zs].sort().join() !== [...layers].sort().join();
    })
    .map((file) => file.path);
  check(
    "every hook's layer matches its overlay's z- class",
    drift.length === 0,
    `drifted: ${drift.join(", ")} — the stack would put a modal on top that is drawn underneath`,
  );
}

section("🔴 Escape is the safe answer");
{
  const login = files.find((f) => f.path === "src/components/auth/LoginPage.tsx").code;
  check(
    "the device-limit prompt: Escape is Cancel, never Remove session",
    /useEscapeToClose\(open, \(\) => onOpenChange\(false\)\)/.test(login) &&
      !/useEscapeToClose\([^)]*onRemove/.test(login),
    "Remove session signs another device out",
  );
  const location = files.find((f) => f.path === "src/components/shared/LocationPromptModal.tsx").code;
  check(
    "the location prompt: Escape is Not now, remembered the same way",
    /useEscapeToClose\(showPromptModal, handleNotNow, \{\s*disabled: isRequesting,\s*layer: 9999,\s*\}\)/.test(location),
    "closing without recording the answer would bring the prompt straight back",
  );
  const payment = files.find((f) => f.path === "src/components/payment/PaymentPage.tsx").code;
  check(
    "the address sheet stays while an address is being switched",
    /useEscapeToClose\(showAddressModal, \(\) => setShowAddressModal\(false\), \{\s*disabled: Boolean\(switchingAddressId\),/.test(payment),
    "its ✕ refuses then too",
  );
  const orders = files.find((f) => f.path === "src/components/orders/OrdersPage.tsx").code;
  check(
    "the rating sheet stays while the rating is being sent",
    /useEscapeToClose\(Boolean\(activeRatingOrder\), \(\) => setActiveRatingOrder\(null\), \{\s*disabled: submittingRating,/.test(orders),
    "its Cancel is disabled then",
  );
}

section("🔴 Hooks above early returns, and `\"use client\"` first");
{
  const before = (path, hookCall, earlyReturn) => {
    const code = files.find((f) => f.path === path).code;
    const h = code.indexOf(hookCall);
    const r = code.indexOf(earlyReturn);
    return h > -1 && r > -1 && h < r;
  };
  check(
    "the dish modal calls it before `if (!isOpen) return null`",
    before("src/components/vendors/ProductDetailsModal.tsx", "useEscapeToClose(isOpen, onClose, { layer: 999 })", "if (!isOpen) return null;"),
    "a hook after an early return runs on some renders and not others — React's rule of hooks",
  );
  check(
    "the device-limit prompt, before `if (!open) return null`",
    before("src/components/auth/LoginPage.tsx", "useEscapeToClose(open,", "if (!open) return null;"),
  );
  check(
    "the location prompt, before `if (!showPromptModal) return null`",
    before("src/components/shared/LocationPromptModal.tsx", "useEscapeToClose(showPromptModal,", "if (!showPromptModal) return null;"),
  );
  check(
    "the payment page, before its loading return",
    before("src/components/payment/PaymentPage.tsx", "useEscapeToClose(showOfferModal,", "if (loading) {"),
  );
  const notFirst = tsxUnder(SRC)
    .filter((file) => /useEscapeToClose\(/.test(readFileSync(file, "utf8")) && file.endsWith(".tsx"))
    .filter((file) => {
      const codeLines = stripComments(readFileSync(file, "utf8"))
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return codeLines[0] !== '"use client";';
    })
    .map(rel);
  check(
    '🔴 `"use client"` is the first line of code in every file that uses it',
    notFirst.length === 0,
    `not first in: ${notFirst.join(", ")} — Next would render it as a server component, and the hook would throw`,
  );
}

section("The guard is wired in");
{
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  check(
    "`verify:escape` is a script someone can run",
    typeof scripts["verify:escape"] === "string",
    "a guard nothing calls passes forever",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
