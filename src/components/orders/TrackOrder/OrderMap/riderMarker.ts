/**
 * Builds the animated rider overlay: the DeliGo rider seen from above (cut out
 * of `deligo_ride.gif`, 13 Oct 2026) with a soft pulsing aura behind it and
 * a small "DeliGo" tag above it.
 * Positioned by HtmlOverlay; centered on the rider's current point along the
 * route. The picture faces up, so turning it by the route's heading makes the
 * rider face the way they are going.
 */

const RIDER_IMAGE = "/deligo_rider.png";
const RIDER_SIZE = 56;
/** From the rider's centre up to the tip of the tag: clear of the rider at any turn. */
const LABEL_GAP = 34;

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

  const rider = document.createElement("img");
  rider.className = "deligo-rider-img";
  rider.src = RIDER_IMAGE;
  rider.alt = "";
  rider.draggable = false;
  // Set here as well as in the stylesheet: the map's own image rules must not
  // be able to let the picture show at its full size.
  rider.width = RIDER_SIZE;
  rider.height = RIDER_SIZE;
  rider.style.width = `${RIDER_SIZE}px`;
  rider.style.height = `${RIDER_SIZE}px`;
  root.appendChild(posWrap("translate(-50%, -50%)", rider));

  // The "DeliGo" tag above the rider, as in the gif. It is its own piece so it
  // stays upright while the rider turns beneath it.
  const label = document.createElement("div");
  label.className = "deligo-rider-label";
  const dot = document.createElement("span");
  dot.className = "deligo-rider-label-dot";
  label.appendChild(dot);
  label.appendChild(document.createTextNode("DeliGo"));
  root.appendChild(posWrap(`translate(-50%, calc(-100% - ${LABEL_GAP}px))`, label));

  return root;
}

/**
 * Turn the rider to a compass heading (degrees clockwise from north). The
 * turn takes the short way round, so going from 350° to 10° is a 20° turn and
 * not a spin back through south.
 */
export function setRiderHeading(marker: HTMLElement, heading: number): void {
  const rider = marker.querySelector<HTMLElement>(".deligo-rider-img");
  if (!rider || !Number.isFinite(heading)) return;
  const shown = Number(rider.dataset.turn);
  if (!Number.isFinite(shown)) {
    rider.dataset.turn = String(heading);
    rider.style.transform = `rotate(${heading}deg)`;
    return;
  }
  const delta = ((((heading - shown) % 360) + 540) % 360) - 180;
  if (Math.abs(delta) < 0.5) return;
  const turn = shown + delta;
  rider.dataset.turn = String(turn);
  rider.style.transform = `rotate(${turn}deg)`;
}
