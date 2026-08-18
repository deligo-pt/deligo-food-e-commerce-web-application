/**
 * A stand-in for the three React hooks `useOrderSearch` is built out of.
 *
 * Exists so the hook's central claim can be *measured* rather than asserted by
 * reading the code: **the search index is rebuilt once per orders list, not once
 * per keystroke.** That is the whole performance story of the orders search, and
 * "it looks right in the source" is exactly how it silently stops being true.
 *
 * This repo has no test runner, no jsdom and no react-test-renderer. What it
 * does have is a hook whose behaviour depends on nothing but memoization, so
 * reproducing memoization faithfully is enough: one slot per hook call in call
 * order, dependencies compared with `Object.is`, and a count of how many times
 * each slot's factory actually ran.
 *
 * Deliberately not a React mock. It stubs three hooks and nothing else, touches
 * no React internals, and imports nothing — so it cannot rot when React or Next
 * change. `scripts/order-search-resolve-hook.mjs` is what points `useOrderSearch`
 * at this file instead of the real React.
 */

let slots = [];
let cursor = 0;
let deferralPending = false;

export const harness = {
  /** Start a fresh component instance: forget every slot. */
  mount() {
    slots = [];
    cursor = 0;
    deferralPending = false;
  },
  /** Start a re-render of the current instance: rewind to the first slot. */
  beginRender() {
    cursor = 0;
  },
  /**
   * Make the next `useDeferredValue` return its PREVIOUS value, reproducing the
   * first frame of a React transition — the frame where the customer is still
   * looking at the results of the keystroke before this one.
   */
  lagNextDeferral() {
    deferralPending = true;
  },
  /** How many times slot `i`'s factory has run since `mount()`. */
  runs(i) {
    return slots[i]?.runs ?? 0;
  },
};

const sameDeps = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((dep, i) => Object.is(dep, b[i]));

function slot() {
  const i = cursor++;
  if (!slots[i]) slots[i] = { runs: 0, primed: false };
  return slots[i];
}

export function useMemo(factory, deps) {
  const s = slot();
  if (!s.primed || !sameDeps(s.deps, deps)) {
    s.value = factory();
    s.deps = deps;
    s.primed = true;
    s.runs++;
  }
  return s.value;
}

// React implements it on the same slot mechanism, and so does this: a
// `useCallback` consumes exactly one slot, like every other hook.
export function useCallback(fn, deps) {
  return useMemo(() => fn, deps);
}

export function useDeferredValue(value) {
  const s = slot();
  if (!s.primed) {
    s.primed = true;
    s.value = value;
    return value;
  }
  if (deferralPending) {
    deferralPending = false;
    return s.value;
  }
  s.value = value;
  return value;
}

// A default export as well, so a module that does `import React from "react"`
// fails on a missing *method* rather than on a missing default export — a much
// clearer message when this stub is stretched beyond what it covers.
const reactStub = { useMemo, useCallback, useDeferredValue };
export default reactStub;
