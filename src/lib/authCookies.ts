import Cookies from "js-cookie";

export const ACCESS_TOKEN_COOKIE = "deligo-access-token";
export const REFRESH_TOKEN_COOKIE = "deligo-refresh-token";

function decodeJwtExpiry(token: string) {
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

export function storeAuthTokens(accessToken: string, refreshToken: string) {
  const cookieOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  };

  Cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieOptions,
    expires: decodeJwtExpiry(accessToken) ? new Date(decodeJwtExpiry(accessToken)! * 1000) : undefined,
  });

  Cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieOptions,
    expires: decodeJwtExpiry(refreshToken) ? new Date(decodeJwtExpiry(refreshToken)! * 1000) : undefined,
  });
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return Cookies.get(ACCESS_TOKEN_COOKIE);
}
