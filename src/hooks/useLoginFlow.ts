"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildDeviceDetails,
  sendLoginOtp,
  type LoginIdentifier,
  verifyLoginOtp,
} from "../lib/auth";
import { storeAuthTokens } from "../lib/authCookies";
import { COUNTRY_OPTIONS } from "../data/countryCodes";
import { requestFCMToken } from "../lib/fcmToken";
import { apiClient } from "@/lib/apiClient";
import { updateLiveLocation } from "@/services/addressApi";
import { useLocationStore } from "@/stores/locationStore";

type LoginMode = "mobile" | "email";
type LoginStep = "credentials" | "otp";
type PendingAction = "verify" | null;

export function useLoginFlow() {
  const router = useRouter();

  const [mode, setMode] = useState<LoginMode>("mobile");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [showReferral, setShowReferral] = useState(false);
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
  const [successMessage, setSuccessMessage] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState<LoginIdentifier | null>(null);
  const [showDeviceLimitModal, setShowDeviceLimitModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

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
      const message = error instanceof Error ? error.message : "Unable to request OTP.";
      setErrorMessage(message);
    } finally {
      setIsSendingOtp(false);
    }
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
      storeAuthTokens(response.data.accessToken, response.data.refreshToken);

      // Auto-sync guest address to the logged in user
      const guestAddressStr = typeof window !== "undefined" ? localStorage.getItem("deligo_guest_address") : null;
      if (guestAddressStr) {
        try {
          const guestAddress = JSON.parse(guestAddressStr);
          const profileResponse = await apiClient.get("/profile");
          const userId = profileResponse.data?.data?.userId;
          if (userId) {
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
          }
        } catch (syncErr) {
          console.error("Failed to sync guest address on OTP verification:", syncErr);
        }
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify OTP.";
      if (message.includes("LIMIT_EXCEEDED") || message.toLowerCase().includes("device limit")) {
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to resend OTP.");
    } finally {
      setIsResendingOtp(false);
    }
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
    }
    setPendingAction(null);
  }

  return {
    mode,
    step,
    showReferral,
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
    successMessage,
    languageLabel,
    loginHint,
    loginIdentifier,
    showDeviceLimitModal,
    setShowReferral,
    setShowLanguageModal,
    setShowCountryMenu,
    setLanguage,
    setSelectedCountry,
    setEmail,
    setMobileNumber,
    setReferralCode,
    setOtp,
    changeMode,
    sendOtp,
    verifyOtp,
    resendOtp,
    backToCredentials,
    clearSessionAndRetry,
    setShowDeviceLimitModal,
  };
}