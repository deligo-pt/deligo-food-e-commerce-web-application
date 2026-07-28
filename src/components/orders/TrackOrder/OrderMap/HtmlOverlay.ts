/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LatLng } from "./types";

/**
 * Handle for an HTML overlay mounted on a Google map. Lets callers move it or
 * tear it down without touching the underlying OverlayView.
 */
export interface HtmlOverlayHandle {
  setPosition: (pos: LatLng) => void;
  getElement: () => HTMLElement;
  remove: () => void;
}

/**
 * Google map panes, bottom → top:
 * mapPane · overlayLayer · markerLayer · overlayMouseTarget · floatPane.
 * We default to `overlayLayer` so animated graphics sit *behind* the SVG pin
 * markers (which render in the marker pane).
 */
type PaneName =
  | "mapPane"
  | "overlayLayer"
  | "markerLayer"
  | "overlayMouseTarget"
  | "floatPane";

/**
 * Mount an absolutely-positioned HTML element on a map at a LatLng, using
 * `google.maps.OverlayView` so the element can be animated with plain CSS.
 * The element is centered on the anchor point.
 *
 * Must be called only after Google Maps has loaded (`window.google.maps`).
 */
export function createHtmlOverlay(opts: {
  map: any;
  position: LatLng;
  element: HTMLElement;
  zIndex?: number;
  paneName?: PaneName;
}): HtmlOverlayHandle {
  const OverlayViewCtor: any = window.google.maps.OverlayView;

  class HtmlOverlay extends OverlayViewCtor {
    private latLng: any;
    private el: HTMLElement;
    private paneName: PaneName;

    constructor() {
      super();
      this.latLng = new window.google.maps.LatLng(
        opts.position.lat,
        opts.position.lng,
      );
      this.el = opts.element;
      this.paneName = opts.paneName ?? "overlayLayer";
      this.el.style.position = "absolute";
      this.el.style.pointerEvents = "none";
      if (opts.zIndex != null) this.el.style.zIndex = String(opts.zIndex);
    }

    onAdd() {
      const panes = this.getPanes();
      panes?.[this.paneName]?.appendChild(this.el);
    }

    draw() {
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.latLng);
      if (!point) return;
      this.el.style.left = `${point.x}px`;
      this.el.style.top = `${point.y}px`;
      // Center the element on the anchor point.
      this.el.style.transform = "translate(-50%, -50%)";
    }

    onRemove() {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }

    updatePosition(pos: LatLng) {
      this.latLng = new window.google.maps.LatLng(pos.lat, pos.lng);
      this.draw();
    }
  }

  const overlay = new HtmlOverlay();
  overlay.setMap(opts.map);

  return {
    setPosition: (pos: LatLng) => overlay.updatePosition(pos),
    getElement: () => opts.element,
    remove: () => overlay.setMap(null),
  };
}
