"use client";

import { useReportWebVitals } from "next/web-vitals";

// Phase 0 baseline instrumentation. Logs Core Web Vitals (LCP / INP / CLS,
// plus FCP / TTFB) in development so we can measure before/after each
// optimization phase. In production this is where a RUM/analytics beacon would
// be wired up (Phase 9) — kept as a no-op there for now.
export default function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[web-vitals] ${metric.name}: ${Math.round(metric.value)}${
          metric.name === "CLS" ? "" : "ms"
        }`,
      );
      return;
    }
    // TODO(Phase 9): POST `metric` to an analytics/RUM endpoint.
  });

  return null;
}
