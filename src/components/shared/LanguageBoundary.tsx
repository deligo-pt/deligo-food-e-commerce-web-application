"use client";

// Previously this remounted its whole subtree on every language change (via a
// Fragment whose `key` was the language), which forced every data-fetching
// effect to re-run — but also reset every component back into its loading
// state, so switching language flashed the entire page through skeletons.
//
// Now language changes re-fetch in place instead: components that render
// server-localized data depend on `langVersion` (from useTranslation) in their
// fetch effect and keep the previous data visible while the new-language
// response loads. This wrapper is intentionally transparent — kept only so the
// layout's structure and import stay stable.
export default function LanguageBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
