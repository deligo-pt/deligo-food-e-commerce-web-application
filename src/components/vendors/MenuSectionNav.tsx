"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sectionDomId } from "./MenuSectionGroup";

interface MenuSectionNavProps {
  sections: { id: string; name: string }[];
}

/**
 * The underline tab bar over a menu's sections.
 *
 * ## 🔴 It jumps, it does not filter
 *
 * Every section of the selected menu is on the page at once, stacked under its
 * own heading; these tabs scroll to one. That is what the reference layout
 * shows — a tab bar above a list that already contains every section — and it
 * is what every delivery app does, because a customer scanning a menu wants to
 * scroll it, not to click through it one heading at a time.
 *
 * It is also the reading that survives the data. Sections with no items exist;
 * as a jump target an empty section is a heading you scroll past, whereas as a
 * filter it would be a tab that leads to a blank page.
 *
 * ## The active tab follows the scroll
 *
 * An `IntersectionObserver` watches the headings rather than a scroll listener
 * computing offsets on every frame. `rootMargin` pulls the top of the detection
 * band below the app's `sticky top-0` header and the bottom of it up past the
 * fold, so the active tab is the heading nearest the top of the readable area —
 * not whichever heading is merely somewhere on screen.
 *
 * Clicking a tab sets the active state immediately rather than waiting for the
 * observer to catch up mid-smooth-scroll, which would otherwise flicker through
 * every heading the page travels past on its way.
 */
export default function MenuSectionNav({ sections }: MenuSectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // While a click-driven smooth scroll is in flight the observer is reporting
  // headings the page is only passing through. This suppresses it until the
  // scroll settles.
  const suppressUntilRef = useRef(0);

  // Derived, not stored-and-reset in an effect. A section can disappear under
  // this component — the vendor edits the menu, the query refetches — and an
  // effect that corrected the stored id afterwards would render one frame
  // pointing at a heading that is not on the page. Falling back to the first
  // section during render means there is no such frame. (Switching menus
  // remounts this component entirely; the caller keys it by menu id.)
  const resolvedActiveId =
    activeId && sections.some((section) => section.id === activeId)
      ? activeId
      : (sections[0]?.id ?? null);

  useEffect(() => {
    if (sections.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressUntilRef.current) return;
        // The topmost heading currently inside the detection band. Picked by
        // scanning rather than by sorting, so that no file in this feature
        // sorts anything at all — the ordering of menus, sections and products
        // belongs to the backend, and a blanket "nothing here reorders" rule is
        // only worth having if there is no exception to argue about.
        let top: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!top || entry.boundingClientRect.top < top.boundingClientRect.top) {
            top = entry;
          }
        }
        if (!top) return;
        const topId = top.target.id;
        const match = sections.find((s) => sectionDomId(s.id) === topId);
        if (match) setActiveId(match.id);
      },
      // Top: clear of the sticky header. Bottom: only the upper 40% of the
      // viewport counts, so a heading is "active" when it is being read, not
      // when it first peeks in from the bottom.
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );

    const nodes = sections
      .map((s) => document.getElementById(sectionDomId(s.id)))
      .filter((n): n is HTMLElement => !!n);
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections]);

  const jumpTo = useCallback((sectionId: string) => {
    setActiveId(sectionId);
    suppressUntilRef.current = Date.now() + 700;
    document
      .getElementById(sectionDomId(sectionId))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (sections.length === 0) return null;

  return (
    <nav className="mb-6 overflow-x-auto border-b border-gray-200 dark:border-neutral-800">
      <div className="flex min-w-max gap-6">
        {sections.map((section) => {
          const active = section.id === resolvedActiveId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => jumpTo(section.id)}
              aria-current={active ? "true" : undefined}
              className={`shrink-0 border-b-2 pb-2 text-sm font-semibold transition ${
                active
                  ? "border-pink-600 text-pink-600 dark:text-pink-400"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              {section.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
