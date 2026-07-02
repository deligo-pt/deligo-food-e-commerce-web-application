/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Home, Pencil, Trash2 } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import SavedAddressesSkeleton from "./SavedAddressesSkeleton";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

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
      toast.success(t("primaryAddressUpdated"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("failedToUpdatePrimaryAddress")));
    } finally {
      setUpdatingId(null);
    }
  };
  const handleDeleteAddress = (addressId: string) => {
    setAddressToDelete(addressId);
  };

  const confirmDeleteAddress = async () => {
    if (!addressToDelete) return;
    const addressId = addressToDelete;
    setAddressToDelete(null);

    try {
      setDeletingId(addressId);

      await apiClient.delete(`/customers/delete-delivery-address/${addressId}`);

      await fetchAddresses();
      window.dispatchEvent(new Event("addressUpdated"));
      toast.success(t("addressDeleted"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("failedToDeleteAddress")));
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
      <div className="flex min-h-100 items-center justify-center text-red-500 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5 text-black dark:text-neutral-200" />
          </button>

          <h1 className="text-3xl font-bold text-black dark:text-neutral-50">
            {t("savedAddresses")}
          </h1>
        </div>

        <button onClick={fetchAddresses}>
          <RefreshCw className="h-4 w-4 text-black dark:text-neutral-200" />
        </button>
      </div>

      {/* Profile Address */}
      {profileAddress && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            {t("profileAddress") || "Profile Address"}
          </h2>
          <div className="flex items-start gap-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-neutral-800">
              <Home className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-semibold uppercase text-blue-600 dark:text-blue-400">
                  {t("profileAddress") || "Profile Address"}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-black dark:text-neutral-100">
                {profileAddress.detailedAddress || profileAddress.street}
              </p>
              <p className="truncate text-xs text-gray-600 dark:text-neutral-400">
                {profileAddress.city}, {profileAddress.state}, {profileAddress.country}{" "}
                {profileAddress.postalCode}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/edit-profile">
                <Pencil className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Addresses */}
      <div className="space-y-4">
        {addresses.length > 0 && (
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
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
                ? "border border-pink-200 dark:border-pink-900/50 bg-pink-50 dark:bg-pink-950/20"
                : "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/30 hover:border-pink-300 dark:hover:border-pink-500/30 hover:bg-pink-50/40 dark:hover:bg-pink-950/5"
                } ${updatingId === address._id || deletingId === address._id
                  ? "pointer-events-none opacity-70"
                  : ""
                }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${isPrimary ? "bg-white dark:bg-neutral-800" : "bg-gray-100 dark:bg-neutral-800"
                  }`}
              >
                <Home
                  className={`h-4 w-4 ${isPrimary ? "text-[#C2185B] dark:text-pink-400" : "text-gray-600 dark:text-neutral-400"
                    }`}
                />
              </div>

              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold uppercase ${isPrimary ? "text-[#C2185B] dark:text-pink-400" : "text-black dark:text-neutral-200"
                      }`}
                  >
                    {address.addressType}
                  </span>

                  {isPrimary && (
                    <span className="rounded bg-[#C2185B] dark:bg-pink-600 px-1.5 py-1px text-[9px] font-semibold text-white">
                      {t("primary")}
                    </span>
                  )}
                </div>

                <p className="truncate text-sm font-semibold text-black dark:text-neutral-100">
                  {address.detailedAddress || address.street}
                </p>

                <p className="truncate text-xs text-gray-600 dark:text-neutral-400">
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
                  <Pencil className="h-4 w-4 text-[#C2185B] dark:text-pink-400" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAddress(address._id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-[#C2185B] dark:text-pink-400" />
                </button>
              </div>
            </div>
          );
        })}

        {addresses.length === 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 text-center text-sm text-gray-500 dark:text-neutral-450">
            {t("noSavedAddressesFound")}
          </div>
        )}

      </div>

      <AlertDialog open={addressToDelete !== null} onOpenChange={(open) => !open && setAddressToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAddress")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAddressConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAddress} className="bg-[#C2185B] hover:bg-[#A01248] dark:bg-pink-600 dark:hover:bg-pink-700 text-white">
              {t("deleteLabel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
