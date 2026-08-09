/**
 * Google Identity Services (GIS) loader.
 *
 * The script is fetched on demand — the first time a login page actually needs
 * it — rather than from the app shell, so it stays out of every other route.
 * This mirrors how Firebase is handled in `firebase.ts`: third-party weight is
 * only paid by the page that uses it.
 *
 * What we want from GIS is the **ID token**: `CredentialResponse.credential` is
 * a JWT signed by Google, and that is exactly what `/auth/social-login` expects
 * as `token`. We deliberately do NOT use `google.accounts.oauth2`, which yields
 * an OAuth *access* token the backend cannot verify, nor the authorization-code
 * flow, which would need a client secret our backend does not hold.
 */

const GIS_ORIGIN = "https://accounts.google.com/gsi/client";
/** Marks the tags we injected, so a reload never removes anyone else's. */
const OWNED_ATTR = "data-deligo-gsi";

/**
 * Google decides the button's language when the script loads, from the `hl`
 * query parameter — not from the `locale` option on `renderButton`, which is
 * documented but does not re-language an already-loaded SDK. So switching
 * language means reloading the script, which is what `loadGoogleIdentity` does
 * when it is called with a locale different from the one currently loaded.
 */
function gisSrc(locale: string) {
  return `${GIS_ORIGIN}?hl=${encodeURIComponent(locale)}`;
}

export type GoogleCredentialResponse = {
  /** The ID token (a JWT). This is what the backend verifies. */
  credential?: string;
  select_by?: string;
};

/** Options we pass to `renderButton`. Narrower than Google's full surface. */
export type GoogleButtonOptions = {
  type: "standard";
  theme: "outline" | "filled_blue" | "filled_black";
  size: "large" | "medium" | "small";
  text: "signin_with" | "signup_with" | "continue_with";
  shape: "rectangular" | "pill";
  logo_alignment: "left" | "center";
  width?: number;
  locale?: string;
};

type GoogleIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
  disableAutoSelect: () => void;
};

/**
 * Reads `window.google.accounts.id` without touching the global `Window` type.
 *
 * `window.google` is already declared elsewhere in the app for Google Maps —
 * adding a second, narrower declaration here would conflict with it and break
 * every `window.google.maps` call site. A local cast keeps this module's typing
 * to itself.
 */
function readGisApi(): GoogleIdApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { google?: { accounts?: { id?: GoogleIdApi } } })
    .google?.accounts?.id;
}

let loader: Promise<GoogleIdApi> | null = null;
/** The locale the currently-loaded script was fetched with. */
let loadedLocale: string | null = null;

/**
 * Unloads our GIS script so it can be re-fetched in another language.
 *
 * Removes **only** `window.google.accounts`, never `window.google` itself —
 * that object is shared with the Google Maps SDK, which this app uses on the
 * address, order-tracking and vendor screens. Deleting the whole thing would
 * break maps every time someone switched language on the login page.
 */
function unloadGis() {
  loader = null;
  loadedLocale = null;
  if (typeof window === "undefined") return;

  document.querySelectorAll(`script[${OWNED_ATTR}]`).forEach((tag) => tag.remove());

  const googleGlobal = (window as unknown as { google?: { accounts?: unknown } })
    .google;
  if (googleGlobal?.accounts) delete googleGlobal.accounts;
}

/** Resolves once `window.google.accounts.id` is usable in the given locale. */
export function loadGoogleIdentity(locale: string): Promise<GoogleIdApi> {
  if (loader && loadedLocale === locale) return loader;
  // A different language was requested: drop the old script and start over.
  if (loader) unloadGis();

  loadedLocale = locale;
  const src = gisSrc(locale);

  loader = new Promise<GoogleIdApi>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google Identity Services requires a browser."));
      return;
    }

    const ready = () => {
      const api = readGisApi();
      if (api) resolve(api);
      else reject(new Error("Google Identity Services loaded without an API."));
    };

    if (readGisApi()) {
      ready();
      return;
    }

    // A tag may already be in flight from an earlier mount; attach to it rather
    // than injecting a second copy.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity Services.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.setAttribute(OWNED_ATTR, "");
    script.addEventListener("load", ready, { once: true });
    script.addEventListener(
      "error",
      () => {
        // Let a later attempt retry from scratch instead of caching the
        // failure forever — the usual cause is a transient network blip.
        unloadGis();
        reject(new Error("Failed to load Google Identity Services."));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return loader;
}
