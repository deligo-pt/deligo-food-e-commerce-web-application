"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthError,
  buildDeviceDetails,
  sendLoginOtp,
  socialLogin,
  type LoginIdentifier,
  type SocialProvider,
  type VerifyOtpResponse,
  verifyLoginOtp,
} from "../lib/auth";
import { storeAuthTokens } from "../lib/authCookies";
import { COUNTRY_OPTIONS } from "../data/countryCodes";
import { requestFCMToken } from "../lib/fcmToken";
import {
  OTP_RESEND_COOLDOWN_MS,
  VERIFIED_HOLD_MS,
  VERIFIED_HOLD_REDUCED_MS,
} from "@/lib/otp";
import { apiClient } from "@/lib/apiClient";
import { updateLiveLocation } from "@/services/addressApi";
import { useLocationStore } from "@/stores/locationStore";
import { useStore } from "@/stores/translationStore";
import { useTranslation } from "@/hooks/useTranslation";
import { getFacebookSdk, loadFacebookSdk } from "@/lib/facebookSdk";

// Inlined by Next at build time. An empty value makes `loadFacebookSdk` reject,
// which leaves the button reporting the option unavailable rather than failing
// in a way the customer cannot interpret.
const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? "";

type LoginMode = "mobile" | "email";
type LoginStep = "credentials" | "otp";
/** What to repeat with `forceLogin` after the user clears a device session. */
type PendingAction = "verify" | "social" | null;
/** The credentials field an error is about, outlined until it is edited. */
type InvalidField = "phone" | "email" | null;

/**
 * Enough of an email's shape to be worth sending: something, @, a domain with
 * a dot and at least two letters after it, no spaces. "Send OTP" stays
 * disabled until the address passes; the server still has the final word.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * When "Resend OTP" unlocks for a number or email, kept in localStorage so
 * neither a reload nor "Change details" → "Send OTP" to the same address
 * skips the wait. Keyed on the address alone: the referral code does not
 * make it a different request.
 */
function resendLockKey(identifier: LoginIdentifier) {
  return `deligo-otp-resend:${identifier.contactNumber ?? identifier.email ?? ""}`;
}

function readResendLock(identifier: LoginIdentifier): number {
  try {
    return Number(window.localStorage.getItem(resendLockKey(identifier))) || 0;
  } catch {
    return 0;
  }
}

function writeResendLock(identifier: LoginIdentifier, readyAt: number) {
  try {
    window.localStorage.setItem(resendLockKey(identifier), String(readyAt));
  } catch {}
}
// Defined next to the request that carries it, in lib/auth.ts. Re-exported here
// because the login UI imports its types from this hook.
export type { SocialProvider };

export function useLoginFlow(initialReferralCode = "") {
  const router = useRouter();
  const lang = useStore((state) => state.lang);
  // `t` keeps a stable identity across renders (see useTranslation), so the
  // memo below does not recompute on every keystroke in the form.
  const { t } = useTranslation();

  const [mode, setMode] = useState<LoginMode>("mobile");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [language, setLanguage] = useState<"english" | "portugues">("english");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  /**
   * The server accepted the code, and the page is playing the verified moment
   * before it moves on. OTP only: the social path keeps going straight home.
   */
  const [otpVerified, setOtpVerified] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // A translation key for errors we word ourselves, as opposed to `errorMessage`
  // which carries the backend's own already-localized text. The page renders
  // whichever of the two is set. Phases 4 and 5 use this to map the social
  // `err.errorKey` values onto our copy instead of showing the raw API message.
  const [errorMessageKey, setErrorMessageKey] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  // Same split as the error pair: our own copy, translated at render.
  const [successMessageKey, setSuccessMessageKey] = useState("");
  const [invalidField, setInvalidField] = useState<InvalidField>(null);
  // The email field has been left once: only then is a half-typed address
  // called out, so the hint does not nag while someone is still typing.
  const [emailTouched, setEmailTouched] = useState(false);
  const emailValid = EMAIL_PATTERN.test(email.trim());
  const showEmailHint = emailTouched && email.trim() !== "" && !emailValid;
  const canSendOtp = mode === "mobile" || emailValid;
  // Resend lock: when it opens, and a clock ticked once a second while it is
  // shut. `now` starts at 0 and is only ever read from event handlers and the
  // interval, so rendering stays pure.
  const [resendReadyAt, setResendReadyAt] = useState(0);
  const [now, setNow] = useState(0);
  const resendRemainingMs = Math.max(0, resendReadyAt - now);
  const [loginIdentifier, setLoginIdentifier] = useState<LoginIdentifier | null>(null);
  const [showDeviceLimitModal, setShowDeviceLimitModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // Which provider is mid-exchange, so only that button shows a spinner.
  const [socialProviderInFlight, setSocialProviderInFlight] =
    useState<SocialProvider | null>(null);
  // The provider token held back for a `forceLogin` retry after the device
  // modal, so clearing a session does not send the user through the provider's
  // consent screen a second time.
  const [pendingSocial, setPendingSocial] = useState<{
    provider: SocialProvider;
    token: string;
  } | null>(null);

  // Preload the Facebook SDK so the click handler can call `FB.login`
  // synchronously. Opening the popup after an await loses the user-gesture
  // attribution and the browser blocks it. A failure here is not surfaced —
  // the button reports it if and when someone actually presses it.
  useEffect(() => {
    loadFacebookSdk(facebookAppId, lang).catch(() => {});
  }, [lang]);

  useEffect(() => {
    if (resendReadyAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      // Read from the real clock each tick, so a throttled background tab
      // shows the right time the moment it is looked at again.
      const current = Date.now();
      setNow(current);
      if (current >= resendReadyAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendReadyAt]);

  function showResendLock(readyAt: number) {
    setResendReadyAt(readyAt);
    setNow(Date.now());
  }

  /** A code just went out: lock "Resend OTP" for this address. */
  function startResendLock(identifier: LoginIdentifier) {
    const readyAt = Date.now() + OTP_RESEND_COOLDOWN_MS;
    writeResendLock(identifier, readyAt);
    showResendLock(readyAt);
  }

  const languageLabel = language === "english" ? "English" : "Português";

  // Translated, not hardcoded: these four lines were the only English left in
  // an otherwise Portuguese login page. The email OTP variant also warns about
  // the spam folder — the success banner above it is the backend's own text and
  // cannot say so, and this line sits directly beside it.
  const loginHint = useMemo(() => {
    if (step === "otp") {
      return mode === "mobile" ? t("loginHintOtpMobile") : t("loginHintOtpEmail");
    }
    return mode === "mobile" ? t("loginHintMobile") : t("loginHintEmail");
  }, [mode, step, t]);

  function clearMessages() {
    setErrorMessage("");
    setErrorMessageKey("");
    setSuccessMessage("");
    setSuccessMessageKey("");
    setInvalidField(null);
  }

  /** Shows one of our own errors and outlines the field it is about. */
  function flagField(field: InvalidField, messageKey: string) {
    setErrorMessageKey(messageKey);
    setInvalidField(field);
  }

  /**
   * The address to send a code to, or the error that stops it — checked here
   * so a mistyped number gets a clear line at once instead of a round trip to
   * the server's generic "Validation failed".
   */
  function buildIdentifier():
    | { identifier: LoginIdentifier }
    | { field: InvalidField; messageKey: string } {
    const referral = referralCode.trim();
    const extra = referral ? { referralCode: referral } : {};
    if (mode === "email") {
      const value = email.trim().toLowerCase();
      if (!value) return { field: "email", messageKey: "loginErrorEmailRequired" };
      // The button is disabled for this; the check stands behind it.
      if (!EMAIL_PATTERN.test(value)) return { field: "email", messageKey: "loginErrorEmailInvalid" };
      return { identifier: { email: value, ...extra } };
    }
    let number = mobileNumber.replace(/\D/g, "");
    if (!number) return { field: "phone", messageKey: "loginErrorPhoneRequired" };
    // A pasted "+351 912 345 678" or "00351…" carries the dial code the
    // picker already supplies; drop it rather than reject the number.
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, "");
    for (const prefix of [`00${dialDigits}`, dialDigits]) {
      if (
        number.startsWith(prefix) &&
        number.length === prefix.length + selectedCountry.nationalLength
      ) {
        number = number.slice(prefix.length);
        break;
      }
    }
    if (number.length !== selectedCountry.nationalLength) {
      return { field: "phone", messageKey: "loginErrorPhoneInvalid" };
    }
    return {
      identifier: { contactNumber: `${selectedCountry.dialCode}${number}`, ...extra },
    };
  }

  function updateMobileNumber(value: string) {
    setMobileNumber(value);
    if (invalidField === "phone") clearMessages();
  }

  function updateEmail(value: string) {
    setEmail(value);
    if (invalidField === "email") clearMessages();
  }

  /** Reports an OTP request failure, keeping the backend's localized text. */
  function reportOtpError(error: unknown) {
    // Our own check should catch a bad number first; this covers any number
    // the server's stricter rule still refuses. Keyed on the code, not text.
    if (error instanceof AuthError && error.errorKey === "VALIDATION_CONTACT_NUMBER_INVALID") {
      flagField("phone", "loginErrorPhoneInvalid");
      return;
    }
    setErrorMessage(
      error instanceof Error ? error.message : "Unable to request OTP.",
    );
  }

  async function sendOtp() {
    clearMessages();
    setShowDeviceLimitModal(false);

    const built = buildIdentifier();
    if (!("identifier" in built)) {
      flagField(built.field, built.messageKey);
      return;
    }
    const { identifier } = built;

    // A code went to this address less than the lock ago: it is still the
    // one to type, so go back to it rather than send another.
    const lockedUntil = readResendLock(identifier);
    if (lockedUntil > Date.now()) {
      setLoginIdentifier(identifier);
      setStep("otp");
      setOtp("");
      setSuccessMessageKey("otpAlreadySent");
      showResendLock(lockedUntil);
      return;
    }

    try {
      setIsSendingOtp(true);
      const response = await sendLoginOtp(identifier);
      setLoginIdentifier(identifier);
      setStep("otp");
      setOtp("");
      setSuccessMessage(response.message);
      startResendLock(identifier);
    } catch (error) {
      reportOtpError(error);
    } finally {
      setIsSendingOtp(false);
    }
  }

  /**
   * Moves a guest's saved address onto the account they just logged into.
   *
   * Best-effort by design: a failure here must never block a successful login,
   * so it logs and returns rather than throwing. The address stays in
   * localStorage if it could not be synced, so a later login can retry it.
   */
  async function syncGuestAddress() {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("deligo_guest_address")
        : null;
    if (!stored) return;

    try {
      const guestAddress = JSON.parse(stored);
      const profileResponse = await apiClient.get("/profile");
      const userId = profileResponse.data?.data?.userId;
      if (!userId) return;

      await updateLiveLocation(userId, {
        latitude: guestAddress.latitude,
        longitude: guestAddress.longitude,
        geoAccuracy: 10,
        isMocked: false,
        street: guestAddress.street,
        city: guestAddress.city,
        state: guestAddress.state,
        country: guestAddress.country,
        postalCode: guestAddress.postalCode,
        detailedAddress: guestAddress.detailedAddress,
      });
      localStorage.removeItem("deligo_guest_address");
      useLocationStore.getState().setGuestAddress(null);
      window.dispatchEvent(new Event("addressUpdated"));
    } catch (syncError) {
      console.error("Failed to sync guest address after login:", syncError);
    }
  }

  /**
   * The single post-login path, shared by OTP and every social provider.
   *
   * `/verify-otp` and `/auth/social-login` return the same envelope, so
   * everything after the token arrives is identical — and must stay that way.
   * Three copies of this drifting apart is exactly how one entry point quietly
   * stops syncing addresses or stops refreshing the router.
   */
  async function completeLogin(response: VerifyOtpResponse) {
    storeAuthTokens(response.data.accessToken, response.data.refreshToken);
    await syncGuestAddress();
    router.replace("/");
    router.refresh();
  }

  /**
   * True when a failure is the backend's device-limit rejection.
   *
   * Keyed on the stable `err.errorKey`; the human message ("Request limit
   * exceeded…") is misleading copy and must not be relied on. The string checks
   * are a defensive fallback only.
   */
  function isDeviceLimitError(error: unknown, message: string) {
    const errorKey = error instanceof AuthError ? error.errorKey : undefined;
    return (
      errorKey === "LIMIT_EXCEEDED" ||
      message.includes("LIMIT_EXCEEDED") ||
      message.toLowerCase().includes("device limit")
    );
  }

  /**
   * Waits out the verified moment — the tiles folding into the badge and its
   * copy settling — then lets the page move on by itself. There is no button
   * to skip it (the owner's call: the page already continues on its own), so
   * the wait is sign-in time the customer did not ask for and is kept to the
   * animation's length and no more. With reduced motion there is no
   * animation, only the badge, and the wait is just long enough to read it.
   */
  function holdForVerifiedMoment() {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, reduced ? VERIFIED_HOLD_REDUCED_MS : VERIFIED_HOLD_MS);
    });
  }

  async function verifyOtp(forceLogin = false) {
    clearMessages();
    setShowDeviceLimitModal(false);

    if (!loginIdentifier) {
      setErrorMessageKey("loginErrorRequestOtpFirst");
      return;
    }
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setErrorMessageKey("loginErrorEnterOtp");
      return;
    }

    try {
      setIsVerifyingOtp(true);

      // Fetch the FCM token so it is included in deviceDetails on the very
      // first verify-otp call. Falls back to "" when FCM is unavailable.
      console.log("[FCM] Requesting FCM token before OTP verification...");
      const fcmToken = (await requestFCMToken()) ?? "";
      console.log("[FCM] Token received:", fcmToken ? `✅ ${fcmToken.slice(0, 30)}...` : "❌ No token (empty)");
      const deviceDetails = { ...buildDeviceDetails(), fcmToken };
      console.log("[FCM] deviceDetails being sent:", deviceDetails);

      // The address only — never the referral code. It was applied when the
      // code was requested (`/login-customer`), and `/verify-otp`'s schema is
      // strict: sending `referralCode` refused the whole request with
      // "Unrecognized key(s) in object: 'referralCode'", so anyone who had
      // typed a code — or opened a shared `/login?ref=` link — could not
      // sign in (17 Oct 2026).
      const address = loginIdentifier.email
        ? { email: loginIdentifier.email }
        : { contactNumber: loginIdentifier.contactNumber };
      const response = await verifyLoginOtp({
        ...address,
        otp: trimmedOtp,
        deviceDetails,
        forceLogin,
      });

      // The session is kept *before* the celebration, not after it: a customer
      // who closes the tab while the badge is drawing is still signed in.
      // `completeLogin` stores the same tokens again, which is harmless, and
      // stays byte-for-byte the path the social providers take.
      storeAuthTokens(response.data.accessToken, response.data.refreshToken);
      setOtpVerified(true);
      await holdForVerifiedMoment();
      await completeLogin(response);
    } catch (error) {
      // Nothing after a successful verify is expected to throw, but if it did
      // the page would sit on the badge with no buttons. Back to the form.
      setOtpVerified(false);
      const message = error instanceof Error ? error.message : "Unable to verify OTP.";
      if (isDeviceLimitError(error, message)) {
        setPendingAction("verify");
        setShowDeviceLimitModal(true);
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  /** Sends a fresh code. True once it has gone out, so the page can refocus. */
  async function resendOtp(): Promise<boolean> {
    // The button is disabled while locked; this guards a stale click.
    if (resendReadyAt > Date.now()) return false;
    clearMessages();
    if (!loginIdentifier) {
      setErrorMessageKey("loginErrorRequestOtpFirst");
      return false;
    }
    try {
      setIsResendingOtp(true);
      const response = await sendLoginOtp(loginIdentifier);
      setSuccessMessage(response.message);
      // The old code died with this send. Left in the tiles it could only
      // fail on Verify. A failed resend keeps it: nothing replaced it.
      setOtp("");
      startResendLock(loginIdentifier);
      return true;
    } catch (error) {
      reportOtpError(error);
      return false;
    } finally {
      setIsResendingOtp(false);
    }
  }

  /**
   * Maps a social failure onto our own copy.
   *
   * Every one of these is keyed on `err.errorKey`, never on the message. An
   * unrecognised key falls back to a generic line rather than surfacing raw API
   * text, which for these endpoints tends to be developer-facing.
   */
  function reportSocialError(error: unknown) {
    const errorKey = error instanceof AuthError ? error.errorKey : undefined;
    switch (errorKey) {
      case "SOCIAL_EMAIL_REQUIRED":
        setErrorMessageKey("socialEmailRequired");
        return;
      case "SOCIAL_ACCOUNT_ALREADY_LINKED":
        setErrorMessageKey("socialAccountAlreadyLinked");
        return;
      case "GOOGLE_CONFIGURATION_MISSING":
      case "FACEBOOK_CONFIGURATION_MISSING":
        // Server-side credentials are absent. Nothing the customer can act on.
        setErrorMessageKey("socialUnavailable");
        return;
      case "INVALID_SOCIAL_TOKEN":
        setErrorMessageKey("socialLoginFailed");
        return;
      default:
        // USER_BLOCKED and anything unmapped: the backend's own localized
        // message is more specific than a generic line would be.
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to sign in.",
        );
    }
  }

  /**
   * Exchanges a provider token for a DeliGo session.
   *
   * Called with a token the provider's own SDK has already produced — this
   * function never talks to Google or Facebook, only to our backend.
   */
  async function runSocialLogin(
    provider: SocialProvider,
    token: string,
    forceLogin = false,
  ) {
    clearMessages();
    setShowDeviceLimitModal(false);
    setSocialProviderInFlight(provider);

    try {
      // Same FCM handling as the OTP path, so a social login registers the
      // device for notifications identically.
      const fcmToken = (await requestFCMToken()) ?? "";
      const referral = referralCode.trim();

      const response = await socialLogin({
        provider,
        token,
        // The referral field sits directly above these buttons, so someone who
        // typed a code and then pressed Google reasonably expects it to count.
        // The backend applies it here exactly as it does on /login-customer.
        ...(referral ? { referralCode: referral } : {}),
        deviceDetails: { ...buildDeviceDetails(), fcmToken },
        forceLogin,
      });

      await completeLogin(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      if (isDeviceLimitError(error, message)) {
        // Keep the token so the retry does not need a second trip through the
        // provider's consent screen.
        setPendingSocial({ provider, token });
        setPendingAction("social");
        setShowDeviceLimitModal(true);
      } else {
        reportSocialError(error);
      }
    } finally {
      setSocialProviderInFlight(null);
    }
  }

  /** Called by `GoogleSignInButton` once GIS hands back an ID token. */
  function handleGoogleCredential(idToken: string) {
    void runSocialLogin("GOOGLE", idToken);
  }

  /**
   * Opens Facebook's login popup and exchanges the resulting access token.
   *
   * Deliberately NOT async and with no `await` before `FB.login`: the popup is
   * only permitted while the browser still considers this the user's click.
   * Awaiting the SDK here would open it a tick later and get it blocked, which
   * is why the SDK is preloaded on mount instead.
   */
  function startFacebookLogin() {
    clearMessages();

    const sdk = getFacebookSdk();
    if (!sdk) {
      // Preload has not finished, or the script was blocked outright.
      setErrorMessageKey("socialUnavailable");
      return;
    }

    setSocialProviderInFlight("FACEBOOK");
    sdk.login(
      (response) => {
        const accessToken = response.authResponse?.accessToken;
        if (response.status === "connected" && accessToken) {
          void runSocialLogin("FACEBOOK", accessToken);
          return;
        }
        // Cancelled, or consent refused. Deliberately silent: the customer
        // just chose not to continue, and an error banner would read as a
        // failure rather than as their own decision.
        setSocialProviderInFlight(null);
      },
      {
        scope: "email,public_profile",
        // Re-asks for permissions previously declined. Without this, a customer
        // who once refused the email prompt can never be asked again, and every
        // later attempt dies on SOCIAL_EMAIL_REQUIRED with no way forward.
        // Harmless when nothing was declined.
        auth_type: "rerequest",
      },
    );
  }

  /**
   * The provider could not be reached at all — script blocked, SDK missing, or
   * a callback that arrived without a token. Distinct from a backend rejection.
   */
  function reportSocialUnavailable() {
    clearMessages();
    setErrorMessageKey("socialUnavailable");
  }

  function changeMode(nextMode: LoginMode) {
    setMode(nextMode);
    setStep("credentials");
    setOtp("");
    setLoginIdentifier(null);
    clearMessages();
    setShowDeviceLimitModal(false);
    setPendingAction(null);
  }

  function backToCredentials() {
    setStep("credentials");
    setOtp("");
    clearMessages();
  }

  function clearSessionAndRetry() {
    setShowDeviceLimitModal(false);
    if (pendingAction === "verify") {
      verifyOtp(true);
    } else if (pendingAction === "social" && pendingSocial) {
      void runSocialLogin(pendingSocial.provider, pendingSocial.token, true);
      setPendingSocial(null);
    }
    setPendingAction(null);
  }

  return {
    mode,
    step,
    showLanguageModal,
    showCountryMenu,
    language,
    selectedCountry,
    email,
    mobileNumber,
    referralCode,
    otp,
    isSendingOtp,
    isVerifyingOtp,
    otpVerified,
    isResendingOtp,
    errorMessage,
    errorMessageKey,
    successMessage,
    successMessageKey,
    invalidField,
    resendRemainingMs,
    showEmailHint,
    canSendOtp,
    markEmailTouched: () => setEmailTouched(true),
    languageLabel,
    loginHint,
    loginIdentifier,
    socialProviderInFlight,
    showDeviceLimitModal,
    setShowLanguageModal,
    setShowCountryMenu,
    setLanguage,
    setSelectedCountry,
    // Editing the field an error is about clears that error.
    setEmail: updateEmail,
    setMobileNumber: updateMobileNumber,
    setReferralCode,
    setOtp,
    changeMode,
    handleGoogleCredential,
    startFacebookLogin,
    reportSocialUnavailable,
    sendOtp,
    verifyOtp,
    resendOtp,
    backToCredentials,
    clearSessionAndRetry,
    setShowDeviceLimitModal,
  };
}