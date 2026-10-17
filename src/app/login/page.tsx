import type { Metadata } from "next";

import LoginPage from "../../components/auth/LoginPage";

export const metadata: Metadata = {
  title: "DeliGo | Login",
  description: "Login or create your DeliGo account.",
};

/**
 * `?ref=CODE` — the link a customer shares from Refer & Earn — fills the
 * referral field in. Read on the server and handed down, so the first paint
 * already shows it (no hydration mismatch, no Suspense boundary needed).
 * Only a code's characters are kept; anything else is dropped.
 */
export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await searchParams;
  const raw = Array.isArray(ref) ? ref[0] : ref;
  const referralCode = (raw ?? "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 32);
  return <LoginPage initialReferralCode={referralCode} />;
}