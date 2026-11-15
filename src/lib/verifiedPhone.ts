/**
 * Ordering needs a verified mobile number (15 Nov 2026, the owner's rule):
 * riders and stores must be able to reach the customer. Pure, so
 * `pnpm verify:verified-phone` runs it with no browser.
 *
 * The backend does not enforce this yet: on 15 Nov 2026 `POST /checkout`
 * accepted a customer with no number and stored `contactNumber: ""`. Until it
 * does, the checkout and payment pages are the gate; the mobile app and direct
 * API calls are not covered.
 *
 * "Verified" is strict: the number must be there **and**
 * `isContactNumberVerified` must be `true`. `/profile` always sends the flag
 * (seen `true` with a number, `false` without one), so a missing flag is not
 * read as verified here — unlike the Referrals page's softer rule.
 */
export interface PhoneProfile {
  contactNumber?: string | null;
  isContactNumberVerified?: boolean | null;
}

export type PhoneState = "verified" | "missing" | "unverified";

export function phoneState(profile: PhoneProfile | null | undefined): PhoneState {
  if (!profile?.contactNumber?.trim()) return "missing";
  return profile.isContactNumberVerified === true ? "verified" : "unverified";
}

export function hasVerifiedPhone(profile: PhoneProfile | null | undefined): boolean {
  return phoneState(profile) === "verified";
}

/**
 * Error keys meaning "this customer needs a (verified) number" — ready for
 * the day the backend refuses such a checkout itself, so the page shows the
 * same card instead of a raw message. Any key naming a missing or unverified
 * contact number counts; a malformed number (`VALIDATION_CONTACT_NUMBER_INVALID`)
 * does not.
 */
export function isPhoneRequiredErrorKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return /(CONTACT_NUMBER|PHONE|MOBILE)_(REQUIRED|MISSING|NOT_VERIFIED|UNVERIFIED)/.test(key);
}
