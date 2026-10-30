/**
 * What a profile still needs before the Referrals page shows its code.
 *
 * The backend issues a code as soon as a first or last name is saved. Showing
 * it only once the whole profile is filled in — both names, a verified email
 * and a verified phone — is a product rule of the web app (30 Oct 2026), so a
 * friend who receives a code can trust the account behind it.
 *
 * A verification flag the API leaves out counts as verified: only an explicit
 * `false` asks the customer to verify.
 */
export interface ProfileForCompleteness {
  name?: { firstName?: string; lastName?: string } | null;
  email?: string | null;
  isEmailVerified?: boolean;
  contactNumber?: string | null;
  isContactNumberVerified?: boolean;
}

export type MissingProfileField =
  | "firstName"
  | "lastName"
  | "email"
  | "verifyEmail"
  | "phone"
  | "verifyPhone";

export function missingProfileFields(
  profile: ProfileForCompleteness | null | undefined,
): MissingProfileField[] {
  const missing: MissingProfileField[] = [];
  if (!profile?.name?.firstName?.trim()) missing.push("firstName");
  if (!profile?.name?.lastName?.trim()) missing.push("lastName");

  if (!profile?.email?.trim()) missing.push("email");
  else if (profile.isEmailVerified === false) missing.push("verifyEmail");

  if (!profile?.contactNumber?.trim()) missing.push("phone");
  else if (profile.isContactNumberVerified === false) missing.push("verifyPhone");

  return missing;
}
