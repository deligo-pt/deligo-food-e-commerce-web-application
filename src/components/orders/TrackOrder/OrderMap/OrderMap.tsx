/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsScript } from "@/lib/googleMapsLoader";
import { useTranslation } from "@/hooks/useTranslation";
import type { CameraMode, LatLng, OrderMapProps } from "./types";
import { getStatusScene, normalizeStatus } from "./statusScene";
import { createHtmlOverlay, type HtmlOverlayHandle } from "./HtmlOverlay";
import { buildRestaurantScene } from "./restaurantScene";
import { buildCustomerScene } from "./customerScene";
import { buildRiderMarker } from "./riderMarker";
import { buildRoutePath, type RoutePath } from "./routePath";

/**
 * Status-aware Google Maps view for order tracking.
 *
 * Phase 0: extracted verbatim from TrackOrder.tsx and given `orderStatus`
 * awareness (via the statusScene config). Behavior is unchanged — the derived
 * scene is wired in and exposed as data-attributes for now; later phases drive
 * the animations/camera from it.
 */
export default function OrderMap({
  orderStatus,
  pickupLatitude,
  pickupLongitude,
  pickupAddress,
  deliveryLatitude,
  deliveryLongitude,
  deliveryAddress,
  riderLatitude,
  riderLongitude,
  riderName,
  etaMinutes,
}: OrderMapProps) {
  const { t } = useTranslation();
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const deliveryMarkerRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const fallbackPolylineRef = useRef<any>(null);
  const restaurantOverlayRef = useRef<HtmlOverlayHandle | null>(null);
  const restaurantSceneRef = useRef<string | null>(null);

  // Customer arrival scene (Phase 4)
  const customerOverlayRef = useRef<HtmlOverlayHandle | null>(null);
  const customerSceneRef = useRef<string | null>(null);

  // Camera choreography (Phase 4): last-applied camera mode so we re-frame only
  // on status change (not on every 5s poll), except followRider which tracks.
  const lastCameraRef = useRef<CameraMode | null>(null);

  // Rider transit animation (Phase 3)
  const riderOverlayRef = useRef<HtmlOverlayHandle | null>(null);
  const traveledPolylineRef = useRef<any>(null);
  const routePathRef = useRef<RoutePath | null>(null);
  const riderGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const simStartRef = useRef<number | null>(null);
  const etaMinutesRef = useRef<number | undefined>(undefined);
  const currentFractionRef = useRef<number>(0);
  const riderTickRef = useRef<number | null>(null);

  const normalizedStatus = normalizeStatus(orderStatus);
  const scene = getStatusScene(orderStatus);

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setMapLoaded(true))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !window.google) return;

    const mapDiv = document.getElementById("track-order-map");
    if (!mapDiv || mapRef.current) return;

    const center = {
      lat: deliveryLatitude || pickupLatitude || 23.7282,
      lng: deliveryLongitude || pickupLongitude || 89.1432,
    };

    const map = new window.google.maps.Map(mapDiv, {
      center,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "transit",
          elementType: "labels.icon",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    mapRef.current = map;
  }, [mapLoaded, deliveryLatitude, pickupLatitude, deliveryLongitude, pickupLongitude]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google) return;

    const map = mapRef.current;

    // Resolve the key anchor points once (reused by overlays and the camera).
    const pickupPoint: LatLng | null =
      typeof pickupLatitude === "number" && typeof pickupLongitude === "number"
        ? { lat: pickupLatitude, lng: pickupLongitude }
        : null;
    const deliveryPoint: LatLng | null =
      typeof deliveryLatitude === "number" && typeof deliveryLongitude === "number"
        ? { lat: deliveryLatitude, lng: deliveryLongitude }
        : null;
    const riderPoint: LatLng | null =
      typeof riderLatitude === "number" && typeof riderLongitude === "number"
        ? { lat: riderLatitude, lng: riderLongitude }
        : null;

    // Honour the OS "reduce motion" setting for the JS-driven rider glide (the
    // CSS keyframes already degrade via their own media query).
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- 1. Customer Marker ---
    if (deliveryLatitude && deliveryLongitude) {
      const deliveryPos = { lat: deliveryLatitude, lng: deliveryLongitude };

      if (!deliveryMarkerRef.current) {
        const customerIcon = {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
                <circle cx="20" cy="22" r="16" fill="rgba(0,0,0,0.15)" filter="blur(2px)" />
                <circle cx="20" cy="20" r="15" fill="#ffffff" stroke="#9d174d" stroke-width="2" />
                <circle cx="20" cy="20" r="12" fill="#9d174d" />
                <path d="M20,11 C17.8,11 16,12.8 16,15 C16,18.2 20,23 20,23 C20,23 24,18.2 24,15 C24,12.8 22.2,11 20,11 Z M20,16.5 C19.2,16.5 18.5,15.8 18.5,15 C18.5,14.2 19.2,13.5 20,13.5 C20.8,13.5 21.5,14.2 21.5,15 C21.5,15.8 20.8,16.5 20,16.5 Z" fill="#ffffff" />
              </svg>
            `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20),
        };

        deliveryMarkerRef.current = new window.google.maps.Marker({
          position: deliveryPos,
          map,
          title: deliveryAddress || t("deliveryTo"),
          icon: customerIcon,
          zIndex: 100,
        });
      } else {
        deliveryMarkerRef.current.setPosition(deliveryPos);
      }
    }

    // --- 2. Restaurant Marker ---
    if (pickupLatitude && pickupLongitude) {
      const pickupPos = { lat: pickupLatitude, lng: pickupLongitude };

      if (!pickupMarkerRef.current) {
        const storeIcon = {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
                <circle cx="20" cy="22" r="16" fill="rgba(0,0,0,0.15)" filter="blur(2px)" />
                <circle cx="20" cy="20" r="15" fill="#ffffff" stroke="#f9186b" stroke-width="2" />
                <circle cx="20" cy="20" r="12" fill="#f9186b" />
                <path d="M14,14 L26,14 L26,18 L14,18 Z M13,11 L27,11 L27,14 L13,14 Z M15,18 L15,25 C15,25.6 15.4,26 16,26 L24,26 C24.6,26 25,25.6 25,25 L25,18 Z" fill="#ffffff" />
              </svg>
            `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20),
        };

        pickupMarkerRef.current = new window.google.maps.Marker({
          position: pickupPos,
          map,
          title: pickupAddress || t("restaurant"),
          icon: storeIcon,
          zIndex: 90,
        });
      } else {
        pickupMarkerRef.current.setPosition(pickupPos);
      }
    }

    // --- 2b. Restaurant status animation (Phase 2) ---
    // Distinct animated scene per restaurant-anchored status (pending / accepted
    // / preparing / ready), rebuilt only when the animation actually changes.
    // Restaurant-anchored scenes prefer the restaurant pin; if its coordinates
    // are withheld until the order is confirmed, fall back to the customer pin
    // so the waiting/preparing animation still appears instead of a blank map.
    const restaurantAnchorPos = pickupPoint ?? deliveryPoint;
    const wantsRestaurantOverlay =
      scene.anchor === "restaurant" && restaurantAnchorPos !== null;

    if (wantsRestaurantOverlay) {
      const pos = restaurantAnchorPos!;
      const sceneChanged = restaurantSceneRef.current !== scene.animation;

      if (restaurantOverlayRef.current && sceneChanged) {
        restaurantOverlayRef.current.remove();
        restaurantOverlayRef.current = null;
      }

      if (!restaurantOverlayRef.current) {
        restaurantOverlayRef.current = createHtmlOverlay({
          map,
          position: pos,
          element: buildRestaurantScene(scene.animation),
          zIndex: 80,
        });
        restaurantSceneRef.current = scene.animation;
      } else {
        restaurantOverlayRef.current.setPosition(pos);
      }
    } else if (restaurantOverlayRef.current) {
      restaurantOverlayRef.current.remove();
      restaurantOverlayRef.current = null;
      restaurantSceneRef.current = null;
    }

    // --- 2c. Customer arrival animation (Phase 4) ---
    // The DELIVERED scene celebrates at the customer pin. Built once on entry,
    // repositioned on re-render, removed when the scene leaves the customer.
    const wantsCustomerOverlay =
      scene.anchor === "customer" &&
      typeof deliveryLatitude === "number" &&
      typeof deliveryLongitude === "number";

    if (wantsCustomerOverlay) {
      const pos = { lat: deliveryLatitude!, lng: deliveryLongitude! };
      const sceneChanged = customerSceneRef.current !== scene.animation;

      if (customerOverlayRef.current && sceneChanged) {
        customerOverlayRef.current.remove();
        customerOverlayRef.current = null;
      }

      if (!customerOverlayRef.current) {
        customerOverlayRef.current = createHtmlOverlay({
          map,
          position: pos,
          element: buildCustomerScene(scene.animation),
          zIndex: 110,
        });
        customerSceneRef.current = scene.animation;
      } else {
        customerOverlayRef.current.setPosition(pos);
      }
    } else if (customerOverlayRef.current) {
      customerOverlayRef.current.remove();
      customerOverlayRef.current = null;
      customerSceneRef.current = null;
    }

    // --- 3. Directions Path ---
    if (pickupLatitude && pickupLongitude && deliveryLatitude && deliveryLongitude) {
      const origin = { lat: pickupLatitude, lng: pickupLongitude };
      const destination = { lat: deliveryLatitude, lng: deliveryLongitude };

      if (!directionsRendererRef.current) {
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#f9186b",
            strokeOpacity: 0.8,
            strokeWeight: 5,
          },
        });

        const directionsService = new window.google.maps.DirectionsService();
        directionsService.route(
          {
            origin,
            destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === window.google.maps.DirectionsStatus.OK && result) {
              directionsRendererRef.current?.setDirections(result);
              // Capture the route geometry for rider interpolation (Phase 3).
              const overview = result.routes?.[0]?.overview_path;
              if (overview?.length) {
                routePathRef.current = buildRoutePath(
                  overview.map((p: any) => ({ lat: p.lat(), lng: p.lng() })),
                );
              }
              if (fallbackPolylineRef.current) {
                fallbackPolylineRef.current.setMap(null);
                fallbackPolylineRef.current = null;
              }
            } else {
              console.warn("Directions request failed, drawing fallback line:", status);
              // Straight-line fallback path so the rider still has a route.
              if (!routePathRef.current) {
                routePathRef.current = buildRoutePath([origin, destination]);
              }
              if (!fallbackPolylineRef.current) {
                fallbackPolylineRef.current = new window.google.maps.Polyline({
                  path: [origin, destination],
                  map,
                  geodesic: true,
                  strokeColor: "#f9186b",
                  strokeOpacity: 0,
                  icons: [
                    {
                      icon: {
                        path: "M 0,-1 0,1",
                        strokeOpacity: 0.8,
                        strokeColor: "#f9186b",
                        scale: 3,
                      },
                      offset: "0",
                      repeat: "20px",
                    },
                  ],
                });
              } else {
                fallbackPolylineRef.current.setPath([origin, destination]);
              }
            }
          }
        );
      }
    }

    // --- 4. Rider transit animation (Phase 3) ---
    // While the scene is anchored to the route (PICKED_UP / ON_THE_WAY), the
    // rider travels vendor→customer. Real GPS is snapped onto the route and
    // always wins; without it, the rider is simulated along the route paced by
    // the delivery ETA. A single rAF loop eases the rider toward its target
    // fraction and greys out the traveled portion of the route.
    const inTransit = scene.anchor === "route";
    const hasRealGps =
      typeof riderLatitude === "number" && typeof riderLongitude === "number";

    if (inTransit) {
      // Publish the latest inputs for the rAF loop to read (avoids stale closures).
      riderGpsRef.current = hasRealGps
        ? { lat: riderLatitude!, lng: riderLongitude! }
        : null;
      etaMinutesRef.current = etaMinutes;
      if (hasRealGps) {
        simStartRef.current = null; // real GPS overrides the simulation clock
      } else if (simStartRef.current === null) {
        simStartRef.current = performance.now();
      }

      const rp = routePathRef.current;

      if (!riderOverlayRef.current) {
        let startPoint: { lat: number; lng: number };
        if (rp && hasRealGps) {
          const snapped = rp.snap({ lat: riderLatitude!, lng: riderLongitude! });
          currentFractionRef.current = snapped.fraction;
          startPoint = snapped.point;
        } else if (rp) {
          currentFractionRef.current = 0;
          startPoint = rp.pointAtFraction(0);
        } else if (hasRealGps) {
          startPoint = { lat: riderLatitude!, lng: riderLongitude! };
        } else {
          startPoint = {
            lat: pickupLatitude ?? deliveryLatitude ?? 0,
            lng: pickupLongitude ?? deliveryLongitude ?? 0,
          };
        }
        riderOverlayRef.current = createHtmlOverlay({
          map,
          position: startPoint,
          element: buildRiderMarker(),
          zIndex: 120,
        });
      }

      // Draw/update the grey "already travelled" leg behind the rider.
      const drawTraveled = (path: RoutePath, fraction: number) => {
        const traveled = path.pointsUpToFraction(fraction);
        if (!traveledPolylineRef.current) {
          traveledPolylineRef.current = new window.google.maps.Polyline({
            path: traveled,
            map,
            strokeColor: "#c9ccd1",
            strokeOpacity: 0.95,
            strokeWeight: 6,
            zIndex: 5,
          });
        } else {
          traveledPolylineRef.current.setPath(traveled);
        }
      };

      // Drive the rider along the route (only when we have a route to follow).
      if (rp && reduceMotion) {
        // Reduced motion: no glide, no simulated crawl. Snap to the real-GPS
        // position when present; otherwise the rider stays put at the start.
        const target = riderGpsRef.current
          ? rp.snap(riderGpsRef.current).fraction
          : currentFractionRef.current;
        currentFractionRef.current = target;
        riderOverlayRef.current?.setPosition(rp.pointAtFraction(target));
        drawTraveled(rp, target);
      } else if (rp && riderTickRef.current === null) {
        const SIM_DEFAULT_MS = 45000;
        const simDurationMs = () => {
          const m = etaMinutesRef.current;
          if (!m || m <= 0) return SIM_DEFAULT_MS;
          return Math.min(Math.max(m * 60000, 30000), 180000);
        };
        const step = () => {
          const path = routePathRef.current;
          if (!path || !riderOverlayRef.current) {
            riderTickRef.current = null;
            return;
          }
          let target: number;
          if (riderGpsRef.current) {
            target = path.snap(riderGpsRef.current).fraction;
          } else if (simStartRef.current !== null) {
            target = Math.min(
              (performance.now() - simStartRef.current) / simDurationMs(),
              1,
            );
          } else {
            target = currentFractionRef.current;
          }

          const cur = currentFractionRef.current;
          currentFractionRef.current =
            Math.abs(target - cur) < 0.0005 ? target : cur + (target - cur) * 0.08;

          riderOverlayRef.current.setPosition(
            path.pointAtFraction(currentFractionRef.current),
          );

          drawTraveled(path, currentFractionRef.current);

          riderTickRef.current = requestAnimationFrame(step);
        };
        riderTickRef.current = requestAnimationFrame(step);
      }

      // No route yet but we do have GPS — at least place the rider there.
      if (!rp && hasRealGps && riderOverlayRef.current) {
        riderOverlayRef.current.setPosition({
          lat: riderLatitude!,
          lng: riderLongitude!,
        });
      }
    } else {
      // Left transit: stop the loop and remove rider + traveled polyline.
      if (riderTickRef.current !== null) {
        cancelAnimationFrame(riderTickRef.current);
        riderTickRef.current = null;
      }
      if (riderOverlayRef.current) {
        riderOverlayRef.current.remove();
        riderOverlayRef.current = null;
      }
      if (traveledPolylineRef.current) {
        traveledPolylineRef.current.setMap(null);
        traveledPolylineRef.current = null;
      }
      simStartRef.current = null;
    }

    // --- 5. Camera choreography (Phase 4) ---
    // A single cameraMode per status frames the map. We re-apply only when the
    // mode changes (status transition) so we don't fight the user on every 5s
    // poll — except `followRider`, which re-frames as the rider moves.
    const fitTo = (points: (LatLng | null)[]) => {
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;
      points.forEach((p) => {
        if (p) {
          bounds.extend(p);
          hasPoints = true;
        }
      });
      if (!hasPoints) return;
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      const listener = window.google.maps.event.addListener(
        map,
        "bounds_changed",
        () => {
          if (map.getZoom()! > 16) map.setZoom(16);
          window.google.maps.event.removeListener(listener);
        },
      );
    };

    const centerOn = (p: LatLng, zoom: number) => {
      map.setZoom(zoom);
      map.panTo(p);
    };

    const applyCamera = (mode: CameraMode) => {
      switch (mode) {
        case "focusRestaurant":
          if (pickupPoint) centerOn(pickupPoint, 16);
          else fitTo([deliveryPoint]);
          break;
        case "centerCustomer":
          if (deliveryPoint) centerOn(deliveryPoint, 16);
          else fitTo([pickupPoint]);
          break;
        case "fitRoute":
          fitTo([pickupPoint, deliveryPoint]);
          break;
        case "followRider":
          fitTo([riderPoint ?? pickupPoint, deliveryPoint]);
          break;
        case "fitAll":
        default:
          fitTo([pickupPoint, riderPoint, deliveryPoint]);
          break;
      }
    };

    const hasAnyPoint = !!(pickupPoint || deliveryPoint || riderPoint);
    const cameraChanged = lastCameraRef.current !== scene.camera;
    const isFollow = scene.camera === "followRider";

    if (hasAnyPoint && (cameraChanged || isFollow)) {
      applyCamera(scene.camera);
      lastCameraRef.current = scene.camera;
    }
  }, [
    mapLoaded,
    pickupLatitude,
    pickupLongitude,
    pickupAddress,
    deliveryLatitude,
    deliveryLongitude,
    deliveryAddress,
    riderLatitude,
    riderLongitude,
    riderName,
    etaMinutes,
    normalizedStatus,
    scene.anchor,
    scene.animation,
    scene.camera,
    t,
  ]);

  useEffect(() => {
    return () => {
      if (riderTickRef.current !== null) {
        cancelAnimationFrame(riderTickRef.current);
        riderTickRef.current = null;
      }
      if (restaurantOverlayRef.current) {
        restaurantOverlayRef.current.remove();
        restaurantOverlayRef.current = null;
        restaurantSceneRef.current = null;
      }
      if (customerOverlayRef.current) {
        customerOverlayRef.current.remove();
        customerOverlayRef.current = null;
        customerSceneRef.current = null;
      }
      if (riderOverlayRef.current) {
        riderOverlayRef.current.remove();
        riderOverlayRef.current = null;
      }
      if (traveledPolylineRef.current) {
        traveledPolylineRef.current.setMap(null);
        traveledPolylineRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="relative h-100 md:h-125 w-full rounded-4xl overflow-hidden shadow-xl group bg-gray-100 dark:bg-gray-800"
      data-order-status={normalizedStatus}
      data-scene={scene.animation}
      data-terminal={scene.animation === "terminal"}
    >
      <div id="track-order-map" className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="animate-pulse text-gray-400 dark:text-gray-500">
            {t("loadingMap")}
          </div>
        </div>
      )}
    </div>
  );
}
