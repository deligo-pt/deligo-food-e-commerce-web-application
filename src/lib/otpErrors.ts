/**
 * The OTP answers this app words itself, after the backend's security update
 * of 17 Nov 2026. Pure, so `pnpm verify:otp-errors` runs it with no browser.
 *
 * | answer | key | what the customer is told |
 * |---|---|---|
 * | `502` | `OTP_DELIVERY_FAILED` | the code could not be sent (and, at sign-up, no account was made) |
 * | `429` | `OTP_ATTEMPTS_EXCEEDED` | 5 wrong codes: paused for 15 minutes |
 * | `400` | `VALIDATION_CONTACT_NUMBER_COUNTRY_NOT_SUPPORTED` | only +351 numbers |
 *
 * Every other answer keeps the backend's own text, which is localized and
 * already specific — the per-IP limiter's `RATE_LIMIT_EXCEEDED` says "Too many
 * auth attempts. Please try again after 30 seconds." (measured), and the
 * cooldown and daily-cap answers carry their own wording. Keyed on the code,
 * never on the message.
 */

export const OTP_DELIVERY_FAILED = "OTP_DELIVERY_FAILED";
export const OTP_ATTEMPTS_EXCEEDED = "OTP_ATTEMPTS_EXCEEDED";
export const CONTACT_NUMBER_COUNTRY_NOT_SUPPORTED = "VALIDATION_CONTACT_NUMBER_COUNTRY_NOT_SUPPORTED";

/** Our translation key for an OTP error code, or `null` to keep the server's text. */
export function otpErrorMessageKey(errorKey: string | null | undefined): string | null {
  switch (errorKey) {
    case OTP_DELIVERY_FAILED:
      return "otpErrorDeliveryFailed";
    case OTP_ATTEMPTS_EXCEEDED:
      return "otpErrorAttemptsExceededShort";
    case CONTACT_NUMBER_COUNTRY_NOT_SUPPORTED:
      return "loginErrorPhoneCountry";
    default:
      return null;
  }
}
