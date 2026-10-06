/**
 * The login code's shape and the verified moment's timing — pure, so
 * `pnpm verify:otp-input` can run it with no browser.
 *
 * The code's length depends on how it was sent (6 Oct 2026): the **email**
 * code is four digits and the **SMS** code is six. The field used to allow
 * four for both, so a mobile customer's last two digits were cut off and the
 * code could never verify. Each length is a cap: typing, pasting and SMS
 * autofill keep at most that many digits.
 */
export const EMAIL_OTP_LENGTH = 4;
export const MOBILE_OTP_LENGTH = 6;

/** The email code's length, and the default where no method is known. */
export const OTP_LENGTH = EMAIL_OTP_LENGTH;

/** How many digits the code sent to this login method has. */
export function otpLengthFor(mode: "mobile" | "email"): number {
  return mode === "mobile" ? MOBILE_OTP_LENGTH : EMAIL_OTP_LENGTH;
}

/** Digits only, at most `length` of them — for typing, pasting and SMS autofill alike. */
export function sanitizeOtp(raw: string | null | undefined, length: number = OTP_LENGTH): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, length);
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
export function tileChanges(
  before: string,
  after: string,
  length: number = OTP_LENGTH,
): (TileChange | null)[] {
  return Array.from({ length }, (_, index) => {
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
