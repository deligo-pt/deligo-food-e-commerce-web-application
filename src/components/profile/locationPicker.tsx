/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";

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
  searchValue?: string;
  onCoordinatesChange?: (
    lat: number,
    lng: number
  ) => void;
}

export default function LocationPicker({
  defaultCenter = DEFAULT_CENTER,
  searchValue,
  onCoordinatesChange,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);

  const [coordinates, setCoordinates] = useState(defaultCenter);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapInstanceRef.current = map;

      markerRef.current = new window.google.maps.Marker({
        position: defaultCenter,
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

    markerRef.current.setPosition(defaultCenter);

    mapInstanceRef.current.setCenter(defaultCenter);

    setCoordinates(defaultCenter);
  }, [defaultCenter]);
  useEffect(() => {
  if (!searchValue || !window.google?.maps) return;

  const service = new window.google.maps.Geocoder();

  service.geocode(
    {
      address: searchValue,
    },
    (results: any, status: string) => {
      if (status !== "OK" || !results?.length) return;

      const location = results[0].geometry.location;

      const lat = location.lat();
      const lng = location.lng();

      setCoordinates({ lat, lng });

      markerRef.current?.setPosition({
        lat,
        lng,
      });

      mapInstanceRef.current?.setCenter({
        lat,
        lng,
      });

      onCoordinatesChange?.(lat, lng);
    }
  );
}, [searchValue]);

  return (
    <div className="space-y-4">
      <div
        ref={mapRef}
        className="h-87.5 w-full overflow-hidden rounded-2xl border border-pink-200 shadow-sm"
      />

      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <h4 className="mb-2 text-sm font-semibold text-green-700">
          Selected Location
        </h4>

        <div className="space-y-1 text-sm text-green-900">
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