/**
 * Checks the backend assumptions the login code is built on.
 *
 *   node scripts/verify-auth-contract.mjs
 *
 * Every assertion here mirrors something `src/lib/auth.ts` or
 * `src/hooks/useLoginFlow.ts` relies on: an enum value, an error key it
 * branches on, a payload shape it sends. If the backend changes one of them the
 * app breaks quietly — a mapped error stops matching and the customer gets raw
 * API text, or a field starts being rejected and login fails outright. Neither
 * shows up in `tsc`, `eslint`, or the build.
 *
 * Plain Node, no dependencies, no test runner. Safe to run against the test
 * environment at any time: every request is designed to fail *before* the
 * backend sends anything to a real person.
 *
 * The one exception is the WhatsApp delivery check, which does reach the send
 * path. It is skipped unless you opt in:
 *
 *   VERIFY_WHATSAPP_SEND=1 node scripts/verify-auth-contract.mjs
 *
 * Do not opt in once BULKGATE_WHATSAPP_SENDER_ID is configured, unless
 * VERIFY_PHONE is a number you own — it would message a stranger.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    const file = readFileSync(join(here, "..", ".env"), "utf8");
    const match = file.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+)"?`, "m"));
    return match?.[1];
  } catch {
    return undefined;
  }
}

const BASE = readEnvValue("NEXT_PUBLIC_API_BASE_URL");
if (!BASE) {
  console.error("NEXT_PUBLIC_API_BASE_URL is not set, and no .env was found.");
  process.exit(2);
}

// A number that fails Portugal's format check, so validation rejects the
// request before any message is generated. Used for every schema-only probe.
const UNSENDABLE = "+3510000";
// Only used by the opt-in delivery check. Override with a number you own.
const VERIFY_PHONE = process.env.VERIFY_PHONE ?? "+351912345678";

let passed = 0;
let failed = 0;

async function post(path, body, headers = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON responses fail the assertion below on their own */
  }
  return { status: response.status, body: payload ?? {} };
}

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) {
      console.log(`        got: ${JSON.stringify(detail)}`);
    }
  }
}

/** Zod reports every field at once, so an unrelated error means ours passed. */
function onlyComplainsAbout(body, field) {
  const sources = body.errorSources ?? [];
  return sources.length > 0 && sources.every((s) => s.path === field);
}

function errorKeyOf(body) {
  return body?.err?.errorKey;
}

console.log(`\nVerifying auth contract against ${BASE}\n`);

// ── /auth/social-login ─────────────────────────────────────────────────────
console.log("POST /auth/social-login");
{
  const deviceDetails = {
    deviceId: "verify-script",
    deviceType: "desktop",
    deviceName: "MacIntel",
    fcmToken: "",
    // Sent by buildDeviceDetails() but absent from the written spec. If the
    // backend ever starts rejecting unknown fields, this catches it.
    isLoggedIn: true,
    userAgent: "verify-auth-contract",
  };

  const full = await post("/auth/social-login", {
    provider: "GOOGLE",
    token: "not.a.real.token",
    referralCode: "FRIEND123",
    deviceDetails,
    forceLogin: false,
  });
  check(
    "accepts the exact payload socialLogin() builds (referral + forceLogin + full deviceDetails)",
    full.status === 401 && errorKeyOf(full.body) === "INVALID_SOCIAL_TOKEN",
    full.body,
  );

  const facebook = await post("/auth/social-login", {
    provider: "FACEBOOK",
    token: "EAAnotreal",
    deviceDetails,
  });
  check(
    "FACEBOOK reaches provider verification too",
    facebook.status === 401 && errorKeyOf(facebook.body) === "INVALID_SOCIAL_TOKEN",
    facebook.body,
  );

  const badProvider = await post("/auth/social-login", {
    provider: "APPLE",
    token: "x",
    deviceDetails,
  });
  check(
    "provider enum is still exactly GOOGLE | FACEBOOK",
    JSON.stringify(badProvider.body).includes("'GOOGLE' | 'FACEBOOK'"),
    badProvider.body.errorSources,
  );

  const missing = await post("/auth/social-login", { provider: "GOOGLE" });
  check(
    "token and deviceDetails are both still required",
    missing.status === 400 &&
      JSON.stringify(missing.body).includes("token") &&
      JSON.stringify(missing.body).includes("deviceDetails"),
    missing.body.errorSources,
  );
}

// ── otpChannel ─────────────────────────────────────────────────────────────
console.log("\nPOST /auth/login-customer + /auth/resend-otp");
{
  for (const path of ["/auth/login-customer", "/auth/resend-otp"]) {
    const body =
      path === "/auth/resend-otp"
        ? { role: "CUSTOMER", contactNumber: UNSENDABLE, otpChannel: "TELEGRAM" }
        : { contactNumber: UNSENDABLE, otpChannel: "TELEGRAM" };
    const res = await post(path, body);
    check(
      `${path} otpChannel enum is still exactly SMS | WHATSAPP`,
      JSON.stringify(res.body).includes("'SMS' | 'WHATSAPP'"),
      res.body.errorSources,
    );
  }

  // sendLoginOtp() sends otpChannel alongside referralCode. If the backend ever
  // made them mutually exclusive, the referral would be silently lost.
  const combined = await post("/auth/login-customer", {
    contactNumber: UNSENDABLE,
    referralCode: "FRIEND123",
    otpChannel: "WHATSAPP",
  });
  check(
    "otpChannel and referralCode are accepted together",
    onlyComplainsAbout(combined.body, "contactNumber"),
    combined.body.errorSources,
  );

  const ptOnly = await post("/auth/login-customer", {
    contactNumber: "+12025550123",
  });
  check(
    "contactNumber is still Portugal-only (COUNTRY_OPTIONS must stay PT-only)",
    onlyComplainsAbout(ptOnly.body, "contactNumber"),
    ptOnly.body.errorSources,
  );
}

// ── WhatsApp delivery (opt-in) ─────────────────────────────────────────────
console.log("\nWhatsApp delivery");
if (process.env.VERIFY_WHATSAPP_SEND === "1") {
  const res = await post("/auth/login-customer", {
    contactNumber: VERIFY_PHONE,
    otpChannel: "WHATSAPP",
  });
  const key = errorKeyOf(res.body);
  if (key === "BULKGATE_CONFIGURATION_MISSING") {
    check(
      "pre-B4: the errorKey reportOtpError() maps to whatsappUnavailable",
      true,
    );
  } else {
    check(
      "post-B4: WhatsApp send accepted — reportOtpError()'s mapping is now dead code, review it",
      res.status === 200,
      res.body,
    );
  }
} else {
  console.log("  SKIP  delivery check (set VERIFY_WHATSAPP_SEND=1 — messages a real number)");
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
