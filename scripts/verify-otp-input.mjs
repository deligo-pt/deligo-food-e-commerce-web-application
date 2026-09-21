/**
 * The login code — four tiles over one input, and the verified moment.
 *
 *   pnpm verify:otp-input
 *
 * No token, no network. Built after a reference video the owner supplied
 * (21 Sep 2026, read frame by frame): while typing, each digit fades in and
 * the ring the tile hands on is erased around its edge; once the code is
 * accepted the row tilts into a square, links up, turns green, folds into one
 * tile, and that tile becomes a badge. Filmed against a production build with
 * the server stubbed: typing, paste, backspace, select-all, the full sequence,
 * Continue skipping it, reduced motion, and one `verify-otp` call each time.
 *
 * ## What this defends
 *
 * 1. **One real input.** Four inputs need hand-written focus jumping — where
 *    fast typing, paste and SMS autofill break. Two regressions found by
 *    driving it are pinned here: `maxLength` truncating a formatted paste
 *    before the sanitiser ran, and caret-pinning swallowing a select-all.
 * 2. **Submission stays manual, and the celebration is the server's word.**
 *    The sequence plays only after `/verify-otp` answers yes — never on the
 *    fourth digit — and the session is stored *before* it, so closing the tab
 *    mid-badge still leaves the customer signed in.
 * 3. **The social providers are untouched.** `completeLogin` is the one path
 *    every sign-in shares; the hold lives beside it, on the OTP path only.
 * 4. **The hold is the animation's length and no more**, and skippable — it is
 *    time added to every sign-in. The stylesheet's timeline and the constant
 *    are checked against each other rather than trusted to agree.
 */

import { register } from "node:module";
import { readFileSync } from "node:fs";
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Code with comments removed, for rules about code. The component's own
 * documentation quotes the attributes it keeps, and a rule that read prose
 * passed on the quote once already. (Naive on purpose: no `//` in a string.)
 */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The body of `name` — from its declaration to the next top-level function. */
const bodyOf = (source, name) => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  if (start === -1) return "";
  const next = source.slice(start + 1).search(/\n  (?:async )?function \w+\(/);
  return source.slice(start, next === -1 ? source.length : start + 1 + next);
};

const { OTP_LENGTH, sanitizeOtp, tileChanges, VERIFIED_HOLD_MS, VERIFIED_HOLD_REDUCED_MS } =
  await import(join(here, "../src/lib/otp.ts"));
const tiles = read("src/components/auth/OtpInput.tsx");
const tilesCode = stripComments(tiles);
const login = stripComments(read("src/components/auth/LoginPage.tsx"));
const flow = stripComments(read("src/hooks/useLoginFlow.ts"));
const css = read("src/app/globals.css");
const verify = bodyOf(flow, "verifyOtp");
const complete = bodyOf(flow, "completeLogin");
const social = bodyOf(flow, "runSocialLogin");

section("🔴 One real input, four pictures of it");
{
  check(
    "exactly one <input>",
    (tilesCode.match(/<input\b/g) ?? []).length === 1,
    "four inputs need hand-written focus jumping — where fast typing, paste and SMS autofill break",
  );
  check("🔴 SMS autofill is kept", /autoComplete="one-time-code"/.test(tilesCode));
  check("the numeric keypad is kept", /inputMode="numeric"/.test(tilesCode));
  check(
    "the tiles are hidden from screen readers, and the input is named",
    /aria-hidden="true"/.test(tilesCode) && /aria-label=\{label\}/.test(tilesCode),
  );
  check(
    "🔴 no maxLength on the input",
    !/maxLength=\{/.test(tilesCode),
    'the browser cuts a pasted "98-76" to "98-7" before sanitizeOtp runs — the code arrived as 987',
  );
  check(
    "🔴 a whole selection is not collapsed",
    /!wholeSelected && \(start !== end \|\| stop !== end\)/.test(tilesCode),
    "select-all then paste or delete replaced the code in the plain field; collapsing it appended instead",
  );
  check(
    "the component holds no copy of the code",
    !/useState\(\s*(value|""|'')/.test(tilesCode) && /onChange\(next\)/.test(tilesCode),
  );
  check(
    "the input stops taking input once the code is accepted",
    /disabled=\{disabled \|\| verified\}/.test(tilesCode),
  );
}

section("🔴 Submission stays manual; the celebration is the server's word");
{
  check(
    "the tiles never submit",
    !/verifyOtp|requestSubmit|onComplete/.test(tilesCode),
    "pressing Verify is still the customer's decision",
  );
  check(
    "Verify is still a button that calls verifyOtp",
    /onClick=\{\(\) => verifyOtp\(\)\}/.test(login),
  );
  check(
    "🔴 the verified moment starts only after the server says yes",
    /await verifyLoginOtp\([\s\S]*?setOtpVerified\(true\)/.test(verify) &&
      verify.indexOf("setOtpVerified(true)") > verify.indexOf("await verifyLoginOtp("),
    "a celebration on the fourth digit would congratulate a wrong code",
  );
  check(
    "🔴 the session is kept before the hold, not after it",
    verify.indexOf("storeAuthTokens(") > -1 &&
      verify.indexOf("storeAuthTokens(") < verify.indexOf("setOtpVerified(true)"),
    "closing the tab while the badge draws must still leave the customer signed in",
  );
  check(
    "then the page moves on through the shared path",
    verify.indexOf("await holdForVerifiedMoment()") < verify.indexOf("await completeLogin(response)") &&
      verify.indexOf("await holdForVerifiedMoment()") > verify.indexOf("setOtpVerified(true)"),
  );
  check(
    "🔴 the social providers do not hold",
    complete.length > 0 &&
      social.length > 0 &&
      !/holdForVerifiedMoment|setOtpVerified/.test(complete) &&
      !/holdForVerifiedMoment|setOtpVerified/.test(social),
    "`completeLogin` is the one path every sign-in shares — the hold lives beside it, on the OTP path only",
  );
  check(
    "a failure after success returns to the form",
    /catch \(error\) \{\s*setOtpVerified\(false\)/.test(verify),
    "otherwise the page would sit on the badge with no buttons",
  );
}

section("🔴 The hold is the animation's length, and nothing else");
{
  check(
    "it waits for the constant, or the reduced one",
    /reduced \? VERIFIED_HOLD_REDUCED_MS : VERIFIED_HOLD_MS/.test(flow) &&
      /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/.test(flow),
  );
  check(
    "🔴 there is no Continue button",
    !/continueAfterVerify|otpContinue/.test(login) && !/continueAfterVerify/.test(flow),
    "the owner's call (21 Sep 2026): the page moves on by itself, so a button would only repeat that",
  );
  // The timeline ends when its last line of copy has risen: the latest
  // per-line delay in the stylesheet (or none, for a single line) plus the
  // rise itself. Read from the CSS rather than assumed, so dropping or adding
  // a line moves the bound with it.
  const rise = Number((css.match(/\.otp-verified-copy > \* \{\s*animation: otp-rise (\d+)ms [^;]*? (\d+)ms both/) ?? [])[1]);
  const firstDelay = Number((css.match(/\.otp-verified-copy > \* \{\s*animation: otp-rise \d+ms [^;]*? (\d+)ms both/) ?? [])[1]);
  const lineDelays = [...css.matchAll(/\.otp-verified-copy > \*:nth-child\((\d+)\) \{\s*animation-delay: (\d+)ms/g)];
  const lastDelay = Math.max(firstDelay, ...lineDelays.map((m) => Number(m[2])));
  const lines = (login.match(/otp-verified-copy[\s\S]*?<\/div>/)?.[0].match(/<p\b/g) ?? []).length;
  check(
    "the stylesheet times exactly the lines the page renders",
    lines > 0 && lineDelays.length === lines - 1 && Math.max(...lineDelays.map((m) => Number(m[1]))) === lines,
    `${lines} lines rendered, ${lineDelays.length + 1} timed — a stale rule would stretch the hold for a line that is not there`,
  );
  check(
    "🔴 the hold outlasts the stylesheet's timeline",
    lastDelay > 0 && rise > 0 && lastDelay + rise <= VERIFIED_HOLD_MS,
    `timeline ends at ${lastDelay + rise}ms, hold is ${VERIFIED_HOLD_MS}ms — the page would leave mid-sentence`,
  );
  check(
    "🔴 …and by no more than a moment",
    VERIFIED_HOLD_MS - (lastDelay + rise) <= 300,
    `${VERIFIED_HOLD_MS - (lastDelay + rise)}ms of nothing after the last line, on every sign-in`,
  );
  check(
    "reduced motion is a shorter wait",
    VERIFIED_HOLD_REDUCED_MS > 0 && VERIFIED_HOLD_REDUCED_MS < VERIFIED_HOLD_MS,
  );
}

section("The page around it");
{
  check(
    "the login page renders the tiles, wired to the hook's state",
    /<OtpInput\b[\s\S]{0,160}value=\{otp\}[\s\S]{0,60}onChange=\{setOtp\}[\s\S]{0,120}verified=\{otpVerified\}/.test(
      login,
    ),
  );
  check("the old six-digit cap is gone", !/slice\(0, 6\)/.test(login));
  check("the hook still owns the code", /const \[otp, setOtp\] = useState\(""\)/.test(flow));
  check(
    "the result is announced",
    /role="status"[\s\S]{0,80}otp-verified-copy/.test(login),
    "the tiles and the badge are drawings; the words are what a screen reader gets",
  );
  check(
    "there is nothing to resend once it is accepted",
    /step === "otp" && !otpVerified/.test(login),
  );
  check(
    "🔴 an empty tile is visible before anything is typed",
    !/"border-border/.test(tilesCode) &&
      /"border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900"/.test(tilesCode),
    "`--border` is #edeeef — about 1.1:1 on the white card; four empty tiles in it were invisible (owner's screenshot, 21 Sep 2026)",
  );
  check(
    "the icon steps back without giving up its width",
    /otpVerified \? "opacity-0" : ""/.test(login),
    "unmounting it would slide the square sideways the moment it starts to form",
  );
}

section("The model, executed");
{
  check("the code is four digits", OTP_LENGTH === 4);
  check(
    "🔴 a formatted paste keeps every digit",
    sanitizeOtp("98-76") === "9876" && sanitizeOtp("Code: 1 2 3 4") === "1234",
  );
  check("letters are not digits", sanitizeOtp("abc") === "");
  check("more than four is cut to four", sanitizeOtp("123456") === "1234");
  check("nothing is nothing", sanitizeOtp(null) === "" && sanitizeOtp(undefined) === "");
  check("a digit fills one tile", same(tileChanges("", "1"), ["filled", null, null, null]));
  check("a backspace clears one", same(tileChanges("12", "1"), [null, "cleared", null, null]));
  check(
    "🔴 an unchanged value changes nothing",
    same(tileChanges("12", "12"), [null, null, null, null]),
    "a letter typed into the field must not replay a tile",
  );
  check("a paste fills every tile", same(tileChanges("", "9876"), ["filled", "filled", "filled", "filled"]));
  check("replacing a digit is a fill", same(tileChanges("1234", "1834"), [null, "filled", null, null]));
}

section("🔴 Typing never glitches");
{
  check(
    "each tile is keyed on its own version",
    /key=\{`\$\{index\}-\$\{tile\.version\}`\}/.test(tilesCode),
    "keyed on the whole value, every keystroke would restart every tile",
  );
  check("an untouched tile keeps its key", /if \(!change\) return tile;/.test(tilesCode));
  check("a keystroke that changes nothing changes nothing", /if \(next === value\) return;/.test(tilesCode));
  check(
    "nothing animates on first render",
    /const REST: TileMotion = \{ version: 0, change: null, batch: false \}/.test(tilesCode),
  );
  check(
    "the ring is erased only from a tile that was just filled",
    /justFilled \? \(\s*<svg/.test(tilesCode) && /className="otp-trace/.test(tilesCode),
  );
  check(
    "a paste staggers from the stylesheet, not from inline delays",
    /data-batch=/.test(tilesCode) &&
      !/animationDelay/.test(tilesCode) &&
      /\.otp-tile-frame:nth-child\(2\) > \.otp-tile\[data-batch="true"\]/.test(css),
  );
}

section("The verified moment, as the video has it");
{
  const keyframes = [
    "otp-digit", "otp-trace", "otp-caret", "otp-gather", "otp-tile-ok", "otp-link-x",
    "otp-link-y", "otp-links", "otp-badge", "otp-check", "otp-ring-inner", "otp-ring-outer",
    "otp-spark", "otp-rise",
  ];
  const missing = keyframes.filter((name) => !new RegExp(`@keyframes ${name} \\{`).test(css));
  check("every step has its keyframes", missing.length === 0, missing.join(", "));
  check(
    "🔴 the row becomes 8 0 / 4 2",
    /nth-child\(1\) \{\s*--otp-i: 0;\s*--otp-col: 0;\s*--otp-row: 0;/.test(css) &&
      /nth-child\(2\) \{\s*--otp-i: 1;\s*--otp-col: 0;\s*--otp-row: 1;/.test(css) &&
      /nth-child\(3\) \{\s*--otp-i: 2;\s*--otp-col: 1;\s*--otp-row: 0;/.test(css) &&
      /nth-child\(4\) \{\s*--otp-i: 3;\s*--otp-col: 1;\s*--otp-row: 1;/.test(css),
    "first and third digits on top, second and fourth below — the reference's order",
  );
  check(
    "the tiles tilt on the way into the square and spin on the way out",
    /@keyframes otp-gather[\s\S]{0,260}rotate\(var\(--otp-tilt\)\)/.test(css) &&
      /@keyframes otp-gather[\s\S]{0,700}rotate\(var\(--otp-spin\)\) scale\(0\.45\)/.test(css),
  );
  check(
    "the same four tiles run it — nothing is swapped in",
    /\.otp-stage\[data-verified="true"\] \.otp-tile-frame \{\s*animation: otp-gather/.test(css) &&
      /data-verified=\{verified \? "true" : undefined\}/.test(tilesCode),
  );
  check(
    "the links draw in the video's order: top, the sides, the bottom",
    (() => {
      const at = (cls) =>
        Number((css.match(new RegExp(`\\.${cls}[^{]*\\{\\s*animation: otp-link-[xy] \\d+ms ease-out (\\d+)ms`)) ?? [])[1]);
      const top = at("otp-link-top");
      const side = Number((css.match(/\.otp-link-right \{\s*animation: otp-link-y \d+ms ease-out (\d+)ms/) ?? [])[1]);
      const bottom = at("otp-link-bottom");
      return top > 0 && top < side && side < bottom;
    })(),
  );
  check(
    "green comes after the square is linked",
    (() => {
      const green = Number((css.match(/\.otp-tile \{\s*animation: otp-tile-ok \d+ms ease-out (\d+)ms/) ?? [])[1]);
      const lastLink = Number((css.match(/\.otp-link-bottom \{\s*animation: otp-link-x (\d+)ms ease-out (\d+)ms/) ?? [])[2]);
      return green > lastLink;
    })(),
  );
  check(
    "the badge appears as the square collapses, and the tick after the badge",
    (() => {
      const badge = Number((css.match(/\.otp-badge \{\s*animation: otp-badge \d+ms [^;]*? (\d+)ms both/) ?? [])[1]);
      const tick = Number((css.match(/\.otp-badge-check \{\s*animation: otp-check \d+ms ease-out (\d+)ms/) ?? [])[1]);
      return badge >= 1300 && badge < 1800 && tick > badge;
    })(),
  );
  check(
    "no overshoot anywhere in it",
    ![...css.matchAll(/animation: otp-[\w-]+ \d+ms cubic-bezier\(([^)]*)\)/g)].some(([, curve]) =>
      curve.split(",").map(Number).some((v, i) => (i === 1 || i === 3) && v > 1),
    ),
    "a y-value above 1 is a bounce; this is a sign-in form",
  );
}

section("🔴 Reduced motion shows where it ends, not how it got there");
{
  const block = (css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\/\* Typing[\s\S]*?\n\}/) ?? [""])[0];
  // Read from the selectors of the `animation: none` rules themselves. The
  // first version asked only whether each class appeared *somewhere* in the
  // block — and `.otp-tile-frame` also appears in the `visibility` rule, so
  // taking it off the off-switch went unnoticed. (Found by mutating this file.)
  const switchedOff = [...block.matchAll(/([^{}]+)\{\s*animation: none;\s*\}/g)]
    .map((m) => m[1])
    .join(",");
  const notOff = [
    "otp-digit-in", "otp-trace", "otp-caret", "otp-tile-frame", "otp-links", "otp-badge",
    "otp-badge-check", "otp-ring-inner", "otp-ring-outer", "otp-spark", "otp-verified-copy",
  ].filter((cls) => !new RegExp(`\\.${cls}\\b`).test(switchedOff));
  check("every OTP animation is switched off", notOff.length === 0, `still animated: ${notOff.join(", ")}`);
  check(
    "the tiles and links that would have folded away are hidden",
    /\.otp-tile-frame,\s*\.otp-stage\[data-verified="true"\] \.otp-links \{\s*visibility: hidden;/.test(block),
    "with the animation off, they would sit on top of the badge",
  );
  check(
    "the tick and the rings are drawn at rest",
    /\.otp-badge-check \{\s*stroke-dasharray: 1;\s*stroke-dashoffset: 0;/.test(css) &&
      /\.otp-ring-inner \{\s*opacity: 0\.35;/.test(css),
    "their resting state is what reduced motion shows",
  );
}

section("The guard is wired in");
{
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  check(
    "`verify:otp-input` is a script someone can run",
    typeof scripts["verify:otp-input"] === "string",
    "a guard nothing calls passes forever",
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
