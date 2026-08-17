/**
 * The remote hosts `next/image` is allowed to optimize — the single source of
 * truth for both `next.config.ts` and the runtime guard below.
 *
 * ## Why this is shared rather than just living in the config
 *
 * An image whose hostname is not on this list does not degrade — it **throws**,
 * synchronously, from inside `defaultLoader` while the component renders
 * (`next/dist/shared/lib/image-loader.js`). React unwinds to the nearest error
 * boundary, so one unrecognized photo replaces the entire route with
 * `app/error.tsx`. That is not hypothetical: on 2026-08-17 the backend started
 * serving product photos from `storage-test.deligo.pt` instead of Cloudinary,
 * and the first product to use it (`PROD-W61R90`, Chocolate Salami) took down
 * its whole vendor page.
 *
 * The throw is guarded by `NODE_ENV !== 'production'`, so production does not
 * crash — but it does not work either: `/_next/image` answers `400` for a host
 * it was not configured with, and the customer gets a broken image. Dev fails
 * loudly, prod fails quietly, and both need the same list.
 *
 * So `isOptimizableImageHost` lets a component ask the question *before*
 * rendering and fall back to `unoptimized`, which skips the loader entirely.
 * The next host the backend invents then costs us image optimization on that
 * one photo instead of the page it appears on.
 *
 * Bypassing optimization does not weaken what the allowlist is for. It exists
 * so our optimizer cannot be pointed at arbitrary URLs and used as an open
 * image proxy; `unoptimized` renders a plain `<img>` that the browser fetches
 * directly, which is not our bandwidth and not our cache.
 */

export type RemoteImageHost = {
  protocol: "https";
  /** Supports Next's wildcards: `**.` for any subdomain depth, `*.` for one label. */
  hostname: string;
  pathname?: string;
};

export const REMOTE_IMAGE_HOSTS: RemoteImageHost[] = [
  // Google account avatars from social login.
  { protocol: "https", hostname: "lh3.googleusercontent.com" },
  { protocol: "https", hostname: "flagcdn.com" },
  // Where the backend has historically put every upload.
  { protocol: "https", hostname: "res.cloudinary.com" },
  // Deligo's own object storage. Wildcarded because the environments are
  // subdomains of one domain (`storage-test.deligo.pt` today; production's
  // sibling does not resolve yet, and this is the file nobody would think to
  // edit on the day it appears).
  { protocol: "https", hostname: "**.deligo.pt" },
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "source.unsplash.com", pathname: "/**" },
  { protocol: "https", hostname: "placehold.co" },
  // Static maps rendered in the vendor-details modal.
  { protocol: "https", hostname: "maps.googleapis.com" },
];

/** `**.deligo.pt` matches `a.deligo.pt` and `a.b.deligo.pt`; `*.x.com` matches one label. */
function hostnameMatches(pattern: string, hostname: string): boolean {
  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(2); // keep the leading dot, so `xdeligo.pt` misses
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }

  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    if (!hostname.endsWith(suffix)) return false;
    const label = hostname.slice(0, -suffix.length);
    return label.length > 0 && !label.includes(".");
  }

  return pattern === hostname;
}

/** `/**` means any path; anything else must match the literal prefix. */
function pathnameMatches(pattern: string | undefined, pathname: string): boolean {
  if (!pattern) return true;
  if (pattern === "/**") return true;

  const wildcard = pattern.indexOf("*");
  if (wildcard === -1) return pattern === pathname;

  return pathname.startsWith(pattern.slice(0, wildcard));
}

/**
 * Can `next/image` optimize this URL without throwing?
 *
 * Relative sources (`/logo.svg`) are ours and always optimizable. A URL that
 * does not parse is not — better an unoptimized `<img>` that shows nothing than
 * a thrown error that shows nothing *and* takes the page with it.
 */
export function isOptimizableImageHost(src?: string | null): boolean {
  if (!src) return false;
  if (src.startsWith("/")) return true;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }

  return REMOTE_IMAGE_HOSTS.some(
    (host) =>
      `${host.protocol}:` === url.protocol &&
      hostnameMatches(host.hostname, url.hostname) &&
      pathnameMatches(host.pathname, url.pathname),
  );
}
