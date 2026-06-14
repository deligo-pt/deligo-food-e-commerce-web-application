import { apiClient } from "@/lib/apiClient";

export interface DeliveryAddressPayload {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  longitude: number;
  latitude: number;
  geoAccuracy?: number;
  addressType: "HOME" | "OFFICE" | "OTHER";
  detailedAddress?: string;
  notes?: string;
}

// For updating live location + primary address
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

// Now updates both session location AND primary delivery address
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

// These endpoints are kept for secondary addresses – not used in this page anymore
export async function addDeliveryAddress(data: DeliveryAddressPayload) {
  const response = await apiClient.post("/customers/add-delivery-address", {
    deliveryAddress: data,
  });
  return response.data;
}

export async function updateDeliveryAddress(
  addressId: string,
  data: DeliveryAddressPayload
) {
  const response = await apiClient.patch(
    `/customers/update-delivery-address/${addressId}`,
    { deliveryAddress: data }
  );
  return response.data;
}