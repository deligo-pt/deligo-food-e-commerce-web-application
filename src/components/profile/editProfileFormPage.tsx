/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { Pencil, User, X } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import Image from "next/image";
import EditProfileFormSkeleton from "./EditProfileFormSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";

interface ProfileData {
  userId: string;
  name: { firstName: string; lastName: string };
  email: string;
  contactNumber?: string;
  NIF?: string;
  profilePhoto?: string;
}

export default function EditProfileFormPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [nif, setNif] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
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
      headers: { "Content-Type": "multipart/form-data" },
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
          if (d.profilePhoto) setImagePreview(d.profilePhoto);
        } else {
          throw new Error("Invalid response");
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to load profile"));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
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
      toast.error("Please enter a new email address to update");
      return;
    }
    setSendingEmailOtp(true);
    try {
      await apiClient.patch("/profile/send-otp", { email });
      setEmailOtpSent(true);
      toast.success("OTP sent to your new email address");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to send OTP"));
    } finally {
      setSendingEmailOtp(false);
    }
  };

  // Verify OTP and update email
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp) {
      toast.error("Please enter OTP");
      return;
    }
    setVerifyingEmail(true);
    try {
      await apiClient.patch("/profile/update-email-or-contact-number", {
        otp: emailOtp,
        type: "email",
      });
      setOriginalEmail(email);
      setEmailOtpSent(false);
      setEmailOtp("");
      toast.success("Email updated successfully");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to verify OTP"));
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Send OTP for mobile
  const handleSendMobileOtp = async () => {
    if (!mobileNumber || mobileNumber === originalMobile) {
      toast.error("Please enter a new mobile number to update");
      return;
    }
    setSendingMobileOtp(true);
    try {
      await apiClient.patch("/profile/send-otp", { contactNumber: mobileNumber });
      setMobileOtpSent(true);
      toast.success("OTP sent to your new mobile number");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to send OTP"));
    } finally {
      setSendingMobileOtp(false);
    }
  };

  // Verify OTP and update mobile
  const handleVerifyMobileOtp = async () => {
    if (!mobileOtp) {
      toast.error("Please enter OTP");
      return;
    }
    setVerifyingMobile(true);
    try {
      await apiClient.patch("/profile/update-email-or-contact-number", {
        otp: mobileOtp,
        type: "mobile",
      });
      setOriginalMobile(mobileNumber);
      setMobileOtpSent(false);
      setMobileOtp("");
      toast.success("Mobile number updated successfully");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to verify OTP"));
    } finally {
      setVerifyingMobile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData?.userId) {
      toast.error("User ID not found");
      return;
    }

    setSubmitting(true);

    try {
      let uploadedPhotoUrl: string | undefined = undefined;

      if (selectedFile) {
        setImageUploading(true);
        try {
          uploadedPhotoUrl = await uploadProfilePhoto(selectedFile);
        } catch (uploadErr) {
          toast.error(getApiErrorMessage(uploadErr, "Failed to upload profile photo"));
          setSubmitting(false);
          setImageUploading(false);
          return;
        } finally {
          setImageUploading(false);
        }
      }

      const payload: any = {};

      if (firstName || lastName) {
        payload.name = {};
        if (firstName) payload.name.firstName = firstName;
        if (lastName) payload.name.lastName = lastName;
      }

      if (nif) payload.NIF = nif;
      if (uploadedPhotoUrl) payload.profilePhoto = uploadedPhotoUrl;

      await apiClient.patch(`/customers/${profileData.userId}`, payload);

      toast.success("Profile updated successfully!");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      const { data } = await apiClient.get("/profile");
      if (data.success && data.data) {
        const d = data.data;
        setProfileData(d);
        if (d.profilePhoto) setImagePreview(d.profilePhoto);
        setOriginalEmail(d.email || "");
        setOriginalMobile(d.contactNumber || "");
        setEmail(d.email || "");
        setMobileNumber(d.contactNumber || "");
        // Notify Navbar to update profile photo instantly
        window.dispatchEvent(
          new CustomEvent("profilePhotoUpdated", {
            detail: { profilePhoto: d.profilePhoto || null },
          })
        );
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error(getApiErrorMessage(err, "Failed to update profile"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <EditProfileFormSkeleton />;
  }

  return (
    <section className="bg-[#f8f9fa] dark:bg-neutral-950 py-8 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-250 px-4">
        <div className="mb-6 flex items-center gap-2 text-sm text-[#5a4044] dark:text-neutral-400">
          <span>{t("home")}</span>
          <span>{t("account")}</span>
          <span>{t("editProfile")}</span>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex flex-col items-center border-b border-neutral-200/50 dark:border-neutral-800 bg-linear-to-b from-neutral-50 dark:from-neutral-800/10 to-transparent py-10">
            <div className="relative">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white dark:border-neutral-800 shadow-lg flex items-center justify-center bg-pink-50 dark:bg-pink-950/30">
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                    width={128}
                    height={128}
                  />
                ) : (
                  <User className="h-16 w-16 text-[#b0004a] dark:text-pink-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 cursor-pointer rounded-full border-2 border-white dark:border-neutral-800 bg-[#b0004a] dark:bg-pink-650 p-2 text-white shadow-lg">
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
            <h1 className="text-2xl font-bold mt-4 text-gray-900 dark:text-neutral-50">{t("editProfile")}</h1>
            <p className="text-sm text-[#5a4044] dark:text-neutral-400">{t("manageAccountInfo")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10 p-8 md:p-12 bg-white dark:bg-neutral-900">
            {/* Basic Information */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-50">{t("basicInformation")}</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("firstName")} *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#b0004a] dark:focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("lastName")} ({t("optional")})
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#b0004a] dark:focus:border-pink-500"
                  />
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("emailAddress")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#b0004a] dark:focus:border-pink-500"
                    />
                    {!emailOtpSent ? (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        disabled={sendingEmailOtp || email === originalEmail}
                        className="whitespace-nowrap rounded bg-[#b0004a] dark:bg-pink-600 hover:bg-[#90003b] dark:hover:bg-pink-700 px-4 py-2 text-white disabled:opacity-50 transition"
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
                          className="w-24 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-2 text-center outline-none text-gray-900 dark:text-neutral-100 focus:border-[#b0004a] dark:focus:border-pink-500"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyEmailOtp}
                          disabled={verifyingEmail}
                          className="whitespace-nowrap rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50 transition"
                        >
                          {verifyingEmail ? t("verifying") : t("verify")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("mobileNumber")} *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder={t("mobilePlaceholder")}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="flex-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#b0004a] dark:focus:border-pink-500"
                    />
                    {!mobileOtpSent ? (
                      <button
                        type="button"
                        onClick={handleSendMobileOtp}
                        disabled={sendingMobileOtp || mobileNumber === originalMobile}
                        className="whitespace-nowrap rounded bg-[#b0004a] dark:bg-pink-650 hover:bg-[#90003b] dark:hover:bg-pink-700 px-4 py-2 text-white disabled:opacity-50 transition"
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
                          className="w-24 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-2 text-center outline-none text-gray-900 dark:text-neutral-100 focus:border-[#b0004a] dark:focus:border-pink-500"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyMobileOtp}
                          disabled={verifyingMobile}
                          className="whitespace-nowrap rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50 transition"
                        >
                          {verifyingMobile ? t("verifying") : t("verify")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="max-w-md">
                <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                  {t("nifTaxId")}
                </label>
                <input
                  type="text"
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  className="w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#b0004a] dark:focus:border-pink-500"
                />
              </div>
            </section>

            <div className="flex flex-col justify-end gap-4 border-t border-neutral-200/50 dark:border-neutral-800 pt-8 sm:flex-row">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-8 py-3 font-bold text-[#b0004a] dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || imageUploading}
                className="rounded bg-[#b0004a] dark:bg-pink-600 hover:bg-[#90003b] dark:hover:bg-pink-700 px-12 py-3 font-bold text-white shadow-lg disabled:opacity-50 transition"
              >
                {imageUploading
                  ? t("uploadingImage")
                  : submitting
                    ? t("saving")
                    : t("saveChanges")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
