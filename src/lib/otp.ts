/**
 * The login code's shape and the verified moment's timing — pure, so
 * `pnpm verify:otp-input` can run it with no browser.
 *
 * DeliGo sends a **four-digit** code. The field used to cap at six
 * (`slice(0, 6)`), which let a customer type two digits the server would
 * never accept and then press Verify on them.
 */
export const OTP_LENGTH = 4;

/** Digits only, at most {@link OTP_LENGTH} of them — for typing, pasting and SMS autofill alike. */
export function sanitizeOtp(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, OTP_LENGTH);
}

/** `filled` — a tile gained or replaced its digit. `cleared` — it lost one. */
export type TileChange = "filled" | "cleared";

/**
 * Which tiles changed between two values.
 *
 * `null` for an untouched tile, and that is the point: an untouched tile must
 * not restart its animation, which is what keeps fast typing smooth — the
 * tile still tracing its border from the previous keystroke is left to finish.
 */
export function tileChanges(before: string, after: string): (TileChange | null)[] {
  return Array.from({ length: OTP_LENGTH }, (_, index) => {
    const was = before[index] ?? "";
    const now = after[index] ?? "";
    if (was === now) return null;
    return now ? "filled" : "cleared";
  });
}

/**
 * How long the verified sequence holds the page before it moves on.
 *
 * The sequence (`globals.css`, "the verified moment") runs: the tiles gather
 * into a square by ~0.55s, link up by ~0.95s, turn green at 1s, fold into one
 * tile by 1.8s, and the badge and its three lines of copy have settled by
 * ~2.37s. The page waits for that — **and not a moment longer**: this is time
 * added to every sign-in, and there is no button to skip it.
 *
 * With reduced motion there is no sequence, only the finished badge, so the
 * wait is just long enough to read "Verified successfully".
 */
export const VERIFIED_HOLD_MS = 2500;
export const VERIFIED_HOLD_REDUCED_MS = 1200;
