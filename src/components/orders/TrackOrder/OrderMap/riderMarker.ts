/**
 * Builds the animated rider overlay: a pink chip with a motorcycle glyph and a
 * soft pulsing aura behind it. Positioned by HtmlOverlay; centered on the
 * rider's current point along the route.
 */

const MOTO_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/><path d="M5.5 17.5 9 11l3 3h3l1.5 3.5"/><path d="M9 11l2-3h3"/></svg>';

function posWrap(transform: string, child: HTMLElement): HTMLElement {
  const w = document.createElement("div");
  w.className = "deligo-scene-pos";
  w.style.transform = transform;
  w.appendChild(child);
  return w;
}

export function buildRiderMarker(): HTMLElement {
  const root = document.createElement("div");
  root.className = "deligo-mscene";
  root.setAttribute("data-scene", "rider");
  root.setAttribute("aria-hidden", "true"); // decorative; status is in the timeline

  const aura = document.createElement("div");
  aura.className = "deligo-pulse-ring deligo-rider-aura";
  root.appendChild(posWrap("translate(-50%, -50%)", aura));

  const chip = document.createElement("div");
  chip.className = "deligo-rider-chip";
  chip.innerHTML = MOTO_SVG;
  root.appendChild(posWrap("translate(-50%, -50%)", chip));

  return root;
}
