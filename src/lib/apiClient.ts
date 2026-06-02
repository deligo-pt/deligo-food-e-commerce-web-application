import axios from "axios";

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

  config.headers = headers;

  return config;
});

export function getApiErrorMessage(error: unknown, fallbackMessage = "Request failed") {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiErrorResponse | undefined;

    return (
      payload?.message ||
      payload?.errorSources?.[0]?.message ||
      error.message ||
      fallbackMessage
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}