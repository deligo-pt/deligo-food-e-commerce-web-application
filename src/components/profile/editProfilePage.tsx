// "use client";

// import Image from "next/image";
// import {
//   Bell,
//   CheckCircle,
//   CreditCard,
//   FileText,
//   Mail,
//   MapPin,
//   Pencil,
//   Phone,
//   Shield,
//   User,
// } from "lucide-react";

// export default function EditProfilePage() {
//   return (
//     <section className="bg-[#f8f9fa] py-10">
//       <div className="mx-auto max-w-5xl px-4">
//         {/* Breadcrumb */}
//         <div className="mb-6 flex items-center gap-2 text-xs text-[#5a4044]">
//           <span>Home</span>
//           <span>›</span>
//           <span>Settings</span>
//           <span>›</span>
//           <span className="font-semibold text-[#191c1d]">
//             Edit Profile
//           </span>
//         </div>

//         {/* Main Card */}
//         <div className="overflow-hidden rounded-2xl border border-[#e3bdc3] bg-white shadow-sm">
//           {/* Header */}
//           <div className="border-b border-[#e3bdc3] px-6 py-10">
//             <div className="flex flex-col items-center">
//               <div className="relative">
//                 <div className="h-24 w-24 overflow-hidden rounded-full">
//                   <Image
//                     src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80"
//                     alt="Profile"
//                     width={96}
//                     height={96}
//                     className="h-full w-full object-cover"
//                   />
//                 </div>

//                 <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#b0004a] text-white shadow-md">
//                   <Pencil size={14} />
//                 </button>
//               </div>

//               <h1 className="mt-5 text-3xl font-bold text-[#191c1d]">
//                 Edit Profile
//               </h1>

//               <p className="mt-1 text-sm text-[#5a4044]">
//                 Manage your account information and preferences
//               </p>
//             </div>
//           </div>

//           {/* Form */}
//           <div className="p-6 md:p-10">
//             <form className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
//               {/* First Name */}
//               <div>
//                 <label className="mb-2 block text-sm font-medium text-[#5a4044]">
//                   First Name <span className="text-[#b0004a]">*</span>
//                 </label>

//                 <div className="flex h-14 items-center rounded-xl border border-[#e3bdc3] bg-white px-4">
//                   <User
//                     size={18}
//                     className="text-[#5a4044]"
//                   />

//                   <input
//                     type="text"
//                     placeholder="Enter your first name"
//                     className="ml-3 w-full border-none bg-transparent text-sm outline-none"
//                   />
//                 </div>
//               </div>

//               {/* Last Name */}
//               <div>
//                 <label className="mb-2 block text-sm font-medium text-[#5a4044]">
//                   Last Name (optional)
//                 </label>

//                 <div className="flex h-14 items-center rounded-xl border border-[#e3bdc3] bg-white px-4">
//                   <User
//                     size={18}
//                     className="text-[#5a4044]"
//                   />

//                   <input
//                     type="text"
//                     placeholder="Enter your last name"
//                     className="ml-3 w-full border-none bg-transparent text-sm outline-none"
//                   />
//                 </div>
//               </div>

//               {/* Email */}
//               <div>
//                 <label className="mb-2 block text-sm font-medium text-[#5a4044]">
//                   Email Address (optional)
//                 </label>

//                 <div className="flex h-14 items-center rounded-xl border border-[#e3bdc3] bg-white px-4">
//                   <Mail
//                     size={18}
//                     className="text-[#5a4044]"
//                   />

//                   <input
//                     type="email"
//                     defaultValue="oaskorne@gmail.com"
//                     className="ml-3 w-full border-none bg-transparent text-sm outline-none"
//                   />
//                 </div>
//               </div>

//               {/* Mobile */}
//               <div>
//                 <label className="mb-2 block text-sm font-medium text-[#5a4044]">
//                   Mobile Number{" "}
//                   <span className="text-[#b0004a]">*</span>
//                 </label>

//                 <div className="flex h-14 items-center rounded-xl border border-[#e3bdc3] bg-white px-4">
//                   <Phone
//                     size={18}
//                     className="text-[#5a4044]"
//                   />

//                   <input
//                     type="tel"
//                     placeholder="Enter your mobile"
//                     className="ml-3 w-full border-none bg-transparent text-sm outline-none"
//                   />
//                 </div>
//               </div>

//               {/* NIF */}
//               <div>
//                 <label className="mb-2 block text-sm font-medium text-[#5a4044]">
//                   NIF / Tax ID (optional)
//                 </label>

//                 <div className="flex h-14 items-center rounded-xl border border-[#e3bdc3] bg-white px-4">
//                   <FileText
//                     size={18}
//                     className="text-[#5a4044]"
//                   />

//                   <input
//                     type="text"
//                     placeholder="Enter your NIF"
//                     className="ml-3 w-full border-none bg-transparent text-sm outline-none"
//                   />
//                 </div>
//               </div>

//               {/* Address */}
//               <div className="md:col-span-2">
//                 <label className="mb-2 block text-sm font-medium text-[#5a4044]">
//                   Delivery Address
//                 </label>

//                 <div className="flex h-14 items-center rounded-xl border border-[#e3bdc3] bg-white px-4">
//                   <MapPin
//                     size={18}
//                     className="text-[#5a4044]"
//                   />

//                   <input
//                     type="text"
//                     placeholder="Enter your home address"
//                     className="ml-3 w-full border-none bg-transparent text-sm outline-none"
//                   />

//                   <button
//                     type="button"
//                     className="text-xs font-semibold text-[#b0004a]"
//                   >
//                     Use Current
//                   </button>
//                 </div>
//               </div>

//               {/* Actions */}
//               <div className="mt-6 border-t border-[#e3bdc3] pt-8 md:col-span-2">
//                 <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
//                   <button
//                     type="button"
//                     className="rounded-xl border border-[#b0004a] px-8 py-3 font-semibold text-[#b0004a] transition hover:bg-[#fff2f3]"
//                   >
//                     Cancel
//                   </button>

//                   <button
//                     type="submit"
//                     className="flex items-center justify-center gap-2 rounded-xl bg-[#b0004a] px-10 py-3 font-semibold text-white transition hover:bg-[#90003b]"
//                   >
//                     Save Changes
//                     <CheckCircle size={18} />
//                   </button>
//                 </div>
//               </div>
//             </form>
//           </div>
//         </div>

//         {/* Bottom Cards */}
//         <div className="mt-8 grid gap-6 md:grid-cols-3">
//           <div className="rounded-xl border border-[#e3bdc3] bg-white p-6 transition hover:border-[#b0004a]">
//             <Shield
//               size={22}
//               className="mb-4 text-[#b0004a]"
//             />

//             <h3 className="mb-2 text-lg font-semibold">
//               Password
//             </h3>

//             <p className="text-sm text-[#5a4044]">
//               Update your login credentials and security settings.
//             </p>
//           </div>

//           <div className="rounded-xl border border-[#e3bdc3] bg-white p-6 transition hover:border-[#b0004a]">
//             <Bell
//               size={22}
//               className="mb-4 text-[#b0004a]"
//             />

//             <h3 className="mb-2 text-lg font-semibold">
//               Notifications
//             </h3>

//             <p className="text-sm text-[#5a4044]">
//               Choose how you want to be alerted about your orders.
//             </p>
//           </div>

//           <div className="rounded-xl border border-[#e3bdc3] bg-white p-6 transition hover:border-[#b0004a]">
//             <CreditCard
//               size={22}
//               className="mb-4 text-[#b0004a]"
//             />

//             <h3 className="mb-2 text-lg font-semibold">
//               Payments
//             </h3>

//             <p className="text-sm text-[#5a4044]">
//               Manage your saved credit cards and wallets.
//             </p>
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { FileText, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { apiClient, getApiErrorMessage } from "../../lib/apiClient";

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
          const fullAddress = [addr.street, addr.city, addr.postalCode].filter(Boolean).join(", ");

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

  const handleEditClick = () => {
    // Static for now – later implement edit functionality
    alert("Edit functionality coming soon");
  };

  if (loading) return <LoadingState />;
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
                    src={profile?.profilePhoto || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80"}
                    alt="Profile"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <h1 className="mt-5 text-3xl font-bold text-[#191c1d]">My Profile</h1>
              <p className="mt-1 text-sm text-[#5a4044]">View your account details</p>
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
                <button
                  onClick={handleEditClick}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#b0004a] px-10 py-3 font-semibold text-white hover:bg-[#90003b]"
                >
                  Edit Profile <Pencil size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <section className="bg-[#f8f9fa] py-10">
      <div className="mx-auto max-w-5xl px-4 text-center">Loading profile...</div>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="bg-[#f8f9fa] py-10">
      <div className="mx-auto max-w-5xl px-4 text-center text-red-600">Error: {message}</div>
    </section>
  );
}

function InputField({ label, icon, value, readOnly, type = "text", required, optional, placeholder }: any) {
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