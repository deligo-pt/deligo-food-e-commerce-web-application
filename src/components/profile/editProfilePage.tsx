/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FileText, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { apiClient, getApiErrorMessage } from "../../lib/apiClient";
import Link from "next/link";
import EditProfileSkeleton from "./EditProfileSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

interface ProfileData {
  name: { firstName: string; lastName: string };
  email: string;
  contactNumber?: string;
  NIF: string;
  address: { street: string; city: string; postalCode: string };
  profilePhoto?: string;
}

export default function EditProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    nif: "",
    address: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await apiClient.get("/profile");
        if (data.success && data.data) {
          const profileData = data.data;
          setProfile(profileData);

          const addr = profileData.address || {};
          const fullAddress = [addr.street, addr.city, addr.postalCode]
            .filter(Boolean)
            .join(", ");

          setFormData({
            firstName: profileData.name?.firstName || "",
            lastName: profileData.name?.lastName || "",
            email: profileData.email || "",
            mobile: profileData.contactNumber || "",
            nif: profileData.NIF || "",
            address: fullAddress,
          });
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

  if (loading) return <EditProfileSkeleton />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="bg-[#f8f9fa] dark:bg-neutral-950 py-10 transition-colors duration-200">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6 flex items-center gap-2 text-xs text-[#5a4044] dark:text-neutral-400">
          <span>{t("home")}</span>
          <span>{t("settings")}</span>
          <span className="font-semibold text-[#191c1d] dark:text-neutral-200">
            {t("editProfile")}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-10">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-24 w-24 overflow-hidden rounded-full bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center border border-neutral-200 dark:border-neutral-800">
                  {profile?.profilePhoto ? (
                    <Image
                      src={profile.profilePhoto}
                      alt="Profile"
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-12 w-12 text-[#b0004a] dark:text-pink-400" />
                  )}
                </div>
              </div>
              <h1 className="mt-5 text-3xl font-bold text-[#191c1d] dark:text-neutral-50">
                {t("myProfile")}
              </h1>

              <p className="mt-1 text-sm text-[#5a4044] dark:text-neutral-400">
                {t("viewAccountDetails")}
              </p>
            </div>
          </div>

          <div className="p-6 md:p-10">
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              <InputField
                label={t("firstName")}
                icon={<User size={18} />}
                value={formData.firstName}
                readOnly
                required
              />
              <InputField
                label={t("lastName")}
                icon={<User size={18} />}
                value={formData.lastName}
                readOnly
                optional
                optionalText={t("optional")}
              />
              <InputField
                label={t("emailAddress")}
                icon={<Mail size={18} />}
                type="email"
                value={formData.email}
                readOnly
              />
              <InputField
                label={t("mobileNumber")}
                icon={<Phone size={18} />}
                type="tel"
                value={formData.mobile}
                readOnly
                optional
                optionalText={t("optional")}
                placeholder={t("notProvided")}
              />
              <InputField
                label={t("nifTaxId")}
                icon={<FileText size={18} />}
                value={formData.nif}
                readOnly
                optional
                optionalText={t("optional")}
              />
              <div className="md:col-span-2">
                <InputField
                  label={t("deliveryAddress")}
                  icon={<MapPin size={18} />}
                  value={formData.address}
                  readOnly
                  placeholder={t("noAddressSaved")}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800 pt-8">
              <div className="flex justify-end">
                <Link href="/edit-profile-form">
                  <button className="flex items-center justify-center gap-2 rounded-xl bg-[#b0004a] dark:bg-pink-600 hover:bg-[#90003b] dark:hover:bg-pink-700 px-10 py-3 font-semibold text-white transition">
                    {t("editProfile")} <Pencil size={18} />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="bg-[#f8f9fa] dark:bg-neutral-950 py-10 transition-colors duration-200 min-h-screen flex items-center justify-center text-gray-900 dark:text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 text-center text-red-600 dark:text-red-400">
        Error: {message}
      </div>
    </section>
  );
}

function InputField({
  label,
  icon,
  value,
  readOnly,
  type = "text",
  required,
  optional,
  optionalText,
  placeholder,
}: any) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
        {label} {required && <span className="text-[#b0004a] dark:text-pink-400">*</span>}
        {optional && (
          <span className="text-xs text-gray-400 dark:text-neutral-500"> ({optionalText})</span>
        )}
      </label>
      <div className="flex h-14 items-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4">
        <span className="text-gray-500 dark:text-neutral-400">{icon}</span>
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          className="ml-3 w-full border-none bg-transparent text-sm outline-none text-gray-900 dark:text-neutral-100 read-only:text-gray-500 dark:read-only:text-neutral-400"
        />
      </div>
    </div>
  );
}
