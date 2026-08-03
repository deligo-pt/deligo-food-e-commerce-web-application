import axios from "axios";
import { clearAuthTokens } from "./authCookies";
import { resolveLocalized, type LocalizedField } from "./localizedField";
import { useStore } from "@/stores/translationStore";

type ApiErrorResponse = {
  success?: boolean;
  // Error messages can come back bilingual, like any other API text field.
  // Callers render this straight into JSX, so it must be narrowed to a string.
  message?: LocalizedField;
  errorSources?: Array<{ path?: string; message?: LocalizedField }>;
  // Stable machine-readable code (e.g. "STORE_CLOSED_OR_UNAPPROVED"). Unlike
  // `message`, which the backend sends in English only, this is safe to branch
  // on — see `getApiErrorKey`.
  err?: { statusCode?: number; errorKey?: string };
};

/**
 * The backend's stable error code for a request, or `null`.
 *
 * Prefer this over matching `message` text: error copy is English-only and can
 * be reworded server-side, whereas `errorKey` is part of the API contract.
 */
export function getApiErrorKey(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const payload = error.response?.data as ApiErrorResponse | undefined;
  return payload?.err?.errorKey ?? null;
}

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
      clearAuthTokens();

      if (window.location.pathname !== "/login") {
        // Latch only while a real navigation is in flight, so concurrent 401s
        // don't each trigger a redirect. If we're already on /login there's no
        // navigation, so leave the latch down — otherwise the flag would stay
        // stuck true forever and swallow every future 401 in the session.
        isRedirecting = true;
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

/**
 * Translations for backend error codes.
 *
 * The API sends `message` in English only, so any error a customer is likely to
 * hit gets its copy owned here and keyed on the stable `errorKey`. Anything not
 * listed falls through to the server's own wording — this is a translation
 * layer, not a place to reinterpret what the backend said.
 */
const ERROR_KEY_MESSAGES: Record<string, LocalizedField> = {
  STORE_CLOSED_OR_UNAPPROVED: {
    en: "This restaurant is closed right now — you can't order from it yet.",
    pt: "Este restaurante está fechado neste momento — ainda não pode encomendar.",
  },
  // Both of these mean the same thing to a customer trying to cancel: the order
  // moved on since the page was painted. The server's own wording ("Only paid
  // orders can be canceled.") describes a backend rule, not their situation.
  ONLY_PAID_ORDER_CAN_BE_CANCELED: {
    en: "This order can no longer be cancelled.",
    pt: "Este pedido já não pode ser cancelado.",
  },
  ORDER_CANNOT_BE_CANCELED_OR_REJECTED_AT_STAGE: {
    en: "This order can no longer be cancelled.",
    pt: "Este pedido já não pode ser cancelado.",
  },
};

export function getApiErrorMessage(error: unknown, fallbackMessage = "Request failed") {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as ApiErrorResponse | undefined;

    // Narrow every bilingual field to a string up front: this function's return
    // value gets rendered directly, and an { en, pt } object reaching JSX throws.
    const lang = useStore.getState().lang ?? "pt";

    // A known error code wins over the server's English prose.
    const keyed = payload?.err?.errorKey
      ? ERROR_KEY_MESSAGES[payload.err.errorKey]
      : undefined;
    if (keyed) return resolveLocalized(keyed, lang);

    const topMessage = resolveLocalized(payload?.message, lang);

    const source = payload?.errorSources?.[0];
    const rawSourceMessage = resolveLocalized(source?.message, lang);
    const sourceMessage = rawSourceMessage
      ? source?.path
        ? `${source.path}: ${rawSourceMessage}`
        : rawSourceMessage
      : undefined;

    // Prefer the specific field-level reason when the top-level message is just
    // a generic validation wrapper; otherwise keep the top-level message.
    if (topMessage && GENERIC_ERROR_MESSAGE.test(topMessage)) {
      return sourceMessage || topMessage;
    }

    return (
      topMessage ||
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