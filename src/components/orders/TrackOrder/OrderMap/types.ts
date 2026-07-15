/**
 * Shared types for the status-driven order tracking map.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Where a status's animation is anchored on the map. */
export type SceneAnchor = "restaurant" | "route" | "customer" | "none";

/** The animation played for a given (normalized) status. */
export type SceneAnimation =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "pickedUp"
  | "onTheWay"
  | "delivered"
  | "terminal";

/** How the camera frames the map for a given status. */
export type CameraMode =
  | "focusRestaurant"
  | "followRider"
  | "fitRoute"
  | "centerCustomer"
  | "fitAll";

/** The full scene descriptor for one order status. */
export interface StatusScene {
  anchor: SceneAnchor;
  animation: SceneAnimation;
  camera: CameraMode;
}

export interface OrderMapProps {
  /** Raw backend order status (normalized internally). */
  orderStatus: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupAddress: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryAddress: string;
  riderLatitude?: number;
  riderLongitude?: number;
  riderName?: string;
  /** Estimated delivery time in minutes; used to pace the simulated rider. */
  etaMinutes?: number;
}
