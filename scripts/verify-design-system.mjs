/**
 * verify:design — the design system is in one place, and the call sites ask it.
 *
 * Run: `pnpm verify:design`
 *
 * ## What this exists to stop
 *
 * `Plan.md` was written after an audit that found 107 distinct hex literals
 * across 1,092 occurrences, a token layer nothing used, and a `<Button>`
 * component imported by exactly zero files while 56 files hand-typed their own.
 * The failure mode is not a crash. It is drift: one more `px-5`, one more
 * spelling of the pink, one more control that looks like a button and cannot be
 * reached by keyboard. Nothing in review catches that, because each instance is
 * individually reasonable.
 *
 * So the assertions here are mostly of the form *the call site states no
 * geometry* — not *the call site states the right geometry*. A guard that
 * checks for `h-10` at the call site is satisfied by the very duplication the
 * phase removed.
 *
 * ## Sections
 *
 *   §1  tokens exist, in both themes, with the values Plan.md §1.4 names
 *   §2  the type scale — the one token Tailwind lacks, and no off-scale sizes
 *       in the files these phases own
 *   §3  the button owns its geometry: three sizes, fixed padding, one text size
 *   §4  the shared focus ring exists and fires on :focus-visible only
 *   §5  the Shop On Deligo card — a real control, on the 4-based scale
 *   §6  the category circles — a real control, 80px, one label size
 *   §7  neither row is a `<div onClick>` any more
 *   §8  the /_design spec page renders the real component, not a redrawing
 *   §9  the sweep — the whole tree is on the six-step scale, and the hex count
 *       can only fall
 *  §10  the five layout defects, and the shapes that let them in
 *  §11  motion: three primitives, each with its own reduced-motion opt-out,
 *       and nothing animating a value the backend supplied
 *  §12  the homepage box model — one card design across two files, a heading
 *       that steps, and no spacing off the 4-based scale
 *  §13  one card shell, tree-wide — the first guard here that walks the whole
 *       tree instead of naming the files a phase happened to touch
 *  §14  two heading roles and one label voice, tree-wide
 *
 * ## What this cannot check
 *
 * Pixels. There is no browser in this environment, so every assertion below is
 * about source text. The sticky-header bug in the category work was found by a
 * user screenshot, not by a suite like this one, and that limit has not moved.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;
const check = (name, condition, detail) => {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
};
const section = (title) => console.log(`\n${title}`);

const read = (path) => readFileSync(join(ROOT, path), "utf8");

/**
 * Code only. Every file below documents the rule it follows and quotes the
 * construct it retired — `p-5 sm:p-7 lg:p-10`, `text-[10px]`, `<div onClick>`.
 * Matching against prose would flag the explanation instead of a defect, which
 * is how a guard teaches people to delete the comment.
 *
 * Line comments before block comments: a `//` line containing `/*` otherwise
 * opens a block that swallows the rest of the file, and every guard below
 * passes against an empty string.
 */
const stripComments = (src) =>
  src
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const css = read("src/app/globals.css");
const cssCode = stripComments(css);
const button = stripComments(read("src/components/ui/button.tsx"));
const shop = stripComments(read("src/components/home/ShopSection.tsx"));
const cuisines = stripComments(read("src/components/home/CategoriesSection.tsx"));
const spec = stripComments(read("src/app/%5Fdesign/page.tsx"));
const cardComponent = stripComments(read("src/components/ui/card.tsx"));
const headingComponent = stripComments(read("src/components/ui/section-heading.tsx"));
const motionHook = stripComments(read("src/hooks/useMotion.ts"));

/** Narrow a source to one region, so a match somewhere else in a 700-line file
 *  cannot satisfy an assertion about this row. */
const between = (src, from, to) => {
  const start = src.indexOf(from);
  if (start === -1) return "";
  const end = src.indexOf(to, start + from.length);
  return src.slice(start, end === -1 ? src.length : end);
};

/** The two-card loading branch of ShopSection, and the cuisine track. */
const shopSkeletonCard = between(shop, "Array.from({ length: 2 })", "</section>");
const cuisineTrack = between(cuisines, "{cuisines.map((cuisine)", "})}");

/** The `:root` block only — so a dark override cannot satisfy a light check. */
const lightTokens = cssCode.slice(
  cssCode.indexOf(":root {"),
  cssCode.indexOf("@theme inline"),
);
const darkTokens = cssCode.slice(cssCode.indexOf(".dark {"));

// ---------------------------------------------------------------------------
section("§1  colour tokens");
// ---------------------------------------------------------------------------

check(
  "--primary is the brand pink, not the shadcn near-black it shipped as",
  /--primary:\s*#f9186b;/.test(lightTokens),
  "the default was oklch(0.205 0 0) — chroma 0",
);
check(
  "…and it is the same pink in dark mode",
  /--primary:\s*#f9186b;/.test(darkTokens),
);
check(
  "no chroma-0 oklch is still posing as the brand colour",
  !/--primary:\s*oklch\([^)]*\s0\s0\)/.test(cssCode),
);
check(
  "--foreground, --muted-foreground and --border carry the Plan.md §1.4 values",
  /--foreground:\s*#191c1d;/.test(lightTokens) &&
    /--muted-foreground:\s*#5f6368;/.test(lightTokens) &&
    /--border:\s*#edeeef;/.test(lightTokens),
);
check(
  "dark mode lightens --muted-foreground rather than inheriting the light one",
  /--muted-foreground:\s*#a3a3a3;/.test(darkTokens),
);
check(
  "--warning exists and is wired into the theme, so the rating star has a name",
  /--warning:\s*#f6c344;/.test(lightTokens) &&
    /--color-warning:\s*var\(--warning\);/.test(cssCode),
);
check(
  "--success carries availability, in both themes, and clears AA on white",
  // The prototype's #0E8A5F measures 4.36:1 — under the 4.5:1 a 14px label
  // needs. #0d835a is the same hue 5% darker at 4.76:1. The dark value is the
  // prototype's own.
  /--success:\s*#0d835a;/.test(lightTokens) &&
    /--success:\s*#2ecc94;/.test(darkTokens) &&
    /--color-success:\s*var\(--success\);/.test(cssCode),
);

// ---------------------------------------------------------------------------
section("§2  type scale");
// ---------------------------------------------------------------------------

check(
  "32px has a token, because it is the one step Tailwind does not name",
  /--text-display:\s*2rem;/.test(cssCode) &&
    /--text-display--line-height:\s*2\.5rem;/.test(cssCode),
);
check(
  "spacing adds no parallel token set — Tailwind's base unit is already 4px",
  /--spacing:\s*0\.25rem;/.test(cssCode) &&
    !/--space-(xs|sm|md|lg|xl)\b/.test(cssCode),
);
check(
  "the two Phase 3 files carry no off-scale font size",
  !/text-\[10px\]/.test(shop) &&
    !/text-\[10px\]/.test(cuisines) &&
    !/text-\[11px\]/.test(shop) &&
    !/text-\[11px\]/.test(cuisines),
);
check(
  "…and no off-scale font size anywhere in the button",
  !/text-\[/.test(button),
);

// ---------------------------------------------------------------------------
section("§3  the button owns its geometry");
// ---------------------------------------------------------------------------

check(
  "three sizes, and the default is 44 on a phone before settling to 40",
  /sm:\s*"h-8 gap-2 px-3"/.test(button) &&
    /default:\s*"h-11 gap-2 px-4 sm:h-10"/.test(button) &&
    /lg:\s*"h-12 gap-2 px-5"/.test(button),
);
check(
  "the icon sizes are square at the same three heights",
  /"icon-sm":\s*"size-8"/.test(button) &&
    /icon:\s*"size-11 sm:size-10"/.test(button) &&
    /"icon-lg":\s*"size-12"/.test(button),
);
check(
  "the xs steps are gone — smaller than sm is not a button in this system",
  !/\bxs:\s*"/.test(button) && !/"icon-xs"/.test(button),
);
check(
  "padding does not shrink itself when an icon sits at an edge",
  // `has-data-[icon=inline-*]` made padding a function of content. Fixed
  // padding is the entire point of the component.
  !/has-data-\[icon=inline-/.test(button),
);
check(
  "one text size for every button, declared once in the base class",
  (button.match(/text-sm/g) || []).length === 1,
);
check(
  "hover darkens the brand fill instead of fading it toward the page",
  // `hover:bg-primary/80` lowered the white label's contrast at the exact
  // moment of interaction. Phase 4 named the darker mix, so the button asks for
  // the token rather than restating the color-mix.
  /hover:bg-primary-hover\b/.test(button) && !/hover:bg-primary\/\d/.test(button),
);
check(
  "the darker step is derived from --primary, not typed as a seventh pink",
  /--primary-hover:\s*color-mix\(in oklch, var\(--primary\), black 10%\);/.test(cssCode) &&
    /--color-primary-hover:\s*var\(--primary-hover\);/.test(cssCode),
);
check(
  "the base class still carries a focus ring for every variant",
  /focus-visible:ring-3/.test(button),
);

// ---------------------------------------------------------------------------
section("§4  the shared focus ring");
// ---------------------------------------------------------------------------

check(
  "globals.css defines .focus-ring",
  /\.focus-ring:focus-visible\s*\{/.test(cssCode),
);
check(
  "it fires on :focus-visible, so a mouse click leaves no ring behind",
  !/\.focus-ring:focus\s*\{/.test(cssCode),
);
check(
  "it paints with the brand token rather than a fourth spelling of the pink",
  /\.focus-ring:focus-visible\s*\{[^}]*var\(--primary\)/.test(cssCode),
);

// ---------------------------------------------------------------------------
section("§5  Shop On Deligo");
// ---------------------------------------------------------------------------

check(
  "the card is a real button, not a div that happens to have onClick",
  /<button\b[\s\S]{0,400}aria-pressed=\{isActive\}/.test(shop),
);
check(
  "it announces which of the two is selected",
  /aria-pressed=\{isActive\}/.test(shop),
);
check(
  "it is reachable and visibly focused",
  /focus-ring/.test(shop),
);
check(
  "padding is on the 4-based scale — the 20/28/40 ladder is gone",
  // Phase 8 moved this off the call site entirely: the card asks
  // `cardVariants` for its padding rather than restating it. So the stronger
  // fact is that the call site names *no* padding at all, and the one place
  // that does name it says 16 → 24.
  /padding: "card"/.test(shop) &&
    !/\bp-[45789]\b/.test(shop) &&
    !/sm:p-[78]/.test(shop) &&
    !/lg:p-10/.test(shop) &&
    /card: "p-4 sm:p-6"/.test(cardComponent),
);
check(
  "the icon is 64px flat, not 80 → 112 → 160",
  /size-16 shrink-0/.test(shop) &&
    !/lg:h-40/.test(shop) &&
    !/sm:h-28/.test(shop),
);
check(
  "one gap, not three",
  /gap-4/.test(shop) && !/sm:gap-6/.test(shop) && !/lg:gap-10/.test(shop),
);
check(
  "the title is on the scale and no longer outgrows the card",
  /text-base font-bold/.test(shop) && !/text-lg/.test(shop) && !/sm:text-xl/.test(shop),
);
check(
  "the image is requested at the size it is drawn at",
  /height=\{64\}/.test(shop) && /width=\{64\}/.test(shop) && !/\{160\}/.test(shop),
);
check(
  "🔴 the skeleton is the same shape as the card it stands in for",
  // A skeleton with different padding, a different icon box, or three text
  // lines where the card renders one is a layout shift with extra steps.
  // Both halves ask the same component for the same padding now, which is a
  // stronger guarantee than two identical strings that happen to match today.
  /cardVariants\(\{ padding: "card" \}\)/.test(shopSkeletonCard) &&
    /size-16 shrink-0 animate-pulse/.test(shopSkeletonCard) &&
    // One icon box and one title line. It used to draw three text lines under
    // a 160px icon, for a card that renders a single word.
    (shopSkeletonCard.match(/animate-pulse/g) || []).length === 2,
);

// ---------------------------------------------------------------------------
section("§6  category circles");
// ---------------------------------------------------------------------------

check(
  "the circle is a real button",
  /<button\b[\s\S]{0,400}aria-pressed=\{isActive\}/.test(cuisines),
);
check(
  "it is reachable and visibly focused",
  /focus-ring group flex/.test(cuisines),
);
check(
  "80px from sm, not 128 — mobile keeps the 64 that was already right",
  // Phase 7 put the circle inside a tile, and the tile is `w-24 sm:w-32`. The
  // old form of this guard read `!/sm:w-32/` across the whole file, so it
  // could not tell a tile's width from a circle's diameter. It asks about the
  // circle's own class string now, which is what it always meant.
  /block size-16 rounded-full[\s\S]{0,200}sm:size-20/.test(cuisines) &&
    !/\bsize-32\b/.test(cuisines) &&
    !/\bsm:h-32\b/.test(cuisines),
);
check(
  "the label is one size at every width",
  /text-center text-xs font-bold uppercase/.test(cuisines) &&
    !/sm:text-xs/.test(cuisines) &&
    !/sm:leading-4/.test(cuisines),
);
check(
  "the image is requested at the size it is drawn at",
  /height=\{80\}/.test(cuisines) && /width=\{80\}/.test(cuisines),
);
check(
  "🔴 the skeleton circle matches the live circle",
  /size-16 animate-pulse rounded-full[\s\S]{0,80}sm:size-20/.test(cuisines),
);
check(
  "the track gap is on the scale, and the skeleton track uses the same one",
  (cuisines.match(/sm:gap-6/g) || []).length === 2 && !/sm:gap-8/.test(cuisines),
);

// ---------------------------------------------------------------------------
section("§7  no clickable divs left in either row");
// ---------------------------------------------------------------------------

/** `<div … onClick={…}` with no intervening `>`, i.e. on the div itself. */
const CLICKABLE_DIV = /<div[^>]*\sonClick=/;

check(
  "ShopSection has no <div onClick>",
  !CLICKABLE_DIV.test(shop),
);
check(
  "CategoriesSection has no <div onClick> for a cuisine",
  // Scoped to the cuisine track. The file also holds a modal backdrop and its
  // stopPropagation panel, which are a different problem for a different phase;
  // a whole-file match would report them here and bury this one.
  cuisineTrack.length > 0 && !CLICKABLE_DIV.test(cuisineTrack),
  cuisineTrack.length === 0 ? "could not locate the cuisine track" : undefined,
);

// ---------------------------------------------------------------------------
section("§8  the spec page");
// ---------------------------------------------------------------------------

check(
  "/_design renders the real Button rather than a redrawing of it",
  /from "@\/components\/ui\/button"/.test(spec) && /<Button size=\{size\.key\}/.test(spec),
);
check(
  "it checks the token is live rather than asserting it in prose",
  /bg-primary/.test(spec),
);
check(
  "it computes contrast instead of quoting it",
  /function contrast\(/.test(spec) && /0\.2126/.test(spec),
);
check(
  "verify:design is wired into package.json",
  /verify:design/.test(read("package.json")),
);

// ---------------------------------------------------------------------------
section("§9  the sweep, across the whole tree");
// ---------------------------------------------------------------------------

/**
 * Every `.tsx` under `src`, comments removed, minus the spec page.
 *
 * `/_design` is excluded on purpose: it renders the seven pinks as swatches and
 * the retired sizes as samples. Those literals are its subject matter. A guard
 * that read them would be reporting the documentation.
 */
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!full.includes("%5Fdesign")) walk(full, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
};
const tree = walk(join(ROOT, "src")).map((f) => ({
  path: f.slice(ROOT.length + 1),
  src: stripComments(readFileSync(f, "utf8")),
}));

const countAcross = (re) =>
  tree.reduce((n, f) => n + (f.src.match(re) || []).length, 0);
const filesWith = (re) => tree.filter((f) => re.test(f.src)).map((f) => f.path);

const OFF_SCALE = /\b(?:[a-z0-9-]+:)*text-(?:lg|3xl|4xl|5xl|6xl|7xl)\b/g;
check(
  "🔴 no off-scale font size survives anywhere in the tree",
  // 18, 30, 36, 48 and 60 are not steps. `text-lg` alone was 56 occurrences:
  // a weighted one is a title and rounds up to 20, an unweighted one is body
  // and rounds down to 16.
  countAcross(OFF_SCALE) === 0,
  filesWith(OFF_SCALE).slice(0, 5).join(", "),
);

const ARBITRARY_SIZE = /text-\[(?:\d+px|[\d.]+rem)\]/g;
check(
  "the arbitrary font sizes are gone, bar the two decorative numerals",
  // `text-[150px]` and `md:text-[220px]` draw the 404 glyph. That is artwork,
  // not app chrome, and §1.1 scopes the scale to chrome.
  countAcross(ARBITRARY_SIZE) === 2,
  `found ${countAcross(ARBITRARY_SIZE)}`,
);

const PINKS = /-\[#(?:f9186b|e91e7f|d7357c|dc3173|c2185b|ef2f7a|d4145b)\]/gi;
check(
  "🔴 not one of the seven pinks is still typed as a utility",
  countAcross(PINKS) === 0,
  filesWith(PINKS).slice(0, 5).join(", "),
);

const GREYS = /text-\[#(?:191c1d|222|2f2f2f|242424|3f3f3f|5a4044|5f5f5f|696969|707070|767676|7a7a7a|7d7d7d|8b8b8b|8c8c8c|8e6f74|616161|6e6e6e)\]/gi;
check(
  "the text greys collapsed onto --foreground and --muted-foreground",
  countAcross(GREYS) === 0,
  filesWith(GREYS).slice(0, 5).join(", "),
);

check(
  "hairlines ask for --border rather than spelling #edeeef",
  countAcross(/border-\[#edeeef\]/gi) === 0,
);

/**
 * A ratchet, not a target. 1,092 hex utilities before the sweep; whatever is
 * left is surface tints and one disabled grey, none of which §1.4 names a token
 * for. The number may fall. It may not rise.
 */
const HEX_CEILING = 211;
const hexNow = countAcross(/-\[#[0-9a-fA-F]{3,8}\]/g);
check(
  `hex utilities are at or below the ${HEX_CEILING} the sweep left`,
  hexNow <= HEX_CEILING,
  `now ${hexNow} — lower the ceiling in this file when it drops`,
);

check(
  "#9aa0a6 is still its own colour, because it means disabled, not secondary",
  // Folding it into --muted-foreground would paint a closed store and an open
  // one the same. It needs a token of its own, and that is a decision, not a
  // sweep.
  countAcross(/-\[#9aa0a6\]/gi) > 0,
);

const card = tree.find((f) => f.path.endsWith("home/RestaurantsSection.tsx")).src;
/** The same card, rendered by two components. Both are checked, always. */
const vendorCardFiles = [card, tree.find((f) => f.path.endsWith("vendors/VendorCard.tsx")).src];

check(
  "the vendor card has a focal point — 20 bold over 12 uppercase",
  // Phase 4 got the sizes apart (20 over 14). Phase 7 got them apart by
  // *kind*: 12 uppercase at 700 is a different voice, not a smaller one, so
  // the title leads even where the two lines are close in width.
  vendorCardFiles.every(
    (f) =>
      /line-clamp-1 text-xl font-bold tracking-\[-0\.015em\]/.test(f) &&
      /line-clamp-1 text-xs font-bold uppercase tracking-\[0\.06em\]/.test(f),
  ),
);
check(
  "🔴 neither copy of the card paints a fact in the brand pink",
  // Both once painted the city line #f9186b. Phase 4 fixed the homepage's;
  // this guard only ever read that file, so `/vendors` kept its pink city for
  // three more phases. §1.4: pink is action and availability, nothing else.
  vendorCardFiles.every((f) => !/text-primary dark:text-pink-40/.test(f)),
);

// ---------------------------------------------------------------------------
section("§10  layout defects");
// ---------------------------------------------------------------------------

const hero = tree.find((f) => f.path.endsWith("home/HeroSection.tsx")).src;
const restaurants = tree.find((f) => f.path.endsWith("home/RestaurantsSection.tsx")).src;
const shopSection = tree.find((f) => f.path.endsWith("home/ShopSection.tsx")).src;
const homeContent = tree.find((f) => f.path.endsWith("home/HomeContent.tsx")).src;

check(
  "🔴 the hero banner crops instead of stretching",
  // `object-fit` is a CSS property, not a Tailwind utility. It compiled to
  // nothing, so every `fill` image fell back to `object-fit: fill` and every
  // sponsor banner was distorted — silently, because a class that does not
  // exist is not an error.
  /object-cover/.test(hero) && !/\bobject-fit\b/.test(hero),
);

/**
 * The whole family of that mistake: a CSS *property* written where a utility
 * belongs. None of these exist in Tailwind, and none of them fail loudly.
 */
const FAKE_UTILITIES =
  /\bclassName="[^"]*\b(?:object-fit|font-size|text-align|flex-direction|align-items|justify-content|background-color|border-radius|box-shadow|line-height|letter-spacing|text-transform|white-space|font-weight|z-index|text-decoration|vertical-align)\b/g;
check(
  "…and no other CSS property is posing as a utility anywhere in the tree",
  countAcross(FAKE_UTILITIES) === 0,
  filesWith(FAKE_UTILITIES).slice(0, 5).join(", "),
);

check(
  "🔴 the restaurant skeleton and the live grid share one gap",
  // They were `gap-6 lg:gap-10` and a flat `gap-10`: every card jumped 16px
  // sideways when the data landed, on mobile and tablet.
  (restaurants.match(/grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3/g) || [])
    .length === 2 && !/gap-10/.test(restaurants),
);
check(
  "the shop header does not move when the categories arrive",
  // `mb-5 sm:mb-8` in the skeleton against a flat `mb-8` live. This was three
  // identical strings that had to be kept identical by hand; since Phase 9 it
  // is one component rendered three times, so they cannot differ at all. The
  // guard follows: every branch defers, none hand-types a header.
  (shopSection.match(/<SectionHeading/g) || []).length === 3 &&
    !/mb-[56] flex items-end/.test(shopSection) &&
    !/sm:mb-8/.test(shopSection),
);

check(
  "🔴 the hero empty state does not print the same sentence twice",
  (hero.match(/\{emptyStateMessage\}/g) || []).length === 1,
);

check(
  "the homepage has an h1 whatever the banners do",
  /<h1 className="sr-only">\{t\("homeHeading"\)\}<\/h1>/.test(homeContent),
);
check(
  "…and exactly one, so the hero's state heading stepped down to h2",
  (homeContent.match(/<h1\b/g) || []).length === 1 && !/<h1\b/.test(hero),
);
check(
  "the new heading has copy in both dictionaries",
  /homeHeading:/.test(read("src/assets/translations/en.ts")) &&
    /homeHeading:/.test(read("src/assets/translations/pt.ts")),
);

// ---------------------------------------------------------------------------
section("§11  motion");
// ---------------------------------------------------------------------------

/**
 * Phase 6's brief put `prefers-reduced-motion` *before* the five things it
 * gates, so the guard is built the same way round: first that every primitive
 * has an opt-out, then that the primitives exist at all.
 */

/** Every `@media (prefers-reduced-motion: reduce)` block, concatenated. The
 *  media query's own closing brace is the only one at column zero, so a lazy
 *  match to `\n}` takes the whole block and stops there. */
const reducedMotionBlocks = [
  ...cssCode.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g),
].map((m) => m[1]);
const reducedMotion = reducedMotionBlocks.join("\n");

/** Every motion primitive the stylesheet declares, by name. */
const motionClasses = [
  ...new Set(
    [...cssCode.matchAll(/\.(motion-[a-z-]+|reveal-group)\b/g)].map((m) => m[1]),
  ),
].sort();

check(
  "the three motion primitives exist, and are the only ones",
  motionClasses.join(" ") === "motion-fade motion-press reveal-group",
  `found: ${motionClasses.join(", ") || "none"}`,
);

const missingOptOut = motionClasses.filter(
  (name) => !new RegExp(`\\.${name}\\b`).test(reducedMotion),
);
check(
  "🔴 every primitive names itself in a prefers-reduced-motion block",
  missingOptOut.length === 0,
  // Written as a sweep rather than three assertions on purpose: a fourth
  // primitive added without an opt-out has to fail this, and a guard that
  // lists the three by hand would pass right over it.
  `no opt-out for: ${missingOptOut.join(", ")}`,
);

check(
  "…and the reveal is forced visible there, not merely un-animated",
  // Its children start at opacity 0 and are painted by the animation. Turning
  // only the animation off would leave the whole grid invisible — the one
  // failure mode of this primitive that is worse than the motion it replaces.
  /\.reveal-group\[data-revealed="false"\] > \*,\s*\.reveal-group\[data-revealed="true"\] > \* \{\s*opacity: 1;/.test(
    reducedMotion,
  ),
);

check(
  "reduced motion stays enumerated, not a blanket reset",
  // `*, ::before, ::after { animation-duration: 0.01ms }` is the usual advice
  // and it is wrong here: it would also freeze the animate-pulse skeletons and
  // animate-spin loaders, which is not less motion, it is less information.
  !/\*,\s*::before,\s*::after\s*\{[^}]*animation-duration/.test(cssCode) &&
    !/\*,\s*\*::before/.test(reducedMotion),
);

/** Everything Phase 6 added to the stylesheet: from the first keyframe to the
 *  opt-out block that closes the file. */
const motionCss = cssCode.slice(cssCode.indexOf("@keyframes motion-fade"));
check(
  "🔴 no primitive animates a property that moves the page",
  // The acceptance criterion is "no CLS introduced". Opacity and transform are
  // composited and cost no layout; width, height, margin, padding and the
  // inset properties reflow everything below them.
  !/\b(?:width|height|margin|padding|top|left|right|bottom|inset|font-size):/.test(
    motionCss,
  ),
  "a layout property appears among the motion rules",
);

check(
  "the stagger lives in the stylesheet, not at the call sites",
  // It was inline `style={{ animationDelay }}` on the spec page. A delay typed
  // per card is a delay that disagrees with the next grid's.
  /\.reveal-group\[data-revealed="true"\] > \*:nth-child\(2\)/.test(cssCode) &&
    /nth-child\(n \+ 9\)/.test(cssCode) &&
    countAcross(/animationDelay/g) === 0 &&
    !/animationDelay/.test(spec),
);

/** The files allowed to carry a motion primitive. Not decoration: the phase's
 *  other acceptance criterion is that no price, discount or cart quantity
 *  animates, and those live in `cart`, `payment` and `orders`. Motion arriving
 *  in a file that is not on this list has to change this line first, which is
 *  where somebody notices what they are about to animate. */
const MOTION_CALL_SITES = [
  "home/HeroSection.tsx",
  "home/ShopSection.tsx",
  "home/CategoriesSection.tsx",
  "home/RestaurantsSection.tsx",
  "vendors/VendorCard.tsx",
  "vendors/VendorsGrid.tsx",
  "vendors/VendorDetailsPage.tsx",
];
const motionFiles = filesWith(/\b(?:motion-fade|motion-press|reveal-group)\b/);
const unexpected = motionFiles.filter(
  (f) => !MOTION_CALL_SITES.some((allowed) => f.endsWith(allowed)),
);
check(
  "🔴 motion is confined to the surfaces this phase named",
  unexpected.length === 0,
  `unexpected: ${unexpected.join(", ")}`,
);
check(
  "…and no money, discount or quantity file is among them",
  // Stated separately from the allowlist so the reason survives if the list
  // grows. Backend-supplied values render exactly as returned and do not move.
  !motionFiles.some((f) => /\/(?:cart|payment|orders)\//.test(f)),
);

check(
  "the crossfade landed on the sections that hard-swapped their skeleton",
  // Three of the four homepage bands. The fourth, the restaurant grid, reveals
  // instead — a reveal is a fade with a rise, so stacking both on one element
  // would fade it twice.
  /className="motion-fade"/.test(hero) &&
    /motion-fade grid/.test(shopSection) &&
    /motion-fade relative/.test(cuisines),
);
check(
  "…and nothing carries the crossfade and the reveal at once",
  countAcross(/className="[^"]*motion-fade[^"]*reveal-group/g) === 0 &&
    countAcross(/className="[^"]*reveal-group[^"]*motion-fade/g) === 0,
);

check(
  "every reveal container renders the attribute the stylesheet keys off",
  // `.reveal-group` with no `data-revealed` is a container that never hides and
  // never animates — it fails silently, which is the worst way to fail.
  filesWith(/reveal-group/).every((f) =>
    /data-revealed=\{revealed\}/.test(tree.find((t) => t.path === f).src),
  ),
);
check(
  "…and the hook hands that value back rather than writing to the DOM",
  // An imperative `el.dataset.revealed = "true"` is undone by the next render
  // that re-states the attribute — here, every delivery-time estimate.
  /return \[setNode, revealed \? "true" : "false"\]/.test(motionHook) &&
    !/dataset|setAttribute/.test(motionHook),
);
check(
  "…and it observes through a callback ref, so a late grid is still seen",
  // These grids live behind `if (loading) return <skeleton/>`. A ref object is
  // null when the effect runs and the effect never runs again.
  /const \[node, setNode\] = useState<T \| null>\(null\)/.test(motionHook) &&
    /\}, \[node, revealed\]\)/.test(motionHook),
);

check(
  "🔴 the card image hover is 1.04 over 300ms, everywhere it appears",
  // Three copies at three durations: 700ms here, 1000ms on the vendors page,
  // 500ms on the categories page. All of them a tenth of the image's width,
  // still travelling after the pointer had gone.
  countAcross(/duration-(?:500|700|1000) [^"`]*scale-1[01]0/g) === 0 &&
    /duration-300[\s\S]{0,120}group-hover:scale-\[1\.04\]/.test(restaurants),
);

check(
  "the hero carousel stops for a pointer, for focus, and for reduced motion",
  // It advanced every four seconds regardless — including while the reader was
  // reaching for a dot, or tabbed onto one.
  /if \(paused \|\| reducedMotion\) return;/.test(hero) &&
    /onMouseEnter=\{\(\) => setPaused\(true\)\}/.test(hero) &&
    /onFocus=\{\(\) => setPaused\(true\)\}/.test(hero),
);
check(
  "…and it is the timer that stops, not a class that hides the movement",
  // Nothing here is animated — the carousel is scrolled by an interval — so
  // this is the one piece of motion in the app a CSS opt-out cannot reach.
  /usePrefersReducedMotion/.test(hero) &&
    /useSyncExternalStore/.test(motionHook),
);

check(
  "one enter animation, not two spellings of it",
  // `.category-enter` was the same 300ms fade under a page-local name, shipped
  // before the primitive existed. Two classes for one idea is how the pink
  // ended up spelled seven ways.
  !/category-enter/.test(cssCode) &&
    countAcross(/category-enter/g) === 0,
);

check(
  "the two remaining skeleton-to-live drifts are closed",
  // Found in this phase, not Phase 5: both section headers said `sm:mb-10` in
  // the skeleton and a flat `mb-10` live, so the heading jumped 16px on mobile
  // — under the new crossfade, which would have drawn the eye to it.
  (cuisines.match(/<SectionHeading/g) || []).length === 3 &&
    (restaurants.match(/<SectionHeading/g) || []).length === 3 &&
    !/mb-6 flex items-end/.test(cuisines) &&
    !/mb-6 flex items-end/.test(restaurants) &&
    !/sm:mb-10/.test(cuisines) &&
    !/sm:mb-10/.test(restaurants),
);

check(
  "the spec page renders the shipped primitives, not a redrawing of them",
  // Section 4 mounts the real <Button>; section 6 now uses the real classes.
  // The only thing still defined in its inline <style> is the switch that
  // simulates the reduced-motion setting.
  /className="motion-fade space-y-3"/.test(spec) &&
    /className="reveal-group grid/.test(spec) &&
    !/dsx-(?:reveal|fade|press)\b/.test(spec),
);

// ---------------------------------------------------------------------------
section("§12  homepage box model");
// ---------------------------------------------------------------------------

/**
 * Phase 7 took its box model from a design prototype and its numbers from
 * §1.1 and §1.2 — the prototype's 32/19/15/13/12 does not survive contact with
 * a six-step scale, so three of those rounded. What is asserted here is the
 * result, not the reference.
 */

const vendorCard = tree.find((f) => f.path.endsWith("vendors/VendorCard.tsx")).src;
const vendorsGrid = tree.find((f) => f.path.endsWith("vendors/VendorsGrid.tsx")).src;
const homeContent2 = tree.find((f) => f.path.endsWith("home/HomeContent.tsx")).src;

/** The card and its two skeletons — four places one design has to hold. */
check(
  "🔴 the card is a hairline and a lift, not a permanent shadow",
  // It was `rounded-4xl border-2 border-transparent` over a standing
  // `0 10px 40px` shadow, with the border turning pink on hover — weight
  // already spent, and pink saying "selected" about a hover.
  //
  // Phase 8 moved the shape out of the call sites, so what is asserted here is
  // that they *ask* for it: three copies of one card, none of them restating a
  // radius or a border. The shape itself is checked once, in §13.
  [restaurants, vendorCard, vendorsGrid].every((f) => /cardVariants\(/.test(f)) &&
    // The negative names what a *card* must not restate. `rounded-3xl` alone
    // is not on the list: the red error panels legitimately use it with their
    // own status colours, and they are panels, not cards.
    ![restaurants, vendorCard, vendorsGrid].some((f) =>
      /rounded-4xl|border border-border\b|shadow-\[0_(?:10px_40px|8px_30px)/.test(f),
    ) &&
    /cardVariants\(\{ variant: "interactive" \}\)/.test(restaurants) &&
    /cardVariants\(\{ variant: "interactive" \}\)/.test(vendorCard),
);
check(
  "the card body is one gap, not three margins",
  // `mb-2` + `mb-4 sm:mb-6` + `pt-4 sm:pt-6` between three children, each
  // free to drift from the others, and `p-5 sm:p-8` around them — 20 and 32,
  // neither on the §1.2 scale.
  [restaurants, vendorCard, vendorsGrid].every((f) =>
    /flex flex-1 flex-col gap-3 p-4 sm:p-6/.test(f) || /flex flex-col gap-3 p-4 sm:p-6/.test(f),
  ),
);

check(
  "🔴 open is a green dot and a green word, both from the token",
  // Phase 7 first moved this to a bare dot by the title with the words pushed
  // to `sr-only` — which asks a sighted reader to know what a coloured dot
  // means, and was wrong. The label is visible again, next to the city where
  // it always was. Green, not pink: §1.4 gives pink to action *and*
  // availability, so painting both in it distinguished neither.
  [restaurants, vendorCard].every(
    (f) =>
      /bg-success/.test(f) &&
      /text-success/.test(f) &&
      /\{vendor\.businessDetails\.isStoreOpen \? t\("openNow"\) : t\("closed"\)\}/.test(f) &&
      !/sr-only/.test(f),
  ),
);
check(
  "…and closed is untouched — the same muted grey it has always been",
  [restaurants, vendorCard].every(
    (f) => /isClosed \? "text-\[#9aa0a6\] dark:text-neutral-500" : "text-success"/.test(f),
  ),
);
check(
  "the green is a token, so it cannot be spelled two ways",
  // #9aa0a6 got to stay a literal because it means "disabled" and has no
  // token; this one has a name from the day it arrived.
  !/-\[#0[de]8[a3]5[fa]\]/i.test(restaurants + vendorCard),
);

check(
  "the overlay pills are a fixed 32 and fully round",
  // `rounded-2xl px-4 py-2 text-sm` with an 18px icon is ~36px, on an image
  // 200px tall at phone width.
  (restaurants.match(/flex h-8 items-center gap-[0-9.]+ rounded-full/g) || []).length >= 3 &&
    (vendorCard.match(/flex h-8 items-center gap-[0-9.]+ rounded-full/g) || []).length >= 3 &&
    !/rounded-2xl bg-white\/95/.test(restaurants + vendorCard),
);

check(
  "🔴 every skeleton still matches the card it stands in for",
  // Three of them now, in two files, one of which is a different file from
  // the card. Phase 5 #2: a skeleton of a different shape is a layout shift
  // with extra steps, and the Phase 6 crossfade runs straight over it.
  [restaurants, vendorsGrid].every(
    (f) =>
      /flex items-center gap-4 border-t border-border pt-3/.test(f) &&
      !/size-2 shrink-0 animate-pulse/.test(f),
  ),
);

check(
  "the section heading steps 24 → 32, and says so exactly once",
  // It was `text-xl sm:text-2xl` (20→24). 32 is `text-display`, a token since
  // Phase 1 and used nowhere on this page until Phase 7. Phase 9 moved the
  // declaration into the component, so the count that matters is one.
  /text-2xl font-bold text-foreground lg:text-display/.test(headingComponent) &&
    ![shopSection, cuisines, restaurants].some((f) =>
      /text-2xl font-bold text-foreground lg:text-display/.test(f),
    ),
);
check(
  "🔴 the 'View all' link is not the size of a card title",
  // `text-sm sm:text-xl` — a secondary link rendering at 20px on desktop,
  // level with the vendor names it sits above.
  !/sm:text-xl/.test(restaurants) && !/sm:leading-7/.test(restaurants),
);
check(
  "the accent rule is on by default, so no branch can forget it",
  // 4px plus a 12px gap. A branch that omitted it dropped its heading 16px when
  // the data landed — the shift the Phase 6 crossfade would light up. It was
  // nine hand-placed copies; it is one default now, which is also what makes
  // §5 open question 5 a one-line answer instead of a sweep.
  /mb-3 block h-1 w-6 rounded-full/.test(headingComponent) &&
    /accent = true/.test(headingComponent) &&
    ![shopSection, cuisines, restaurants].some((f) => /mb-3 block h-1 w-6/.test(f)),
);

check(
  "the cuisine tile is a surface, and its skeleton is the same surface",
  // The circle used to float on the page background, which left `aria-pressed`
  // with nowhere to show but a ring.
  (cuisines.match(/rounded-2xl border/g) || []).length >= 2 &&
    /w-24 shrink-0 snap-start/.test(cuisines) &&
    /w-24 shrink-0 flex-col/.test(cuisines) &&
    !/calc\(\(100vw-5rem\)\/4\)/.test(cuisines),
);

/**
 * Spacing, ratcheted. §1.2 allows 4, 8, 12, 16, 24, 32, 48, 64 — so `p-1`
 * through `p-4`, `p-6`, `p-8`, `p-12`, `p-16` and nothing between. The rest of
 * the tree carries ~200 more of these; this is scoped to the files Phase 7
 * owns and may only ever fall.
 */
const OFF_SCALE_SPACING = /\b(?:sm:|md:|lg:|xl:)?[pm][trblxy]?-(?:5|7|9|10|11|14|20)\b/g;
const phase7Files = [
  ["HeroSection", tree.find((f) => f.path.endsWith("home/HeroSection.tsx")).src],
  ["ShopSection", shopSection],
  ["CategoriesSection", cuisines],
  ["RestaurantsSection", restaurants],
  ["HomeContent", homeContent2],
  ["VendorCard", vendorCard],
];
const offScale = phase7Files.flatMap(([name, src]) =>
  (src.match(OFF_SCALE_SPACING) || []).map((m) => `${name}:${m}`),
);
check(
  "🔴 no spacing off the 4-based scale in the files this phase owns",
  offScale.length === 0,
  `found ${offScale.length}: ${offScale.slice(0, 8).join(", ")}`,
);

// ---------------------------------------------------------------------------
section("§13  one card shell, tree-wide");
// ---------------------------------------------------------------------------

/**
 * Plan.md Phase 8, and the first guard in this file built the way §2b asks.
 *
 * Every assertion above this point names its files. That is how each of these
 * defects survived: §9's focal-point check read one of the two vendor-card
 * files, so `/vendors` kept a §1.4 violation for three phases; §12's spacing
 * ratchet covers six files, so 181 off-scale values sit outside it. A guard
 * that names files documents a phase. A guard that walks the tree documents a
 * rule. This one walks.
 */

check(
  "the shell is declared once, with the values the phase settled on",
  /rounded-3xl border border-border bg-card dark:border-neutral-800/.test(cardComponent) &&
    /interactive:\s*\n?\s*"transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"/.test(
      cardComponent,
    ) &&
    /card: "p-4 sm:p-6"/.test(cardComponent),
);
check(
  "…and it is a cva export, not a component nothing can import",
  // 58 files render a card onto <article>, <button>, <div> or <Link>. Phase 2
  // learned what happens to a component that is awkward at the call site.
  /export const cardVariants = cva\(/.test(cardComponent) &&
    !/export function Card\b/.test(cardComponent),
);

/** Files that legitimately draw a 26px radius, and why. None is a card. */
const ROUNDED_4XL_ALLOWED = [
  "home/HeroSection.tsx", // the sponsor banner — a media frame
  "orders/TrackOrder/OrderMap/OrderMap.tsx", // the map frame
  "orders/TrackOrder/TrackOrder.tsx", // …and the map's skeleton, which must match it
  "vendors/ProductDetailsModal.tsx", // dialog surfaces, not cards
  "shared/LocationPromptModal.tsx",
  "auth/LoginPage.tsx", // the auth panel, plus three pill CTAs at h-14
];
const stray4xl = filesWith(/rounded-4xl/).filter(
  (f) => !ROUNDED_4XL_ALLOWED.some((a) => f.endsWith(a)),
);
check(
  "🔴 no card draws the old 26px radius — and the exceptions are named",
  stray4xl.length === 0,
  `unexpected rounded-4xl in: ${stray4xl.join(", ")}`,
);

check(
  "🔴 the transparent double border is gone from the whole tree",
  // `border-2 border-transparent` reserved space for a border that only
  // appeared on hover, in pink, on a card that was not selected.
  countAcross(/border-2 border-transparent/g) === 0,
  filesWith(/border-2 border-transparent/).join(", "),
);
check(
  "🔴 no card carries a permanent hand-mixed shadow",
  // Four of them were in use — 0 10px 40px, 0 8px 30px, 0 4px 20px and a
  // pink-tinted hover nobody else had. Weight already spent leaves none to
  // spend when the pointer arrives.
  countAcross(/shadow-\[0_(?:10px_40px|8px_30px|4px_20px)/g) === 0,
  filesWith(/shadow-\[0_(?:10px_40px|8px_30px|4px_20px)/).join(", "),
);

/** The pink hover border survives only on things that are not cards. */
const PINK_HOVER_ALLOWED = [
  "home/CategoriesSection.tsx", // a row in the cuisine picker's dialog
  "search/SearchFilters.tsx", // filter chips
];
const strayPink = filesWith(/hover:border-\[#ffd9de\]/).filter(
  (f) => !PINK_HOVER_ALLOWED.some((a) => f.endsWith(a)),
);
check(
  "no card says 'selected' about itself when a pointer crosses it",
  // §1.4 gives --primary to action and availability. A hover is neither.
  strayPink.length === 0,
  `unexpected pink hover border in: ${strayPink.join(", ")}`,
);

/** Every file that asks for the shell must not also hand-type one. */
const cardCallSites = filesWith(/cardVariants\(/).filter(
  (f) => !f.endsWith("ui/card.tsx"),
);
check(
  "every card-shaped surface asks for the shell rather than restating it",
  cardCallSites.length >= 8 &&
    cardCallSites.every((f) => {
      const src = tree.find((t) => t.path === f).src;
      return !/bg-white dark:bg-neutral-900/.test(src);
    }),
  `${cardCallSites.length} call sites; hand-typed surface in: ${cardCallSites
    .filter((f) => /bg-white dark:bg-neutral-900/.test(tree.find((t) => t.path === f).src))
    .join(", ")}`,
);

/**
 * A ratchet on the shells themselves. Six were in use before this phase — four
 * of them within one screen of the homepage. The number may fall to 1. It may
 * not rise.
 */
const SHELL_CEILING = 2;
const shells = new Set();
for (const { src } of tree) {
  for (const m of src.matchAll(/rounded-(2xl|3xl|4xl)[^"`]{0,80}?(?:shadow-\[|border-2 border-transparent)/g)) {
    shells.add(m[1]);
  }
}
check(
  `distinct hand-typed card shells are at or below ${SHELL_CEILING}`,
  shells.size <= SHELL_CEILING,
  `found ${shells.size}: ${[...shells].join(", ")}`,
);

// ---------------------------------------------------------------------------
section("§14  two heading roles, one label voice");
// ---------------------------------------------------------------------------

/**
 * Plan.md Phase 9, and a correction to it.
 *
 * The phase was planned from a count — `<h2>` spelled three ways, so settle on
 * the most common. Reading the call sites says those `<h2>`s do two different
 * jobs: a **section heading** tops a band of content on a page, a **panel
 * head** titles a card, a dialog or a form group. Sweeping every one to
 * `text-2xl lg:text-display` would have made a dialog title the size of a page
 * title. The rule is the role, not the tag.
 */

const H2 = /<h2\b[^>]*?className=(?:"([^"]*)"|\{`([^`]*)`)/gs;
const SIZE_TOKEN = /\b((?:[a-z0-9-]+:)*text-(?:display|2xl|xl|base|sm|xs))\b/g;
const h2Patterns = new Map();
for (const { path, src } of tree) {
  for (const m of src.matchAll(H2)) {
    const cls = m[1] ?? m[2] ?? "";
    const key = (cls.match(SIZE_TOKEN) || []).join(" ") || "(none)";
    if (!h2Patterns.has(key)) h2Patterns.set(key, []);
    h2Patterns.get(key).push(path);
  }
}

/** The one heading that is a quiet uppercase group label rather than either
 *  role — it titles the address list and is deliberately 12px. */
const H2_EXCEPTIONS = ["saved-addresses/SavedAddressesPage.tsx"];
const strayH2 = [...h2Patterns.entries()].filter(
  ([k, files]) =>
    k !== "text-2xl lg:text-display" &&
    k !== "text-xl" &&
    !files.every((f) => H2_EXCEPTIONS.some((e) => f.endsWith(e))),
);
check(
  "🔴 every <h2> is a section heading or a panel head, and nothing else",
  // Nine patterns before this phase: text-2xl ×24, text-xl ×16,
  // text-2xl lg:text-display ×8, text-2xl md:text-display ×3, text-base ×3,
  // text-base sm:text-xl ×2, text-2xl sm:text-display, text-sm, text-xs.
  strayH2.length === 0,
  `stray patterns: ${strayH2.map(([k]) => k).join(" | ")}`,
);
check(
  "…and the section role is declared once, in the component",
  /text-2xl font-bold text-foreground lg:text-display/.test(headingComponent) &&
    /export function SectionHeading/.test(headingComponent),
);

check(
  "🔴 one breakpoint for the step-up to 32",
  // `lg:` ×25, `md:` ×4, `sm:` ×4 — three spellings of one step, which is how
  // the same heading landed at 32px at three different widths.
  countAcross(/(?:sm|md):text-display/g) === 0,
  filesWith(/(?:sm|md):text-display/).join(", "),
);

/** Wide tracking on a *code* helps it read character by character. Neither of
 *  these is `uppercase`, which is what separates them from a label. */
const TRACKING_EXCEPTIONS = [
  "referrals/ReferEarnPage.tsx",
  "orders/TrackOrder/PickupCodeCard.tsx",
];
const strayTracking = tree
  .filter(({ path }) => !TRACKING_EXCEPTIONS.some((e) => path.endsWith(e)))
  .flatMap(({ path, src }) =>
    src
      .split("\n")
      .filter((l) => /tracking-\[0\.(?:12|14|16|2)em\]/.test(l))
      .map(() => path),
  );
check(
  "🔴 uppercase labels have one tracking, and codes are the named exception",
  // Five values were in use: 0.06, 0.12, 0.14, 0.16, 0.2em. A number typed five
  // ways is a number nobody chose.
  strayTracking.length === 0,
  `off-standard tracking in: ${[...new Set(strayTracking)].join(", ")}`,
);

check(
  "the accent rule is a default, not nine hand-placed copies",
  // Which is also what makes §5 open question 5 a one-line answer rather than
  // an edit to every section in the app.
  /accent = true/.test(headingComponent) &&
    filesWith(/mb-3 block h-1 w-6 rounded-full/).every((f) =>
      f.endsWith("ui/section-heading.tsx"),
    ),
);
check(
  "🔴 a section's skeleton and its heading are the same component",
  // Phases 5, 6 and 7 each found another pair of hand-kept-identical strings
  // that had drifted. One component rendering both halves makes the drift
  // impossible rather than merely asserted.
  /loading \? \(/.test(headingComponent) &&
    [shopSection, cuisines, restaurants].every(
      (f) => (f.match(/<SectionHeading/g) || []).length === 3,
    ),
);

check(
  "no uppercase micro-label is marked up as a heading",
  // `/categories` rendered every tile's name as its own <h2>, so the page
  // announced a dozen headings that were the names of twelve links.
  !/<h2[^>]*text-xs font-bold uppercase[\s\S]{0,240}category\.name/.test(
    tree.find((f) => f.path.endsWith("categories/CategoriesPage.tsx")).src,
  ),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
