/**
 * Whether this tab is in view, for `useSyncExternalStore`. The rider chat
 * marks messages read only when the customer can actually see them.
 */
export function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

export function pageIsVisible() {
  return document.visibilityState === "visible";
}
