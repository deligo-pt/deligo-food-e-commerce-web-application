"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { categoryDomId } from "@/lib/categoryModel";

/** The minimum a group has to be for this hook to navigate to it. */
export interface ScrollSpyGroup {
  id: string;
}

export interface CategoryScrollSpy {
  /** The group currently in view. `null` only when there are no groups. */
  activeId: string | null;
  /** Scroll that group's heading into the open, below the header. */
  selectGroup: (groupId: string) => void;
  /** Measured height of the app header, for anything that sticks below it. */
  headerHeight: number;
}

/** `true` when the viewer has asked for less motion. Safe before hydration. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tracks which category heading is in view, and scrolls to one on demand.
 *
 * ## Why this is a hook and not two components' worth of copy
 *
 * The vendor page shows categories two ways — a sticky pill row on narrow
 * screens, a sidebar list from `lg` up. Both highlight the group in view and
 * both scroll to a heading on click. Implemented twice they would drift, and
 * the drift would be invisible: two observers with slightly different bands
 * disagree only at the boundary, on one breakpoint, while scrolling.
 *
 * So the page calls this once and hands `activeId` and `selectGroup` to both
 * views. One observer, one answer, and the two can never disagree because there
 * is only one of them.
 *
 * ## 🔴 The active id is derived, never stored by an effect
 *
 * `visibleId` is what the observer last saw; `activeId` is computed during
 * render as "that, if it is still a group, else the first group". Resetting it
 * from an effect instead means that when a group disappears — a language
 * switch, a refetch returning fewer products — one frame renders pointing at a
 * heading that is not on the page, and that frame's scroll target is `null`.
 * eslint's `react-hooks/set-state-in-effect` flags the effect form; this is the
 * shape that satisfies it and the reason to keep it.
 *
 * `setVisibleId` is called only from the observer callback and from
 * `selectGroup` — both events, neither an effect body.
 *
 * ## What `overlayRef` is for
 *
 * Anything sticky that sits *over* the content and would cover a heading the
 * page just scrolled to. On narrow screens that is the pill row; from `lg` up
 * the pill row is `display: none`, so its `offsetHeight` is `0` and the same
 * arithmetic gives the desktop answer without a branch. The sidebar is never
 * passed here — it sits beside the content, not above it.
 */
export function useCategoryScrollSpy(
  groups: readonly ScrollSpyGroup[],
  overlayRef?: RefObject<HTMLElement | null>,
): CategoryScrollSpy {
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  // Which headings the observer currently reports as in view. A ref, not state:
  // it changes on every scroll frame and only the derived winner is rendered.
  const intersecting = useRef(new Set<string>());

  // Re-register when the *set* of groups changes, not when the array identity
  // does; the page rebuilds this list on every products render.
  const groupKey = groups.map((group) => group.id).join("|");

  // ---------------------------------------------------------------------------
  // 🔴 Where the sticky things come to rest.
  //
  // The app header is `sticky top-0 z-50`. Anything that sticks at `top-0` with
  // a lower z-index does not sit under it — it slides *behind* it and vanishes,
  // which is only visible by scrolling.
  //
  // Its height is measured rather than written down. The header is
  // `px-4 py-3 lg:px-16 lg:py-4` around content that changes with breakpoint and
  // login state, so any constant would be right at one viewport and wrong at the
  // others. `ResizeObserver` fires once on `observe()`, so the initial value
  // arrives through the callback and never through an effect body.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    // The app header is the one that is actually pinned. Preferring a
    // sticky/fixed header over "the first `<header>` in the document" keeps this
    // correct if another header — the support chat's, say — ever mounts ahead of
    // it, while still falling back so a missed computed style cannot leave the
    // offset at zero.
    const headers = Array.from(document.querySelectorAll("header"));
    const header =
      headers.find((node) => {
        const position = getComputedStyle(node).position;
        return position === "sticky" || position === "fixed";
      }) ?? headers[0];
    if (!header) return;

    const observer = new ResizeObserver(([entry]) => {
      // 🔴 NOT `contentRect`. That is the *content* box, so it omits the
      // header's own `py-3 lg:py-4` — 24px, or 32px from `lg` up. Sticking at
      // that height parks everything 32px too high and the header covers the
      // top half of the row, which is exactly what shipped once already.
      const borderBox = Array.isArray(entry.borderBoxSize)
        ? entry.borderBoxSize[0]?.blockSize
        : undefined;
      const height = borderBox ?? entry.target.getBoundingClientRect().height;
      setHeaderHeight(Math.round(height));
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Everything the page has to scroll past to put a heading in the open. Read
  // from the ref at call time — never during render, where a ref may be stale.
  const measureScrollOffset = useCallback(
    () => headerHeight + (overlayRef?.current?.offsetHeight ?? 0) + 12,
    [headerHeight, overlayRef],
  );

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const ids = groupKey ? groupKey.split("|") : [];

    // The id is known at lookup time, so it is remembered here rather than read
    // back off the element. That keeps the heading's markup its own component's
    // business — it needs an `id`, and no data-attribute contract.
    const nodeIds = new Map<Element, string>();
    for (const id of ids) {
      const node = document.getElementById(categoryDomId(id));
      if (node) nodeIds.set(node, id);
    }

    // Until the headings mount there is nothing to observe, and the derived
    // fallback keeps the first group active.
    if (nodeIds.size === 0) return;

    const seen = intersecting.current;
    seen.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = nodeIds.get(entry.target);
          if (!id) continue;
          if (entry.isIntersecting) seen.add(id);
          else seen.delete(id);
        }
        // The topmost heading still in the band wins, so scrolling up and
        // scrolling down agree on which category you are in.
        const winner = ids.find((id) => seen.has(id));
        if (winner) setVisibleId(winner);
      },
      {
        // A band just under whatever is pinned above the content, so a pill
        // lights up the moment its heading actually appears rather than a
        // guessed distance later.
        rootMargin: `-${measureScrollOffset()}px 0px -65% 0px`,
        threshold: 0,
      },
    );

    nodeIds.forEach((_id, node) => observer.observe(node));
    return () => {
      observer.disconnect();
      seen.clear();
    };
  }, [groupKey, measureScrollOffset]);

  // Derived, not stored. See the note above.
  const activeId =
    visibleId && groups.some((group) => group.id === visibleId)
      ? visibleId
      : (groups[0]?.id ?? null);

  const selectGroup = useCallback(
    (groupId: string) => {
      const heading = document.getElementById(categoryDomId(groupId));
      if (!heading) return;

      // Optimistic: the control responds on the click rather than waiting for
      // the scroll to finish and the observer to fire. The observer corrects it
      // a frame later if the scroll lands somewhere else.
      setVisibleId(groupId);

      // `scrollIntoView({ block: "start" })` puts the heading at the very top of
      // the viewport, which is behind the header and anything pinned under it.
      // The heading's `scroll-mt` covers native anchor jumps; here the exact
      // measured offset is available, so the arithmetic is done rather than
      // approximated.
      const top =
        heading.getBoundingClientRect().top + window.scrollY - measureScrollOffset();
      window.scrollTo({
        top: Math.max(0, top),
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [measureScrollOffset],
  );

  return { activeId, selectGroup, headerHeight };
}
