/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useLocationStore } from "@/stores/locationStore";

declare global {
  interface Window {
    google: any;
  }
}

const DEFAULT_CENTER = {
  lat: 23.8103,
  lng: 90.4125,
};

const GOOGLE_API_URL = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_LOCATION_API_KEY}&libraries=places`;

interface LocationPickerProps {
  defaultCenter?: {
    lat: number;
    lng: number;
  };
  onCoordinatesChange?: (
    lat: number,
    lng: number
  ) => void;
}

export default function LocationPicker({
  defaultCenter = DEFAULT_CENTER,
  onCoordinatesChange,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  const { coords: geoCoords } = useLocationStore();

  const resolvedCenter = useMemo(() => {
    if (
      defaultCenter &&
      (defaultCenter.lat !== 23.8103 || defaultCenter.lng !== 90.4125)
    ) {
      return defaultCenter;
    }
    if (geoCoords) {
      return {
        lat: geoCoords.latitude,
        lng: geoCoords.longitude,
      };
    }
    return defaultCenter;
  }, [defaultCenter, geoCoords]);

  const [coordinates, setCoordinates] = useState(resolvedCenter);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: resolvedCenter,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;

      markerRef.current = new window.google.maps.Marker({
        position: resolvedCenter,
        map,
        draggable: true,
      });

      markerRef.current.addListener("dragend", (e: any) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        setCoordinates({ lat, lng });

        onCoordinatesChange?.(lat, lng);
      });

      map.addListener("click", (e: any) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        setCoordinates({ lat, lng });

        onCoordinatesChange?.(lat, lng);

        markerRef.current?.setPosition({
          lat,
          lng,
        });
      });
    };

    if (window.google?.maps) {
      initMap();
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${GOOGLE_API_URL}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", initMap);
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_API_URL;
    script.async = true;
    script.defer = true;
    script.onload = initMap;

    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  useEffect(() => {
    if (!markerRef.current || !mapInstanceRef.current) return;

    markerRef.current.setPosition(resolvedCenter);

    mapInstanceRef.current.setCenter(resolvedCenter);

    setCoordinates(resolvedCenter);

    if (resolvedCenter.lat !== defaultCenter.lat || resolvedCenter.lng !== defaultCenter.lng) {
      onCoordinatesChange?.(resolvedCenter.lat, resolvedCenter.lng);
    }
  }, [resolvedCenter]);


  return (
    <div className="space-y-4">
      <div
        ref={mapRef}
        className="h-87.5 w-full overflow-hidden rounded-2xl border border-pink-200 dark:border-neutral-800 shadow-sm"
      />

      <div className="rounded-xl border border-green-200 dark:border-green-900/30 bg-green-50 dark:bg-green-950/20 p-4 transition-colors duration-200">
        <h4 className="mb-2 text-sm font-semibold text-green-700 dark:text-green-400">
          Selected Location
        </h4>

        <div className="space-y-1 text-sm text-green-900 dark:text-green-100">
          <p>
            <span className="font-medium">Latitude:</span>{" "}
            {coordinates.lat.toFixed(6)}
          </p>

          <p>
            <span className="font-medium">Longitude:</span>{" "}
            {coordinates.lng.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
}