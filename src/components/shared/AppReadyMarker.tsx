"use client";

import { useEffect } from "react";

/**
 * Tells the back-navigation guard in the root layout that the app started.
 *
 * Going Back can hand the browser an old copy of a page whose scripts no
 * longer load; it then sits on its first-paint placeholders forever. The guard
 * is an inline script, so it runs even then. It reloads once if this marker
 * has not appeared within a few seconds of a Back/Forward arrival.
 */
export default function AppReadyMarker() {
  useEffect(() => {
    document.documentElement.setAttribute("data-app-ready", "");
    try {
      sessionStorage.removeItem("deligo-bf-reload");
    } catch {}
  }, []);

  return null;
}
