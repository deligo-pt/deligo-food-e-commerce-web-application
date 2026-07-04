import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

// Run `ANALYZE=true pnpm build` to open the interactive bundle report
// (Phase 0 baseline / Phase 4 code-splitting verification).
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Security headers applied to every response. CSP is intentionally omitted here
// (see the note at the bottom of this file) — a wrong CSP white-screens the app,
// and it needs live testing against Google Maps / Firebase / the payment flow
// before it can be turned on.
const securityHeaders = [
  // Force HTTPS for two years, including subdomains (ignored on plain http/localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Don't let browsers MIME-sniff responses into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow the site being framed by other origins (clickjacking protection).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Send only the origin on cross-origin navigations; full URL same-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Least-privilege browser features: geolocation is needed (self); disable the
  // camera/microphone the app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  // Import only the icons/components actually used from these barrel packages,
  // instead of pulling the whole library into the client bundle.
  experimental: {
    optimizePackageImports: ["lucide-react", "radix-ui"],
  },
  // Strip console.* from production (keep console.error) to shrink client JS.
  compiler: {
    removeConsole: { exclude: ["error"] },
  },
  // Don't ship browser source maps or advertise the framework in prod.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  async headers() {
    return [
      // Security headers on everything.
      { source: "/:path*", headers: securityHeaders },
    ];
  },
  images: {
    // Serve AVIF/WebP (with automatic fallback) — markedly smaller than
    // JPEG/PNG on the same visual quality, especially on mobile.
    formats: ["image/avif", "image/webp"],
    // Cache optimized images for a week (keyed by URL, so a changed source
    // image gets a new cache entry — no stale-asset risk).
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "source.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        // Static maps rendered in the vendor-details modal.
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Content-Security-Policy (deferred — enable only after live testing).
// The app loads third-party code/resources that a strict CSP must allowlist, or
// it white-screens: Google Maps (maps.googleapis.com, maps.gstatic.com), Firebase
// Cloud Messaging (*.googleapis.com, fcmregistrations), the payment redirect flow,
// remote images (cloudinary/unsplash/placehold/googleusercontent/flagcdn), and
// Next's inline hydration script (needs 'unsafe-inline' or per-request nonces).
// Recommended rollout: ship as `Content-Security-Policy-Report-Only` with a report
// endpoint first, watch for violations, then promote to enforcing. Left off here
// so we never ship a policy that breaks maps/payments untested.
// ─────────────────────────────────────────────────────────────────────────────

export default bundleAnalyzer(nextConfig);
