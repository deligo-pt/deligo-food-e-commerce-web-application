import { toTimelineStatus } from "@/lib/orderTimeline";
import type { StatusScene } from "./types";

/**
 * Canonical status → animated-scene mapping. This is the single source of
 * truth the map derives from: which overlay animation is active, where it is
 * anchored, and how the camera frames things. Later phases read from here;
 * Phase 0 only wires it in.
 */
export const STATUS_SCENES: Record<string, StatusScene> = {
  PENDING: { anchor: "restaurant", animation: "pending", camera: "focusRestaurant" },
  ACCEPTED: { anchor: "restaurant", animation: "accepted", camera: "focusRestaurant" },
  PREPARING: { anchor: "restaurant", animation: "preparing", camera: "focusRestaurant" },
  READY_FOR_PICKUP: { anchor: "restaurant", animation: "ready", camera: "focusRestaurant" },
  PICKED_UP: { anchor: "route", animation: "pickedUp", camera: "fitRoute" },
  ON_THE_WAY: { anchor: "route", animation: "onTheWay", camera: "followRider" },
  DELIVERED: { anchor: "customer", animation: "delivered", camera: "centerCustomer" },
  CANCELLED: { anchor: "none", animation: "terminal", camera: "fitAll" },
  REJECTED: { anchor: "none", animation: "terminal", camera: "fitAll" },
};

const DEFAULT_SCENE: StatusScene = STATUS_SCENES.PENDING;

/**
 * Normalize a raw backend status to the canonical set — the same folding the
 * timeline uses, so the map and the timeline can never disagree about what an
 * order's status means. That includes the API's `CANCELED`, which used to miss
 * the key above and drop a cancelled order onto the PENDING scene: a map
 * animating "waiting for the restaurant" beside a refund banner.
 */
export function normalizeStatus(status: string | undefined | null): string {
  return toTimelineStatus(status);
}

/** Resolve the scene for a raw status, falling back to the PENDING scene. */
export function getStatusScene(status: string | undefined | null): StatusScene {
  return STATUS_SCENES[normalizeStatus(status)] ?? DEFAULT_SCENE;
}
