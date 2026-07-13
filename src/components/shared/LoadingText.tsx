"use client";

import { useTranslation } from "@/hooks/useTranslation";

// Tiny client wrapper so a Suspense fallback rendered by a Server Component can
// still show localized "Loading..." text. Keeps the parent page a Server
// Component (preserving route config like `export const dynamic`).
export default function LoadingText({
  tKey = "loading",
  className,
}: {
  tKey?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return <div className={className}>{t(tKey)}</div>;
}
