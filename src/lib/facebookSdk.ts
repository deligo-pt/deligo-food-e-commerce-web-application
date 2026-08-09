/**
 * Facebook JavaScript SDK loader.
 *
 * Fetched on demand by the login page rather than from the app shell, the same
 * arrangement used for Google Identity Services and Firebase: third-party
 * weight is paid only by the page that needs it.
 *
 * What we want is `authResponse.accessToken` — Facebook's own access token,
 * which is what `/auth/social-login` expects as `token` for this provider. Not
 * the user ID, and not a signed request.
 *
 * **The SDK must be loaded before the button is pressed.** `FB.login` opens a
 * popup, and browsers only allow that during a user gesture. Awaiting the
 * script inside the click handler puts an async gap between the click and the
 * popup, and the popup blocker kills it. So the page preloads on mount and the
 * click handler reads the already-loaded SDK synchronously via
 * `getFacebookSdk()`.
 */

export type FacebookLoginResponse = {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: { accessToken?: string } | null;
};

type FacebookApi = {
  init: (options: {
    appId: string;
    version: string;
    cookie?: boolean;
    xfbml?: boolean;
  }) => void;
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope?: string; auth_type?: string },
  ) => void;
};

/** Graph API version. Keep in step with the backend's verification calls. */
const GRAPH_VERSION = "v26.0";

/**
 * Reads `window.FB` without declaring it on the global `Window` type.
 *
 * Adding a global declaration here would risk the same collision that
 * `window.google` caused when Google Identity Services was added alongside the
 * existing Maps typings. A local cast keeps this module's typing to itself.
 */
function readFbApi(): FacebookApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { FB?: FacebookApi }).FB;
}

/** Facebook wants a full locale in the script URL, not a bare language code. */
function toFacebookLocale(lang: string) {
  return lang === "pt" ? "pt_PT" : "en_US";
}

let loader: Promise<FacebookApi> | null = null;

/**
 * Loads and initialises the SDK once.
 *
 * The locale is baked into the script URL and Facebook offers no way to change
 * it afterwards, so the first call wins. A customer who switches language after
 * the page has loaded may see Facebook's own dialog in the previous language —
 * a cosmetic edge case on a screen Facebook renders and largely localises from
 * the account's own settings anyway.
 */
export function loadFacebookSdk(appId: string, lang: string): Promise<FacebookApi> {
  if (loader) return loader;

  loader = new Promise<FacebookApi>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("The Facebook SDK requires a browser."));
      return;
    }
    if (!appId) {
      reject(new Error("Missing Facebook app ID."));
      return;
    }

    const src = `https://connect.facebook.net/${toFacebookLocale(lang)}/sdk.js`;

    const ready = () => {
      const api = readFbApi();
      if (!api) {
        reject(new Error("The Facebook SDK loaded without an API."));
        return;
      }
      // `cookie` and `xfbml` are off: we never read the SDK's session cookie
      // (the backend issues our own tokens) and there are no XFBML tags to
      // parse. Both default to false, but silence here would look accidental.
      api.init({ appId, version: GRAPH_VERSION, cookie: false, xfbml: false });
      resolve(api);
    };

    if (readFbApi()) {
      ready();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load the Facebook SDK.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", ready, { once: true });
    script.addEventListener(
      "error",
      () => {
        // Let a later attempt start clean rather than caching the failure
        // forever — the usual cause is a blocked request or a network blip.
        loader = null;
        reject(new Error("Failed to load the Facebook SDK."));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return loader;
}

/**
 * The loaded SDK, or `undefined` if it is not ready yet.
 *
 * Synchronous on purpose: the click handler must reach `FB.login` without an
 * await, or the popup it opens is no longer attributable to the user's gesture.
 */
export function getFacebookSdk(): FacebookApi | undefined {
  return readFbApi();
}
