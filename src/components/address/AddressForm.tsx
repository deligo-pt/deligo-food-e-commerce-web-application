/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Building2, Globe, Home, MapPin, Navigation, Save, Tag } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import { addDeliveryAddress, updateDeliveryAddress } from "@/services/addressApi";
import { getApiErrorMessage } from "@/lib/apiClient";
import {
  addressTypeLabelKey,
  normalizeAddressType,
  toBackendAddressType,
  toSelectableAddressType,
  type SelectableAddressType,
} from "@/lib/addressType";
import { useTranslation } from "@/hooks/useTranslation";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/authCookies";
import { useLocationStore } from "@/stores/locationStore";
import { Button } from "@/components/ui/button";

interface AddressFormProps {
  coordinates: { lat: number; lng: number } | null;
  initialAddress?: any;
  isEditMode?: boolean;
  /** Required in edit mode — identifies which saved address to update. */
  addressId?: string;
  onSuccess?: () => void;
  isGuestMode?: boolean;
  /**
   * Whether the position the page opens with should be reverse-geocoded into
   * the fields. True suits "set my current location", where filling in the
   * detected place is the point. False suits "add a new address", where that
   * position is only a guess and presenting it as filled-in data misrepresents
   * it as something the customer entered. Either way, a location they go on to
   * choose — search result or dragged pin — always autofills.
   */
  prefillFromOpeningLocation?: boolean;
  /**
   * Bump this to request a one-off prefill from the current `coordinates`, even
   * when they are the ones the page opened with. "Use Current Location" needs
   * it: a desktop browser geolocating by Wi-Fi/IP routinely returns the exact
   * same coordinates already on screen, and without an explicit signal that
   * fill is indistinguishable from the opening position — so the button would
   * silently do nothing.
   */
  prefillRequestId?: number;
}

export default function AddressForm({
  coordinates,
  initialAddress,
  isEditMode = false,
  addressId,
  onSuccess,
  isGuestMode = false,
  prefillFromOpeningLocation = true,
  prefillRequestId = 0,
}: AddressFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const isLoggedIn = !!getAccessToken();

  const getLabelText = (key: string) => {
    const value = t(key);
    const requiredKeys = [
      "streetAddress",
      // The courier needs the door, not just the street.
      "houseApartmentFloor",
      "city",
      "stateRegion",
      "country",
    ];
    if (requiredKeys.includes(key)) {
      return value.endsWith("*") ? value : `${value} *`;
    }
    return isEditMode ? value.replace(/\s*\*$/, "") : value;
  };
  const [addressType, setAddressType] = useState<SelectableAddressType>("home");
  // The customer's own name for an "Other" address ("Gym"). Kept out of
  // `formData` because it belongs to the type selection above it, not to the
  // postal fields — and because it is only ever sent for OTHER.
  const [customAddressType, setCustomAddressType] = useState("");
  const [formData, setFormData] = useState({
    street: "",
    detailedAddress: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const hasInitializedRef = useRef(false);
  // The position the page opened with, latched once. Used to tell it apart from
  // a location the customer actively picked afterwards.
  const openedWithCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastPrefillRequestRef = useRef(prefillRequestId);

  // Initialize from initialAddress (edit mode)
  useEffect(() => {
    if (!initialAddress) return;
    setFormData({
      street: initialAddress.street || "",
      detailedAddress: initialAddress.detailedAddress || "",
      city: initialAddress.city || "",
      state: initialAddress.state || "",
      country: initialAddress.country || "",
      postalCode: initialAddress.postalCode || "",
    });
    setCustomAddressType(initialAddress.customAddressType || "");
    if (initialAddress.addressType) {
      setAddressType(toSelectableAddressType(initialAddress.addressType));
    }
    // Mark that the form is populated — geocode effect can now safely replace fields
    hasInitializedRef.current = true;
  }, [initialAddress]);

  useEffect(() => {
    if (!coordinates) return;

    // Latch the opening position before any other guard, so a slow Maps script
    // or a still-loading saved address can't let a later, user-chosen pin be
    // mistaken for the one we opened with.
    if (!openedWithCoordsRef.current) openedWithCoordsRef.current = coordinates;
    const openedWith = openedWithCoordsRef.current;
    const isOpeningLocation =
      openedWith.lat === coordinates.lat && openedWith.lng === coordinates.lng;

    // An explicit "fill from this position" request outranks the opening-
    // location rule. Consumed once, so a later unrelated re-run doesn't replay.
    const wasRequested = prefillRequestId !== lastPrefillRequestRef.current;
    if (wasRequested) lastPrefillRequestRef.current = prefillRequestId;

    if (isOpeningLocation && !prefillFromOpeningLocation && !wasRequested) return;

    if (!window.google?.maps) return;

    // In edit mode, skip until initialAddress has been loaded into the form
    if (initialAddress && !hasInitializedRef.current) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat: coordinates.lat, lng: coordinates.lng } },
      (results: any[], status: any) => {
        if (status !== "OK" || !results?.length) {
          setFormData((prev) => ({
            ...prev,
            street: "",
            city: "",
            state: "",
            country: "",
            postalCode: "",
          }));
          return;
        }
        const comps = results[0].address_components;

        // Extract every component we care about (empty string = not present)
        let street = "",
          city = "",
          state = "",
          country = "",
          postalCode = "";

        comps.forEach((c: any) => {
          // Street: prefer "route"; fall back to "sublocality_level_1" for areas without named roads
          if (c.types.includes("route")) street = c.long_name;
          else if (!street && c.types.includes("sublocality_level_1"))
            street = c.long_name;
          if (c.types.includes("locality")) city = c.long_name;
          if (c.types.includes("administrative_area_level_1"))
            state = c.long_name;
          if (c.types.includes("country")) country = c.long_name;
          if (c.types.includes("postal_code")) postalCode = c.long_name;
        });

        // Always replace all geocoded fields — clear any that the geocoder didn't return
        setFormData((prev) => ({
          ...prev,
          street,
          city,
          state,
          country,
          postalCode,
        }));
      }
    );
  }, [coordinates, initialAddress, prefillFromOpeningLocation, prefillRequestId]);

  // Only OTHER carries a custom name, and the API demands a non-empty one for
  // it. Checked up front in both save paths so the customer gets a pointed
  // message instead of a raw Zod error from the server.
  const trimmedCustomType = customAddressType.trim();
  const needsCustomType = addressType === "other";

  const handleSave = async () => {
    if (needsCustomType && !trimmedCustomType) {
      toast.error(t("customAddressTypeRequired"));
      return;
    }

    if (isGuestMode) {
      if (!coordinates) {
        toast.error(t("locationNotDetected"));
        return;
      }
      if (!formData.street.trim()) {
        toast.error(t("streetRequired"));
        return;
      }
      if (!formData.detailedAddress.trim()) {
        toast.error(t("houseApartmentFloorRequired"));
        return;
      }
      if (!formData.city.trim()) {
        toast.error(t("cityRequired"));
        return;
      }
      if (!formData.state.trim()) {
        toast.error(t("regionRequired"));
        return;
      }
      if (!formData.country.trim()) {
        toast.error(t("countryRequired"));
        return;
      }

      setIsSaving(true);
      try {
        const guestAddress = {
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          country: formData.country.trim(),
          postalCode: formData.postalCode.trim(),
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          detailedAddress: formData.detailedAddress.trim(),
          addressType: toBackendAddressType(addressType),
          // Carried through so the name survives the guest→account sync on
          // login, which replays this object to the API.
          ...(needsCustomType ? { customAddressType: trimmedCustomType } : {}),
        };
        useLocationStore.getState().setGuestAddress(guestAddress);
        window.dispatchEvent(new Event("addressUpdated"));
        toast.success(t("locationSavedLocally"));
        onSuccess?.();
      } catch (err: any) {
        toast.error(t("failedToSaveLocation"));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!getAccessToken()) {
      toast.info(t("pleaseLogInToSaveAddress"));
      router.push("/login");
      return;
    }
    if (!coordinates) {
      toast.error(t("locationNotDetected"));
      return;
    }
    if (!formData.street.trim()) {
      toast.error(t("streetRequired"));
      return;
    }
    if (!formData.detailedAddress.trim()) {
      toast.error(t("houseApartmentFloorRequired"));
      return;
    }
    if (!formData.city.trim()) {
      toast.error(t("cityRequired"));
      return;
    }
    if (!formData.state.trim()) {
      toast.error(t("regionRequired"));
      return;
    }
    if (!formData.country.trim()) {
      toast.error(t("countryRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        street: formData.street.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country.trim(),
        postalCode: formData.postalCode.trim(),
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        geoAccuracy: 10,
        detailedAddress: formData.detailedAddress.trim(),
        addressType: toBackendAddressType(addressType),
        ...(needsCustomType ? { customAddressType: trimmedCustomType } : {}),
      };

      if (isEditMode) {
        // PATCH the address being edited. Note this is NOT
        // `update-live-location` — that endpoint is the GPS "where am I now"
        // flow, which carries no addressType and makes the server append a
        // fresh CURRENT_LOCATION record instead of updating this one.
        if (!addressId) {
          toast.error(t("addressNotLoaded"));
          setIsSaving(false);
          return;
        }

        // Older records are stored with the retired type `PRIMARY`. The form
        // has no PRIMARY button, so `toSelectableAddressType` shows them as
        // Home — and saving an unrelated change (street, postal code) would
        // then submit HOME and be rejected with "The primary address type
        // cannot be modified.", even though the customer never touched the
        // type. Send `addressType` only when the selection actually changed.
        const { addressType: selectedType, ...addressFields } = payload;
        const storedType = initialAddress?.addressType;
        const seeded = storedType ? toSelectableAddressType(storedType) : null;
        const untouched = seeded !== null && seeded === addressType;
        // `CURRENT_LOCATION` has no button of its own either, but there the
        // whole point of editing is to give the row a real type — so it is
        // always sent, untouched or not.
        const isCurrentLocation =
          normalizeAddressType(storedType) === "CURRENT_LOCATION";

        // `OTHER` is likewise always sent: `customAddressType` is only
        // meaningful next to it, and the server validates the pair. Omitting
        // the type while sending a renamed label would be an untested
        // half-update. This cannot resurrect the PRIMARY problem above —
        // a stored PRIMARY seeds the form as Home, never Other.
        const alwaysSendType = isCurrentLocation || needsCustomType;

        await updateDeliveryAddress(
          addressId,
          untouched && !alwaysSendType
            ? addressFields
            : { ...addressFields, addressType: selectedType },
        );
      } else {
        await addDeliveryAddress(payload);
      }

      // Notify navbar to refresh address text
      window.dispatchEvent(new Event("addressUpdated"));

      toast.success(
        isEditMode ? t("addressUpdatedSuccess") : t("addressAddedSuccess")
      );
      onSuccess?.();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, t("failedToSaveLocation")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card border border-transparent dark:border-neutral-800 p-6 shadow-sm dark:shadow-none md:p-8">
      <Toaster position="top-center" richColors />
      <div className="mb-8">
        <h2 className="mb-2 text-xl font-bold text-foreground dark:text-neutral-50">
          {t("addressDetails")}
        </h2>
        <p className="text-sm text-muted-foreground dark:text-neutral-400">
          {t("addressDetailsDescription")}
        </p>
      </div>

      {/* Address Type */}
      <div className="mb-8">
        <label className="mb-4 block text-sm font-semibold text-foreground dark:text-neutral-200">
          {t("labelAddressAs")}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(["home", "work", "other"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAddressType(type)}
              className={`focus-ring flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-medium transition ${addressType === type
                ? "border-primary dark:border-primary bg-[#fff2f5] dark:bg-primary/10 text-primary"
                : "border-[#e3bdc3] dark:border-neutral-800 text-muted-foreground dark:text-neutral-300 bg-transparent hover:bg-gray-50 dark:hover:bg-neutral-800"
                }`}
            >
              {type === "home" && <Home size={18} />}
              {type === "work" && <Building2 size={18} />}
              {type === "other" && <Globe size={18} />}
              {t(addressTypeLabelKey(toBackendAddressType(type)))}
            </button>
          ))}
        </div>

        {/* Required by the API for OTHER, so it is marked required and blocks
            the save. Sits inside the type block, directly under the button it
            belongs to, rather than down among the postal fields. */}
        {needsCustomType && (
          <div className="mt-4">
            <label
              htmlFor="customAddressType"
              className="mb-2 block text-sm font-medium text-foreground dark:text-neutral-200"
            >
              {t("customAddressTypeLabel")} *
            </label>
            <div className="flex items-center rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 focus-within:border-primary">
              <Tag size={18} className="mr-3 text-muted-foreground dark:text-neutral-500" />
              <input
                id="customAddressType"
                type="text"
                value={customAddressType}
                onChange={(e) => setCustomAddressType(e.target.value)}
                placeholder={t("customAddressTypePlaceholder")}
                maxLength={50}
                className="h-14 w-full bg-transparent outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Street + Detailed */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground dark:text-neutral-200">
            {getLabelText("streetAddress")}
          </label>
          <div className="flex items-center rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 focus-within:border-primary">
            <MapPin size={18} className="mr-3 text-muted-foreground dark:text-neutral-500" />
            <input
              type="text"
              value={formData.street}
              onChange={(e) =>
                setFormData({ ...formData, street: e.target.value })
              }
              placeholder={t("enterStreetAddress")}
              className="h-14 w-full bg-transparent outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground dark:text-neutral-200">
            {getLabelText("houseApartmentFloor")}
          </label>
          <div className="flex items-center rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 focus-within:border-primary">
            <Building2 size={18} className="mr-3 text-muted-foreground dark:text-neutral-500" />
            <input
              type="text"
              value={formData.detailedAddress}
              onChange={(e) =>
                setFormData({ ...formData, detailedAddress: e.target.value })
              }
              placeholder={t("apartmentPlaceholder")}
              className="h-14 w-full bg-transparent outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
            />
          </div>
        </div>
      </div>

      {/* Postal + City, in that order — matching how the saved address is
          rendered back ("1229 Dhaka, Bangladesh") so entry and display read the
          same way. On mobile the grid collapses to one column, which makes this
          the vertical order too. */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground dark:text-neutral-200">
            {getLabelText("postalCode")}
          </label>
          <input
            type="text"
            value={formData.postalCode}
            onChange={(e) =>
              setFormData({ ...formData, postalCode: e.target.value })
            }
            placeholder={t("enterPostalCode")}
            className="h-14 w-full rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground dark:text-neutral-200">
            {getLabelText("city")}
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder={t("enterCity")}
            className="h-14 w-full rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:border-primary"
          />
        </div>
      </div>

      {/* State + Country */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground dark:text-neutral-200">
            {getLabelText("stateRegion")}
          </label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) =>
              setFormData({ ...formData, state: e.target.value })
            }
            placeholder={t("enterStateRegion")}
            className="h-14 w-full rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground dark:text-neutral-200">
            {getLabelText("country")}
          </label>
          <div className="flex items-center rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 focus-within:border-primary">
            <Globe size={18} className="mr-3 text-muted-foreground dark:text-neutral-500" />
            <input
              type="text"
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
              placeholder={t("enterCountry")}
              className="h-14 w-full bg-transparent outline-none text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500"
            />
          </div>
        </div>
      </div>



      {/* Coordinates Card */}
      <div className="mb-8 rounded-2xl border border-[#e3bdc3] dark:border-neutral-800 bg-[#fafafa] dark:bg-[#fafafa]/5 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Navigation size={18} className="text-primary" />
          <h3 className="font-semibold text-foreground dark:text-neutral-200">
            {t("gpsCoordinates")}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground dark:text-neutral-400">
              {t("latitude")}
            </p>
            <p className="rounded-lg bg-card border border-transparent dark:border-neutral-800/50 px-4 py-3 font-mono text-sm text-foreground dark:text-neutral-300">
              {coordinates ? coordinates.lat.toFixed(6) : "—"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground dark:text-neutral-400">
              {t("longitude")}
            </p>
            <p className="rounded-lg bg-card border border-transparent dark:border-neutral-800/50 px-4 py-3 font-mono text-sm text-foreground dark:text-neutral-300">
              {coordinates ? coordinates.lng.toFixed(6) : "—"}
            </p>
          </div>
        </div>
      </div>

      {!isLoggedIn && !isGuestMode && (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          <strong>{t("notSignedIn")}</strong> {t("notSignedInExplore")}{" "}
          <Button
            variant="link"
            size="sm"
            onClick={() => router.push("/login")}
            className="h-auto px-0 font-semibold text-inherit underline hover:text-amber-900 dark:hover:text-amber-200"
          >
            {t("logInLink")}
          </Button>{" "}
          {t("notSignedInSaveSuffix")}
        </div>
      )}

      <Button
        size="lg"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full gap-2 rounded-xl font-semibold"
      >
        <Save size={18} />
        {isGuestMode
          ? (t("updateAddress") || "Update Address")
          : !isLoggedIn
            ? "Login to Save Address"
            : isSaving
              ? t("saving")
              : isEditMode
                ? t("updateAddress")
                : t("saveAddress")}
      </Button>
    </div>
  );
}