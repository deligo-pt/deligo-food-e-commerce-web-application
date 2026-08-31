"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  CircleX,
  Check,
  Globe,
  Gift,
  KeyRound,
  LoaderCircle,
  Mail,
  MonitorSmartphone,
  Phone,
} from "lucide-react";
import Image from "next/image";
import Logo from "@/components/shared/Logo";
import { COUNTRY_OPTIONS, type CountryOption } from "../../data/countryCodes";
import { FacebookMark } from "./BrandIcons";
import GoogleSignInButton from "./GoogleSignInButton";
import SocialButton from "./SocialButton";
import { useTheme } from "@/hooks/useTheme";
// Inlined by Next at build time. Empty is handled: GoogleSignInButton falls
// back to a plain button that reports the option unavailable, so a missing ID
// degrades rather than crashes.
const googleOAuthClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "";
import { useLoginFlow } from "../../hooks/useLoginFlow";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { Button } from "@/components/ui/button";

function CountryFlag({
  countryCode,
  name,
}: {
  countryCode: string;
  name: string;
}) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${countryCode}.png`}
      alt={`${name} flag`}
      width={20}
      height={20}
      className="h-5 w-5 object-contain "
    />
  );
}

function ClearSessionModal({
  open,
  onOpenChange,
  onRemove,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  t: (key: string) => string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-transparent bg-white p-6 text-center shadow-2xl animate-scaleIn dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none sm:p-8">
        {/* Themed icon — pink brand tint, echoing the #f9186b accent used
            throughout the app */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#ffe4ee] dark:bg-primary/15">
          <MonitorSmartphone className="h-8 w-8 text-primary" />
        </div>

        <h3 className="text-xl font-bold text-foreground dark:text-neutral-50 sm:text-2xl">
          {t("deviceLimitExceeded")}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-base leading-6 text-muted-foreground dark:text-neutral-400">
          {t("deviceLimitExceededDescription")}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer rounded-full font-semibold"
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onRemove();
              onOpenChange(false);
            }}
            className="cursor-pointer rounded-full font-semibold shadow-sm active:scale-[0.98]"
          >
            {t("removeSession")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);
  // Google's button has no automatic dark mode; it has to be told.
  const { theme } = useTheme();
  const setLang = useStore((state) => state.setLang);
  const {
    mode,
    step,
    showLanguageModal,
    showCountryMenu,
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
    loginHint,
    loginIdentifier,
    socialProviderInFlight,
    handleGoogleCredential,
    startFacebookLogin,
    reportSocialUnavailable,
    showDeviceLimitModal,
    setShowDeviceLimitModal,
    setShowLanguageModal,
    setShowCountryMenu,
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
  } = useLoginFlow();

  return (
    <main className="min-h-screen bg-[#f7f2f5] dark:bg-neutral-950 px-4 py-8 text-foreground dark:text-neutral-100 sm:px-6 lg:px-8 lg:py-10 transition-colors duration-200">
      {/* Explicit path back to the homepage */}
      <Link
        href="/"
        className="mx-auto mb-5 flex w-full max-w-5xl items-center gap-2 text-sm font-medium text-foreground/70 dark:text-neutral-400 hover:text-primary dark:hover:text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        {t("returnToHome")}
      </Link>

      <section className="mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-4xl bg-white dark:bg-neutral-900 border border-transparent dark:border-neutral-800 shadow-[0_18px_70px_rgba(16,24,40,0.12)] dark:shadow-none lg:min-h-[calc(100vh-5rem)] lg:flex-row">
        {/* Left side - same as before */}
        <div className="flex items-center justify-center bg-primary px-6 py-12 text-center text-white sm:px-10 lg:min-h-full lg:w-[42%] lg:px-12 lg:py-16">
          <div className="flex w-full max-w-sm flex-col items-center">
            <Link
              href="/"
              aria-label={t("returnToHome")}
              className="rounded-xl outline-none transition-transform duration-200 ease-out hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-primary motion-reduce:transform-none motion-reduce:transition-none"
            >
              {/* Panel is #ef2f7a, so the tile would be pink on pink; the
                  knockout puts the mark straight on the panel. The rounding
                  and drop shadow went with the tile and have nothing to sit
                  on now. */}
              <Logo
                size={112}
                variant="mark"
                className="h-auto w-20 sm:w-24 lg:w-28"
                priority
                alt="DeliGo logo"
              />
            </Link>
            <h1 className="mt-6 text-display font-extrabold tracking-[-0.03em] text-white">
              DeliGo
            </h1>
            <p className="mt-4 text-base leading-6 text-white/90">
              {t("loginFastReliable")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-start px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="flex w-full flex-col">
            <div>
              <h2 className="text-2xl font-extrabold leading-tight tracking-[-0.03em] text-foreground dark:text-neutral-50 lg:text-display">
                {t("welcomeBack")}
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground dark:text-neutral-400">
                {t("loginOrCreateAccount")}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6 border-b border-[#e3e3e3] dark:border-neutral-800 sm:mt-10">
              <button
                type="button"
                onClick={() => changeMode("mobile")}
                className="focus-ring relative pb-4 text-xl font-semibold transition-colors"
              >
                <span
                  className={
                    mode === "mobile" ? "text-primary dark:text-pink-400" : "text-muted-foreground dark:text-neutral-400"
                  }
                >
                  {t("mobile")}
                </span>
                <span
                  className={[
                    "absolute -bottom-px left-0 h-0.5 rounded-full transition-all duration-300",
                    mode === "mobile"
                      ? "w-full bg-primary dark:bg-pink-400"
                      : "w-0 bg-transparent",
                  ].join(" ")}
                />
              </button>

              <button
                type="button"
                onClick={() => changeMode("email")}
                className="focus-ring relative pb-4 text-xl font-semibold transition-colors"
              >
                <span
                  className={
                    mode === "email" ? "text-primary dark:text-pink-400" : "text-muted-foreground dark:text-neutral-400"
                  }
                >
                  {t("email")}
                </span>
                <span
                  className={[
                    "absolute -bottom-px right-0 h-0.5 rounded-full transition-all duration-300",
                    mode === "email"
                      ? "w-full bg-primary dark:bg-pink-400"
                      : "w-0 bg-transparent",
                  ].join(" ")}
                />
              </button>
            </div>

            <div className="mt-8 space-y-5 sm:mt-10">
              <p className="text-base leading-6 text-muted-foreground dark:text-neutral-400">
                {loginHint}
              </p>

              {/* `errorMessageKey` holds copy we word ourselves and must
                  translate; `errorMessage` is the backend's own already
                  localized text. Only one is ever set at a time. */}
              {errorMessageKey || errorMessage ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-[#ffd4dc] dark:border-red-950 bg-[#fff4f7] dark:bg-red-950/20 px-4 py-3 text-sm font-medium text-[#b81f57] dark:text-red-400"
                >
                  {errorMessageKey ? t(errorMessageKey) : errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-2xl border border-[#cdeed9] dark:border-green-950 bg-[#f2fbf5] dark:bg-green-950/20 px-4 py-3 text-sm font-medium text-[#166534] dark:text-green-400">
                  {successMessage}
                </div>
              ) : null}

              <div className="relative rounded-2xl border border-[#dcdcdc] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] dark:shadow-none sm:px-5">
                {step === "credentials" ? (
                  mode === "mobile" ? (
                    <div className="flex items-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          setShowCountryMenu((currentValue) => !currentValue)
                        }
                        className="focus-ring flex items-center gap-2 rounded-sm pr-3 text-base font-medium text-foreground dark:text-neutral-300 transition-colors hover:text-primary dark:hover:text-pink-400"
                      >
                        <CountryFlag
                          countryCode={selectedCountry.flagCode}
                          name={selectedCountry.name}
                        />
                        <span>{selectedCountry.dialCode}</span>
                        <ChevronDown
                          size={16}
                          strokeWidth={2.6}
                          className="text-muted-foreground dark:text-neutral-500"
                        />
                      </button>
                      <div className="h-7 w-px bg-[#dedede] dark:bg-neutral-800" />
                      <div className="flex flex-1 items-center gap-3">
                        <Phone size={18} className="text-muted-foreground dark:text-neutral-500" />
                        <input
                          type="tel"
                          inputMode="tel"
                          value={mobileNumber}
                          onChange={(event) =>
                            setMobileNumber(event.target.value)
                          }
                          placeholder={t("mobileNumber")}
                          className="w-full border-0 bg-transparent text-base text-muted-foreground dark:text-neutral-200 outline-none placeholder:text-muted-foreground dark:placeholder:text-neutral-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-1">
                      <Mail size={18} className="text-muted-foreground dark:text-neutral-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t("emailAddress")}
                        className="w-full border-0 bg-transparent text-base text-muted-foreground dark:text-neutral-200 outline-none placeholder:text-muted-foreground dark:placeholder:text-neutral-500"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-3 px-1">
                    <KeyRound size={18} className="text-muted-foreground dark:text-neutral-500" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(event) =>
                        setOtp(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      placeholder={t("enterOtp")}
                      className="w-full border-0 bg-transparent text-base text-muted-foreground dark:text-neutral-200 outline-none placeholder:text-muted-foreground dark:placeholder:text-neutral-500"
                    />
                  </div>
                )}

                {showCountryMenu && step === "credentials" ? (
                  <div className="absolute left-4 top-[calc(100%-0.25rem)] z-20 mt-3 w-[calc(100%-2rem)] max-w-80 overflow-hidden rounded-3xl border border-[#e7e7e7] dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-[0_24px_60px_rgba(16,24,40,0.18)] dark:shadow-none">
                    <div className="border-b border-[#efefef] dark:border-neutral-800 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#a0a0a0] dark:text-neutral-500">
                        {t("selectCountryCode")}
                      </p>
                      <p className="mt-1 text-base text-[#5d5d5d] dark:text-neutral-400">
                        {t("chooseCountryAndDialCode")}
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2">
                      {COUNTRY_OPTIONS.map((country: CountryOption) => (
                        <button
                          key={`${country.name}-${country.dialCode}`}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country);
                            setShowCountryMenu(false);
                          }}
                          className={[
                            "focus-ring flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors",
                            selectedCountry.dialCode === country.dialCode &&
                            selectedCountry.name === country.name
                              ? "bg-[#fff4f8] dark:bg-pink-950/20 text-primary dark:text-pink-400"
                              : "text-foreground dark:text-neutral-300 hover:bg-[#fafafa] dark:hover:bg-neutral-800",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            <CountryFlag
                              countryCode={country.flagCode}
                              name={country.name}
                            />
                            <div className="flex flex-col">
                              <span className="text-base font-medium">
                                {country.name}
                              </span>
                              <span className="text-xs text-muted-foreground dark:text-neutral-500">
                                {country.dialCode}
                              </span>
                            </div>
                          </div>
                          {selectedCountry.dialCode === country.dialCode &&
                          selectedCountry.name === country.name ? (
                            <Check size={18} className="text-primary dark:text-pink-400" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Always visible rather than hidden behind a "Have a referral
                  code?" toggle: the placeholder already says it is optional, so
                  the toggle only cost a click for the people who did have a
                  code and hid the feature from everyone else. Credentials step
                  only — the code is read when the OTP is requested, so an input
                  on the OTP step would silently do nothing. */}
              {step === "credentials" ? (
                <div className="rounded-2xl border border-[#dcdcdc] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] dark:shadow-none sm:px-5">
                  <div className="flex items-center gap-3 px-1">
                    <Gift size={18} className="text-muted-foreground dark:text-neutral-500" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(event) => setReferralCode(event.target.value)}
                      placeholder={t("referralCodeOptional")}
                      className="w-full border-0 bg-transparent text-base text-muted-foreground dark:text-neutral-200 outline-none placeholder:text-muted-foreground dark:placeholder:text-neutral-500"
                    />
                  </div>
                </div>
              ) : null}

              {step === "credentials" ? (
                <button
                  type="button"
                  onClick={() => sendOtp()}
                  disabled={isSendingOtp}
                  className="focus-ring mt-1 flex h-14 w-full items-center justify-center rounded-4xl bg-linear-to-r from-[#d9357b] to-[#ff65b4] text-xl font-bold text-white shadow-[0_12px_28px_rgba(217,53,123,0.32)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSendingOtp ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={18} className="animate-spin" />
                      {t("sendingOtp")}
                    </span>
                  ) : (
                    t("sendOtp")
                  )}
                </button>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={backToCredentials}
                    className="focus-ring mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-4xl border border-[#e1e1e1] dark:border-neutral-800 bg-white dark:bg-neutral-900 text-base font-semibold text-foreground dark:text-neutral-300 transition-colors hover:bg-[#fafafa] dark:hover:bg-neutral-800"
                  >
                    <ArrowLeft size={18} />
                    {t("changeDetails")}
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyOtp()}
                    disabled={isVerifyingOtp}
                    className="focus-ring mt-1 inline-flex h-14 items-center justify-center rounded-4xl bg-linear-to-r from-[#d9357b] to-[#ff65b4] text-xl font-bold text-white shadow-[0_12px_28px_rgba(217,53,123,0.32)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isVerifyingOtp ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle size={18} className="animate-spin" />
                        {t("verifyingOtp")}
                      </span>
                    ) : (
                      t("verifyOtp")
                    )}
                  </button>
                </div>
              )}

              {step === "otp" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={isResendingOtp}
                    className="focus-ring inline-flex items-center gap-2 rounded-sm text-base font-medium text-primary dark:text-pink-400 transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isResendingOtp ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle size={16} className="animate-spin" />
                        {t("resendingOtp")}
                      </span>
                    ) : (
                      t("resendOtp")
                    )}
                  </button>
                  {/* Composed in JSX rather than interpolated: t() takes a
                      single key and has no placeholder support. Phone sends
                      name SMS so the user knows where to look; email has no
                      channel. */}
                  <p className="text-sm text-muted-foreground dark:text-neutral-400">
                    {loginIdentifier?.contactNumber
                      ? t("otpSentViaSms")
                      : t("otpSentTo")}{" "}
                    {loginIdentifier?.email ?? loginIdentifier?.contactNumber}
                  </p>
                </div>
              ) : null}

              {/* Social sign-in. Credentials step only — once a code has been
                  requested the user is mid-flow, and offering another way to
                  start over is noise. Shown on both tabs, because the provider
                  has nothing to do with which identifier was typed. */}
              {step === "credentials" ? (
                /* Capped at 400px because that is Google's hard maximum for a
                   button it renders — pass more and it silently clamps. Capping
                   the whole group instead of just the button keeps the divider
                   aligned with it, so the inset reads as a deliberate grouping
                   rather than a mistake. Below 400px everything is full width
                   and this does nothing. */
                <div className="mx-auto w-full max-w-[400px] pt-2">
                  <div className="flex items-center gap-4">
                    <span className="h-px flex-1 bg-[#e3e3e3] dark:bg-neutral-800" />
                    <span className="text-sm font-medium text-muted-foreground dark:text-neutral-400">
                      {t("orWith")}
                    </span>
                    <span className="h-px flex-1 bg-[#e3e3e3] dark:bg-neutral-800" />
                  </div>
                  <div className="mt-5 space-y-3">
                    {/* Google draws its own button — see GoogleSignInButton for
                        why a custom one cannot obtain an ID token. */}
                    <GoogleSignInButton
                      clientId={googleOAuthClientId}
                      locale={lang}
                      theme={theme === "dark" ? "dark" : "light"}
                      label={t("continueWithGoogle")}
                      onCredential={handleGoogleCredential}
                      onUnavailable={reportSocialUnavailable}
                    />
                    {/* Facebook sign-in — TEMPORARILY DISABLED on request.
                        Nothing was deleted: `SocialButton`, `FacebookMark`, and
                        the `startFacebookLogin` / `socialProviderInFlight`
                        bindings from `useLoginFlow` are all still imported, so
                        restoring is just removing these two markers.

                    <SocialButton
                      onClick={startFacebookLogin}
                      label={t("continueWithFacebook")}
                      icon={<FacebookMark size={18} />}
                      busy={socialProviderInFlight === "FACEBOOK"}
                    />
                    */}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowLanguageModal(true)}
                  className="focus-ring inline-flex items-center gap-2 rounded-full bg-[#f5f5f5] dark:bg-neutral-800 px-5 py-3 text-base font-medium text-muted-foreground dark:text-neutral-350 shadow-[0_1px_0_rgba(0,0,0,0.02)] dark:shadow-none"
                >
                  <Globe size={18} />
                  {lang === "pt" ? "Português" : "English"}
                  <ChevronDown size={16} />
                </button>
              </div>

              <p className="pt-6 text-center text-base leading-7 text-muted-foreground dark:text-neutral-400">
                {t("byContinuingAgree")}
              </p>
              <p className="-mt-1 text-center text-base font-semibold leading-7 text-primary dark:text-pink-400">
                <Link href="/terms" className="transition-opacity hover:opacity-80">
                  {t("termsOfService")}
                </Link>
                <span className="text-muted-foreground"> &amp; </span>
                <Link href="/privacy" className="transition-opacity hover:opacity-80">
                  {t("privacyPolicy")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {showLanguageModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-140 rounded-[28px] bg-white dark:bg-neutral-900 border border-transparent dark:border-neutral-800 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] dark:shadow-none sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-2xl font-extrabold tracking-[-0.03em] text-[#252525] dark:text-neutral-50">
                {t("selectLanguage")}
              </h3>
              <button
                type="button"
                onClick={() => setShowLanguageModal(false)}
                className="focus-ring rounded-full p-1 text-foreground dark:text-neutral-400 transition-colors hover:bg-black/5 dark:hover:bg-neutral-850"
                aria-label="Close language modal"
              >
                <CircleX size={34} strokeWidth={1.8} />
              </button>
            </div>
            <div className="my-6 h-px w-full bg-[#e7e7e7] dark:bg-neutral-800" />
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setLang("en");
                  setShowLanguageModal(false);
                }}
                className={[
                  "focus-ring flex w-full items-center justify-between rounded-3xl border px-5 py-5 text-left transition-all",
                  lang === "en"
                    ? "border-primary dark:border-primary bg-[#fff4f8] dark:bg-primary/10"
                    : "border-[#f0f0f0] dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-950",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <span className="text-display leading-none">🇬🇧</span>
                  <span className="text-2xl font-semibold tracking-[-0.02em] text-foreground dark:text-neutral-200">
                    {t("english")}
                  </span>
                </div>
                {lang === "en" ? (
                  <Check size={28} className="text-primary dark:text-pink-400" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLang("pt");
                  setShowLanguageModal(false);
                }}
                className={[
                  "focus-ring flex w-full items-center justify-between rounded-3xl border px-5 py-5 text-left transition-all",
                  lang === "pt"
                    ? "border-primary dark:border-primary bg-[#fff4f8] dark:bg-primary/10"
                    : "border-[#f0f0f0] dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-950",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <span className="text-display leading-none">🇵🇹</span>
                  <span className="text-2xl font-semibold tracking-[-0.02em] text-foreground dark:text-neutral-200">
                    {t("portugues")}
                  </span>
                </div>
                {lang === "pt" ? (
                  <Check size={28} className="text-primary dark:text-pink-400" />
                ) : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Device limit modal */}
      <ClearSessionModal
        open={showDeviceLimitModal}
        onOpenChange={setShowDeviceLimitModal}
        onRemove={clearSessionAndRetry}
        t={t}
      />
    </main>
  );
}
