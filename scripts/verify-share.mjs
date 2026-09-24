/**
 * Sharing a dish from its card.
 *
 *   pnpm verify:share
 *
 * No token, no network: `shareOrCopy` runs against stubbed `navigator`s.
 *
 * ## What this defends
 *
 * 1. **The link lands on the dish.** `/vendors/<vendorId>?product=<productId>`
 *    is the deep link the store page already reads. Both ids are easy to get
 *    wrong in a way that only shows once a friend taps the link: the store's
 *    `V-…` userId answers 400 where its Mongo id works (since 24 Sep 2026 —
 *    `pnpm verify:vendor-id`), and the dish's Mongo `_id` is not what
 *    `?product=` takes, its business `productId` is.
 * 2. **Sharing never opens the dish.** The button sits inside cards that are
 *    clickable themselves, and a search card answers Enter on `keydown`, which
 *    a click handler alone does not stop.
 * 3. **A tap always ends somewhere.** The share sheet where there is one, the
 *    link copied where there is not — or where Safari refuses the sheet after
 *    a slow lookup — and closing the sheet is silence, not an error.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(here, "..", file), "utf8");
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

const { productShareUrl, productShareText, shareOrCopy, productIdFromParam } = await import(
  join(here, "../src/lib/share.ts")
);
const button = stripComments(read("src/components/shared/ShareButton.tsx"));
const vendorPage = stripComments(read("src/components/vendors/VendorDetailsPage.tsx"));
const search = stripComments(read("src/app/(main)/search/SearchContent.tsx"));
const en = read("src/assets/translations/en.ts");
const pt = read("src/assets/translations/pt.ts");

/** A stand-in `navigator`, recording what it was asked to do. */
function fakeNavigator({ share, copy } = {}) {
  const calls = { shared: [], copied: [] };
  const nav = {};
  if (share) {
    nav.share = async (data) => {
      calls.shared.push(data);
      if (share !== true) throw Object.assign(new Error(share), { name: share });
    };
  }
  if (copy) {
    nav.clipboard = {
      writeText: async (text) => {
        if (copy === "throws") throw new Error("denied");
        calls.copied.push(text);
      },
    };
  }
  return { nav, calls };
}
const PHONE = { sheet: true };
const COMPUTER = { sheet: false };
const VENDOR_ID = "6a6ad9d6f9e179566170dd64"; // Sumu's Bites, on the test API
const DATA = { title: "Beef Tehari", text: "Found this on DeliGo: Beef Tehari", url: `https://x/vendors/${VENDOR_ID}?product=PROD-1` };

section("🔴 The link lands on the dish");
{
  check(
    "the store's route id and the dish's productId, in the route the page reads",
    productShareUrl("https://deligo.pt", VENDOR_ID, "PROD-0042") ===
      `https://deligo.pt/vendors/${VENDOR_ID}?product=PROD-0042`,
  );
  check(
    "a trailing slash on the origin does not double up",
    productShareUrl("https://deligo.pt/", "v1", "PROD-1") === "https://deligo.pt/vendors/v1?product=PROD-1",
  );
  check(
    "the ids are encoded, not trusted",
    productShareUrl("https://d.pt", "v 1", "P&x=1") === "https://d.pt/vendors/v%201?product=P%26x%3D1",
    "a product id is data from the API; an `&` in it must not become a second parameter",
  );
  check(
    "🔴 a link pasted with its message still finds the dish",
    productIdFromParam("PROD-7H7GMP Found this on DeliGo: Morog Polao — Tasca do Bairro") === "PROD-7H7GMP" &&
      productIdFromParam("  PROD-7H7GMP  ") === "PROD-7H7GMP" &&
      productIdFromParam("PROD-7H7GMP") === "PROD-7H7GMP",
    "the macOS share menu's Copy joins link and message; pasted, the whole line became the id — 'Product not found' (owner's screenshot, 21 Sep 2026)",
  );
  check(
    "no id is no id, not an empty string",
    productIdFromParam("") === null && productIdFromParam("   ") === null && productIdFromParam(null) === null,
    "an empty id would open the dish popup on nothing",
  );
  check(
    "the store page opens a dish from `?product=`, reading only the id",
    /productIdFromParam\(searchParams\.get\("product"\)\)/.test(vendorPage),
    "the whole feature rides on this — without it a shared link lands on the store, not the dish",
  );
  check(
    "🔴 the menu card shares the business productId, never the Mongo _id",
    /productShareUrl\(window\.location\.origin, vendorId, product\.productId\)/.test(vendorPage),
    "`?product=` takes PROD-…; the cart's `_id` would open nothing",
  );
  check(
    "🔴 …and the store's route id",
    /\bvendorId=\{vendorId\}/.test(vendorPage),
    "`vendorId` here is the `[vendorId]` route param — the id the link needs",
  );
  check(
    "a search result shares the store its card leads to",
    /const vendorId = await vendorIdFor\(hit\);/.test(search) &&
      /productShareUrl\(window\.location\.origin, vendorId, hit\.productId\)/.test(search),
    "shared and tapped must land in the same place",
  );
}

section("The words that travel with it");
{
  check(
    "intro, dish and store",
    productShareText("Found this on DeliGo:", "Beef Tehari", "Tasca do Bairro") ===
      "Found this on DeliGo: Beef Tehari — Tasca do Bairro",
  );
  check(
    "no store name, no dangling dash",
    productShareText("Found this on DeliGo:", "Beef Tehari", "") === "Found this on DeliGo: Beef Tehari" &&
      productShareText("Found this on DeliGo:", "Beef Tehari", undefined) === "Found this on DeliGo: Beef Tehari",
  );
  check(
    "copy in both languages",
    ["shareFailed", "shareItemIntro", "linkCopied", "share"].every(
      (key) => new RegExp(`\\n  ${key}:`).test(en) && new RegExp(`\\n  ${key}:`).test(pt),
    ),
  );
}

section("🔴 A tap always ends somewhere");
{
  {
    const { nav, calls } = fakeNavigator({ share: true, copy: true });
    const outcome = await shareOrCopy(DATA, COMPUTER, nav);
    check(
      "🔴 a computer copies the bare link, even where a share menu exists",
      outcome === "copied" && calls.shared.length === 0 && calls.copied[0] === DATA.url,
      "the desktop share menu's Copy joins link and message — the string that 404'd",
    );
  }
  check(
    "the button asks the pointer, at the moment of the tap",
    /matchMedia\?\.\("\(pointer: coarse\)"\)\.matches === true/.test(button) &&
      /shareOrCopy\(await getShareData\(\), \{ sheet \}\)/.test(button),
    "touch screens get the sheet; a mouse gets the link",
  );
  {
    const { nav, calls } = fakeNavigator({ share: true, copy: true });
    const outcome = await shareOrCopy(DATA, PHONE, nav);
    check("the share sheet is used where there is one", outcome === "shared" && calls.shared.length === 1 && calls.copied.length === 0);
  }
  {
    const { nav, calls } = fakeNavigator({ share: "AbortError", copy: true });
    const outcome = await shareOrCopy(DATA, PHONE, nav);
    check(
      "🔴 closing the sheet is silence, not a copy and not an error",
      outcome === "cancelled" && calls.copied.length === 0,
      "the customer changed their mind; a 'link copied' toast would be a lie",
    );
  }
  {
    const { nav, calls } = fakeNavigator({ share: "NotAllowedError", copy: true });
    const outcome = await shareOrCopy(DATA, PHONE, nav);
    check(
      "🔴 a refused sheet falls back to copying",
      outcome === "copied" && calls.copied[0] === DATA.url,
      "Safari refuses the sheet when a slow lookup outlasts the tap; the customer still gets a link",
    );
  }
  {
    const { nav, calls } = fakeNavigator({ copy: true });
    const outcome = await shareOrCopy(DATA, PHONE, nav);
    check(
      "no share sheet (most desktops): the link is copied",
      outcome === "copied" && calls.copied.length === 1,
    );
    check(
      "what is copied is the link alone",
      calls.copied[0] === DATA.url,
      "pasted anywhere, a bare link is the thing that works",
    );
  }
  {
    const { nav } = fakeNavigator({ copy: "throws" });
    check("a clipboard that refuses is a failure", (await shareOrCopy(DATA, PHONE, nav)) === "failed");
  }
  check("neither is a failure, not a crash", (await shareOrCopy(DATA, PHONE, {})) === "failed");
}

section("🔴 Sharing never opens the dish");
{
  check(
    "the click stops at the button",
    /event\.preventDefault\(\);\s*event\.stopPropagation\(\);/.test(button),
    "the menu card opens the dish on click",
  );
  check(
    "🔴 so do Enter and Space",
    /onKeyDown=\{\(event\) => \{\s*if \(event\.key === "Enter" \|\| event\.key === " "\) event\.stopPropagation\(\);/.test(button),
    "a search card navigates on keydown — a click handler alone would share *and* open",
  );
  check(
    "it says so only when there is something to say",
    /if \(outcome === "copied"\) toast\.success\(t\("linkCopied"\)\)/.test(button) &&
      /if \(outcome === "failed"\) toast\.error\(t\("shareFailed"\)\)/.test(button) &&
      !/outcome === "cancelled"\) toast/.test(button),
  );
  check(
    "a second tap while the first is working does nothing",
    /if \(busy\) return;/.test(button),
  );
  check(
    "it is named after the dish",
    /aria-label=\{label\}/.test(button) &&
      /label=\{`\$\{t\("share"\)\} \$\{product\.name\}`\}/.test(vendorPage) &&
      /label=\{`\$\{t\("share"\)\} \$\{hit\.name\}`\}/.test(search),
    "a screen reader hears 'Share Beef Tehari', not twelve identical 'Share' buttons",
  );
}

section("On every dish card");
{
  check(
    "the menu card has it, opposite the discount badge",
    /<ShareButton\s+className="absolute right-2 top-2"/.test(vendorPage) &&
      /absolute left-2 top-2 rounded-full bg-primary/.test(vendorPage),
  );
  check(
    "the search card has it, and warms the lookup on press-down",
    /<ShareButton\s+className="absolute right-2 top-2"[\s\S]{0,200}onPrepare=\{\(\) => onPrefetch\(hit\)\}/.test(search),
  );
  check(
    "the store name reaches the cards as a string",
    /const storeName = vendor\?\.businessDetails\?\.businessName;/.test(vendorPage) &&
      /storeName=\{storeName\}/.test(vendorPage),
    "the cards are memoised; handing them the vendor object would re-render the grid on every refetch",
  );
}

section("The guard is wired in");
{
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  check(
    "`verify:share` is a script someone can run",
    typeof scripts["verify:share"] === "string",
    "a guard nothing calls passes forever",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
