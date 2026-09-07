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
import { addressTypeLabel, normalizeAddressType } from "@/lib/addressType";
import {
  formatAddressLine1,
  formatAddressLine2,
} from "@/lib/addressFormat";
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
import { Button } from "@/components/ui/button";

interface DeliveryAddress {
  _id: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  detailedAddress?: string;
  addressType: string;
  /** The customer's own name for an `OTHER` address; "" on older records. */
  customAddressType?: string;
  isActive: boolean;
}

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

  const handleSetActiveAddress = async (addressId: string) => {
    try {
      setUpdatingId(addressId);

      await apiClient.patch(
        `/customers/toggle-delivery-address-status/${addressId}`,
      );

      await invalidateProfile();
      window.dispatchEvent(new Event("addressUpdated"));
      toast.success(t("activeAddressUpdated"));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("failedToUpdateActiveAddress")));
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

  /* Phase 12. The skeleton above is swapped out in a single frame;
     `motion-fade` is that same swap over 300ms. Opacity only, once, and
     it opts out under prefers-reduced-motion with the rest of the set. */
  return (
    <div className="motion-fade mx-auto max-w-2xl px-4 py-6 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Header. No manual refresh control: the list already re-fetches on
          window focus and after every mutation, so the button gave the user
          nothing to observe. */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-display font-bold text-black dark:text-neutral-50">
          {t("manageAddresses")}
        </h1>
      </div>

      {/* Delivery Addresses */}
      <div className="space-y-4">
        {addresses.length > 0 && (
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground dark:text-neutral-400">
            {t("deliveryAddresses") || "Delivery Addresses"}
          </h2>
        )}

        {addresses.map((address) => {
          // The selected address, badged ACTIVE / ATIVO. Distinct from the
          // retired `addressType: "PRIMARY"` some stored records still carry —
          // the old badge wording made those two look like the same thing.
          const isActiveAddress = address.isActive;
          // Never render `addressType` raw — it would leak internal enum values
          // (CURRENT_LOCATION) and legacy ones (PRIMARY) straight to the user.
          const TypeIcon = ADDRESS_TYPE_ICONS[normalizeAddressType(address.addressType)];

          return (
            <div
              key={address._id}
              onClick={() => {
                if (!address.isActive) {
                  handleSetActiveAddress(address._id);
                }
              }}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-all sm:gap-4 sm:p-4 ${isActiveAddress
                ? "border border-primary/20 dark:border-pink-900/50 bg-primary/5 dark:bg-pink-950/20"
                : "border border-border bg-white dark:bg-neutral-900/30 hover:border-primary/30 dark:hover:border-pink-500/30 hover:bg-primary/5 dark:hover:bg-pink-950/5"
                } ${updatingId === address._id || deletingId === address._id
                  ? "pointer-events-none opacity-70"
                  : ""
                }`}
            >
              {/* shrink-0: without it the icon is squeezed into an oval as soon
                  as the address text is long enough to compete for width. */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isActiveAddress ? "bg-white dark:bg-neutral-800" : "bg-gray-100 dark:bg-neutral-800"
                  }`}
              >
                <TypeIcon
                  className={`h-4 w-4 ${isActiveAddress ? "text-primary dark:text-pink-400" : "text-gray-600 dark:text-neutral-400"
                    }`}
                />
              </div>

              {/* min-w-0 is what keeps a long address inside the card: a flex
                  item defaults to min-width:auto, i.e. its content width, so
                  without this the row grows past the card and pushes the action
                  buttons out of the background entirely. */}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`text-sm font-semibold uppercase ${isActiveAddress ? "text-primary dark:text-pink-400" : "text-black dark:text-neutral-200"
                      }`}
                  >
                    {addressTypeLabel(t, address.addressType, address.customAddressType)}
                  </span>

                  {isActiveAddress && (
                    <span className="rounded bg-primary dark:bg-pink-600 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-white">
                      {t("active")}
                    </span>
                  )}
                </div>

                {/* Addresses wrap rather than truncate — a clipped street line
                    is the half a courier can least afford to lose, and these
                    cards have no other place to show it. */}
                <p className="text-sm leading-snug font-semibold break-words text-black dark:text-neutral-100">
                  {formatAddressLine1(address)}
                </p>

                <p className="mt-0.5 text-xs leading-snug break-words text-gray-600 dark:text-neutral-400">
                  {formatAddressLine2(address)}
                </p>
              </div>

              {/* Icon-only, so they carry their own labels. Sized to a real
                  36px tap target instead of the bare 16px glyph. */}
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("editAddress")}
                  title={t("editAddress")}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/edit-address/${address._id}`);
                  }}
                  className="hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Pencil className="h-4 w-4 text-primary dark:text-pink-400" />
                </Button>

                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("deleteAddress")}
                  title={t("deleteAddress")}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAddress(address._id);
                  }}
                  className="hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4 text-primary dark:text-pink-400" />
                </Button>
              </div>
            </div>
          );
        })}

        {addresses.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-gray-500 dark:text-neutral-400">
            {t("noSavedAddressesFound")}
          </div>
        )}

        <Link
          href="/add-address"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 dark:border-pink-500/40 bg-white dark:bg-neutral-900/30 px-4 py-4 text-sm font-semibold text-primary dark:text-pink-400 transition-all hover:border-primary dark:hover:border-pink-400 hover:bg-primary/5 dark:hover:bg-pink-950/10"
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
