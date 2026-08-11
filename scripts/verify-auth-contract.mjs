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

// ── OTP request shape ──────────────────────────────────────────────────────
console.log("\nPOST /auth/login-customer");
{
  // sendLoginOtp() sends referralCode alongside the identifier. If the backend
  // ever made them mutually exclusive, the referral would be silently lost.
  const combined = await post("/auth/login-customer", {
    contactNumber: UNSENDABLE,
    referralCode: "FRIEND123",
  });
  check(
    "referralCode is accepted alongside contactNumber",
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

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
