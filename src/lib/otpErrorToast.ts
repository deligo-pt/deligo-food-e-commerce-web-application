import axios from "axios";
import { errorKeyOf, getApiErrorMessage, validationKeyOf } from "./apiClient";
import { otpErrorMessageKey } from "./otpErrors";

/**
 * The toast for a failed `PATCH /profile/send-otp` or code check outside the
 * login page (checkout's "Verify phone" card, Edit Profile): ours for the
 * three codes above, the server's own text otherwise.
 */
export function otpErrorToast(
  error: unknown,
  t: (key: string) => string,
  fallback: string,
): string {
  const payload = axios.isAxiosError(error) ? error.response?.data : undefined;
  const key = otpErrorMessageKey(errorKeyOf(payload) ?? validationKeyOf(payload));
  return key ? t(key) : getApiErrorMessage(error, fallback);
}
