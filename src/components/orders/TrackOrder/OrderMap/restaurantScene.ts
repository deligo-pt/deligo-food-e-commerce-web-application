import type { SceneAnimation } from "./types";

/**
 * Builds the animated DOM for a restaurant-anchored scene (PENDING / ACCEPTED /
 * PREPARING / READY_FOR_PICKUP). Returns a zero-size root positioned on the
 * restaurant pin by `HtmlOverlay`; children place themselves relative to that
 * point via their own transforms so animation transforms never fight
 * positioning transforms.
 *
 * Animation classes (`deligo-*`) and looks are defined in globals.css and are
 * reduced-motion aware.
 */

const ICONS: Partial<Record<SceneAnimation, string>> = {
  // clock — waiting at the restaurant
  pending:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  // check — order accepted
  accepted:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  // pot — cooking / preparing
  preparing:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16"/><path d="M6 10v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"/><path d="M8 10V8"/><path d="M16 10V8"/></svg>',
  // bag — ready for pickup
  ready:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z"/><path d="M4 6h16"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
};

/** A positioning wrapper: places its child relative to the pin point. */
function posWrap(transform: string, child: HTMLElement): HTMLElement {
  const w = document.createElement("div");
  w.className = "deligo-scene-pos";
  w.style.transform = transform;
  w.appendChild(child);
  return w;
}

function ringEl(): HTMLElement {
  const ring = document.createElement("div");
  ring.className = "deligo-pulse-ring";
  return ring;
}

function badgeEl(iconSvg: string, animClass: string): HTMLElement {
  const anim = document.createElement("div");
  anim.className = animClass;
  const chip = document.createElement("div");
  chip.className = "deligo-scene-badge";
  chip.innerHTML = iconSvg;
  anim.appendChild(chip);
  return anim;
}

function steamEl(): HTMLElement {
  const col = document.createElement("div");
  col.className = "deligo-steam-col";
  [0, 0.5, 1].forEach((delay) => {
    const wisp = document.createElement("div");
    wisp.className = "deligo-steam-wisp deligo-steam";
    wisp.style.animationDelay = `${delay}s`;
    col.appendChild(wisp);
  });
  return col;
}

export function buildRestaurantScene(animation: SceneAnimation): HTMLElement {
  const root = document.createElement("div");
  root.className = "deligo-mscene";
  root.setAttribute("data-scene", animation);
  root.setAttribute("aria-hidden", "true"); // decorative; status is in the timeline

  // Pulse halo behind the pin.
  root.appendChild(posWrap("translate(-50%, -50%)", ringEl()));

  // Floating badge above the pin. ACCEPTED pops once (burst); others hover (bob).
  const icon = ICONS[animation] ?? ICONS.pending!;
  const badgeAnim = animation === "accepted" ? "deligo-burst" : "deligo-bob";
  root.appendChild(
    posWrap("translate(-50%, calc(-50% - 30px))", badgeEl(icon, badgeAnim)),
  );

  // Cooking scene adds rising steam above the badge.
  if (animation === "preparing") {
    root.appendChild(posWrap("translate(-50%, calc(-50% - 52px))", steamEl()));
  }

  return root;
}
