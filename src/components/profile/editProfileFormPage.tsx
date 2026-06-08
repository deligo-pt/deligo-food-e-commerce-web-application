/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Home,
  MapPin,
  Search,
  LocateFixed,
  Map,
  CheckCircle,
  Pencil,
  X,
} from "lucide-react";
import LocationPicker from "@/components/profile/locationPicker";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import Image from "next/image";

interface ProfileData {
  userId: string;
  name: { firstName: string; lastName: string };
  email: string;
  contactNumber?: string;
  NIF?: string;
  profilePhoto?: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    detailedAddress?: string;
    latitude?: number;
    longitude?: number;
    geoAccuracy?: number;
  };
}

export default function EditProfileFormPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [nif, setNif] = useState("");
  const [street, setStreet] = useState("");
  const [houseDetail, setHouseDetail] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [addressType, setAddressType] = useState("Home");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [coordinates, setCoordinates] = useState({
    lat: 23.8103,
    lng: 90.4125,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Upload image and return URL
  const uploadProfilePhoto = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("files", file);

    const response = await apiClient.post("/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (!response.data?.success || !response.data?.data?.length) {
      throw new Error("Upload response missing image URL");
    }

    return response.data.data[0];
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data } = await apiClient.get("/profile");
        if (data.success && data.data) {
          const d = data.data;
          setProfileData(d);
          setFirstName(d.name?.firstName || "");
          setLastName(d.name?.lastName || "");
          setEmail(d.email || "");
          setMobileNumber(d.contactNumber || "");
          setNif(d.NIF || "");
          setStreet(d.address?.street || "");
          setHouseDetail(d.address?.detailedAddress || "");
          setCity(d.address?.city || "");
          setPostalCode(d.address?.postalCode || "");
          setState(d.address?.state || "");
          setCountry(d.address?.country || "");
          if (d.address?.latitude && d.address?.longitude) {
            setCoordinates({
              lat: d.address.latitude,
              lng: d.address.longitude,
            });
          }
          if (d.profilePhoto) setImagePreview(d.profilePhoto);
        } else {
          throw new Error("Invalid response");
        }
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load profile"));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat, lng } },
      (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          const components = results[0].address_components;
          let foundStreet = "",
            foundCity = "",
            foundPostal = "",
            foundState = "",
            foundCountry = "";
          for (const comp of components) {
            const types = comp.types;
            if (types.includes("route")) foundStreet = comp.long_name;
            if (types.includes("locality")) foundCity = comp.long_name;
            if (types.includes("postal_code")) foundPostal = comp.long_name;
            if (types.includes("administrative_area_level_1"))
              foundState = comp.long_name;
            if (types.includes("country")) foundCountry = comp.long_name;
          }
          setStreet(foundStreet || street);
          setCity(foundCity || city);
          setPostalCode(foundPostal || postalCode);
          setState(foundState || state);
          setCountry(foundCountry || country);
        }
      },
    );
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        reverseGeocode(latitude, longitude);
      },
      (err) => alert("Unable to get location: " + err.message),
    );
  };

  const handleFullMap = () => {
    document
      .getElementById("map-section")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(profileData?.profilePhoto || "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData?.userId) {
      setError("User ID not found");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      let uploadedPhotoUrl: string | undefined = undefined;

      // Upload new profile photo if a new file is selected
      if (selectedFile) {
        setImageUploading(true);
        try {
          uploadedPhotoUrl = await uploadProfilePhoto(selectedFile);
        } catch (uploadErr) {
          setError(getApiErrorMessage(uploadErr, "Failed to upload profile photo"));
          setSubmitting(false);
          setImageUploading(false);
          return;
        } finally {
          setImageUploading(false);
        }
      }

      // Build address object with only changed fields
      const addressPayload: any = {};
      if (street) addressPayload.street = street;
      if (city) addressPayload.city = city;
      if (state) addressPayload.state = state;
      if (country) addressPayload.country = country;
      if (postalCode) addressPayload.postalCode = postalCode;
      if (houseDetail) addressPayload.detailedAddress = houseDetail;
      if (coordinates.lat) addressPayload.latitude = coordinates.lat;
      if (coordinates.lng) addressPayload.longitude = coordinates.lng;
      addressPayload.geoAccuracy = 10; 

      const payload: any = {};

      if (firstName || lastName) {
        payload.name = {};
        if (firstName) payload.name.firstName = firstName;
        if (lastName) payload.name.lastName = lastName;
      }

      if (mobileNumber) payload.contactNumber = mobileNumber;
      if (nif) payload.NIF = nif;
      if (uploadedPhotoUrl) payload.profilePhoto = uploadedPhotoUrl;

      if (Object.keys(addressPayload).length > 0) {
        payload.address = addressPayload;
      }
      await apiClient.patch(`/customers/${profileData.userId}`, payload);

      setSuccess("Profile updated successfully!");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      const { data } = await apiClient.get("/profile");
      if (data.success && data.data) {
        const d = data.data;
        setProfileData(d);
        if (d.profilePhoto) setImagePreview(d.profilePhoto);
      }
    } catch (err) {
      console.error("Update error:", err);
      setError(getApiErrorMessage(err, "Failed to update profile"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-[#f8f9fa] py-8">
        <div className="mx-auto max-w-250 px-4 text-center">
          Loading profile...
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f8f9fa] py-8">
      <div className="mx-auto max-w-250 px-4">
        <div className="mb-6 flex items-center gap-2 text-sm text-[#5a4044]">
          <span>Home</span> <span>&gt;</span> <span>Account</span>{" "}
          <span>&gt;</span>
          <span className="font-bold text-[#b0004a]">Edit Profile</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#e3bdc3] bg-white shadow-sm">
          <div className="flex flex-col items-center border-b border-[#e3bdc3]/30 bg-linear-to-b from-[#b0004a]/5 to-transparent py-10">
            <div className="relative">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-lg">
                <Image
                  src={
                    imagePreview ||
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300"
                  }
                  alt="Profile"
                  className="h-full w-full object-cover"
                  width={128}
                  height={128}
                />
              </div>
              <label className="absolute bottom-0 right-0 cursor-pointer rounded-full border-2 border-white bg-[#b0004a] p-2 text-white shadow-lg">
                <Pencil size={18} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white shadow-md"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <h1 className="mt-6 text-2xl font-bold text-[#191c1d]">
              Edit Profile
            </h1>
            <p className="text-[#5a4044]">
              Manage your account information and preferences
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10 p-8 md:p-12">
            {/* Basic Information */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">Basic Information</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    Last Name (optional)
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    className="w-full rounded border border-[#e3bdc3] bg-gray-50 px-4 py-3 outline-none text-gray-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    Mobile Number *
                  </label>
                  <div className="flex">
                    <div className="flex items-center border border-r-0 border-[#e3bdc3] bg-gray-100 px-3">
                      +351
                    </div>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full rounded-r border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                    />
                  </div>
                </div>
              </div>
              <div className="max-w-md">
                <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                  NIF / Tax ID
                </label>
                <input
                  type="text"
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                />
              </div>
            </section>

            {/* Delivery Address */}
            <section className="space-y-6 border-t border-[#e3bdc3]/30 pt-8">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <div className="flex items-center gap-3">
                    <MapPin className="text-[#b0004a]" />
                    <h2 className="text-xl font-semibold">Delivery Address</h2>
                  </div>
                  <p className="ml-9 text-sm text-[#5a4044]">
                    Confirm Location
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUseGPS}
                    className="flex items-center gap-2 rounded border border-[#b0004a] bg-[#b0004a]/10 px-4 py-2 text-[#b0004a]"
                  >
                    <LocateFixed size={18} /> Use GPS
                  </button>
                  <button
                    type="button"
                    onClick={handleFullMap}
                    className="flex items-center gap-2 rounded border border-[#e3bdc3] px-4 py-2"
                  >
                    <Map size={18} /> Full Map
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a4044]"
                />
                <input
                  id="autocomplete"
                  placeholder="Search for your address..."
                  className="w-full rounded-full border border-[#e3bdc3] px-12 py-4 outline-none focus:border-[#b0004a]"
                />
              </div>

              <div id="map-section">
                <LocationPicker
                  onCoordinatesChange={(lat, lng) =>
                    setCoordinates({ lat, lng })
                  }
                  defaultCenter={coordinates}
                />
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
                <div className="rounded-full bg-green-500 p-2 text-white">
                  <CheckCircle />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest text-green-700">
                    LOCATION CONFIRMED
                  </p>
                  <p className="font-medium text-green-900">
                    {street}, {city}, {postalCode}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-[#5a4044]">
                  Label as *
                </label>
                <div className="flex gap-3">
                  {["Home", "Work", "Other"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAddressType(label)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded border py-3 ${
                        addressType === label
                          ? "border-2 border-[#b0004a] bg-[#b0004a]/5 font-bold text-[#b0004a]"
                          : "border border-[#e3bdc3]"
                      }`}
                    >
                      {label === "Home" && <Home size={18} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Detailed Address Fields */}
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    House / Apartment / Floor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 123, 4th Floor, Door B"
                    value={houseDetail}
                    onChange={(e) => setHouseDetail(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    State / Region *
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    Country *
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-end gap-4 border-t border-[#e3bdc3]/30 pt-8 sm:flex-row">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-8 py-3 font-bold text-[#b0004a]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || imageUploading}
                className="rounded bg-[#b0004a] px-12 py-3 font-bold text-white shadow-lg disabled:opacity-50"
              >
                {imageUploading ? "Uploading image..." : submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {error && <div className="text-center text-red-600">{error}</div>}
            {success && (
              <div className="text-center text-green-600">{success}</div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}