"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, LocateFixed, Map, Search } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import LocationPicker from "@/components/profile/locationPicker";
import AddressForm from "./AddressForm";

interface Address {
  _id: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  detailedAddress?: string;
  addressType: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
}

interface Props {
  addressId: string;
}

export default function EditAddressPage({ addressId }: Props) {
  const router = useRouter();
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coordinates, setCoordinates] = useState({
    lat: 23.8103,
    lng: 90.4125,
  });

  useEffect(() => {
    const fetchAddress = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get("/profile");
        const deliveryAddresses = response.data.data.deliveryAddresses || [];
        const foundAddress = deliveryAddresses.find(
          (item: Address) => item._id === addressId,
        );

        if (!foundAddress) {
          setError("Address not found");
          return;
        }

        setAddress(foundAddress);
        setCoordinates({
          lat: foundAddress.latitude ?? 23.8103,
          lng: foundAddress.longitude ?? 90.4125,
        });
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load address"));
      } finally {
        setLoading(false);
      }
    };

    fetchAddress();
  }, [addressId]);

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => alert("Unable to retrieve your location."),
    );
  };

  const handleFullMap = () => {
    document
      .getElementById("map-section")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleUpdateLocation = () => {
    alert("Location updated. Save the address form to apply changes.");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <p className="text-lg text-gray-600">Loading address...</p>
      </div>
    );
  }

  if (error || !address) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa]">
        <p className="text-lg text-red-500">{error || "Address not found"}</p>
        <button
          onClick={() => router.back()}
          className="rounded-lg bg-[#b0004a] px-6 py-2 text-white"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <section className="bg-[#f8f9fa] py-8">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Page Title */}
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm transition hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-[#b0004a]" />
          </button>
          <h1 className="text-3xl font-bold text-[#191c1d]">Edit Address</h1>
        </div>

        {/* Content – identical layout to AddAddressPage */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Side – Location Picker (same as add page) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-bold text-[#191c1d]">
                  Confirm Location
                </h2>
                <p className="text-sm text-[#5a4044]">
                  Adjust the pin on the map if needed
                </p>
              </div>

              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search for area, street name..."
                  className="w-full rounded-full border border-[#e3bdc3] py-4 pl-12 pr-4 outline-none transition focus:border-[#b0004a]"
                />
              </div>

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

              <div id="map-section" className="mb-6">
                <LocationPicker
                  defaultCenter={coordinates}
                  onCoordinatesChange={(lat, lng) =>
                    setCoordinates({ lat, lng })
                  }
                />
              </div>

              <button
                type="button"
                onClick={handleUpdateLocation}
                className="mb-4 w-full rounded-xl bg-[#b0004a] py-4 font-semibold text-white transition hover:opacity-90"
              >
                Update Location
              </button>

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

          <div className="lg:col-span-7">
            <AddressForm
              coordinates={coordinates}
              initialData={address}
              isEditMode={true}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
