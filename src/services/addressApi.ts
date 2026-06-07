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
}

export async function fetchUserProfile() {
  const response = await apiClient.get("/profile");
  return response.data;
}

export async function updateLiveLocation(userId: string, latitude: number, longitude: number) {
  const response = await apiClient.patch(`/customers/${userId}/update-live-location`, {
    latitude,
    longitude,
  });
  return response.data;
}

export async function addDeliveryAddress(data: DeliveryAddressPayload) {
  const response = await apiClient.post("/customers/add-delivery-address", {
    deliveryAddress: data,
  });
  return response.data;
}

export async function updateDeliveryAddress(addressId: string, data: DeliveryAddressPayload) {
  const response = await apiClient.patch(`/customers/update-delivery-address/${addressId}`, {
    deliveryAddress: data,
  });
  return response.data;
}