/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FileText, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { apiClient, getApiErrorMessage } from "../../lib/apiClient";
import Link from "next/link";
import EditProfileSkeleton from "./EditProfileSkeleton";

interface ProfileData {
  name: { firstName: string; lastName: string };
  email: string;
  NIF: string;
  address: { street: string; city: string; postalCode: string };
  profilePhoto?: string;
}

export default function EditProfilePage() {
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
            mobile: "",
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
    <section className="bg-[#f8f9fa] py-10">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6 flex items-center gap-2 text-xs text-[#5a4044]">
          <span>Home</span> <span>›</span> <span>Settings</span> <span>›</span>
          <span className="font-semibold text-[#191c1d]">Edit Profile</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e3bdc3] bg-white shadow-sm">
          <div className="border-b border-[#e3bdc3] px-6 py-10">
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="h-24 w-24 overflow-hidden rounded-full">
                  <Image
                    src={
                      profile?.profilePhoto ||
                      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80"
                    }
                    alt="Profile"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <h1 className="mt-5 text-3xl font-bold text-[#191c1d]">
                My Profile
              </h1>
              <p className="mt-1 text-sm text-[#5a4044]">
                View your account details
              </p>
            </div>
          </div>

          <div className="p-6 md:p-10">
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              <InputField
                label="First Name"
                icon={<User size={18} />}
                value={formData.firstName}
                readOnly
                required
              />
              <InputField
                label="Last Name"
                icon={<User size={18} />}
                value={formData.lastName}
                readOnly
                optional
              />
              <InputField
                label="Email Address"
                icon={<Mail size={18} />}
                type="email"
                value={formData.email}
                readOnly
              />
              <InputField
                label="Mobile Number"
                icon={<Phone size={18} />}
                type="tel"
                value={formData.mobile}
                readOnly
                optional
                placeholder="Not provided"
              />
              <InputField
                label="NIF / Tax ID"
                icon={<FileText size={18} />}
                value={formData.nif}
                readOnly
                optional
              />
              <div className="md:col-span-2">
                <InputField
                  label="Delivery Address"
                  icon={<MapPin size={18} />}
                  value={formData.address}
                  readOnly
                  placeholder="No address saved"
                />
              </div>
            </div>

            <div className="mt-6 border-t border-[#e3bdc3] pt-8">
              <div className="flex justify-end">
                <Link href="/edit-profile-form">
                  <button className="flex items-center justify-center gap-2 rounded-xl bg-[#b0004a] px-10 py-3 font-semibold text-white hover:bg-[#90003b]">
                    Edit Profile <Pencil size={18} />
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
    <section className="bg-[#f8f9fa] py-10">
      <div className="mx-auto max-w-5xl px-4 text-center text-red-600">
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
  placeholder,
}: any) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#5a4044]">
        {label} {required && <span className="text-[#b0004a]">*</span>}
        {optional && <span className="text-xs text-gray-400"> (optional)</span>}
      </label>
      <div className="flex h-14 items-center rounded-xl border border-[#e3bdc3] bg-white px-4">
        {icon}
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          className="ml-3 w-full border-none bg-transparent text-sm outline-none read-only:text-gray-500"
        />
      </div>
    </div>
  );
}
