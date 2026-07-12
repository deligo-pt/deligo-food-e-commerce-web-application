import axios from "axios";
import { clearAuthTokens } from "./authCookies";
import { useStore } from "@/stores/translationStore";

type ApiErrorResponse = {
  success?: boolean;
  message?: string;
  errorSources?: Array<{ path?: string; message?: string }>;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1";
const ACCESS_TOKEN_COOKIE = "deligo-access-token";

function getAccessTokenFromCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${ACCESS_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const headers = axios.AxiosHeaders.from(config.headers);

  if (!headers.has("Authorization")) {
    const accessToken = getAccessTokenFromCookie();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  // Tell the backend which language to resolve bilingual fields into. Read the
  // current language per request so it always reflects the latest switch.
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", useStore.getState().lang ?? "pt");
  }

  config.headers = headers;

  return config;
});
let isRedirecting = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !isRedirecting
    ) {
      isRedirecting = true;

      clearAuthTokens();

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);
// Backend validation failures arrive wrapped in a generic top-level message
// (e.g. "Validation Error" / "Zod Validation Error") while the actionable
// detail lives in errorSources[]. Treat those wrappers as non-descriptive so
// we surface the field-level reason instead of the opaque wrapper.
const GENERIC_ERROR_MESSAGE = /validation error/i;

export function getApiErrorMessage(error: unknown, fallbackMessage = "Request failed") {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiErrorResponse | undefined;

    const source = payload?.errorSources?.[0];
    const sourceMessage = source?.message
      ? source.path
        ? `${source.path}: ${source.message}`
        : source.message
      : undefined;

    // Prefer the specific field-level reason when the top-level message is just
    // a generic validation wrapper; otherwise keep the top-level message.
    if (payload?.message && GENERIC_ERROR_MESSAGE.test(payload.message)) {
      return sourceMessage || payload.message;
    }

    return (
      payload?.message ||
      sourceMessage ||
      error.message ||
      fallbackMessage
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}