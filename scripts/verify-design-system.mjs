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
 *  §11  motion: every animated class in the stylesheet has a reduced-motion
 *       opt-out, the adopted list carries a reason per entry, and the denylist
 *       is asserted by reason — a transform may not sit over a backend value
 *  §12  the homepage box model — one card design across two files, a heading
 *       that steps, and no spacing off the 4-based scale
 *  §13  one card shell, tree-wide — the first guard here that walks the whole
 *       tree instead of naming the files a phase happened to touch
 *  §14  two heading roles and one label voice, tree-wide
 *  §15  the two colours that already have names are asked for, not typed —
 *       tree-wide, and per className rather than per file
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
/** `mb-4 flex items-end` — the wrapper `SectionHeading` renders, read from the
 *  component so the "nobody hand-rolls this" checks cannot go stale when its
 *  spacing changes. */
const headingWrapperClass = (
  /<div className="((?:mb-\d+) flex items-end)/.exec(headingComponent) || [, "mb-4 flex items-end"]
)[1];
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
  // Rewritten in Phase 11, and for the fifth phase running the cause was the
  // same: this pinned the whole class string, including `lg`'s `px-5`, so it
  // broke the moment the spacing sweep touched a padding it was never about.
  // §3 is the *height* ladder — 32 / 44-then-40 / 48, the middle one being the
  // 44px touch target on a phone. §16 owns the paddings. One fact, one guard.
  /sm:\s*"h-8 /.test(button) &&
    /default:\s*"h-11 .*sm:h-10"/.test(button) &&
    /lg:\s*"h-12 /.test(button),
  between(button, "size: {", "},").replace(/\s+/g, " ").slice(0, 140),
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
  // Scoped to the track. This read the whole file and was matching the cuisine
  // *picker's* rows — a different button in the same file — so it would have
  // passed with the tile unfocusable. Two elements, two assertions.
  /focus-ring motion-press group flex/.test(cuisineTrack),
);

/**
 * 🔴 Browser round 2, 1 Sep 2026. Five assertions below used to pin 80px, and
 * they were right for Phase 7 and wrong about the row.
 *
 * The strip is made of circles. Phase 7 boxed each one in a surface tile, and
 * a tile has to hold the label too, so the circle shrank to 80 to make room —
 * the row spent its budget on chrome and shrank the only thing in it anyone
 * reads. Reversed on sight against a screenshot of the previous design.
 *
 * What is asserted now is the *relationship*, not the number: the live circle
 * and the skeleton circle are the same diameter, and the image is requested at
 * the diameter it is drawn at. Those hold at any size. The one literal left is
 * that a circle is bigger than a label — which is the thing that went wrong.
 */

/** `size-16 … sm:size-32` → ["16", "32"]. */
const circleSize = (src) => {
  const m = /block (size-\d+) rounded-full[\s\S]{0,200}(sm:size-\d+)/.exec(src);
  return m ? [m[1].slice(5), m[2].slice(8)] : null;
};
const skeletonSize = (src) => {
  const m = /(size-\d+) animate-pulse rounded-full[\s\S]{0,80}(sm:size-\d+)/.exec(src);
  return m ? [m[1].slice(5), m[2].slice(8)] : null;
};

check(
  "🔴 the skeleton circle is the live circle, whatever size that is",
  // Phase 5 #2's shape: two literals in two branches, free to drift apart.
  // Comparing them to each other is the only form of this that survives a
  // resize — and this is the third guard in the file to learn that lesson.
  circleSize(cuisines) !== null &&
    JSON.stringify(circleSize(cuisines)) === JSON.stringify(skeletonSize(cuisines)),
  `live ${JSON.stringify(circleSize(cuisines))} vs skeleton ${JSON.stringify(skeletonSize(cuisines))}`,
);
check(
  "the image is requested at the diameter it is drawn at",
  (() => {
    const size = circleSize(cuisines);
    if (!size) return false;
    const px = Number(size[1]) * 4;
    return new RegExp(`height=\\{${px}\\}`).test(cuisines) &&
      new RegExp(`width=\\{${px}\\}`).test(cuisines);
  })(),
  `circle is ${JSON.stringify(circleSize(cuisines))}`,
);
check(
  "🔴 the circle is the tile — no box drawn around it competing for the width",
  // The reversal itself. A surface tile here means a border and a background
  // on the button, and a fixed width to hold them; all three are what pushed
  // the circle down to 80 and wrapped the long labels onto two lines.
  !/rounded-2xl border bg-card/.test(cuisineTrack) &&
    !/sm:w-32/.test(cuisineTrack) &&
    // Content-driven from `sm` so "PORTUGUESE FOOD" stays on one line.
    /sm:w-auto sm:min-w-35/.test(cuisineTrack),
);
check(
  "…and the selected state is the ring it was before the tile carried it",
  /bg-primary ring-4 ring-primary\/20/.test(cuisineTrack) &&
    // §1.4: pink has a name. The original spelled this #f9186b / #ffd9de.
    !/#f9186b|#ffd9de/.test(cuisineTrack),
);
check(
  "the label is one size at every width",
  // The restore tried to bring back `sm:tracking-[0.16em]` too, and §14 caught
  // it: 0.16em was one of the five spellings Phase 9 collapsed into one. The
  // circle was the reason the row read badly; the letter-spacing was not, and
  // re-opening a settled rule for it would be taste overruling a decision.
  /text-center text-xs font-bold uppercase/.test(cuisines) &&
    /tracking-\[0\.06em\]/.test(cuisines) &&
    !/sm:text-xs/.test(cuisines) &&
    !/sm:leading-4/.test(cuisines),
);
check(
  "the track gap is on the scale, and the skeleton track uses the same one",
  (cuisines.match(/sm:gap-8/g) || []).length === 2 && !/sm:gap-6/.test(cuisines),
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
 *
 * 211 → 199 in Phase 10: twelve of them were hairlines spelled as hex
 * (`border-[#e7e8e9]`, `border-[#efefef]`, five more one-offs) and they went to
 * `border-border` with the rest of §15's sweep.
 */
const HEX_CEILING = 199;
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

/**
 * 🔴 Every class in the stylesheet that *starts an animation* — found by
 * behaviour, not by name.
 *
 * This used to be `/\.(motion-[a-z-]+|reveal-group)\b/`, and that regex is how
 * `animate-fadeIn` and `animate-scaleIn` lived in this file for six phases
 * without a `prefers-reduced-motion` opt-out: they predate Phase 6's naming
 * convention, so a guard that enumerated by prefix looked straight past them.
 * A guard that enumerates by name can only ever check the things somebody
 * remembered to name.
 *
 * The rules inside a media block are excluded — that is where the opt-outs
 * live, and they turn animations off rather than on.
 */
const topLevelCss = cssCode.replace(/@media[^{]*\{[\s\S]*?\n\}/g, "");
const animatedClasses = [
  ...new Set(
    // Any rule whose body starts an animation, then every class named in its
    // selector — so `.reveal-group[data-revealed="true"] > *` is found by the
    // class it keys off rather than missed for having a combinator.
    [...topLevelCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /\banimation(?:-name)?\s*:/.test(m[2]))
      .flatMap((m) => [...m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((c) => c[1])),
  ),
].sort();

/**
 * 🔴 The other half: classes that animate by **transition** rather than by
 * keyframe, found the same way — by what the rule body does.
 *
 * `motion-press` used to be appended to the opt-out sweep by hand, with a
 * comment saying it was excluded "by construction". That was true and it was
 * also a list somebody had to remember: browser round 3 added two more
 * primitives of exactly that shape, and a hand-appended name would have let
 * either of them ship without a reduced-motion opt-out. The same mistake as
 * `animate-fadeIn`, one layer over.
 */
const transitionClasses = [
  ...new Set(
    [...topLevelCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /\btransition(?:-property|-duration)?\s*:/.test(m[2]))
      .flatMap((m) => [...m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((c) => c[1])),
  ),
].sort();

/** Of those, the ones the design system owns. The rest are illustration: the
 *  order-tracking scene, the add-to-cart cue, the closing-soon notice. */
const motionClasses = animatedClasses.filter((c) => /^(motion-|reveal-group)/.test(c));
const transitionPrimitives = transitionClasses.filter((c) => /^motion-/.test(c));
check(
  "the design system's motion primitives are the ones it declares",
  motionClasses.join(" ") === "motion-fade motion-scale reveal-group" &&
    transitionPrimitives.join(" ") ===
      "motion-image-floor motion-image-in motion-press",
  `animated: ${motionClasses.join(", ") || "none"} | transitioned: ${transitionPrimitives.join(", ") || "none"}`,
);
check(
  "🔴 every `animation:` names a keyframe that exists, and every keyframe is used",
  // Phase 12 deleted `@keyframes fadeIn` and `.closing-banner` still referenced
  // it. Nothing would have thrown: the banner would simply have stopped
  // animating, which is the quietest way for a stylesheet to be wrong.
  (() => {
    const defined = new Set([...cssCode.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
    const used = new Set(
      [...cssCode.matchAll(/animation(?:-name)?:\s*([\w-]+)/g)]
        .map((m) => m[1])
        .filter((n) => n !== "none"),
    );
    return (
      [...used].every((u) => defined.has(u)) && [...defined].every((d) => used.has(d))
    );
  })(),
);

const missingOptOut = [...animatedClasses, ...transitionClasses].filter(
  (name) => !new RegExp(`\\.${name}\\b`).test(reducedMotion),
);
check(
  "🔴 every animated class names itself in a prefers-reduced-motion block",
  // Widened in Phase 12 from the four system primitives to *every* class in
  // the stylesheet that animates — eleven of them, including the delivery
  // scene and the add-to-cart cue. Two had no opt-out at all when this was
  // widened, and both had been there since before Phase 6.
  missingOptOut.length === 0,
  // Written as a sweep rather than three assertions on purpose: a fourth
  // primitive added without an opt-out has to fail this, and a guard that
  // lists the three by hand would pass right over it. Transitions are swept
  // the same way as of browser round 3 — see `transitionClasses`.
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

/**
 * The **adopted list** — Plan.md Phase 12.
 *
 * Phase 6 shipped this as an allowlist of seven files, and it was right then:
 * it is what stops a price animating. But it could not tell "this must not
 * move" from "nobody got to it", and that is what the entries now carry — a
 * reason each, asserted to be present. A list of filenames documents where a
 * phase stopped. A list of reasons documents a decision.
 */
const MOTION_ADOPTED = [
  ["home/HeroSection.tsx", "banner reveals when its image decodes; dots fade when the request answers"],
  ["home/ShopSection.tsx", "lane grid arrives; the lanes are controls, so they press"],
  ["home/CategoriesSection.tsx", "cuisine strip staggers in on view; tiles are controls; picker is a dialog"],
  ["home/RestaurantsSection.tsx", "vendor grid staggers in; the card is a link, so it presses"],
  ["vendors/VendorCard.tsx", "same card as the homepage, same press"],
  ["vendors/VendorsGrid.tsx", "ten cards at once is where a stagger reads as arrival"],
  ["vendors/VendorHeroImage.tsx", "store banner reveals when its photo decodes; holds no price, by design"],
  ["vendors/CategoryGroup.tsx", "menu cards stagger in on view — fade only, because the cards carry prices"],
  ["categories/CategoriesPage.tsx", "tile grid replaces a skeleton; tiles became real buttons"],
  ["vouchers/VouchersPageContent.tsx", "voucher list replaces a skeleton — fade only, over discounts"],
  ["referrals/ReferEarnPage.tsx", "page body replaces a skeleton — fade only, over an earnings total"],
  ["notifications/NotificationsPage.tsx", "list replaces a skeleton"],
  ["profile/profilePage.tsx", "profile replaces a skeleton"],
  ["profile/editProfileFormPage.tsx", "form replaces a skeleton"],
  ["saved-addresses/SavedAddressesPage.tsx", "address list replaces a skeleton"],
  ["help/ReportIssuePage.tsx", "order list replaces a skeleton"],
  ["auth/LoginPage.tsx", "the auth panel is a dialog and enters like one"],
];
check(
  "the adopted list is reasons, not filenames",
  // The assertion that keeps this list honest as it grows: an entry with no
  // reason is somebody adding motion without saying what for.
  MOTION_ADOPTED.every(([file, why]) => file.endsWith(".tsx") && why.length > 20),
  `missing a reason: ${MOTION_ADOPTED.filter(([, w]) => !w || w.length <= 20).map(([f]) => f).join(", ")}`,
);

const PRIMITIVE =
  /\b(?:motion-fade|motion-press|motion-scale|reveal-group|motion-image-in|motion-image-floor)\b/;
/** `motion-image-in` scales as well as blurring, so it belongs here — not
 *  because the hero renders a price (it renders none) but because the rule is
 *  about the primitive, and the next file to reach for it may. */
const ALWAYS_TRANSFORMS = /\b(?:motion-press|motion-scale|motion-image-in)\b/;

/**
 * 🔴 `reveal-group` is the one primitive that can be asked *not* to transform.
 *
 * Browser round 6 added `data-travel="none"`, which swaps the 8px rise for
 * opacity alone. That is not a loophole in the denylist below — it is the
 * denylist's own reasoning followed to its end. The rule bans a transform over
 * a price because a number that moves while it is read can be misread; a group
 * that fades without travelling moves nothing, so there is nothing left to ban.
 *
 * A file "travels" if any of its groups is unpinned, not if none of them is —
 * one travelling group in a file full of prices is the defect, however many
 * fade-only ones sit beside it.
 */
const travellingReveal = (src) => {
  const groups = (src.match(/\breveal-group\b/g) || []).length;
  if (groups === 0) return false;
  return (src.match(/data-travel="none"/g) || []).length < groups;
};
const transformsIn = (src) => ALWAYS_TRANSFORMS.test(src) || travellingReveal(src);
const TRANSFORMING = { test: transformsIn };
/** A backend-supplied number, rendered. The user's standing rule is that these
 *  appear exactly as returned. */
const RENDERS_A_VALUE = /currencySymbol|€|\bprice\b|discountValue|totalPrice|\bquantity\b/i;

const motionFiles = filesWith(PRIMITIVE);
const unexpected = motionFiles.filter(
  (f) => !MOTION_ADOPTED.some(([allowed]) => f.endsWith(allowed)),
);
check(
  "🔴 motion appears only where the adopted list says, with its reason",
  unexpected.length === 0,
  `unexpected: ${unexpected.join(", ")}`,
);
const staleAdopted = MOTION_ADOPTED.filter(
  ([file]) => !motionFiles.some((f) => f.endsWith(file)),
);
check(
  "…and every reason on it still describes a file that carries motion",
  // The list was only ever checked in one direction, so an entry could outlive
  // the motion it justified and sit there reading as a decision. Browser round
  // 3 took `motion-fade` off the hero's outer block; had it taken the last
  // primitive out of the file, nothing would have noticed the reason was now
  // describing something that no longer happens.
  staleAdopted.length === 0,
  `listed but carries no primitive: ${staleAdopted.map(([f]) => f).join(", ")}`,
);

/**
 * 🔴 The denylist, asserted by reason rather than by folder — which is what
 * Phase 12 was for.
 *
 * The distinction that makes it checkable: **a transform moves the number, an
 * opacity fade does not.** `motion-press`, `motion-scale` and `reveal-group`
 * translate or scale everything inside them, so they may not appear in a file
 * that renders a price, a discount or a quantity. `motion-fade` is opacity
 * only over one shot — it is the hard skeleton swap that was already happening,
 * softened — so it is allowed over values, and the app has shipped exactly that
 * on the vendor menu since Phase 6.
 *
 * This is what denied `/search` a press state: its result card renders a price,
 * and the card is the price's container.
 */
const movingValues = tree
  .filter((f) => TRANSFORMING.test(f.src) && RENDERS_A_VALUE.test(f.src))
  .map((f) => f.path);
check(
  "🔴 nothing that transforms is in a file that renders a price, discount or quantity",
  movingValues.length === 0,
  `a transform over a backend value in: ${movingValues.join(", ")}`,
);
check(
  "…and the fade exemption is exercised, not theoretical",
  // If no adopted file both fades and renders a value, the rule above has never
  // actually been the *narrower* claim it says it is, and the next reader would
  // be right to simplify it into a blanket ban.
  tree.some(
    (f) =>
      /motion-fade/.test(f.src) &&
      RENDERS_A_VALUE.test(f.src) &&
      !TRANSFORMING.test(f.src),
  ),
);
/**
 * 🔴 The fade-only stagger, and the hole it was written to cover.
 *
 * Asked for on the vendor menu: "the cards should appear like the homepage".
 * The homepage's stagger travels, every card on that menu ends in a price, and
 * the denylist above exists precisely to stop the two meeting. `data-travel`
 * keeps the sequencing and drops the rise.
 *
 * **The hole.** `CategoryGroup` staggers cards it does not render — they come
 * in through a render prop, and their prices are written in `VendorDetailsPage`.
 * So the denylist, which reads one file at a time, sees a component with no
 * money in it and would have waved a travelling group straight through. The
 * file-scoped check is not wrong, it is just blind at exactly this seam, and no
 * amount of tightening `RENDERS_A_VALUE` would open its eyes.
 *
 * What is checkable is the shape rather than the content: a component that
 * animates children supplied by its caller cannot know what it is moving.
 */
const foreignChildStaggers = tree
  .filter(
    (f) =>
      /\breveal-group\b/.test(f.src) &&
      /\brenderProduct\b|\bReactNode\b|\bchildren\b/.test(f.src) &&
      travellingReveal(f.src),
  )
  .map((f) => f.path);
check(
  "🔴 a group that staggers content it did not author does not travel",
  // It cannot know whether it is moving a price, and "probably not" is not the
  // standard this rule was written to.
  foreignChildStaggers.length === 0,
  `travels over children it does not render: ${foreignChildStaggers.join(", ")}`,
);

check(
  "…and the variant it uses is opacity alone, not a smaller rise",
  // The distinction the whole exemption rests on. A 2px rise would still be a
  // transform and would still move the number; the answer to "a price must not
  // move" is zero, not less.
  (() => {
    const variant =
      /\.reveal-group\[data-travel="none"\]\[data-revealed="true"\] > \* \{([^}]*)\}/.exec(
        cssCode,
      )?.[1] ?? "";
    const named = /animation-name:\s*([\w-]+)/.exec(variant)?.[1];
    if (!named) return false;
    const kf =
      new RegExp(`@keyframes\\s+${named}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(cssCode)?.[1] ?? "";
    return kf.length > 0 && !/transform/.test(kf) && /opacity/.test(kf);
  })(),
);

check(
  "…and it names itself in the reduced-motion block rather than inheriting one",
  // The rule above it is `animation: none` at (0,2,0); this variant sets
  // `animation-name` at (0,3,0) and wins the longhand back. It is still inert,
  // because the shorthand also reset the duration — but "correct because two
  // specificities cancelled out" has no place in an accessibility opt-out.
  /\.reveal-group\[data-travel="none"\]\[data-revealed="true"\] > \* \{\s*animation-name: none;/.test(
    reducedMotion,
  ),
);

check(
  "🔴 the vendor banner's transform lives where there is no price to move",
  // The other half of the same request, and the reason `VendorHeroImage` is its
  // own file rather than eight lines of `VendorDetailsPage`. The boundary is
  // load-bearing: a price rendered in that file would silently re-create the
  // defect the split exists to prevent.
  (() => {
    const heroFile = tree.find((f) => f.path.endsWith("vendors/VendorHeroImage.tsx"));
    const page = tree.find((f) => f.path.endsWith("vendors/VendorDetailsPage.tsx"));
    if (!heroFile || !page) return false;
    return (
      /motion-image-in/.test(heroFile.src) &&
      !RENDERS_A_VALUE.test(heroFile.src) &&
      RENDERS_A_VALUE.test(page.src) &&
      !transformsIn(page.src)
    );
  })(),
);

check(
  "the coarse backstop holds: cart, payment and orders carry no motion at all",
  // Redundant with the rule above and kept anyway. These are the three places
  // someone is reading a number they will be charged, and a check that cannot
  // be argued with is worth having where being wrong costs most.
  !motionFiles.some((f) => /\/(?:cart|payment|orders)\//.test(f)),
  motionFiles.filter((f) => /\/(?:cart|payment|orders)\//.test(f)).join(", "),
);

const interactiveCards = tree.filter((f) => /variant: "interactive"/.test(f.src));
const unpressable = interactiveCards.filter(
  (f) => !/motion-press/.test(f.src) && !RENDERS_A_VALUE.test(f.src),
);
check(
  "🔴 every card that says it is a control is pressable, or denied for a reason",
  // Two states, no third. Either the card presses, or its file renders a value
  // and the rule above denied it. A card carrying `interactive` and neither is
  // one nobody got to — which is the gap this phase existed to close.
  interactiveCards.length > 0 && unpressable.length === 0,
  `interactive but neither pressed nor denied: ${unpressable.map((f) => f.path).join(", ")}`,
);

/**
 * 🔴 Every homepage band that replaces a skeleton animates the replacement —
 * stated as a relationship, because the value-shaped version of this assertion
 * has now needed editing in two consecutive rounds.
 *
 * It used to name the exact className each band carried (`motion-fade grid`,
 * `motion-fade relative`), which meant it failed whenever a band changed *how*
 * it arrives rather than *whether* it does — twice, both times correctly and
 * both times for a reason the assertion could not express. What it is actually
 * for is that none of the four arrives with no transition at all, and that no
 * band pays for its arrival twice.
 */
const HOMEPAGE_BANDS = [
  ["HeroSection", hero],
  ["ShopSection", shopSection],
  ["CategoriesSection", cuisines],
  ["RestaurantsSection", restaurants],
];
const bandsWithoutArrival = HOMEPAGE_BANDS.filter(([, src]) => !PRIMITIVE.test(src));
check(
  "🔴 every homepage band animates the frame where its skeleton becomes content",
  bandsWithoutArrival.length === 0,
  `arrives with no transition: ${bandsWithoutArrival.map(([n]) => n).join(", ")}`,
);
check(
  "…and none of them pays for that arrival twice",
  // A container that fades while its own children stagger inside it animates
  // one event as two. Checked as "not on the same element" and, for the two
  // bands that stagger, as "the ancestor is not fading either".
  countAcross(/className="[^"]*motion-fade[^"]*reveal-group/g) === 0 &&
    countAcross(/className="[^"]*reveal-group[^"]*motion-fade/g) === 0 &&
    !/motion-fade relative/.test(cuisines) &&
    !/motion-fade grid[^"]*reveal-group/.test(restaurants),
);

// ---------------------------------------------------------------------------
section("§11.1  the banner reveal");
// ---------------------------------------------------------------------------

/**
 * Browser round 3. Five assertions, none of which name a duration, a blur
 * radius or a pixel — the lesson of round 2 is that a guard which pins a value
 * defends whatever value happened to be there.
 *
 * What went wrong: `loading` went false when `/sponsorships` answered, the
 * skeleton unmounted, and `motion-fade` crossfaded in a carousel whose
 * `<Image fill>` had painted nothing. The slide has no background, so the
 * animation ran over an empty box and the artwork arrived after it with no
 * transition at all. The motion was real and it was on the wrong event.
 */

const heroImageIn = /\.motion-image-in \{([^}]*)\}/.exec(cssCode)?.[1] ?? "";
/** `.motion-image-floor { … transition-duration: 400ms … }` → 400. */
const transitionMs = (cls) => {
  const body = new RegExp(`\\.${cls} \\{([^}]*)\\}`).exec(cssCode)?.[1] ?? "";
  const m = /transition-duration:\s*(\d+)ms/.exec(body);
  return m ? Number(m[1]) : null;
};

check(
  "🔴 the banner reveal waits on the image decoding, not on the request answering",
  // The whole defect, stated as the thing that must not come back: anything
  // that gates the floor on `loading` puts the crossfade back over an empty
  // frame. The floor and the image read one signal, written by `onLoad`.
  /onLoad=\{\(\) => markLoaded\(slide\._id\)\}/.test(hero) &&
    /data-loaded=\{loadedIds\.has\(slide\._id\)\}/.test(hero) &&
    /const currentLoaded = loadedIds\.has\(/.test(hero) &&
    /data-loaded=\{currentLoaded\}/.test(hero) &&
    !/motion-image-floor[\s\S]{0,240}data-loaded=\{!?loading\}/.test(hero),
);

check(
  "…and a banner that never loads still clears the floor",
  // A 404 fires `onError` and never `onLoad`. Without this the placeholder
  // shimmers forever, which reads as a hang rather than as a broken image.
  /onError=\{\(\) => markLoaded\(slide\._id\)\}/.test(hero),
);

check(
  "🔴 the placeholder is one component, drawn in both places it appears",
  // It is rendered in flow while the request is out and again as the floor
  // over the mounted carousel. Two copies of the same markup would drift, and
  // the drift would show at exactly the frame where nothing should change.
  /function BannerSkeletonArt\(\)/.test(hero) &&
    (hero.match(/<BannerSkeletonArt \/>/g) || []).length === 2 &&
    // `animate-pulse` animates opacity and so does the floor's fade. On one
    // element the animation wins outright and the floor never dissolves.
    !/motion-image-floor[^"]*animate-pulse/.test(hero),
);

check(
  "🔴 the LCP image blurs rather than fades",
  // The first slide carries `priority`, which makes it the page's LCP element,
  // and LCP is recorded when the element becomes *visible*. Animating it up
  // from `opacity: 0` moves the metric by the length of the animation and buys
  // nothing over blurring an image that is already opaque.
  /filter:\s*blur\(/.test(heroImageIn) &&
    !/opacity/.test(heroImageIn) &&
    /priority=\{index === 0\}/.test(hero),
  `motion-image-in: ${heroImageIn.replace(/\s+/g, " ").trim()}`,
);

check(
  "the floor is gone before the picture has finished resolving",
  // A relationship, not two numbers: whatever the durations are, a placeholder
  // still fading over an already-sharp banner is two events where the design
  // calls for one handover.
  transitionMs("motion-image-floor") !== null &&
    transitionMs("motion-image-in") !== null &&
    transitionMs("motion-image-floor") < transitionMs("motion-image-in"),
  `floor ${transitionMs("motion-image-floor")}ms vs image ${transitionMs("motion-image-in")}ms`,
);
/**
 * 🔴 An animation that persists its last keyframe keeps *declaring* it, and
 * animation declarations outrank every normal author rule in the cascade.
 *
 * `motion-reveal` ended on `transform: none` with `animation-fill-mode: both`,
 * so from the moment a grid finished revealing, every card in it was pinned to
 * `transform: none` — and `.motion-press:active { transform: scale(0.97) }`
 * never landed again. Two primitives, each correct alone, silently cancelling
 * one another wherever they met. `backwards` keeps the half that is needed
 * (the first keyframe applies through the stagger delay, so a card waiting its
 * turn is not visible) and drops the half that did the damage.
 *
 * Derived rather than named: any class whose animation persists and whose
 * keyframes touch `transform` is one that can do this to whatever it lands on.
 */
const persistingTransformClasses = [
  ...new Set(
    [...topLevelCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => {
        const anim = /animation:\s*([\w-]+)[^;]*?\b(?:forwards|both)\s*;/.exec(m[2]);
        if (!anim) return false;
        const kf = new RegExp(`@keyframes\\s+${anim[1]}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(
          cssCode,
        )?.[1];
        return Boolean(kf) && /transform/.test(kf);
      })
      .flatMap((m) => [...m[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((c) => c[1])),
  ),
].sort();

check(
  "🔴 the reveal hands its children back when it ends, so their press still lands",
  // `reveal-group` is the one primitive here that lands on arbitrary elements
  // — whatever a grid happens to be made of — so it is the one that may not
  // keep declaring a transform after it has finished.
  !persistingTransformClasses.includes("reveal-group") &&
    /animation: motion-reveal [^;]*\bbackwards;/.test(cssCode),
  `persists a transform: ${persistingTransformClasses.join(", ") || "none"}`,
);

const deadPresses = tree
  .filter((f) =>
    persistingTransformClasses.some((c) =>
      new RegExp(
        `className="[^"]*(?:${c}[^"]*motion-press|motion-press[^"]*${c})`,
      ).test(f.src),
    ),
  )
  .map((f) => f.path);
check(
  "…and nothing that presses carries one of those on the same element either",
  // The remaining two — the dialog panel's `motion-scale` and the order-tracking
  // scene — persist a transform legitimately, because neither is a control.
  // This is what stops the next one being put on something that is.
  deadPresses.length === 0,
  `press cancelled by a persisting transform in: ${deadPresses.join(", ")}`,
);

const cuisineTrackAttrs = between(cuisines, "ref={trackRef}", 'className="reveal-group');
check(
  "🔴 the strip reveals on the element whose children are the tiles",
  // `.reveal-group > *` keys off *direct* children. Moved up to the wrapper it
  // would have exactly one child — the scroll track — so the strip would fade
  // as a single block and the stagger would quietly do nothing at all. Asserted
  // as "no element opens between the ref and the class", which is the only way
  // to say that they are the same element.
  cuisineTrackAttrs.length > 0 &&
    !/<div/.test(cuisineTrackAttrs) &&
    /data-revealed=\{revealed\}/.test(cuisineTrackAttrs),
);

check(
  "…and it borrows the grid's stagger rather than typing its own",
  // The 50ms step is a system value shared with the vendor grid directly below
  // it. A strip that staggered faster than the grid under it would read as two
  // systems on one page.
  /reveal-group/.test(cuisines) &&
    /reveal-group/.test(restaurants) &&
    countAcross(/animation-delay|animationDelay/g) === 0,
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
    // Derived, not typed: the string these must *not* contain is whatever
    // `SectionHeading` currently opens with. Spelled by hand it went stale the
    // moment round 5 changed the component's margin, and a negative assertion
    // that can no longer match anything passes forever.
    !new RegExp(headingWrapperClass).test(cuisines) &&
    !new RegExp(headingWrapperClass).test(restaurants) &&
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
  "the cuisine tile and its skeleton are one geometry, and neither is a surface",
  // 🔴 Reversed in browser round 2 — this asserted the Phase 7 tile. What
  // survives the reversal is the half that was always the point: the two
  // branches state the same width, and the arbitrary `calc()` stays gone.
  /w-24 shrink-0 snap-start/.test(cuisines) &&
    /w-24 shrink-0 flex-col/.test(cuisines) &&
    !/calc\(\(100vw-5rem\)\/4\)/.test(cuisines) &&
    // §6 owns the reversal itself; this only refuses to re-add the surface.
    !/rounded-2xl border bg-card/.test(cuisines),
);

/**
 * Spacing, ratcheted. §1.2 allows 4, 8, 12, 16, 24, 32, 48, 64 — so `p-1`
 * through `p-4`, `p-6`, `p-8`, `p-12`, `p-16` and nothing between.
 *
 * Phase 11 widened this from the six files Phase 7 owned to the whole tree,
 * which is the widening §2b asks each phase to do. The old regex is kept below
 * as the *scoped* check because it also documents which values were retired;
 * §16 is the tree-wide one.
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

const cardBase = between(cardComponent, "cva(", "{");
check(
  "the shell is declared once, with the values the phase settled on",
  // Rewritten in Phase 10. It used to pin the literal
  // `... bg-card dark:border-neutral-800`, which is exactly the hand-typing
  // Phase 10 removed — so it asserts the stronger fact now: the shell names
  // two tokens and *no theme override*, because a token that needs a `dark:`
  // beside it is not carrying its dark value.
  /rounded-3xl/.test(cardBase) &&
    /border border-border/.test(cardBase) &&
    /bg-card/.test(cardBase) &&
    !/dark:/.test(cardBase) &&
    /interactive:\s*\n?\s*"transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"/.test(
      cardComponent,
    ) &&
    /card: "p-4 sm:p-6"/.test(cardComponent),
  cardBase.trim().slice(0, 120),
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

// ---------------------------------------------------------------------------
section("§15 the token layer, again — tree-wide");
// ---------------------------------------------------------------------------

/**
 * Plan.md Phase 10, and the third guard here built the way §2b asks: it walks
 * the tree rather than naming the files a phase happened to touch.
 *
 * §0 opened the plan with "the token layer exists and nothing uses it". It had
 * happened a second time with two different tokens — `bg-card` used once
 * against 125 hand-typed `bg-white dark:bg-neutral-900`, `border-border` used
 * 17 times against 286 hand-typed `dark:border-neutral-800`. Both are now
 * swept, so what these assertions defend is the *pairing*: the moment a
 * `dark:` variant appears next to a colour a token already carries, the token
 * has stopped being the source of truth again.
 */

check(
  "🔴 --border carries its own dark value instead of borrowing the surface's",
  // It was `oklch(1 0 0 / 10%)` — 10% white, so it composited to #2e2e2e on a
  // card, #232323 on the page ground and to the photograph over an image. A
  // token that renders four colours is why 286 call sites overrode it.
  /--border:\s*#262626;/.test(darkTokens),
  "expected the opaque #262626 the tree was already hand-typing",
);
check(
  "…and the light value is unchanged",
  /--border:\s*#edeeef;/.test(lightTokens),
);

/** Per line, which in this Prettier-formatted tree is per className string. */
const linesWhere = (predicate) =>
  tree.flatMap((f) =>
    f.src
      .split("\n")
      .map((line, i) => (predicate(line) ? `${f.path}:${i + 1}` : null))
      .filter(Boolean),
  );

const bare = (token) =>
  new RegExp(`(?<![\\w:/-])${token.replace(/[[\]#]/g, "\\$&")}(?![\\w/-])`);

const bgPairs = linesWhere(
  (l) => bare("bg-white").test(l) && bare("dark:bg-neutral-900").test(l),
);
check(
  "🔴 no className states the card surface in both themes by hand",
  // `bg-white dark:bg-neutral-900` is `bg-card`, measured: --card is #ffffff
  // and #171717, and #171717 is neutral-900 exactly. 150 lines said it the
  // long way.
  bgPairs.length === 0,
  bgPairs.slice(0, 5).join(", "),
);

/* The light greys that are the hairline --border already draws. Max per-channel
   distance from #edeeef in brackets — measured, none above 12, all of them a
   1px line. */
const HAIRLINE_GREYS = [
  "border-gray-200", // #e5e7eb [8]
  "border-gray-100", // #f3f4f6 [7]
  "border-neutral-200", // #e5e5e5 [10]
  "border-neutral-100", // #f5f5f5 [8]
  "border-slate-200", // #e2e8f0 [11]
  "border-slate-100", // #f1f5f9 [10]
  "border-gray-150", // not a Tailwind colour — it was drawing --border already
  "border-\\[#e7e8e9\\]", // [6]
  "border-\\[#f0f0f0\\]", // [3]
  "border-\\[#e3e3e3\\]", // [12]
  "border-\\[#e7e7e7\\]", // [8]
  "border-\\[#efefef\\]", // [2]
  "border-\\[#e6e6e6\\]", // [9]
  "border-\\[#f3f4f5\\]", // [6]
];
const GREY_HAIRLINE = new RegExp(
  `(?<![\\w:/-])(?:${HAIRLINE_GREYS.join("|")})(?![\\w/-])`,
);
const borderPairs = linesWhere(
  (l) => bare("dark:border-neutral-800").test(l) && GREY_HAIRLINE.test(l),
);
check(
  "🔴 no hairline spells a grey the token already means, then overrides it",
  // Fourteen spellings of one light grey, each with the same dark override.
  // This is the §1.4 argument that retired the seven pinks, one layer down.
  borderPairs.length === 0,
  borderPairs.slice(0, 5).join(", "),
);

/**
 * Ratchets, not targets — the same shape as the hex ceiling above. What is left
 * is held on purpose and each kind has a reason:
 *
 * - `border-transparent dark:border-neutral-800` (23) — invisible in light by
 *   design. Sweeping it would *add* a hairline to 23 surfaces.
 * - the pink tints, `#e3bdc3` and friends (26) — brand colour, and deriving
 *   them from --primary the way --primary-hover already is remains a decision
 *   rather than a sweep.
 * - an alpha on either side (12) — `border-neutral-200/50`, `dark:…-800/80`.
 *   The token cannot express a translucency that differs per theme.
 * - `border-gray-300` (2) and `border-[#dcdcdc]` (2) — 28 and 19 from #edeeef,
 *   which is a deliberately heavier line, not a spelling of this one.
 */
const DARK_BORDER = /dark:border-neutral-800/g;
const darkBorderNow = countAcross(DARK_BORDER);
const DARK_BORDER_CEILING = 77;
check(
  `hand-typed dark hairlines are at or below the ${DARK_BORDER_CEILING} the sweep left`,
  darkBorderNow <= DARK_BORDER_CEILING,
  `now ${darkBorderNow} — lower the ceiling in this file when it drops`,
);

const WHITE = /(?<![\w:/-])bg-white(?![\w/-])/g;
const whiteNow = countAcross(WHITE);
const WHITE_CEILING = 48;
check(
  `hand-typed white surfaces are at or below the ${WHITE_CEILING} the sweep left`,
  // These are the ones that are not the card: a pill over a photograph, a
  // surface whose dark side carries an alpha, the login panel.
  whiteNow <= WHITE_CEILING,
  `now ${whiteNow} — lower the ceiling in this file when it drops`,
);

const sunkenUnthemed = linesWhere(
  (l) => /(?<!hover:)bg-\[#f8f9fa\]/i.test(l) && !/dark:bg-/.test(l),
);
/**
 * 🔴 The named palette is a spelling of the brand pink too.
 *
 * Reported from the vendor page: "different type of pink is used". Phase 4
 * collapsed seven pinks into `--primary` and swept **hex literals** to do it —
 * so `bg-[#f9186b]` was caught and `bg-pink-600` was not. `pink-600` is
 * `#db2777`: duller, and a different *hue*, not a different shade. It sat
 * beside the navbar and the buttons for eight phases, in 151 places, and every
 * assertion in this file looked straight past it because none of them was
 * looking for a class name.
 *
 * That is the same failure as `animate-fadeIn` in §11 and for the same reason:
 * a guard that enumerates the ways a thing can be spelled only ever catches the
 * spellings somebody thought of.
 *
 * Dark mode is deliberately exempt. The brand pink is too hot on a dark ground,
 * and `text-primary dark:text-pink-400` is a decision, not drift — 260 of them.
 */
const PINK_EXCEPTIONS = [
  ["to-pink-500", "second stop of a two-stop brand gradient; one token deletes the gradient"],
  ["to-pink-400", "second stop of a two-stop brand gradient; one token deletes the gradient"],
  ["from-pink-900", "a near-black scrim over a photo — from-primary would be a bright pink wash"],
];
const LIGHT_PINK = /(?:^|[\s"'`])((?:[a-z][a-z-]*:)*)((?:bg|text|border|ring|fill|stroke|from|to|via|decoration|shadow|divide)-pink-\d+)/g;
const paletteLeaks = [];
for (const f of tree) {
  for (const m of f.src.matchAll(LIGHT_PINK)) {
    if (m[1].includes("dark:")) continue;
    if (PINK_EXCEPTIONS.some(([base]) => m[2] === base)) continue;
    paletteLeaks.push(`${f.path}:${m[1]}${m[2]}`);
  }
}
check(
  "🔴 no light-mode Tailwind pink survives — the token is the only brand pink",
  paletteLeaks.length === 0,
  `palette pink instead of --primary: ${paletteLeaks.slice(0, 6).join(", ")}`,
);
check(
  "…and the exceptions are reasons, not a hole",
  // Same shape as §11's adopted list. An entry with no reason is somebody
  // widening the exception rather than making the case for one.
  PINK_EXCEPTIONS.every(([base, why]) => /^[a-z-]+-pink-\d+$/.test(base) && why.length > 25) &&
    // …and each one is actually still in use. An exception nobody exercises is
    // a hole standing open for the next person who reaches for that class.
    PINK_EXCEPTIONS.every(([base]) => countAcross(new RegExp(`\\b${base}\\b`, "g")) > 0),
  `unused or unexplained: ${PINK_EXCEPTIONS.filter(([b, w]) => !w || countAcross(new RegExp(`\\b${b}\\b`, "g")) === 0).map(([b]) => b).join(", ")}`,
);
check(
  "🔴 the dark-mode pair is left alone, and is still the common case",
  // The exemption has to be exercised or the rule above is quietly a blanket
  // ban that nobody noticed was one. It is not: dark mode steps to a lighter
  // palette pink on purpose, in far more places than light mode ever used one.
  countAcross(/dark:(?:bg|text|border|ring)-pink-\d+/g) > 100,
);

check(
  "the sunken surface has no token yet, so every use of it states both themes",
  // `#f8f9fa` (39) and `bg-gray-50 dark:bg-neutral-900` (9) are a page ground
  // one step below the card. --background is #ffffff light, --muted is #262626
  // dark; neither pair matches, so folding them in would change a colour rather
  // than name one. That is §5 open question 8 — a decision, like #9aa0a6.
  //
  // Which is exactly why this asserts the *pair* rather than the colour's
  // presence: an untokenised colour has to carry its own dark value by hand,
  // and writing this found one that did not — a whole `/current-location` band
  // that stayed light grey in dark mode. `hover:` is excluded because
  // SocialButton's is Google's brand spec, deliberately unthemed.
  sunkenUnthemed.length === 0,
  sunkenUnthemed.join(", "),
);

// ---------------------------------------------------------------------------
section("§16 the 4-based scale, tree-wide");
// ---------------------------------------------------------------------------

/**
 * Plan.md Phase 11. §12 has asserted the scale since Phase 7 — across six
 * files. This is the same rule with the scope §2b asks for, and the widening is
 * the phase: the sweep was an afternoon, the ratchet is what stops it happening
 * a third time.
 *
 * ## 🔴 There are two spacing roles, and the scale governs one of them
 *
 * The phase was planned from a count — "181 off-scale utilities" — produced by
 * a regex that only looked at `p*` and `m*` whole numbers. Counting properly
 * (adding `gap`, `space-x/y`, and the half-steps) gives **358**, and reading
 * them splits cleanly in two:
 *
 * - **Layout** — the space *between* things: card padding, grid gaps, section
 *   rhythm, page frame. 216 of these were off-scale and every one was
 *   arbitrary — `p-6` used 94 times and `p-5` 34 times for the same job. Swept.
 * - **Optical alignment** — 142 sub-step values, and they are not drift.
 *   `mt-0.5` nudges a 16px icon onto a 14px text baseline. `px-1.5 py-0.5` is
 *   the box of an inline `<code>` at 12px. `gap-1.5` separates an icon from a
 *   12px label. Two pixels is not a layout decision; it is a correction for a
 *   glyph's bearing, and rounding it to zero misaligns the icon.
 *
 * Sweeping the second group would have been a regression performed in the name
 * of compliance — the same trap as Phase 9's "settle on one `<h2>` size". So
 * they are held, named, and ratcheted: they may not grow.
 *
 * ## One rule, not 216 judgments
 *
 * The plan said `p-10` → "8 or 12 by eye". With no browser in this session,
 * 216 unverifiable eye-judgments are worse than one stated rule, so: **round to
 * the nearest allowed step, ties break downward** — 5→4, 7→6, 9→8, 10→8, 11→12,
 * 14→12, 20→16, 24→16. Every change is at most one step, and it is checkable.
 *
 * It broke upward exactly once, and the exception has a reason rather than an
 * eye: `<Button size="lg">` was `px-5`, and 5→4 would have given it the same
 * horizontal padding as `size="default"`, collapsing two rungs of a deliberate
 * ladder into one. Where a tie erases a distinction, it breaks up. See §16's
 * ladder assertion.
 */

const SPACING_UTIL =
  /(?<![\w:/-])((?:(?:sm|md|lg|xl|2xl|hover|focus|group-hover|dark|first|last|max-sm|max-md|max-lg):)*)(-?(?:p[trblxyse]?|m[trblxyse]?|gap(?:-[xy])?|space-[xy]))-(\d+(?:\.\d+)?)(?![\w/.-])/g;

/** 4, 8, 12, 16, 24, 32, 48, 64 — and 0, which is the absence of space. */
const ON_SCALE = new Set(["0", "1", "2", "3", "4", "6", "8", "12", "16"]);

/**
 * `tree` already excludes `%5Fdesign` — see `walk` above. That exclusion long
 * predates this phase and is right: the kit *renders* the retired values so
 * they can be compared against what ships, so a tree-wide rule would flag its
 * evidence. It also means nothing guards the kit, which the separate ceiling
 * below fixes.
 */
const strayLayout = [];
let subStep = 0;
for (const f of tree) {
  f.src.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(SPACING_UTIL)) {
      const val = m[3];
      if (ON_SCALE.has(val)) continue;
      if (val.includes(".")) { subStep++; continue; }
      strayLayout.push(`${f.path}:${i + 1} ${m[0]}`);
    }
  });
}

check(
  "🔴 no layout spacing off the 4-based scale, anywhere in the tree",
  // The rule §1.2 has stated since the plan was written, enforced for the
  // first time outside the six files Phase 7 touched.
  strayLayout.length === 0,
  `found ${strayLayout.length}: ${strayLayout.slice(0, 8).join(", ")}`,
);

const SUB_STEP_CEILING = 129;
check(
  `the optical sub-step is held at or below the ${SUB_STEP_CEILING} that exist`,
  // Held on purpose, not missed — see the note above. A ratchet rather than a
  // ban, because the next `mt-0.5` should have to justify itself against 140
  // that already do the same job.
  subStep <= SUB_STEP_CEILING,
  `now ${subStep} — lower the ceiling in this file when it drops`,
);

const kitOffScale = [...spec.matchAll(SPACING_UTIL)].filter(
  (m) => !ON_SCALE.has(m[3]) && !m[3].includes("."),
);
const KIT_DEMO_CEILING = 16;
check(
  "the design kit's retired values are demo data, and a fixed amount of it",
  // The kit sits outside `tree`, so this is the only thing looking at it. Its
  // off-scale values are the `RETIRED_SPACING` array, two `<Mono>` captions and
  // the "now" shop-card demo — 16 on four lines. A ceiling rather than a ban,
  // because the exception must not quietly become a habit.
  kitOffScale.length <= KIT_DEMO_CEILING,
  `now ${kitOffScale.length}: ${kitOffScale.slice(0, 6).map((m) => m[0]).join(", ")}`,
);

const sizes = between(button, "size: {", "},");
check(
  "🔴 the button's three sizes have three horizontal paddings",
  // Phase 11's tie-breaks-down rule sent `lg` from px-5 to px-4, which is what
  // `default` already is: two rungs, one padding. A ladder whose steps are
  // indistinguishable is not a ladder, so this tie broke upward to px-6.
  /sm: "h-8 gap-2 px-3"/.test(sizes) &&
    /default: "h-11 gap-2 px-4 sm:h-10"/.test(sizes) &&
    /lg: "h-12 gap-2 px-6"/.test(sizes),
  sizes.replace(/\s+/g, " ").slice(0, 140),
);

const dialog = stripComments(read("src/components/ui/alert-dialog.tsx"));
check(
  "the dialog's full-bleed footer still cancels its content padding",
  // `p-5` with `-mx-5 -mb-5` became `p-4` with `-mx-4 -mb-4`. They have to move
  // together or the footer stops reaching the dialog's edges — and they did,
  // *because* one uniform rule moved both. Per-site judgment is what breaks a
  // relationship like this, which is the second argument for the rule.
  /(?<![\w-])p-4(?![\w/-])/.test(between(dialog, "alert-dialog-content", "className")) ||
    (/-mx-4 -mb-4/.test(dialog) && /gap-4 rounded-3xl border border-border bg-card p-4/.test(dialog)),
  "expected p-4 on the content and -mx-4 -mb-4 on the footer",
);

// ---------------------------------------------------------------------------
section("§17 two defects reported from a browser");
// ---------------------------------------------------------------------------

/**
 * The first two findings in this plan that came from someone *looking at the
 * page* rather than from a guard, which is worth saying plainly: fourteen
 * sections of assertions above cover source text, and neither of these is a
 * source-text mistake. One is a colour that cancels itself, the other is a
 * number that was right twice in the same place.
 */

const ringOnItsOwnFill = [];
for (const f of tree) {
  f.src.split("\n").forEach((line, i) => {
    const bg = [...line.matchAll(/(?<![\w:/-])bg-([a-z0-9[\]#-]+)(?![\w/-])/g)].map((m) => m[1]);
    const ring = [...line.matchAll(/(?<![\w:/-])ring-([a-z0-9[\]#-]+)(?![\w/-])/g)]
      .map((m) => m[1])
      .filter((v) => !/^\d+$/.test(v) && v !== "offset");
    const clash = ring.filter((r) => bg.includes(r));
    if (clash.length) ringOnItsOwnFill.push(`${f.path}:${i + 1} ring-${clash[0]} on bg-${clash[0]}`);
  });
}
check(
  "🔴 no ring is the colour of the fill it surrounds",
  // The navbar's count badge was `bg-white … ring-2 ring-white` on a pink bar
  // over a white icon. A ring exists to put a gap between two shapes, and this
  // one was made of the same thing as the shape — so it separated nothing and
  // turned a 16px disc into a 20px one, which covered the bell behind it.
  // The gap has to be the colour of what is *behind* both.
  ringOnItsOwnFill.length === 0,
  ringOnItsOwnFill.join(", "),
);

const navbar = stripComments(read("src/components/shared/Navbar.tsx"));
check(
  "…and the badge that had it is declared once, not twice",
  // Two identical 150-character strings in one file. Phase 5 spent three
  // phases on pairs like that drifting apart; this one was wrong in both
  // copies at once, which is the other way it goes.
  /const COUNT_BADGE\s*=/.test(navbar) &&
    (navbar.match(/className=\{COUNT_BADGE\}/g) || []).length === 2 &&
    !/ring-2 ring-white/.test(navbar),
);
check(
  "the badge sits outside the icon's box and can hold two characters",
  // `right-0 top-0` anchored it *inside* a 22px icon. `min-w-4 px-1` rather
  // than `w-4` because "9+" at 12px bold is wider than a 16px circle and the
  // disc has no `overflow-hidden` to hide the spill.
  (() => {
    // Scoped to the constant. `!/h-4 w-4/.test(navbar)` was the first attempt
    // and it read the whole file — five unrelated 16px spinners live in there.
    const badge = between(navbar, "const COUNT_BADGE", ";");
    return (
      /-right-1 -top-1/.test(badge) &&
      /min-w-4/.test(badge) &&
      // `\bw-4\b` was the second attempt and it matches inside `min-w-4` —
      // the `-` before `w` is a non-word character, so `\b` sits right there.
      !/(?<![\w-])w-4(?![\w-])/.test(badge) &&
      !/right-0 top-0/.test(badge)
    );
  })(),
  between(navbar, "const COUNT_BADGE", ";").replace(/\s+/g, " ").slice(0, 160),
);

const cuisineSection = stripComments(read("src/components/home/CategoriesSection.tsx"));
const sectionMargins = [...cuisineSection.matchAll(/<section className="([^"]*)"/g)].map((m) => m[1]);
check(
  "🔴 the cuisine strip's hover clearance is absorbed by the gap, not stacked on it",
  // Measured in a browser at 88 on a phone. The track's `pb-4` is real — the
  // tiles lift 4px and `shadow-lg` reaches ~12 below, and `overflow-x-auto`
  // would clip both. The wrapper's `pb-6` was not: it clipped nothing and
  // showed nothing. What is left is invisible but not free, so the section's
  // own margin takes it off the rhythm rather than adding to it. The arithmetic
  // that used to be written out here is now §18's, against a rhythm this no
  // longer needs to know the value of; all three branches still have to agree.
  !/overflow-hidden pb-6/.test(cuisineSection) &&
    sectionMargins.length === 3 &&
    new Set(sectionMargins).size === 1,
  `section margins: ${JSON.stringify(sectionMargins)}`,
);

const termsPage = stripComments(read("src/app/(main)/terms/page.tsx"));
check(
  "🔴 /terms' hero and its content container do not both pay for the same gap",
  // Reported from a screenshot: 112px between the page title and the first
  // heading. `py-16` on the hero put 64 below the h1 and `py-12` on the
  // container below it put 48 above the next heading — two elements each
  // paying in full for one gap. The hero keeps its top air and stops paying
  // for the bottom, so the container's padding *is* the gap — at the same
  // rhythm the homepage uses, which §18 asserts rather than restating here.
  /<section className="relative pt-12 sm:pt-16">/.test(termsPage) &&
    !/<section className="relative py-\d+">/.test(termsPage) &&
    /container mx-auto px-4 py-8 sm:py-12/.test(termsPage),
);
check(
  "…and every gap on that page is a §1.2 value",
  // Heading → its content is 24; block → block inside a section is 32;
  // section → section is 48 stepping to 64. The page had 16, 32, 48 and 64
  // for the first of those and a flat 64 for the last.
  (() => {
    const headings = [...termsPage.matchAll(/<h[1-4][^>]*className="([^"]*)"/g)].map((m) => m[1]);
    const headingGaps = headings
      .map((c) => (c.match(/(?<![\w:-])mb-(\d+)(?![\w/-])/) || [])[1])
      .filter(Boolean);
    const sectionGaps = [...termsPage.matchAll(/className="[^"]*(?<![\w:-])mb-8 sm:mb-12(?![\w/-])[^"]*"/g)];
    return (
      headingGaps.length > 0 &&
      headingGaps.every((g) => g === "6") &&
      sectionGaps.length === 2 &&
      !/(?<![\w:-])mb-16(?![\w/-])(?! )/.test(termsPage.replace(/sm:mb-16/g, ""))
    );
  })(),
  "headings must be mb-6; the two section breaks must carry the page rhythm",
);

/**
 * 🔴 The shape that turned up three times in one afternoon, once someone
 * looked at the pages: **two elements each paying in full for the same gap.**
 *
 * - `/terms`: `py-16` on the hero band *and* `py-12` on the container under it.
 * - `/privacy` and the GDPR page: `mb-12` on each chapter `<section>` *and*
 *   `mt-8` on the heading that opens the next one — 80px between chapters
 *   where §1.2 says 48.
 * - the cuisine strip, in a different currency: `pb-6` on a wrapper over the
 *   `pb-4` its child already had.
 *
 * None of the three is a wrong *value*. Every number involved is on the §1.2
 * scale, which is why §16 passes over all of them and why this needed eyes.
 * The rule is about ownership: one side of a boundary pays, and the section
 * owns its own rhythm.
 */
const doublePaidGaps = [];
for (const f of tree) {
  const lines = f.src.split("\n");
  lines.forEach((line, i) => {
    if (!/<section[^>]*className="[^"]*(?<![\w:-])mb-\d/.test(line)) return;
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      if (/<h[1-6][^>]*className="[^"]*(?<![\w:-])mt-\d/.test(lines[j])) {
        doublePaidGaps.push(`${f.path}:${j + 1}`);
        break;
      }
      if (/<(?:div|section|main|p)\b/.test(lines[j])) break;
    }
  });
}
check(
  "🔴 a section that states its own bottom gap has no heading paying for it again",
  doublePaidGaps.length === 0,
  `heading with a top margin under a section that already has one: ${doublePaidGaps.join(", ")}`,
);

/**
 * And the values themselves, across the six static pages. Phase 9's two
 * heading roles decide it: a section heading gets 24 to its content, a panel
 * head gets 12 to its prose. It was 8, 12, 16, 24 and 32 before, plus a `mt-*`
 * on the paragraph instead of a `mb-*` on the heading half the time, which is
 * why the value could not be grepped.
 */
const STATIC_PAGES = [
  "app/(main)/terms/page.tsx",
  "app/(main)/privacy/page.tsx",
  "app/(main)/available-countries/page.tsx",
  "components/gdpr-compliance/GdprCompliancePage.tsx",
  "components/about-deligo/AboutDeligo.tsx",
  "components/faqs/FAQPage.tsx",
  "components/contact-page/ContactPage.tsx",
];
const strayHeadingGaps = [];
for (const path of STATIC_PAGES) {
  const file = tree.find((f) => f.path === `src/${path}`);
  if (!file) { strayHeadingGaps.push(`${path}: not found`); continue; }
  file.src.split("\n").forEach((line, i) => {
    const m = line.match(/<h[1-6][^>]*className="([^"]*)"/);
    if (!m) return;
    const mb = (m[1].match(/(?<![\w:-])mb-([\d.]+)(?![\w/-])/) || [])[1];
    if (mb === undefined) return; // the subtitle under it owns the gap
    // `mb-1` on a 14px label above its 14px caption is a label/value pair, not
    // a heading over content — the small-type role Phase 11 named.
    if (mb === "1" && /text-sm/.test(m[1])) return;
    if (mb !== "3" && mb !== "6") strayHeadingGaps.push(`${path}:${i + 1} mb-${mb}`);
  });
}
check(
  "…and a heading on a static page gives its content 24, or its own prose 12",
  strayHeadingGaps.length === 0,
  `off-role heading gaps: ${strayHeadingGaps.join(", ")}`,
);

// ---------------------------------------------------------------------------
section("§18  the section rhythm");
// ---------------------------------------------------------------------------

/**
 * Browser round 5. Reported from a screenshot as "a lot of gap between the
 * banner and Shop On DeliGo".
 *
 * Two findings, and only the second was the one that got pointed at.
 *
 * 1. **The hero was an outlier.** Every band sat 64 from the next. The hero sat
 *    ~86, because its dots strip — `mt-3` + a 6px dot + `pb-1` — was stacked on
 *    top of a rhythm that had already been paid. Exactly the shape §17 caught
 *    three times elsewhere, and exactly the fix the cuisine strip already used
 *    for its shadow clearance: the band deducts its own furniture from the gap.
 * 2. **The rhythm was only ever half the gap.** Band bottom to the next band's
 *    *content* was 64 + accent + 12 + heading + 24 ≈ 144. The section gap is the
 *    number anyone counts; the heading block is the number nobody does. Both
 *    came down — 48/64 → 32/48, and `SectionHeading`'s 24 → 16.
 *
 * Nothing below names 32, 48 or 16. The rhythm is read from the one place it is
 * stated and everything else is asserted against *it*, because the whole reason
 * this needed a screenshot is that every value involved was already legal.
 */

/** §1.2's ladder, in pixels. §16 enforces it as a denylist of the values that
 *  are *not* on it; §18 needs the positive form to say "this is a legal gap". */
const SCALE = [4, 8, 12, 16, 24, 32, 48, 64];

/** `space-y-8 … sm:space-y-12` → { base: 32, sm: 48 }, in pixels. */
const rhythm = (() => {
  const m = /space-y-(\d+)[^"]*sm:space-y-(\d+)/.exec(homeContent);
  return m ? { base: Number(m[1]) * 4, sm: Number(m[2]) * 4 } : null;
})();
/** `mb-4 sm:mb-8` → { base: 16, sm: 32 }. `sm` falls back to `base`. */
const bottomMargin = (cls) => {
  const base = /(?<![\w:-])mb-(\d+)(?![\w/-])/.exec(cls);
  const sm = /(?<![\w:-])sm:mb-(\d+)(?![\w/-])/.exec(cls);
  if (!base) return null;
  return { base: Number(base[1]) * 4, sm: (sm ? Number(sm[1]) : Number(base[1])) * 4 };
};
/** One optical step. §16 already carries 142 sub-step values for exactly this
 *  reason — a 6px dot cannot be made to sum to a scale value using scale
 *  margins, and pretending otherwise is how a fudge becomes a pinned number. */
const STEP = 4;

check(
  "🔴 the page states its section rhythm once, and on the scale",
  rhythm !== null && SCALE.includes(rhythm.base) && SCALE.includes(rhythm.sm) && rhythm.base < rhythm.sm,
  `rhythm: ${JSON.stringify(rhythm)}`,
);

const cuisineMargin = bottomMargin(sectionMargins[0] ?? "");
check(
  "🔴 the cuisine strip's own margin plus its clearance is the rhythm, exactly",
  // `space-y` compiles inside `:where()`, so a plain `mb-*` on the child wins
  // outright rather than adding to it. The track's `pb-4` is the clearance the
  // tiles' shadow needs; 16 + 16 = 32 and 16 + 32 = 48. Read from the file, so
  // moving the rhythm moves what this demands of the strip.
  (() => {
    const clearance = Number((/pb-(\d+)[^"]*sm:gap-8/.exec(cuisineSection) || [, 4])[1]) * 4;
    return (
      cuisineMargin !== null &&
      cuisineMargin.base + clearance === rhythm.base &&
      cuisineMargin.sm + clearance === rhythm.sm
    );
  })(),
  `strip margin ${JSON.stringify(cuisineMargin)} against rhythm ${JSON.stringify(rhythm)}`,
);

const heroSectionClass = (/<section className="(group relative[^"]*)"/.exec(hero) || [, ""])[1];
const heroMargin = bottomMargin(heroSectionClass);
check(
  "🔴 the hero deducts its dots strip from the rhythm instead of adding to it",
  // The deduction has to be the *same* at both widths — the strip does not
  // change size with the viewport, so a deduction that does is drift — and
  // within one optical step of what the strip actually measures. Not "is 24":
  // that number is a consequence of a 6px dot, and pinning it would make the
  // next person's honest re-measurement look like a regression.
  (() => {
    if (!heroMargin || !rhythm) return false;
    const dots = /mt-(\d+) flex justify-center gap-\d+ pb-(\d+)/.exec(hero);
    const dotRow = /h-(\d+(?:\.\d+)?) w-12/.exec(hero);
    if (!dots || !dotRow) return false;
    const strip = Number(dots[1]) * 4 + Number(dotRow[1]) * 4 + Number(dots[2]) * 4;
    const deduction = { base: rhythm.base - heroMargin.base, sm: rhythm.sm - heroMargin.sm };
    return deduction.base === deduction.sm && Math.abs(deduction.base - strip) <= STEP;
  })(),
  `hero margin ${JSON.stringify(heroMargin)} against rhythm ${JSON.stringify(rhythm)}`,
);

check(
  "…and it is the only band that pays for furniture of its own",
  // ShopSection and RestaurantsSection carry nothing below their content, so
  // they take the rhythm untouched. A margin appearing on one of them is
  // either new furniture nobody mentioned or a gap being nudged by hand.
  !/<section className="[^"]*(?<![\w:-])mb-\d/.test(shopSection) &&
    !/<section className="[^"]*(?<![\w:-])mb-\d/.test(restaurants),
);

check(
  "🔴 a section heading sits closer to its content than the bands sit to each other",
  // The gap that was invisible in the report. It is not on the §1.2 section
  // scale and should not be: it is a heading-to-content gap, and a heading that
  // gives its content as much air as the page gives the next section does not
  // read as belonging to it.
  (() => {
    const mb = /<div className="mb-(\d+) flex items-end/.exec(headingComponent);
    if (!mb || !rhythm) return false;
    const gap = Number(mb[1]) * 4;
    return SCALE.includes(gap) && gap < rhythm.base;
  })(),
  `heading gap: ${headingWrapperClass}`,
);

check(
  "…and the prose pages keep the wider one, deliberately",
  // Two heading roles, two gaps: a chapter on a page that is *read* keeps 24,
  // a band on a page that is *scanned* takes 16. Asserted so the two cannot
  // quietly converge — the failure mode here is somebody "tidying" one to
  // match the other and losing the distinction Phase 9 drew.
  (() => {
    const mb = /<div className="mb-(\d+) flex items-end/.exec(headingComponent);
    return Boolean(mb) && Number(mb[1]) * 4 < 24;
  })() && /<h[1-4][^>]*className="[^"]*(?<![\w:-])mb-6(?![\w/-])/.test(termsPage),
);

check(
  "🔴 /terms breaks its chapters on the same rhythm the homepage uses",
  // One rhythm, not a browse one and a prose one. It was 48/64 on both before
  // and stayed in step by coincidence — both were typed, neither was derived.
  (() => {
    const m = /className="[^"]*(?<![\w:-])mb-(\d+) sm:mb-(\d+)(?![\w/-])/.exec(termsPage);
    return Boolean(m) && Number(m[1]) * 4 === rhythm.base && Number(m[2]) * 4 === rhythm.sm;
  })(),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
