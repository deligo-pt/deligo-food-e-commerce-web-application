import axios from "axios";
import { apiClient, getApiErrorMessage } from "./apiClient";

export type LoginIdentifier = {
  email?: string;
  contactNumber?: string;
  referralCode?: string;
};

/** Social providers the backend accepts on `/auth/social-login`. */
export type SocialProvider = "GOOGLE" | "FACEBOOK";

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
  // The backend attaches a stable, non-localized marker here (e.g.
  // "LIMIT_EXCEEDED" for the device limit). The human `message` is unreliable
  // to branch on, so callers should key off `err.errorKey` instead.
  err?: { statusCode?: number; errorKey?: string };
};

// Error thrown by the auth requests that preserves the backend's machine
// marker (`errorKey`) and HTTP status alongside the display message, so flows
// like the device-limit modal can branch on the stable key rather than the
// localized/free-text message.
export class AuthError extends Error {
  errorKey?: string;
  statusCode?: number;
  constructor(
    message: string,
    options?: { errorKey?: string; statusCode?: number },
  ) {
    super(message);
    this.name = "AuthError";
    this.errorKey = options?.errorKey;
    this.statusCode = options?.statusCode;
  }
}

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
      // 2xx body that still reports failure — surface its errorKey too.
      throw new AuthError(
        payload.message || payload.errorSources?.[0]?.message || "Request failed",
        { errorKey: payload.err?.errorKey, statusCode: payload.err?.statusCode },
      );
    }
    return response.data;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    // A non-2xx (e.g. 403 device limit) rejects here as an AxiosError; the
    // stable marker lives in error.response.data.err.errorKey. Preserve it so
    // callers can branch on the key instead of the free-text message.
    const data = axios.isAxiosError(error)
      ? (error.response?.data as ApiErrorResponse | undefined)
      : undefined;
    throw new AuthError(getApiErrorMessage(error), {
      errorKey: data?.err?.errorKey,
      statusCode:
        data?.err?.statusCode ??
        (axios.isAxiosError(error) ? error.response?.status : undefined),
    });
  }
}

/**
 * Requests a login OTP, delivered by SMS.
 *
 * The backend also accepts an `otpChannel` of `"WHATSAPP"`, but its provider is
 * unconfigured (every WhatsApp send answers `BULKGATE_CONFIGURATION_MISSING`),
 * so the option is not offered and nothing is sent here. Omitting the field is
 * identical to sending `"SMS"`.
 */
export async function sendLoginOtp(payload: LoginIdentifier): Promise<LoginResponse> {
  return requestJson<LoginResponse>("/auth/login-customer", payload);
}
/**
 * Exchanges a provider token for a DeliGo session.
 *
 * `token` is the provider's own token, never a DeliGo one — a Google **ID
 * token** (the `credential` JWT from Google Identity Services) or a Facebook
 * **access token**. The backend verifies it with the provider, then links or
 * creates the customer account and issues our tokens.
 *
 * The response is the same shape `/verify-otp` returns, so the caller can hand
 * it to exactly the same post-login path.
 */
export async function socialLogin(payload: {
  provider: SocialProvider;
  token: string;
  referralCode?: string;
  deviceDetails: DeviceDetails;
  forceLogin?: boolean;
}): Promise<VerifyOtpResponse> {
  return requestJson<VerifyOtpResponse>("/auth/social-login", payload);
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