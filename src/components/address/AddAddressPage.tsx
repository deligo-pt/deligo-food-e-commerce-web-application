/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ArrowLeft, CheckCircle, LocateFixed, Map, Search } from "lucide-react";
import { useEffect, useState } from "react";
import LocationPicker from "@/components/profile/locationPicker";
import AddressForm from "./AddressForm";

export default function AddAddressPage() {
  const [coordinates, setCoordinates] = useState({
    lat: 23.8103,
    lng: 90.4125,
  });

  const [addressData, setAddressData] = useState({
    street: "",
    detailedAddress: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });
  const [searchValue, setSearchValue] = useState("");

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("GPS Position:", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });

        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.log(error);
      },
    );
  };

  const handleFullMap = () => {
    document
      .getElementById("map-section")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const reverseGeocode = (lat: number, lng: number) => {
    if (!window.google?.maps) return;

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode(
      {
        location: { lat, lng },
      },
      (results: any, status: string) => {
        if (status !== "OK" || !results?.length) return;

        const addressComponents = results[0].address_components;

        let street = "";
        let city = "";
        let state = "";
        let country = "";
        let postalCode = "";

        addressComponents.forEach((component: any) => {
          const types = component.types;

          if (types.includes("route")) {
            street = component.long_name;
          }

          if (types.includes("locality")) {
            city = component.long_name;
          }

          if (types.includes("administrative_area_level_1")) {
            state = component.long_name;
          }

          if (types.includes("country")) {
            country = component.long_name;
          }

          if (types.includes("postal_code")) {
            postalCode = component.long_name;
          }
        });

        setAddressData((prev) => ({
          ...prev,
          street,
          city,
          state,
          country,
          postalCode,
        }));
      },
    );
  };
  useEffect(() => {
    reverseGeocode(coordinates.lat, coordinates.lng);
  }, [coordinates]);

  useEffect(() => {
    handleUseGPS();
  }, []);

  return (
    <section className="bg-[#f8f9fa] py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Page Title */}
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm transition hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-[#b0004a]" />
          </button>

          <h1 className="text-3xl font-bold text-[#191c1d]">Add New Address</h1>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Side */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {/* Heading */}
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-bold text-[#191c1d]">
                  Confirm Location
                </h2>

                <p className="text-sm text-[#5a4044]">
                  Select a label and save your location for future orders
                </p>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                {/* 
                <input
                  type="text"
                  placeholder="Search for area, street name..."
                  className="w-full rounded-full border border-[#e3bdc3] py-4 pl-12 pr-4 outline-none transition focus:border-[#b0004a]"
                /> */}
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search for area, street name..."
                  className="w-full rounded-full border border-[#e3bdc3] py-4 pl-12 pr-4 outline-none transition focus:border-[#b0004a]"
                />
              </div>

              {/* Actions */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleUseGPS}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#b0004a] px-4 py-3 font-medium text-[#b0004a] transition hover:bg-[#fff2f5]"
                >
                  <LocateFixed size={18} />
                  Use GPS
                </button>

                <button
                  type="button"
                  onClick={handleFullMap}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#b0004a] px-4 py-3 font-medium text-[#b0004a] transition hover:bg-[#fff2f5]"
                >
                  <Map size={18} />
                  Full Map
                </button>
              </div>

              {/* Real Map */}
              <div id="map-section" className="mb-6">
                <LocationPicker
                  defaultCenter={coordinates}
                  searchValue={searchValue}
                  onCoordinatesChange={(lat, lng) =>
                    setCoordinates({ lat, lng })
                  }
                />
              </div>

              {/* Update Button */}
              <button
                type="button"
                className="mb-4 w-full rounded-xl bg-[#b0004a] py-4 font-semibold text-white transition hover:opacity-90"
              >
                Update Location
              </button>

              {/* Location Confirmed */}
              <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                <CheckCircle className="mt-0.5 text-green-600" size={20} />

                <div>
                  <p className="font-bold text-green-800">LOCATION CONFIRMED</p>

                  <p className="text-sm text-green-700">
                    Lat: {coordinates.lat.toFixed(6)} | Lng:{" "}
                    {coordinates.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="lg:col-span-7">
            <AddressForm coordinates={coordinates} initialData={addressData} />
          </div>
        </div>
      </div>
    </section>
  );
}
