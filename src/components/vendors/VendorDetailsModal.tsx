"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Share2,
  MapPin,
  Clock3,
  UtensilsCrossed,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

interface VendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string | null;
}

interface VendorData {
  name: {
    firstName: string;
    lastName: string;
  };
  businessDetails: {
    businessName: string;
    businessType: string;
    businessLicenseNumber: string;
    NIF: string;
    totalBranches: number;
    openingHours: string;
    closingHours: string;
    closingDays: string[];
    isStoreOpen: boolean;
    storeClosedAt: string | null;
    deliveryZoneId: string;
    preparationTimeMinutes: number;
    restaurantCuisineType: string;
  };
  businessLocation: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  };
  _id: string;
  userId: string;
  email: string;
  contactNumber: string;
}

export default function VendorDetailsModal({
  isOpen,
  onClose,
  vendorId,
}: VendorDetailsModalProps) {
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !vendorId) return;

    const fetchVendor = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/vendors/customer/${vendorId}`);
        const vendor = response.data.data;
        setVendorData(vendor);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load vendor details"));
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [isOpen, vendorId]);

  if (!isOpen) return null;

  // Build static map URL using vendor coordinates
  const mapStaticUrl =
    vendorData?.businessLocation?.latitude && vendorData?.businessLocation?.longitude
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${vendorData.businessLocation.latitude},${vendorData.businessLocation.longitude}&zoom=15&size=600x240&markers=color:red%7C${vendorData.businessLocation.latitude},${vendorData.businessLocation.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_LOCATION_API_KEY}`
      : null;

  const fullAddress = vendorData?.businessLocation
    ? `${vendorData.businessLocation.street}, ${vendorData.businessLocation.city} ${vendorData.businessLocation.postalCode}, ${vendorData.businessLocation.country}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-250 overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="rounded-full p-2 transition hover:bg-gray-100"
            >
              <ArrowLeft size={20} />
            </button>

            <div>
              <h1 className="text-[18px] font-semibold text-gray-900">
                {vendorData?.businessDetails?.businessName || "Vendor"}
              </h1>
              <p className="text-sm text-gray-500">Please contact the vendor</p>
            </div>
          </div>

          <button className="rounded-full p-2 text-pink-600 transition hover:bg-pink-50">
            <Share2 size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 gap-8 p-8 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Map */}
            <div className="relative overflow-hidden rounded-xl shadow-md">
              {loading ? (
                <div className="h-60 w-full animate-pulse bg-gray-200" />
              ) : error ? (
                <div className="flex h-60 w-full items-center justify-center bg-gray-100 text-gray-500">
                  <p>Map unavailable</p>
                </div>
              ) : mapStaticUrl ? (
                <Image
                  src={mapStaticUrl}
                  alt="Vendor Location"
                  width={600}
                  height={350}
                  className="h-60 w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-60 w-full items-center justify-center bg-gray-100 text-gray-500">
                  <p>Location not available</p>
                </div>
              )}

              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-sm">
                <MapPin size={14} className="fill-pink-600 text-pink-600" />
                <span className="text-xs font-medium text-gray-900">
                  {vendorData?.businessDetails?.businessName || "Vendor"}
                </span>
              </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="rounded-full bg-green-100 p-3">
                  <Clock3 size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-600">
                    {vendorData?.businessDetails?.isStoreOpen
                      ? "Open now"
                      : "Closed now"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {vendorData?.businessDetails?.openingHours &&
                    vendorData?.businessDetails?.closingHours
                      ? `${vendorData.businessDetails.openingHours} – ${vendorData.businessDetails.closingHours}`
                      : "Hours not set"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="rounded-full bg-pink-100 p-3">
                  <UtensilsCrossed size={20} className="text-pink-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-pink-600">
                    Preparation Time
                  </p>
                  <p className="text-xs text-gray-500">
                    {vendorData?.businessDetails?.preparationTimeMinutes ?? "—"}{" "}
                    minutes
                  </p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="rounded-xl border-l-4 border-pink-600 bg-gray-100 p-6">
              <div className="flex gap-4">
                <MapPin size={20} className="mt-1 text-pink-600" />
                <div>
                  <h3 className="mb-1 text-sm text-gray-500">Address</h3>
                  <p className="text-sm text-gray-900">
                    {fullAddress || "Address not provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-lg font-semibold text-pink-600">
                Contact Information
              </h2>
              <div className="space-y-3">
                {/* Phone */}
                <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100">
                    <Phone size={18} className="text-pink-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-bold text-gray-900">
                      {vendorData?.contactNumber || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100">
                    <Mail size={18} className="text-pink-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-bold text-gray-900">
                      {vendorData?.email || "N/A"}
                    </p>
                  </div>
                </div>

                {/* NIF */}
                <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100">
                    <FileText size={18} className="text-pink-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">NIF Number</p>
                    <p className="text-sm font-bold text-gray-900">
                      {vendorData?.businessDetails?.NIF || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Details */}
            <div className="border-t border-gray-200 pt-4">
              <h2 className="mb-4 text-lg font-semibold text-pink-600">
                Other details
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm text-gray-500">
                    Legal entity name
                  </p>
                  <p className="font-bold text-gray-900">
                    {vendorData?.businessDetails?.businessName || "N/A"}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 p-4 italic leading-relaxed text-gray-500">
                  The partner commits to only offer products that comply with
                  the applicable rules of European Union law.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <div className="rounded-lg bg-white p-4 shadow-lg">
              Loading vendor details...
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="mx-8 mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}