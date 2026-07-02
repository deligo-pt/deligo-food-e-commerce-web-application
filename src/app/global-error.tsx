"use client";

import { useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";

// Root-level error boundary. This replaces the root layout when the layout itself
// (or something it renders) throws, so it must render its own <html>/<body> and
// cannot rely on the app's global CSS — hence the inline styles. See Issue.md #13.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={i18n.language}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f2f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "2rem",
          color: "#191c1d",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          {t("somethingWentWrong")}
        </h1>
        <p style={{ maxWidth: 420, color: "#5a4044", marginTop: "0.5rem" }}>
          {t("criticalError")}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "9999px",
            border: "none",
            backgroundColor: "#b0004a",
            color: "#fff",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("tryAgain")}
        </button>
      </body>
    </html>
  );
}
