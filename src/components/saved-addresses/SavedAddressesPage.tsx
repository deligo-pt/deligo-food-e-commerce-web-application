/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Home, Pencil, Trash2, Plus } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import SavedAddressesSkeleton from "./SavedAddressesSkeleton";

interface DeliveryAddress {
  _id: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  detailedAddress?: string;
  addressType: string;
  isActive: boolean;
}

interface ProfileAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  detailedAddress?: string;
}

interface ProfileResponse {
  success: boolean;
  message: string;
  data: {
    address: ProfileAddress;
    deliveryAddresses: DeliveryAddress[];
  };
}

export default function SavedAddressesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [profileAddress, setProfileAddress] = useState<ProfileAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiClient.get<ProfileResponse>("/profile");

      setProfileAddress(response.data.data.address || null);
      setAddresses(response.data.data.deliveryAddresses || []);
    } catch (error) {
      setError(getApiErrorMessage(error, "Failed to load addresses"));
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimaryAddress = async (addressId: string) => {
    try {
      setUpdatingId(addressId);

      await apiClient.patch(
        `/customers/toggle-delivery-address-status/${addressId}`,
      );

      await fetchAddresses();
      window.dispatchEvent(new Event("addressUpdated"));
    } catch (error) {
      alert(getApiErrorMessage(error, "Failed to update primary address"));
    } finally {
      setUpdatingId(null);
    }
  };
  const handleDeleteAddress = async (addressId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this address?",
    );

    if (!confirmed) return;

    try {
      setDeletingId(addressId);

      await apiClient.delete(`/customers/delete-delivery-address/${addressId}`);

      await fetchAddresses();
      window.dispatchEvent(new Event("addressUpdated"));
    } catch (error) {
      alert(getApiErrorMessage(error, "Failed to delete address"));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchAddresses();

    const handleFocus = () => {
      fetchAddresses();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
  if (loading) {
    return <SavedAddressesSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-100 items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button>
            <ArrowLeft className="h-5 w-5 text-black" />
          </button>

          <h1 className="text-3xl font-bold text-black">
            {t("savedAddresses")}
          </h1>
        </div>

        <button onClick={fetchAddresses}>
          <RefreshCw className="h-4 w-4 text-black" />
        </button>
      </div>

      {/* Profile Address */}
      {profileAddress && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t("profileAddress") || "Profile Address"}
          </h2>
          <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
              <Home className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-semibold uppercase text-blue-600">
                  {t("profileAddress") || "Profile Address"}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-black">
                {profileAddress.detailedAddress || profileAddress.street}
              </p>
              <p className="truncate text-xs text-gray-600">
                {profileAddress.city}, {profileAddress.state}, {profileAddress.country}{" "}
                {profileAddress.postalCode}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/edit-profile">
                <Pencil className="h-4 w-4 text-blue-500" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Addresses */}
      <div className="space-y-4">
        {addresses.length > 0 && (
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t("deliveryAddresses") || "Delivery Addresses"}
          </h2>
        )}

        {addresses.map((address) => {
          const isPrimary = address.isActive;

          return (
            <div
              key={address._id}
              onClick={() => {
                if (!address.isActive) {
                  handleSetPrimaryAddress(address._id);
                }
              }}
              className={`flex cursor-pointer items-start gap-4 rounded-xl p-4 transition-all ${isPrimary
                ? "border border-pink-200 bg-pink-50"
                : "border border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50/40"
                } ${updatingId === address._id || deletingId === address._id
                  ? "pointer-events-none opacity-70"
                  : ""
                }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${isPrimary ? "bg-white" : "bg-gray-100"
                  }`}
              >
                <Home
                  className={`h-4 w-4 ${isPrimary ? "text-[#C2185B]" : "text-gray-600"
                    }`}
                />
              </div>

              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold uppercase ${isPrimary ? "text-[#C2185B]" : "text-black"
                      }`}
                  >
                    {address.addressType}
                  </span>

                  {isPrimary && (
                    <span className="rounded bg-[#C2185B] px-1.5 py-1px text-[9px] font-semibold text-white">
                      {t("primary")}
                    </span>
                  )}
                </div>

                <p className="truncate text-sm font-semibold text-black">
                  {address.detailedAddress || address.street}
                </p>

                <p className="truncate text-xs text-gray-600">
                  {address.city}, {address.state}, {address.country}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/edit-address/${address._id}`);
                  }}
                >
                  <Pencil className="h-4 w-4 text-[#C2185B]" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAddress(address._id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-[#C2185B]" />
                </button>
              </div>
            </div>
          );
        })}

        {addresses.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            {t("noSavedAddressesFound")}
          </div>
        )}

        {/* Add New Address */}
        <Link href="/add-address">
          <button className="flex h-24 w-full items-center justify-center gap-3 rounded-xl border border-dashed border-[#C2185B] text-[#C2185B]">
            <Plus className="h-5 w-5" />

            <span className="text-base font-medium">{t("addNewAddress")}</span>
          </button>
        </Link>
      </div>
    </div>
  );
}
