"use client";

import {
  Building2,
  Globe,
  Home,
  MapPin,
  Navigation,
  Save,
} from "lucide-react";
import { useState } from "react";

interface AddressFormProps {
  coordinates: {
    lat: number;
    lng: number;
  };
}

export default function AddressForm({
  coordinates,
}: AddressFormProps) {
  const [addressType, setAddressType] = useState<
    "home" | "work" | "other"
  >("home");

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="mb-2 text-2xl font-bold text-[#191c1d]">
          Address Details
        </h2>

        <p className="text-sm text-[#5a4044]">
          Fill in the details to save this address for future
          deliveries.
        </p>
      </div>

      {/* Address Label */}
      <div className="mb-8">
        <label className="mb-4 block text-sm font-semibold text-[#191c1d]">
          Label Address As
        </label>

        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setAddressType("home")}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition ${
              addressType === "home"
                ? "border-[#b0004a] bg-[#fff2f5] text-[#b0004a]"
                : "border-[#e3bdc3] text-[#5a4044]"
            }`}
          >
            <Home size={18} />
            Home
          </button>

          <button
            type="button"
            onClick={() => setAddressType("work")}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition ${
              addressType === "work"
                ? "border-[#b0004a] bg-[#fff2f5] text-[#b0004a]"
                : "border-[#e3bdc3] text-[#5a4044]"
            }`}
          >
            <Building2 size={18} />
            Work
          </button>

          <button
            type="button"
            onClick={() => setAddressType("other")}
            className={`rounded-xl border px-4 py-3 font-medium transition ${
              addressType === "other"
                ? "border-[#b0004a] bg-[#fff2f5] text-[#b0004a]"
                : "border-[#e3bdc3] text-[#5a4044]"
            }`}
          >
            Other
          </button>
        </div>
      </div>

      {/* Street Information */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            Street Address *
          </label>

          <div className="flex items-center rounded-xl border border-[#e3bdc3] px-4">
            <MapPin
              size={18}
              className="mr-3 text-[#5a4044]"
            />

            <input
              type="text"
              placeholder="Enter street address"
              className="h-14 w-full bg-transparent outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            House / Apartment / Floor
          </label>

          <div className="flex items-center rounded-xl border border-[#e3bdc3] px-4">
            <Building2
              size={18}
              className="mr-3 text-[#5a4044]"
            />

            <input
              type="text"
              placeholder="Apt 4B, Floor 2"
              className="h-14 w-full bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* City Information */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            City *
          </label>

          <input
            type="text"
            placeholder="Enter city"
            className="h-14 w-full rounded-xl border border-[#e3bdc3] px-4 outline-none focus:border-[#b0004a]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            Postal Code *
          </label>

          <input
            type="text"
            placeholder="1000-001"
            className="h-14 w-full rounded-xl border border-[#e3bdc3] px-4 outline-none focus:border-[#b0004a]"
          />
        </div>
      </div>

      {/* State + Country */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            State / Region
          </label>

          <input
            type="text"
            placeholder="Lisbon"
            className="h-14 w-full rounded-xl border border-[#e3bdc3] px-4 outline-none focus:border-[#b0004a]"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#191c1d]">
            Country
          </label>

          <div className="flex items-center rounded-xl border border-[#e3bdc3] px-4">
            <Globe
              size={18}
              className="mr-3 text-[#5a4044]"
            />

            <input
              type="text"
              defaultValue="Portugal"
              className="h-14 w-full bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Coordinates Card */}
      <div className="mb-8 rounded-2xl border border-[#e3bdc3] bg-[#fafafa] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Navigation
            size={18}
            className="text-[#b0004a]"
          />

          <h3 className="font-semibold text-[#191c1d]">
            GPS Coordinates
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-[#5a4044]">
              Latitude
            </p>

            <p className="rounded-lg bg-white px-4 py-3 font-mono text-sm">
              {coordinates.lat.toFixed(6)}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-[#5a4044]">
              Longitude
            </p>

            <p className="rounded-lg bg-white px-4 py-3 font-mono text-sm">
              {coordinates.lng.toFixed(6)}
            </p>
          </div>
        </div>
      </div>

      {/* Additional Notes
      <div className="mb-8">
        <label className="mb-2 block text-sm font-medium text-[#191c1d]">
          Delivery Notes (Optional)
        </label>

        <textarea
          rows={4}
          placeholder="Add any instructions for the delivery driver..."
          className="w-full rounded-xl border border-[#e3bdc3] p-4 outline-none focus:border-[#b0004a]"
        />
      </div> */}

      {/* Save Button */}
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b0004a] py-4 font-semibold text-white transition hover:opacity-90"
      >
        <Save size={18} />
        Save Address
      </button>
    </div>
  );
}