/**
 * The customer side of the backend's security update (17 Nov 2026).
 *
 *   pnpm verify:otp-errors
 *
 * No token, no network. What the backend changed, and what this app does:
 *
 * - 60 s between sends, 10 per day → "Resend" opens after 60 s, not 5 min,
 *   and a 429's `Retry-After` holds it shut for exactly that long.
 * - `POST /auth/resend-otp` → resend uses it (always a generic 200).
 * - 5 wrong codes → 429 OTP_ATTEMPTS_EXCEEDED, 15 min → the code boxes and
 *   Verify close until then, with the time to come back.
 * - 502 OTP_DELIVERY_FAILED, 400 …COUNTRY_NOT_SUPPORTED → our own words.
 * - Google/Facebook with an email that has an account → 409
 *   SOCIAL_LINK_VERIFICATION_REQUIRED → a code step, finished with
 *   `POST /auth/social-login/link`.
 * - Web gets the refresh token only as an httpOnly cookie → not read, not
 *   stored (this app never refreshed a session).
 *
 * Measured on the test API the same day: the country rule answers a Zod 400
 * with `params.messageKey`; the per-IP limiter answers 429
 * RATE_LIMIT_EXCEEDED with `Retry-After: 30`. The lockout and the link answer
 * could not be produced without sending a real code, so their keys are the
 * backend notes' own.
 */

import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

register("./ts-resolve-hook.mjs", import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(join(here, "..", file), "utf8");

const { otpErrorMessageKey } = await import(join(here, "../src/lib/otpErrors.ts"));
const { OTP_RESEND_COOLDOWN_MS, OTP_LOCKOUT_MS, formatClockTime } = await import(join(here, "../src/lib/otp.ts"));

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

const auth = read("src/lib/auth.ts");
const cookies = read("src/lib/authCookies.ts");
const flow = read("src/hooks/useLoginFlow.ts");
const page = read("src/components/auth/LoginPage.tsx");
const phoneCard = read("src/components/cart/VerifiedPhoneCard.tsx");
const editProfile = read("src/components/profile/editProfileFormPage.tsx");
const en = read("src/assets/translations/en.ts");
const pt = read("src/assets/translations/pt.ts");

section("Timings match the server");
check("🔴 resend opens after 60 s (the server's cooldown), not 5 minutes", OTP_RESEND_COOLDOWN_MS === 60_000, OTP_RESEND_COOLDOWN_MS);
check("the lockout lasts 15 minutes when the server gives no time", OTP_LOCKOUT_MS === 15 * 60_000);
check("the come-back time reads HH:MM", formatClockTime(new Date(2026, 10, 17, 9, 5).getTime()) === "09:05");
check(
  "a 429's Retry-After is kept and holds Resend shut that long",
  /retryAfterSeconds: axios\.isAxiosError\(error\)[\s\S]{0,80}retry-after/.test(auth) &&
    /statusCode === 429 && error\.retryAfterSeconds/.test(flow),
);

section("Our own words for the codes that need them");
check("502 OTP_DELIVERY_FAILED", otpErrorMessageKey("OTP_DELIVERY_FAILED") === "otpErrorDeliveryFailed");
check("429 OTP_ATTEMPTS_EXCEEDED", otpErrorMessageKey("OTP_ATTEMPTS_EXCEEDED") === "otpErrorAttemptsExceededShort");
check(
  "400 non-Portuguese number",
  otpErrorMessageKey("VALIDATION_CONTACT_NUMBER_COUNTRY_NOT_SUPPORTED") === "loginErrorPhoneCountry",
);
check(
  "anything else keeps the server's localized text (e.g. RATE_LIMIT_EXCEEDED's \"try again after 30 seconds\")",
  otpErrorMessageKey("RATE_LIMIT_EXCEEDED") === null && otpErrorMessageKey(undefined) === null,
);
const keys = [
  "otpErrorDeliveryFailed", "otpErrorAttemptsExceeded", "otpErrorAttemptsExceededShort", "loginErrorPhoneCountry",
  "socialLinkTitle", "socialLinkSubtitle", "socialLinkHint", "socialLinkHintNoEmail", "socialLinkVerify", "socialLinkCodeSent",
];
const missing = keys.filter((k) => !new RegExp(`^  ${k}:`, "m").test(en) || !new RegExp(`^  ${k}:`, "m").test(pt));
check("every new line is in English and Portuguese", missing.length === 0, missing.join(", "));
check("checkout's Verify phone card uses the same words", /otpErrorToast\(err, t, "Failed to send OTP"\)/.test(phoneCard));
check(
  "so does Edit Profile (email and mobile)",
  (editProfile.match(/otpErrorToast\(err, t,/g) ?? []).length === 4,
);

section("Too many wrong codes pauses sign-in");
check(
  "🔴 OTP_ATTEMPTS_EXCEEDED on Verify locks the address",
  /errorKey === OTP_ATTEMPTS_EXCEEDED\)[\s\S]{0,200}lockVerify\(/.test(flow),
);
check("the lock is kept across a reload, per address", /deligo-otp-locked:/.test(flow) && /restoreVerifyLock\(identifier\)/.test(flow));
check(
  "the code boxes and Verify are closed while it lasts",
  /disabled=\{isVerifyingOtp \|\| verifyLocked\}[\s\S]{0,40}verified=\{otpVerified\}/.test(page) &&
    (page.match(/disabled=\{isVerifyingOtp \|\| verifyLocked\}/g) ?? []).length === 2,
);
check("it lifts by itself when the time is up", /setVerifyLockedUntil\(0\);\s*setErrorMessage\(""\);/.test(flow));

section("Resend uses the resend endpoint");
check(
  "🔴 POST /auth/resend-otp with the address and role CUSTOMER",
  /"\/auth\/resend-otp", \{ \.\.\.address, role: "CUSTOMER" \}/.test(auth),
);
check("the login flow's Resend calls it", /await resendLoginOtp\(loginIdentifier\)/.test(flow));
check("the first send still uses login-customer", /await sendLoginOtp\(identifier\)/.test(flow));

section("Google/Facebook with an email that already has an account");
check("🔴 the 409 opens the link step instead of failing", /SOCIAL_LINK_VERIFICATION_REQUIRED\) \{\s*startSocialLink\(/.test(flow));
check(
  "the code is sent to POST /auth/social-login/link with provider, token, otp, deviceDetails",
  /"\/auth\/social-login\/link"/.test(auth) &&
    /linkSocialAccount\(\{\s*provider: socialLink\.provider,\s*token: socialLink\.token,\s*otp: trimmedOtp,\s*deviceDetails,\s*\}\)/.test(flow),
);
check("…and nothing else (no forceLogin: the strict schemas refuse unknown keys)", !/linkSocialAccount\(\{[^}]*forceLogin/.test(flow));
check("a resend asks the same sign-in again; its 409 is the success", /async function resendLinkCode[\s\S]{0,900}SOCIAL_LINK_VERIFICATION_REQUIRED[\s\S]{0,80}socialLinkCodeSent/.test(flow));
check("Cancel drops the held provider token", /function backToCredentials\(\)[\s\S]{0,300}setSocialLink\(null\)/.test(flow));
check(
  "the page words it: title, no Mobile/Email tabs, Verify & link, Cancel",
  /withProvider\("socialLinkTitle"\)/.test(page) && /socialLink \? "hidden" : ""/.test(page) &&
    /withProvider\("socialLinkVerify"\)/.test(page) && /socialLink \? t\("cancel"\)/.test(page),
);

section("The refresh token is no longer read or kept");
check("🔴 a sign-in keeps the access token only", /data: \{ accessToken: t\.accessToken \}/.test(auth) && !/refreshToken: isNonEmptyString/.test(auth));
check(
  "storeAuthTokens takes one token and clears the old refresh cookie",
  /export function storeAuthTokens\(accessToken: string\)/.test(cookies) &&
    /Cookies\.remove\(REFRESH_TOKEN_COOKIE, \{ path: "\/" \}\);\s*announceAuthChange\(\);\s*\}/.test(cookies),
);
check("no caller passes a refresh token any more", !/refreshToken/.test(flow));

section("The guard is wired in");
{
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  check("`verify:otp-errors` is a script someone can run", typeof scripts["verify:otp-errors"] === "string");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
