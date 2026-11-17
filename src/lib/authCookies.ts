import Cookies from "js-cookie";

export const ACCESS_TOKEN_COOKIE = "deligo-access-token";
export const REFRESH_TOKEN_COOKIE = "deligo-refresh-token";

/**
 * Fired on `window` whenever the session cookies are written or removed here,
 * so long-lived connections (the rider-chat socket, `SocketProvider`) follow a
 * sign-in or sign-out at once instead of on the next navigation.
 */
export const AUTH_CHANGED_EVENT = "deligo:auth-changed";

function announceAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

function decodeJwtExpiry(token: string | null | undefined) {
  // Never assume a token arrived: `undefined.split` is what broke sign-in on
  // 14 Nov 2026. No token, no expiry.
  if (typeof token !== "string") return null;
  const tokenParts = token.split(".");

  if (tokenParts.length < 2) {
    return null;
  }

  try {
    const base64 = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(paddedBase64));

    if (typeof payload.exp !== "number") {
      return null;
    }

    return payload.exp;
  } catch {
    return null;
  }
}

/**
 * Keeps the session: the access token, until the moment it expires.
 *
 * Only the access token. Since the backend's security update (17 Nov 2026) a
 * web client never receives the refresh token in the response — it arrives
 * only as an httpOnly cookie scoped to the API's `/api/v1/auth` path, which
 * script cannot read — and this app has never refreshed a session anyway.
 * The `deligo-refresh-token` cookie older sign-ins left behind is removed.
 */
export function storeAuthTokens(accessToken: string) {
  Cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    path: "/",
    sameSite: "lax" as const,
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
    expires: decodeJwtExpiry(accessToken) ? new Date(decodeJwtExpiry(accessToken)! * 1000) : undefined,
  });
  Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
  announceAuthChange();
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return Cookies.get(ACCESS_TOKEN_COOKIE);
}
export function clearAuthTokens() {
  Cookies.remove(ACCESS_TOKEN_COOKIE, { path: "/" });
  Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
  announceAuthChange();
}