import { apiClient } from "@/lib/apiClient";
import type { AddressType } from "@/lib/addressType";

export interface DeliveryAddressPayload {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  longitude: number;
  latitude: number;
  geoAccuracy?: number;
  addressType: AddressType;
  /**
   * Required, and must be non-empty, whenever `addressType` is `OTHER` — the
   * API rejects the save otherwise:
   *   path: deliveryAddress.customAddressType
   *   "Please provide a custom address type when selecting "Other" as the
   *    address type"
   * Ignored for the other types; switching an address away from OTHER clears it
   * server-side.
   */
  customAddressType?: string;
  detailedAddress?: string;
  notes?: string;
}

// For updating live location + primary address (PATCH)
export interface LiveLocationPayload {
  latitude: number;
  longitude: number;
  geoAccuracy?: number;
  isMocked?: boolean;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  detailedAddress?: string;
  notes?: string;
}

export async function fetchUserProfile() {
  const response = await apiClient.get("/profile");
  return response.data;
}

// POST /customers/add-delivery-address — adds a new delivery address
export async function addDeliveryAddress(data: DeliveryAddressPayload) {
  const response = await apiClient.post("/customers/add-delivery-address", {
    deliveryAddress: data,
  });
  return response.data;
}

// PATCH /customers/:userId/update-live-location — updates session location + primary address
export async function updateLiveLocation(
  userId: string,
  payload: LiveLocationPayload
) {
  const response = await apiClient.patch(
    `/customers/${userId}/update-live-location`,
    payload
  );
  return response.data;
}

/**
 * `addressType` is optional on update. Older records are stored with the
 * retired type `PRIMARY`, and the API rejects any attempt to move one off it
 * ("The primary address type cannot be modified."). Omitting the field leaves
 * the stored type untouched, so the rest of the address stays editable.
 */
export type UpdateDeliveryAddressPayload = Omit<
  DeliveryAddressPayload,
  "addressType"
> & { addressType?: AddressType };

export async function updateDeliveryAddress(
  addressId: string,
  data: UpdateDeliveryAddressPayload
) {
  const response = await apiClient.patch(
    `/customers/update-delivery-address/${addressId}`,
    { deliveryAddress: data }
  );
  return response.data;
}