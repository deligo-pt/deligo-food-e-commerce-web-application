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
import EditProfileFormSkeleton from "./EditProfileFormSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
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

  // OTP states
  const [originalEmail, setOriginalEmail] = useState("");
  const [originalMobile, setOriginalMobile] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingMobileOtp, setSendingMobileOtp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingMobile, setVerifyingMobile] = useState(false);

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
          setOriginalEmail(d.email || "");
          setMobileNumber(d.contactNumber || "");
          setOriginalMobile(d.contactNumber || "");
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

  // Send OTP for email
  const handleSendEmailOtp = async () => {
    if (!email || email === originalEmail) {
      setError("Please enter a new email address to update");
      return;
    }
    setSendingEmailOtp(true);
    setError(null);
    try {
      await apiClient.patch("/profile/send-otp", { email });
      setEmailOtpSent(true);
      setSuccess("OTP sent to your new email address");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to send OTP"));
    } finally {
      setSendingEmailOtp(false);
    }
  };

  // Verify OTP and update email
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp) {
      setError("Please enter OTP");
      return;
    }
    setVerifyingEmail(true);
    setError(null);
    try {
      await apiClient.patch("/profile/update-email-or-contact-number", {
        otp: emailOtp,
        type: "email",
      });
      setOriginalEmail(email);
      setEmailOtpSent(false);
      setEmailOtp("");
      setSuccess("Email updated successfully");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to verify OTP"));
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Send OTP for mobile
  const handleSendMobileOtp = async () => {
    if (!mobileNumber || mobileNumber === originalMobile) {
      setError("Please enter a new mobile number to update");
      return;
    }
    setSendingMobileOtp(true);
    setError(null);
    try {
      await apiClient.patch("/profile/send-otp", {
        contactNumber: mobileNumber,
      });
      setMobileOtpSent(true);
      setSuccess("OTP sent to your new mobile number");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to send OTP"));
    } finally {
      setSendingMobileOtp(false);
    }
  };

  // Verify OTP and update mobile
  const handleVerifyMobileOtp = async () => {
    if (!mobileOtp) {
      setError("Please enter OTP");
      return;
    }
    setVerifyingMobile(true);
    setError(null);
    try {
      await apiClient.patch("/profile/update-email-or-contact-number", {
        otp: mobileOtp,
        type: "mobile",
      });
      setOriginalMobile(mobileNumber);
      setMobileOtpSent(false);
      setMobileOtp("");
      setSuccess("Mobile number updated successfully");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to verify OTP"));
    } finally {
      setVerifyingMobile(false);
    }
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
          setError(
            getApiErrorMessage(uploadErr, "Failed to upload profile photo"),
          );
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
        // Sync original values after refresh
        setOriginalEmail(d.email || "");
        setOriginalMobile(d.contactNumber || "");
        setEmail(d.email || "");
        setMobileNumber(d.contactNumber || "");
      }
    } catch (err) {
      console.error("Update error:", err);
      setError(getApiErrorMessage(err, "Failed to update profile"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <EditProfileFormSkeleton />;
  }

  return (
    <section className="bg-[#f8f9fa] py-8">
      <div className="mx-auto max-w-250 px-4">
        <div className="mb-6 flex items-center gap-2 text-sm text-[#5a4044]">
          <span>{t("home")}</span>
          <span>{t("account")}</span>
          <span>{t("editProfile")}</span>
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
            <h1>{t("editProfile")}</h1>

            <p>{t("manageAccountInfo")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10 p-8 md:p-12">
            {/* Basic Information */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">
                  {t("basicInformation")}
                </h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    {t("firstName")} *
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
                    {t("lastName")} ({t("optional")})
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
                    {t("emailAddress")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                    />
                    {!emailOtpSent ? (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        disabled={sendingEmailOtp || email === originalEmail}
                        className="whitespace-nowrap rounded bg-[#b0004a] px-4 py-2 text-white disabled:opacity-50"
                      >
                        {sendingEmailOtp ? t("sending") : t("sendOtp")}
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t("otp")}
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value)}
                          className="w-24 rounded border border-[#e3bdc3] px-2 py-2 text-center outline-none focus:border-[#b0004a]"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyEmailOtp}
                          disabled={verifyingEmail}
                          className="whitespace-nowrap rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                        >
                          {verifyingEmail ? t("verifying") : t("verify")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    {t("mobileNumber")} *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder={t("mobilePlaceholder")}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="flex-1 rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                    />
                    {!mobileOtpSent ? (
                      <button
                        type="button"
                        onClick={handleSendMobileOtp}
                        disabled={
                          sendingMobileOtp || mobileNumber === originalMobile
                        }
                        className="whitespace-nowrap rounded bg-[#b0004a] px-4 py-2 text-white disabled:opacity-50"
                      >
                        {sendingMobileOtp ? t("sending") : t("sendOtp")}
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t("otp")}
                          value={mobileOtp}
                          onChange={(e) => setMobileOtp(e.target.value)}
                          className="w-24 rounded border border-[#e3bdc3] px-2 py-2 text-center outline-none focus:border-[#b0004a]"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyMobileOtp}
                          disabled={verifyingMobile}
                          className="whitespace-nowrap rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                        >
                          {verifyingMobile ? t("verifying") : t("verify")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="max-w-md">
                <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                  {t("nifTaxId")}
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
                    <h2 className="text-xl font-semibold">
                      {t("deliveryAddress")}
                    </h2>
                  </div>
                  <p className="ml-9 text-sm text-[#5a4044]">
                    {t("confirmLocation")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleUseGPS}
                    className="flex items-center gap-2 rounded border border-[#b0004a] bg-[#b0004a]/10 px-4 py-2 text-[#b0004a]"
                  >
                    <LocateFixed size={18} /> {t("useGps")}
                  </button>
                  <button
                    type="button"
                    onClick={handleFullMap}
                    className="flex items-center gap-2 rounded border border-[#e3bdc3] px-4 py-2"
                  >
                    <Map size={18} /> {t("fullMap")}
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
                  placeholder={t("searchAddressPlaceholder")}
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
                    {t("locationConfirmed")}
                  </p>
                  <p className="font-medium text-green-900">
                    {street}, {city}, {postalCode}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-[#5a4044]">
                  {t("labelAs")} *
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
                    {t("streetAddress")} *
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
                    {t("houseApartmentFloor")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("houseApartmentFloorPlaceholder")}
                    value={houseDetail}
                    onChange={(e) => setHouseDetail(e.target.value)}
                    className="w-full rounded border border-[#e3bdc3] px-4 py-3 outline-none focus:border-[#b0004a]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044]">
                    {t("city")} *
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
                    {t("postalCode")} *
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
                    {t("stateRegion")} *
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
                    {t("country")} *
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
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || imageUploading}
                className="rounded bg-[#b0004a] px-12 py-3 font-bold text-white shadow-lg disabled:opacity-50"
              >
                {imageUploading
                  ? t("uploadingImage")
                  : submitting
                    ? t("saving")
                    : t("saveChanges")}
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
