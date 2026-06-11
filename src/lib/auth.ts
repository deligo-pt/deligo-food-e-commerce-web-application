import { apiClient, getApiErrorMessage } from "./apiClient";

export type LoginIdentifier = {
  email?: string;
  contactNumber?: string;
  referralCode?: string;
};

export type DeviceDetails = {
  deviceId: string;
  deviceType: string;
  deviceName: string;
  fcmToken: string;
  isLoggedIn: boolean;
  userAgent: string;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  data: null;
};

export type VerifyOtpResponse = {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
  };
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
  errorSources?: Array<{ path?: string; message?: string }>;
};

const deviceStorageKey = "deligo-device-id";

function getBrowserStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setBrowserStorageValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function getStableDeviceId() {
  const existingDeviceId = getBrowserStorageValue(deviceStorageKey);
  if (existingDeviceId) return existingDeviceId;
  const generatedDeviceId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `deligo-${Math.random().toString(36).slice(2, 10)}`;
  setBrowserStorageValue(deviceStorageKey, generatedDeviceId);
  return generatedDeviceId;
}

function getDeviceType(userAgent: string) {
  const normalizedUserAgent = userAgent.toLowerCase();
  if (normalizedUserAgent.includes("tablet")) return "tablet";
  return normalizedUserAgent.includes("mobi") ? "mobile" : "desktop";
}

export function buildDeviceDetails(): DeviceDetails {
  if (typeof window === "undefined") {
    return {
      deviceId: "unknown",
      deviceType: "",
      deviceName: "",
      fcmToken: "",
      isLoggedIn: true,
      userAgent: "",
    };
  }
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform || "";
  return {
    deviceId: getStableDeviceId(),
    deviceType: getDeviceType(userAgent),
    deviceName: platform,
    fcmToken: "",
    isLoggedIn: true,
    userAgent,
  };
}

async function requestJson<T>(url: string, body: unknown): Promise<T> {
  try {
    const response = await apiClient.post<T>(url, body);
    const payload = response.data as T & ApiErrorResponse;
    if (payload && typeof payload === "object" && "success" in payload && payload.success === false) {
      throw new Error(payload.message || payload.errorSources?.[0]?.message || "Request failed");
    }
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
}

export async function sendLoginOtp(payload: LoginIdentifier): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/login-customer", payload);
}
export async function verifyLoginOtp(payload: {
  email?: string;
  contactNumber?: string;
  otp: string;
  deviceDetails: DeviceDetails;
  forceLogin?: boolean;
}): Promise<VerifyOtpResponse> {
  return requestJson<VerifyOtpResponse>(
    "/auth/verify-otp",
    {
      ...payload,
      role: "CUSTOMER",
    }
  );
}