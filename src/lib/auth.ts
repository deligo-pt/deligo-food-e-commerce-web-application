import axios from "axios";
import { apiClient, errorKeyOf, getApiErrorMessage, validationKeyOf } from "./apiClient";

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

/**
 * A sign-in that worked. Only the access token: since the security update of
 * 17 Nov 2026 a web client gets its refresh token solely as an httpOnly cookie
 * on the API's own `/api/v1/auth` path, which this app can neither read nor
 * use — and never did use (it has no refresh flow).
 */
export type VerifyOtpResponse = {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
  };
};

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
  errorSources?: Array<{ path?: string; message?: string }>;
  // The backend attaches a stable, non-localized marker here (e.g.
  // "LIMIT_EXCEEDED" for the device limit). The human `message` is unreliable
  // to branch on, so callers should key off the key instead. Production sends
  // it only at the top level (no `err`), so read it with `errorKeyOf`.
  errorKey?: string;
  err?: { statusCode?: number; errorKey?: string; variables?: Record<string, unknown> };
  data?: unknown;
};

// Error thrown by the auth requests that preserves the backend's machine
// marker (`errorKey`) and HTTP status alongside the display message, so flows
// like the device-limit modal can branch on the stable key rather than the
// localized/free-text message.
export class AuthError extends Error {
  errorKey?: string;
  statusCode?: number;
  /** Seconds from the response's `Retry-After` header — sent with a `429`. */
  retryAfterSeconds?: number;
  /** The error body's `data` and `err.variables`, for answers that carry details. */
  details?: Record<string, unknown>;
  constructor(
    message: string,
    options?: {
      errorKey?: string;
      statusCode?: number;
      retryAfterSeconds?: number;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "AuthError";
    this.errorKey = options?.errorKey;
    this.statusCode = options?.statusCode;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.details = options?.details;
  }
}

/** A positive number of seconds from a `Retry-After` header, or `undefined`. */
function retryAfterOf(value: unknown): number | undefined {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/** `data` and `err.variables` of an error body, flattened (data wins). */
function detailsOf(payload: ApiErrorResponse | undefined): Record<string, unknown> | undefined {
  const fromData =
    payload?.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};
  const merged = { ...(payload?.err?.variables ?? {}), ...fromData };
  return Object.keys(merged).length ? merged : undefined;
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
        {
          errorKey: errorKeyOf(payload) ?? validationKeyOf(payload),
          statusCode: payload.err?.statusCode,
        },
      );
    }
    return response.data;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    // A non-2xx (e.g. 403 device limit) rejects here as an AxiosError; the
    // stable marker is `errorKey` (top level; also under `err` on the test
    // server). Preserve it so
    // callers can branch on the key instead of the free-text message.
    const data = axios.isAxiosError(error)
      ? (error.response?.data as ApiErrorResponse | undefined)
      : undefined;
    throw new AuthError(getApiErrorMessage(error), {
      // A validation rejection has no errorKey; its field code stands in, so
      // the login form can word e.g. a bad phone number itself.
      errorKey: errorKeyOf(data) ?? validationKeyOf(data),
      statusCode:
        data?.err?.statusCode ??
        (axios.isAxiosError(error) ? error.response?.status : undefined),
      // The 429s say how long to wait: the per-IP limiter sends
      // `Retry-After: 30` with RATE_LIMIT_EXCEEDED (measured 17 Nov 2026).
      retryAfterSeconds: axios.isAxiosError(error)
        ? retryAfterOf(error.response?.headers?.["retry-after"])
        : undefined,
      details: detailsOf(data),
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
 * Sends a fresh code to an address that already asked for one.
 *
 * `POST /auth/resend-otp`, with the address and `role` (the Postman shape).
 * The backend always issues a new code and always answers a generic `200`,
 * whether or not the address has an account — so success here only means
 * "if the address is valid, a code is on its way". The referral code is not
 * sent: it was applied with the first request.
 */
export async function resendLoginOtp(identifier: LoginIdentifier): Promise<LoginResponse> {
  const address = identifier.email
    ? { email: identifier.email }
    : { contactNumber: identifier.contactNumber };
  return requestJson<LoginResponse>("/auth/resend-otp", { ...address, role: "CUSTOMER" });
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
  return withSessionTokens(await requestJson<unknown>("/auth/social-login", payload));
}

/**
 * The answer when a Google/Facebook email already belongs to an account. The
 * backend no longer links the two by itself: it emails that account a code
 * and waits for `linkSocialAccount` with it.
 */
export const SOCIAL_LINK_VERIFICATION_REQUIRED = "SOCIAL_LINK_VERIFICATION_REQUIRED";

/**
 * Finishes a social sign-in that needed linking: the same provider token,
 * plus the code emailed to the existing account. Answers like `/social-login`.
 */
export async function linkSocialAccount(payload: {
  provider: SocialProvider;
  token: string;
  otp: string;
  deviceDetails: DeviceDetails;
}): Promise<VerifyOtpResponse> {
  return withSessionTokens(await requestJson<unknown>("/auth/social-login/link", payload));
}

/** The `errorKey` for a success response that carries no session tokens. */
export const NO_SESSION_TOKENS = "NO_SESSION_TOKENS";

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/**
 * The session tokens from a `/verify-otp` or `/social-login` success, wherever
 * the backend put them.
 *
 * 14 Nov 2026: the email login started failing with "Cannot read properties
 * of undefined (reading 'split')" after the code was accepted: the success
 * body no longer had `data.accessToken`, and saving `undefined` as a cookie
 * crashed. The documented place is checked first, then the shapes other
 * DeliGo routes use (`data.tokens`, a nested `data.data`, the top level).
 * Anything else is refused with `NO_SESSION_TOKENS`, a real sign-in error
 * instead of a crash, and the fields that did arrive are logged by name
 * (never their values) so the new shape can be read from the console.
 */
export function withSessionTokens(payload: unknown): VerifyOtpResponse {
  const body = (payload ?? {}) as Record<string, unknown>;
  const data = (body.data ?? {}) as Record<string, unknown>;
  const candidates = [data, data.tokens, data.data, (data.data as Record<string, unknown> | undefined)?.tokens, body, body.tokens];
  for (const c of candidates) {
    const t = (c ?? {}) as Record<string, unknown>;
    if (isNonEmptyString(t.accessToken)) {
      return {
        success: true,
        message: typeof body.message === "string" ? body.message : "",
        data: { accessToken: t.accessToken },
      };
    }
  }
  const shape = (o: unknown) =>
    o && typeof o === "object" ? Object.keys(o as object).join(", ") || "(empty)" : String(o);
  console.warn(
    `[auth] Sign-in succeeded but no accessToken was found. Response fields: {${shape(body)}}; data fields: {${shape(body.data)}}`,
  );
  throw new AuthError("Signed in, but no session was returned.", { errorKey: NO_SESSION_TOKENS });
}

export async function verifyLoginOtp(payload: {
  email?: string;
  contactNumber?: string;
  otp: string;
  deviceDetails: DeviceDetails;
  forceLogin?: boolean;
}): Promise<VerifyOtpResponse> {
  return withSessionTokens(
    await requestJson<unknown>("/auth/verify-otp", {
      ...payload,
      role: "CUSTOMER",
    }),
  );
}