"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/* ---------------------------------------------------------------------------
   Motion hooks — Plan.md Phase 6.

   The CSS primitives in `globals.css` cover everything that can be expressed
   as "this element just appeared" or "this element is being pressed". Two
   things cannot: knowing that an element has scrolled into view, and stopping
   a timer that moves the page on its own. Those are here.
   --------------------------------------------------------------------------- */

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION).matches;
}

/** The server has no media queries, and "animate" is the safe assumption. */
function reducedMotionOnServer(): boolean {
  return false;
}

/**
 * `true` when the viewer has asked their system for less motion.
 *
 * Reactive, unlike the one-shot check in `useCategoryScrollSpy` — that one is
 * read at the moment of a scroll and is correct as a plain function call. This
 * one gates a timer that is already running, so it has to re-render when the
 * setting changes rather than only when the next scroll happens.
 *
 * `useSyncExternalStore` rather than state-plus-effect: the server snapshot is
 * always `false`, so the markup matches, and React re-renders once after
 * hydration if the real answer differs. Writing it with `useEffect` would trip
 * `react-hooks/set-state-in-effect` and paint one frame of the wrong answer.
 *
 * Most motion in this app does **not** need this hook — the CSS primitives
 * carry their own `prefers-reduced-motion` opt-out and switch themselves off.
 * Reach for it only when the thing to stop is JavaScript.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    readReducedMotion,
    reducedMotionOnServer,
  );
}

/**
 * Reveals a `.reveal-group` container the first time it scrolls into view.
 *
 * Returns the ref to put on the container and the value for its
 * `data-revealed` attribute. The component renders that attribute itself —
 * this hook never writes to the DOM — so a re-render cannot quietly undo the
 * reveal, which is exactly what would happen if the attribute were set
 * imperatively while the JSX kept claiming "false".
 *
 * ```tsx
 * const [gridRef, revealed] = useRevealOnScroll<HTMLDivElement>();
 * <div ref={gridRef} data-revealed={revealed} className="reveal-group grid …">
 * ```
 *
 * ## A callback ref, not a ref object
 *
 * The containers this watches are inside a `if (loading) return <skeleton/>`
 * branch, so the element does not exist on the render that runs this hook. A
 * `useRef` object would be `null` when the effect fired and would never fire
 * again — the ref changing is not a dependency. A callback ref goes through
 * state, so the observer attaches on the render the grid actually appears.
 *
 * ## Reduced motion is not handled here, on purpose
 *
 * The media query in `globals.css` forces every child of a `.reveal-group`
 * visible whatever this hook decides, so there is nothing to branch on. The
 * observer still runs and still flips the attribute; the animation it would
 * have triggered is already `none`. One less thing to keep in step.
 *
 * ## And neither is the missing-observer case
 *
 * If `IntersectionObserver` is absent the container reveals itself on the next
 * frame rather than staying hidden. A browser old enough to lack it should see
 * a plain page, not an empty one.
 */
export function useRevealOnScroll<T extends HTMLElement>(): [
  (node: T | null) => void,
  "true" | "false",
] {
  const [node, setNode] = useState<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!node || revealed) return;

    if (typeof IntersectionObserver === "undefined") {
      // Revealed on the next frame rather than left hidden. The state change
      // is deferred out of the effect body on purpose: setting it inline is
      // both a lint error and a second render before the first paint.
      const frame = requestAnimationFrame(() => setRevealed(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Fires once. The observer disconnects itself rather than staying
        // subscribed for a re-entry that must not re-animate anything.
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      // A tenth of the viewport, so a grid reveals as it arrives rather than
      // the instant its first pixel crosses the edge.
      { rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, revealed]);

  return [setNode, revealed ? "true" : "false"];
}
