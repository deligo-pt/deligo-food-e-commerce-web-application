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
import { apiClient } from "@/lib/apiClient";
import { updateLiveLocation } from "@/services/addressApi";
import { useLocationStore } from "@/stores/locationStore";
import { useStore } from "@/stores/translationStore";
import { getFacebookSdk, loadFacebookSdk } from "@/lib/facebookSdk";

// Inlined by Next at build time. An empty value makes `loadFacebookSdk` reject,
// which leaves the button reporting the option unavailable rather than failing
// in a way the customer cannot interpret.
const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? "";

type LoginMode = "mobile" | "email";
type LoginStep = "credentials" | "otp";
/** What to repeat with `forceLogin` after the user clears a device session. */
type PendingAction = "verify" | "social" | null;
// Defined next to the request that carries it, in lib/auth.ts. Re-exported here
// because the login UI imports its types from this hook.
export type { SocialProvider };

export function useLoginFlow() {
  const router = useRouter();
  const lang = useStore((state) => state.lang);

  const [mode, setMode] = useState<LoginMode>("mobile");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [language, setLanguage] = useState<"english" | "portugues">("english");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // A translation key for errors we word ourselves, as opposed to `errorMessage`
  // which carries the backend's own already-localized text. The page renders
  // whichever of the two is set. Phases 4 and 5 use this to map the social
  // `err.errorKey` values onto our copy instead of showing the raw API message.
  const [errorMessageKey, setErrorMessageKey] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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

  const languageLabel = language === "english" ? "English" : "Português";

  const loginHint = useMemo(() => {
    if (step === "otp") {
      return mode === "mobile"
        ? "Enter the OTP sent to your phone."
        : "Enter the OTP sent to your email.";
    }
    return mode === "mobile"
      ? "Use your phone number to request a login OTP."
      : "Use your email address to request a login OTP.";
  }, [mode, step]);

  function clearMessages() {
    setErrorMessage("");
    setErrorMessageKey("");
    setSuccessMessage("");
  }

  function buildIdentifier() {
    const referral = referralCode.trim();
    if (mode === "email") {
      const value = email.trim().toLowerCase();
      if (!value) throw new Error("Enter your email address.");
      return { email: value, ...(referral ? { referralCode: referral } : {}) };
    }
    const number = mobileNumber.replace(/\D/g, "");
    if (!number) throw new Error("Enter your mobile number.");
    return {
      contactNumber: `${selectedCountry.dialCode}${number}`,
      ...(referral ? { referralCode: referral } : {}),
    };
  }

  /** Reports an OTP request failure, keeping the backend's localized text. */
  function reportOtpError(error: unknown) {
    setErrorMessage(
      error instanceof Error ? error.message : "Unable to request OTP.",
    );
  }

  async function sendOtp() {
    clearMessages();
    setShowDeviceLimitModal(false);

    try {
      const identifier = buildIdentifier();
      setIsSendingOtp(true);
      const response = await sendLoginOtp(identifier);
      setLoginIdentifier(identifier);
      setStep("otp");
      setOtp("");
      setSuccessMessage(response.message);
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

  async function verifyOtp(forceLogin = false) {
    clearMessages();
    setShowDeviceLimitModal(false);

    if (!loginIdentifier) {
      setErrorMessage("Request a new OTP first.");
      return;
    }
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setErrorMessage("Enter the OTP sent to you.");
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

      const response = await verifyLoginOtp({
        ...loginIdentifier,
        otp: trimmedOtp,
        deviceDetails,
        forceLogin,
      });
      await completeLogin(response);
    } catch (error) {
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

  async function resendOtp() {
    clearMessages();
    if (!loginIdentifier) {
      setErrorMessage("Request a new OTP first.");
      return;
    }
    try {
      setIsResendingOtp(true);
      const response = await sendLoginOtp(loginIdentifier);
      setSuccessMessage(response.message);
    } catch (error) {
      reportOtpError(error);
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
    isResendingOtp,
    errorMessage,
    errorMessageKey,
    successMessage,
    languageLabel,
    loginHint,
    loginIdentifier,
    socialProviderInFlight,
    showDeviceLimitModal,
    setShowLanguageModal,
    setShowCountryMenu,
    setLanguage,
    setSelectedCountry,
    setEmail,
    setMobileNumber,
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