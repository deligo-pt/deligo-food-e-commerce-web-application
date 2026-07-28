import type { SceneAnimation } from "./types";

/**
 * Builds the animated DOM for the customer-anchored arrival scene (DELIVERED):
 * a berry celebratory halo behind the customer pin and a check badge that drops
 * in and settles above it. Positioned by `HtmlOverlay` at the delivery point;
 * children place themselves via their own transforms so animation transforms
 * never fight positioning transforms.
 *
 * Animation classes (`deligo-*`) live in globals.css and are reduced-motion
 * aware.
 */

const CHECK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

/** A positioning wrapper: places its child relative to the pin point. */
function posWrap(transform: string, child: HTMLElement): HTMLElement {
  const w = document.createElement("div");
  w.className = "deligo-scene-pos";
  w.style.transform = transform;
  w.appendChild(child);
  return w;
}

export function buildCustomerScene(animation: SceneAnimation): HTMLElement {
  const root = document.createElement("div");
  root.className = "deligo-mscene";
  root.setAttribute("data-scene", animation);
  root.setAttribute("aria-hidden", "true"); // decorative; status is in the timeline

  // Berry celebratory halo behind the customer pin (on-theme customer accent).
  const ring = document.createElement("div");
  ring.className = "deligo-pulse-ring deligo-ring-customer";
  root.appendChild(posWrap("translate(-50%, -50%)", ring));

  // Check badge that drops in and settles above the pin.
  const anim = document.createElement("div");
  anim.className = "deligo-ring-drop";
  const chip = document.createElement("div");
  chip.className = "deligo-scene-badge deligo-badge-delivered";
  chip.innerHTML = CHECK_SVG;
  anim.appendChild(chip);
  root.appendChild(posWrap("translate(-50%, calc(-50% - 30px))", anim));

  return root;
}
