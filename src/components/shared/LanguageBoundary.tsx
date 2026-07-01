"use client";

import { Fragment } from "react";
import { useStore } from "@/stores/translationStore";

// Remounts its children whenever the language changes. Because the Fragment's
// key changes, React unmounts and remounts the subtree, so every component's
// data-fetching effect re-runs and dynamic data comes back in the new language.
export default function LanguageBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = useStore((state) => state.lang);

  return <Fragment key={lang}>{children}</Fragment>;
}
