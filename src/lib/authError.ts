/**
 * Whether a `401` means "you are signed out" or "that credential was wrong".
 *
 * The API uses `401` for both, which is correct of it and a trap for us: the
 * response interceptor's job is to end a dead session, and for a while it ended
 * live ones too. Mistyping an OTP digit answers
 * `401 INVALID_OTP_CODE`, and a blanket status check read that as a expired
 * token — cookies cleared, hard navigation to `/login`, form state gone, all
 * because four digits were wrong.
 *
 * `err.errorKey` is in the body of every one of these, which is why this branches
 * on it. Same rule as `getApiErrorMessage`: the key is part of the contract, the
 * status and the prose are not.
 */

/**
 * The `401`s that really are the session ending. Measured against the live API:
 *
 * | request | key |
 * |---|---|
 * | no `Authorization` header | `AUTHENTICATION_REQUIRED` |
 * | malformed token | `NOT_AUTHORIZED` |
 * | genuinely expired token | `NOT_AUTHORIZED` |
 *
 * A **denylist**, deliberately. An allowlist of known-safe keys would have to be
 * extended every time the backend invents another credential check, and the cost
 * of forgetting is this bug again — a customer logged out mid-form for getting a
 * code wrong. The cost of the denylist being wrong is milder: an unrecognized
 * session failure leaves them signed in until the next request notices.
 */
const SESSION_ENDED_ERROR_KEYS = new Set([
  "AUTHENTICATION_REQUIRED",
  "NOT_AUTHORIZED",
]);

/**
 * Should this response log the customer out?
 *
 * Only a `401`, and only one the server attributed to the session.
 *
 * A `401` carrying **no** `errorKey` is treated as the session ending. Every one
 * observed so far carries one, so this is the unexplained case — and of the two
 * ways to be wrong about it, stranding someone in an app where every request
 * silently fails is worse than an unnecessary trip to the login screen.
 */
export function isSessionEndedResponse(
  status: number | undefined,
  errorKey: string | null | undefined,
): boolean {
  if (status !== 401) return false;
  if (!errorKey) return true;

  return SESSION_ENDED_ERROR_KEYS.has(errorKey);
}
