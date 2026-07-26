"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Pencil,
  Trash2,
  Plus,
  Briefcase,
  MapPin,
  Navigation,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { addressTypeLabelKey, normalizeAddressType } from "@/lib/addressType";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { useProfile, useInvalidateProfile } from "@/hooks/queries/useProfile";
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

/*
 * Postal format, two lines:
 *
 *   [Street Address], [House / Apartment / Floor]
 *   [Postal Code] [City], [Country]
 *
 * The field names map to the add/edit form's own labels — `street` is "Street
 * Address" and `detailedAddress` is "House / Apartment / Floor". They belong on
 * the same line: the previous `detailedAddress || street` showed the apartment
 * *instead of* the street whenever both were filled in, which is the half of an
 * address a courier can least afford to lose.
 *
 * Separators matter for reading: distinct components are comma-separated, while
 * postal code and city are one unit and stay space-joined ("1229 Dhaka").
 *
 * Parts are filtered rather than joined blindly — `postalCode` is not enforced
 * by the form, so it can legitimately be missing, and a blank one must not
 * leave a dangling comma or a leading space.
 */
const joinParts = (separator: string, ...parts: (string | undefined)[]) =>
  parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p)
    .join(separator);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * Addresses captured from the device's location store Google's *whole*
 * formatted address in `street` ("Ka-74/5 Progati Sarani Rd, Dhaka 1229,
 * Bangladesh"), while ones typed into the form store only the route. The
 * formatted ones carry the locality in Google's order — city before postal
 * code — so the same rule as line 2 is applied to them: postal code first.
 *
 * The swap is anchored on this address's own `city` value rather than a loose
 * pattern, so it can only fire where the city genuinely precedes a postal code
 * and can never reorder part of a street name.
 */
const postalBeforeCity = (line: string, city?: string) => {
  const c = city?.trim();
  if (!c) return line;
  // Portuguese (1750-126) and 4-digit formats such as Bangladesh's (1229).
  const re = new RegExp(`\\b${escapeRegExp(c)}\\s+(\\d{3,5}(?:-\\d{3,4})?)\\b`, "gi");
  return line.replace(re, (_match, code: string) => `${code} ${c}`);
};

const formatAddressLine1 = (a: DeliveryAddress) =>
  postalBeforeCity(joinParts(", ", a.street, a.detailedAddress), a.city);

const formatAddressLine2 = (a: DeliveryAddress) =>
  joinParts(", ", joinParts(" ", a.postalCode, a.city), a.country);

const ADDRESS_TYPE_ICONS = {
  HOME: Home,
  OFFICE: Briefcase,
  OTHER: MapPin,
  CURRENT_LOCATION: Navigation,
} as const;

// NOTE: the profile also carries an `address` object, but it is only a mirror of
// whichever delivery address is currently active — verified against the API by
// toggling the active address and watching `profile.address` follow it. It is
// deliberately not read here; the active card below is the same record.
interface ProfileResponse {
  success: boolean;
  message: string;
  data: {
    deliveryAddresses: DeliveryAddress[];
  };
}

export default function SavedAddressesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

  // Shared, cached profile query — addresses populate instantly if the Navbar
  // (or another page) already loaded the profile.
  const {
    data: profile,
    isLoading: loading,
    error: profileError,
  } = useProfile<ProfileResponse["data"]>();
  const invalidateProfile = useInvalidateProfile();

  const addresses = profile?.deliveryAddresses ?? [];
  const error = profileError
    ? getApiErrorMessage(profileError, "Failed to load addresses")
    : "";

  const handleSetPrimaryAddress = async (addressId: string) => {
    try {
      setUpdatingId(addressId);

      await apiClient.patch(
        `/customers/toggle-delivery-address-status/${addressId}`,
      );

      await invalidateProfile();
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

      await invalidateProfile();
      window.dispatchEvent(new Event("addressUpdated"));
      toast.success(t("addressDeleted"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("failedToDeleteAddress")));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const handleFocus = () => {
      invalidateProfile();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [invalidateProfile]);
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
      {/* Header. No manual refresh control: the list already re-fetches on
          window focus and after every mutation, so the button gave the user
          nothing to observe. */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-black dark:text-neutral-50">
          {t("manageAddresses")}
        </h1>
      </div>

      {/* Delivery Addresses */}
      <div className="space-y-4">
        {addresses.length > 0 && (
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            {t("deliveryAddresses") || "Delivery Addresses"}
          </h2>
        )}

        {addresses.map((address) => {
          const isPrimary = address.isActive;
          // Never render `addressType` raw — it would leak internal enum values
          // (CURRENT_LOCATION) and legacy ones (PRIMARY) straight to the user.
          const TypeIcon = ADDRESS_TYPE_ICONS[normalizeAddressType(address.addressType)];

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
                <TypeIcon
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
                    {t(addressTypeLabelKey(address.addressType))}
                  </span>

                  {isPrimary && (
                    <span className="rounded bg-[#C2185B] dark:bg-pink-600 px-1.5 py-1px text-[10px] font-semibold text-white">
                      {t("primary")}
                    </span>
                  )}
                </div>

                <p className="truncate text-sm font-semibold text-black dark:text-neutral-100">
                  {formatAddressLine1(address)}
                </p>

                <p className="truncate text-xs text-gray-600 dark:text-neutral-400">
                  {formatAddressLine2(address)}
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

        <Link
          href="/add-address"
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-pink-300 dark:border-pink-500/40 bg-white dark:bg-neutral-900/30 px-4 py-4 text-sm font-semibold text-[#C2185B] dark:text-pink-400 transition-all hover:border-[#C2185B] dark:hover:border-pink-400 hover:bg-pink-50/60 dark:hover:bg-pink-950/10"
        >
          <Plus className="h-4 w-4" />
          {t("addNewAddress")}
        </Link>

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
            <AlertDialogAction onClick={confirmDeleteAddress}>
              {t("deleteLabel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
