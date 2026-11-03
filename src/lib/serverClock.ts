/**
 * "Now" according to a server, not the customer's device.
 *
 * Countdowns in the scheduled-orders feature (a pause's `resumeAt`, a slot
 * about to expire) are differences between a server timestamp and now. A phone
 * whose clock is a few minutes off would count down to the wrong moment, so the
 * guide asks for the server's time from the HTTP `Date` header.
 *
 * ## Where the time comes from
 *
 * 1. **The API's own `Date` header**, read from every `apiClient` response.
 *    The API is cross-origin and (3 Nov 2026) does not list `Date` in
 *    `Access-Control-Expose-Headers`, so the browser hides it and this source
 *    is currently empty. It is wired anyway: once the backend exposes the
 *    header, it starts working with no change here.
 * 2. **Our own site's `Date` header**, from one same-origin `HEAD` request.
 *    Same-origin headers are always readable, and the site's host (Vercel)
 *    keeps NTP time, so this corrects a wrong device clock today.
 * 3. **The device clock**, until either of the above has answered.
 *
 * The header has one-second resolution and the request takes some time, so
 * the offset is measured against the request's midpoint. Sub-second error is
 * irrelevant for minute-level countdowns.
 */

let offsetMs = 0;
/** Where the current offset came from: an API sample beats the site's. */
let source: "device" | "site" | "api" = "device";
let calibration: Promise<void> | null = null;

function offsetFrom(dateHeader: string | null | undefined, sentAt: number, receivedAt: number) {
  if (!dateHeader) return null;
  const serverMs = Date.parse(dateHeader);
  if (Number.isNaN(serverMs)) return null;
  return serverMs - (sentAt + receivedAt) / 2;
}

/**
 * Records the API's `Date` header. Called by `apiClient` on every response;
 * a no-op while the header is not exposed to the browser.
 */
export function recordApiDate(
  dateHeader: string | null | undefined,
  sentAt: number,
  receivedAt: number,
) {
  const offset = offsetFrom(dateHeader, sentAt, receivedAt);
  if (offset === null) return;
  offsetMs = offset;
  source = "api";
}

/**
 * Measures the offset once against our own site. Safe to call often: only the
 * first call in a page's life makes a request, and nothing happens on the
 * server or when the API has already given a sample.
 */
export function calibrateServerClock(): Promise<void> {
  if (typeof window === "undefined" || source === "api") return Promise.resolve();
  if (calibration) return calibration;

  const sentAt = Date.now();
  calibration = fetch(`/icon.png?clock=${sentAt}`, { method: "HEAD", cache: "no-store" })
    .then((response) => {
      const offset = offsetFrom(response.headers.get("date"), sentAt, Date.now());
      // An API sample that arrived meanwhile wins.
      if (offset !== null && source !== "api") {
        offsetMs = offset;
        source = "site";
      }
    })
    .catch(() => {
      // Offline or blocked: keep the device clock.
    });

  return calibration;
}

/** The current time in ms, corrected to the server's clock when known. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Milliseconds from server-now until `iso`. Negative once it has passed; null if unparseable. */
export function msUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = Date.parse(iso);
  return Number.isNaN(target) ? null : target - serverNow();
}
